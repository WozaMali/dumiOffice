import { supabase } from "@/lib/supabase";
import { customersApi } from "@/lib/api/customers";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export interface StoreClient {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  member_since_year: number;
  created_at: string;
  updated_at: string;
}

export interface StoreClientAddressRow {
  id: string;
  client_id: string;
  label: string;
  line1: string;
  suburb: string | null;
  province: string | null;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

export interface StoreClientPreference {
  id: string;
  client_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  consent_version: string;
  created_at: string;
  updated_at: string;
}

interface SaveConsentInput {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  consentVersion?: string;
}

export interface SaveAddressInput {
  label?: string;
  line1: string;
  suburb?: string;
  province?: string;
  city: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

let lastOfficeSyncToastAt = 0;

function notifyOfficeSyncFailure(err: unknown) {
  console.error("Office CRM sync failed", err);
  const now = Date.now();
  if (now - lastOfficeSyncToastAt < 5000) return;
  lastOfficeSyncToastAt = now;
  toast.message(
    "Saved on the shop. If Office /clients did not update: run docs/SUPABASE_CRM_SYNC_FROM_STORE_RPC.sql (recommended), or docs/SUPABASE_STOREFRONT_CUSTOMERS_SYNC_RLS.sql.",
  );
}

/** Push storefront row into `public.customers` for the Office app; safe to fire after each write. */
async function syncOfficeCustomersAfterStorefrontWrite(clientId: string): Promise<void> {
  try {
    await customersApi.syncFromStorefrontStoreClientId(clientId);
  } catch (e) {
    notifyOfficeSyncFailure(e);
  }
}

const toProfileName = (userMetaName?: unknown, fallbackEmail?: string): string => {
  if (typeof userMetaName === "string" && userMetaName.trim()) {
    return userMetaName.trim();
  }
  if (fallbackEmail?.trim()) {
    return fallbackEmail.split("@")[0];
  }
  return "Guest";
};

function phoneFromUserMetadata(meta: Record<string, unknown>): string | null {
  const raw = meta.phone ?? meta.phone_number;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

async function upsertStoreClientFromAuthUser(user: User): Promise<StoreClient> {
  const email = user.email?.trim();
  if (!email) throw new Error("Authenticated account has no email.");

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const fullName = toProfileName(meta.full_name ?? meta.name, email);
  const phone = phoneFromUserMetadata(meta);

  const { data: row, error } = await supabase
    .from("store_clients")
    .upsert(
      {
        auth_user_id: user.id,
        email,
        full_name: fullName,
        phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return row as StoreClient;
}

export const storefrontApi = {
  /**
   * Mirrors Supabase Auth profile (full_name, phone in user_metadata) into `store_clients`
   * and then into Office `customers`. Call after `auth.updateUser` so /clients stays in sync.
   */
  async applyAuthUserToStoreAndOffice(user: User): Promise<StoreClient> {
    const row = await upsertStoreClientFromAuthUser(user);
    await syncOfficeCustomersAfterStorefrontWrite(row.id);
    return row;
  },

  async getOrCreateClientFromSession(): Promise<StoreClient> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("Please sign in before saving checkout details.");
    }
    return storefrontApi.applyAuthUserToStoreAndOffice(data.user);
  },

  async countOrdersForClient(clientId: string): Promise<number> {
    const { count, error } = await supabase
      .from("store_orders")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    if (error) throw error;
    return count ?? 0;
  },

  async updateClient(clientId: string, updates: { full_name?: string; phone?: string }): Promise<void> {
    const { error } = await supabase
      .from("store_clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    if (error) throw error;
    await syncOfficeCustomersAfterStorefrontWrite(clientId);
  },

  async getClientConsent(clientId: string): Promise<StoreClientPreference | null> {
    const { data, error } = await supabase
      .from("store_client_preferences")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) throw error;
    return (data as StoreClientPreference | null) ?? null;
  },

  async saveClientConsent(clientId: string, input: SaveConsentInput): Promise<void> {
    const { error } = await supabase.from("store_client_preferences").upsert(
      {
        client_id: clientId,
        email_notifications: input.emailNotifications,
        sms_notifications: input.smsNotifications,
        marketing_emails: input.marketingEmails,
        terms_accepted_at: input.termsAcceptedAt,
        privacy_accepted_at: input.privacyAcceptedAt,
        consent_version: input.consentVersion ?? "v1",
      },
      { onConflict: "client_id" },
    );
    if (error) throw error;
    await syncOfficeCustomersAfterStorefrontWrite(clientId);
  },

  async listAddresses(clientId: string): Promise<StoreClientAddressRow[]> {
    const { data, error } = await supabase
      .from("store_client_addresses")
      .select("*")
      .eq("client_id", clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as StoreClientAddressRow[]) ?? [];
  },

  async saveAddress(clientId: string, input: SaveAddressInput): Promise<void> {
    if (input.isDefault) {
      const { error: clearDefaultError } = await supabase
        .from("store_client_addresses")
        .update({ is_default: false })
        .eq("client_id", clientId)
        .eq("is_default", true);
      if (clearDefaultError) throw clearDefaultError;
    }

    const { error } = await supabase.from("store_client_addresses").insert({
      client_id: clientId,
      label: input.label ?? "Home",
      line1: input.line1,
      suburb: input.suburb?.trim() || null,
      province: input.province?.trim() || null,
      city: input.city,
      postal_code: input.postalCode,
      country: input.country ?? "South Africa",
      is_default: input.isDefault ?? true,
    });
    if (error) throw error;
    await syncOfficeCustomersAfterStorefrontWrite(clientId);
  },

  async deleteAddress(clientId: string, addressId: string): Promise<void> {
    const { error } = await supabase
      .from("store_client_addresses")
      .delete()
      .eq("id", addressId)
      .eq("client_id", clientId);
    if (error) throw error;
    await syncOfficeCustomersAfterStorefrontWrite(clientId);
  },
};
