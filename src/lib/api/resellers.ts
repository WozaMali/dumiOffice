import { supabase } from "@/lib/supabase";
import type {
  PriceTier,
  ProductTierPrice,
  ResellerAccount,
  ResellerAccountStatus,
} from "@/types/database";

export const RESELLERS_SETUP_HINT =
  "Run docs/SUPABASE_RESELLERS_AND_STOCK_PRICES.sql in the Supabase SQL Editor, then refresh this page.";

function isMissingResellerTables(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const combined = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
  if (err?.code === "PGRST205" || err?.code === "42P01") return true;
  if (combined.includes("could not find") && combined.includes("schema cache")) return true;
  if (
    combined.includes("relation") &&
    combined.includes("does not exist") &&
    (combined.includes("reseller_accounts") ||
      combined.includes("price_tiers") ||
      combined.includes("product_tier_prices"))
  ) {
    return true;
  }
  return false;
}

function assertResellerTables(error: unknown): void {
  if (isMissingResellerTables(error)) {
    throw new Error(RESELLERS_SETUP_HINT);
  }
}

export type ResellerUpsertInput = {
  id?: string;
  customer_id?: string | null;
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  address_line?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  status: ResellerAccountStatus;
  price_tier_id?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  moq_units?: number | null;
  notes?: string | null;
};

export type ProductTierPriceUpsertInput = {
  product_id: string;
  tier_id: string;
  price_30ml?: number | null;
  price_50ml?: number | null;
  price_100ml?: number | null;
  price_200ml?: number | null;
  unit_price?: number | null;
};

function trimOrNull(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

export const resellersApi = {
  async listTiers(): Promise<PriceTier[]> {
    const { data, error } = await supabase
      .from("price_tiers")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return (data ?? []) as PriceTier[];
  },

  async listAccounts(): Promise<ResellerAccount[]> {
    const { data, error } = await supabase
      .from("reseller_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return (data ?? []) as ResellerAccount[];
  },

  async upsertAccount(input: ResellerUpsertInput): Promise<ResellerAccount> {
    const payload = {
      customer_id: input.customer_id ?? null,
      business_name: input.business_name.trim(),
      contact_name: trimOrNull(input.contact_name),
      email: trimOrNull(input.email),
      phone: trimOrNull(input.phone),
      vat_number: trimOrNull(input.vat_number),
      address_line: trimOrNull(input.address_line),
      city: trimOrNull(input.city),
      province: trimOrNull(input.province),
      postal_code: trimOrNull(input.postal_code),
      status: input.status,
      price_tier_id: input.price_tier_id ?? null,
      payment_terms: trimOrNull(input.payment_terms) ?? "COD",
      credit_limit: input.credit_limit ?? null,
      moq_units: input.moq_units ?? null,
      notes: trimOrNull(input.notes),
    };

    if (!payload.business_name) {
      throw new Error("Business name is required.");
    }

    const query = input.id
      ? supabase
          .from("reseller_accounts")
          .update(payload)
          .eq("id", input.id)
          .select("*")
          .single()
      : supabase.from("reseller_accounts").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return data as ResellerAccount;
  },

  async setAccountStatus(
    id: string,
    status: ResellerAccountStatus,
  ): Promise<ResellerAccount> {
    const { data, error } = await supabase
      .from("reseller_accounts")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return data as ResellerAccount;
  },

  async listTierPrices(tierId?: string): Promise<ProductTierPrice[]> {
    let query = supabase.from("product_tier_prices").select("*");
    if (tierId) query = query.eq("tier_id", tierId);

    const { data, error } = await query;
    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return (data ?? []) as ProductTierPrice[];
  },

  async upsertTierPrice(input: ProductTierPriceUpsertInput): Promise<ProductTierPrice> {
    const payload = {
      product_id: input.product_id,
      tier_id: input.tier_id,
      price_30ml: input.price_30ml ?? null,
      price_50ml: input.price_50ml ?? null,
      price_100ml: input.price_100ml ?? null,
      price_200ml: input.price_200ml ?? null,
      unit_price: input.unit_price ?? null,
    };

    const { data, error } = await supabase
      .from("product_tier_prices")
      .upsert(payload, { onConflict: "product_id,tier_id" })
      .select("*")
      .single();

    if (error) {
      assertResellerTables(error);
      throw error;
    }
    return data as ProductTierPrice;
  },

  async resolveTierPrice(
    productId: string,
    tierCode: string,
    sizeMl?: number | null,
  ): Promise<number | null> {
    const { data, error } = await supabase.rpc("resolve_tier_price", {
      p_product_id: productId,
      p_tier_code: tierCode,
      p_size_ml: sizeMl ?? null,
    });

    if (error) {
      assertResellerTables(error);
      throw error;
    }
    if (data == null) return null;
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  },
};
