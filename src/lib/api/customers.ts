import { supabase } from "@/lib/supabase";
import type { Customer, Address } from "@/types/database";

/** When RPC is missing or fails softly, use browser + RLS (needs SUPABASE_STOREFRONT_CUSTOMERS_SYNC_RLS.sql). */
async function syncFromStoreClientFallback(clientId: string): Promise<void> {
  const { data: sc, error: scErr } = await supabase
    .from("store_clients")
    .select("email,full_name,phone")
    .eq("id", clientId)
    .maybeSingle();

  if (scErr) throw scErr;
  const email = sc?.email?.trim();
  if (!email) return;

  const customerName = (sc.full_name ?? "").trim() || email.split("@")[0]!;
  const customerPhone = (sc.phone ?? "").trim();

  const { data: pref } = await supabase
    .from("store_client_preferences")
    .select("marketing_emails,sms_notifications,email_notifications")
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: addr } = await supabase
    .from("store_client_addresses")
    .select("line1,suburb,city,province,postal_code")
    .eq("client_id", clientId)
    .eq("is_default", true)
    .maybeSingle();

  const hasCompleteAddress =
    !!addr &&
    !!(addr.line1 as string | null)?.trim() &&
    !!(addr.city as string | null)?.trim() &&
    !!(addr.postal_code as string | null)?.trim();

  await customersApi.syncFromStorefrontWalkIn({
    email,
    customerName,
    customerPhone,
    marketingConsent: pref?.marketing_emails ?? true,
    smsConsent: pref?.sms_notifications ?? false,
    emailConsent: pref?.email_notifications ?? true,
    address: hasCompleteAddress
      ? {
          address_line: String(addr!.line1).trim(),
          suburb: addr?.suburb ? String(addr.suburb).trim() : undefined,
          city: String(addr!.city).trim(),
          province: addr?.province ? String(addr.province).trim() : undefined,
          postal_code: String(addr!.postal_code).trim(),
        }
      : null,
  });
}

export type OfficeClientListDisplayRow = {
  customer_id: string;
  display_name: string | null;
  display_phone: string | null;
  address_summary: string | null;
};

export const customersApi = {
  /** Store + CRM merged row for Clients table (requires docs/SUPABASE_OFFICE_CLIENT_LIST_DISPLAY_RPC.sql). */
  async fetchOfficeListDisplay(): Promise<OfficeClientListDisplayRow[]> {
    const { data, error } = await supabase.rpc("office_client_list_display");
    if (error) {
      console.warn("office_client_list_display:", error.message);
      return [];
    }
    return (data ?? []) as OfficeClientListDisplayRow[];
  },

  async list(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("customer_name");

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getByEmail(email: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("customer_email", email)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  /** Case-insensitive match (storefront auth email vs CRM row). */
  async getByEmailCaseInsensitive(email: string): Promise<Customer | null> {
    const trimmed = email.trim();
    if (!trimmed) return null;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .ilike("customer_email", trimmed)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Read `store_clients` + default address + preferences and upsert `public.customers` (+ default `addresses`).
   * Use after any storefront profile / address / consent save so Office /clients matches My Account.
   */
  /**
   * Prefer DB RPC `sync_crm_from_store_client` (docs/SUPABASE_CRM_SYNC_FROM_STORE_RPC.sql) so sync
   * works even when RLS blocks direct `customers` writes. Falls back to browser updates if RPC is absent.
   */
  async syncFromStorefrontStoreClientId(clientId: string): Promise<void> {
    const { data, error } = await supabase.rpc("sync_crm_from_store_client", {
      p_client_id: clientId,
    });

    if (!error && data && typeof data === "object") {
      const j = data as { ok?: boolean; error?: string };
      if (j.ok === true) return;
      if (j.ok === false) throw new Error(j.error || "CRM sync rejected");
    }

    if (error) {
      const msg = String((error as { message?: string }).message || "");
      const code = String((error as { code?: string }).code || "");
      const rpcMissing =
        code === "PGRST202" ||
        code === "42883" ||
        /could not find the function/i.test(msg) ||
        /function .+ does not exist/i.test(msg) ||
        /schema cache/i.test(msg);
      if (!rpcMissing) {
        console.warn("sync_crm_from_store_client RPC failed; trying table API + RLS", error);
      }
    }

    await syncFromStoreClientFallback(clientId);
  },

  /**
   * Upsert office CRM row from the public walk-in / storefront flow so /clients stays in sync.
   * Requires RLS policies for authenticated shoppers if customers has RLS enabled — see docs/SUPABASE_STOREFRONT_CUSTOMERS_SYNC_RLS.sql
   */
  async syncFromStorefrontWalkIn(params: {
    email: string;
    customerName: string;
    customerPhone: string;
    marketingConsent: boolean;
    smsConsent: boolean;
    emailConsent: boolean;
    address?: {
      address_line: string;
      suburb?: string;
      city: string;
      province?: string;
      postal_code: string;
    } | null;
  }): Promise<void> {
    const emailNorm = params.email.trim().toLowerCase();
    if (!emailNorm || !params.customerName.trim()) return;

    let row = await this.getByEmailCaseInsensitive(emailNorm);
    const payload: Partial<Customer> = {
      customer_name: params.customerName.trim(),
      customer_email: emailNorm,
      customer_phone: params.customerPhone.trim() || undefined,
      marketing_consent: params.marketingConsent,
      sms_consent: params.smsConsent,
      email_consent: params.emailConsent,
      client_channel: "Online",
    };

    if (row) {
      row = await this.update(row.id, payload);
    } else {
      row = await this.create({
        ...payload,
        customer_type: "retail",
        lifetime_value: 0,
        total_orders: 0,
      });
    }

    const customerId = row.id;
    if (!params.address || !customerId) return;

    const { data: existing } = await supabase
      .from("addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("is_default", true)
      .maybeSingle();

    const addr = {
      customer_id: customerId,
      address_type: "delivery",
      address_line: params.address.address_line,
      suburb: params.address.suburb ?? "",
      city: params.address.city,
      province: params.address.province ?? "",
      postal_code: params.address.postal_code,
      country: "South Africa",
      is_default: true,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: addrErr } = await supabase.from("addresses").update(addr).eq("id", existing.id);
      if (addrErr) throw addrErr;
    } else {
      await addressesApi.create(addr);
    }
  },

  async create(customer: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};

export const addressesApi = {
  async update(id: string, updates: Partial<Address>): Promise<Address> {
    const { data, error } = await supabase
      .from("addresses")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listByCustomerId(customerId: string): Promise<Address[]> {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", customerId);

    if (error) throw error;
    return data ?? [];
  },

  async create(address: Partial<Address>): Promise<Address> {
    const { data, error } = await supabase
      .from("addresses")
      .insert(address)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
