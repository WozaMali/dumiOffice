import { supabase } from "@/lib/supabase";
import type { DiscountCoupon, DiscountCouponType } from "@/types/database";

export const DISCOUNT_COUPONS_SETUP_HINT =
  "Run docs/SUPABASE_DISCOUNT_COUPONS.sql in the Supabase SQL Editor, then refresh this page.";

function isMissingCouponTables(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const combined = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
  if (err?.code === "PGRST205" || err?.code === "42P01") return true;
  if (combined.includes("could not find") && combined.includes("schema cache")) return true;
  if (
    combined.includes("relation") &&
    combined.includes("does not exist") &&
    (combined.includes("discount_coupons") || combined.includes("discount_coupon"))
  ) {
    return true;
  }
  return false;
}

function assertCouponTables(error: unknown): void {
  if (isMissingCouponTables(error)) {
    throw new Error(DISCOUNT_COUPONS_SETUP_HINT);
  }
}

export type DiscountCouponUpsertInput = {
  id?: string;
  code: string;
  label: string | null;
  discount_type: DiscountCouponType;
  discount_value: number;
  min_subtotal: number;
  max_discount: number | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_client_limit: number | null;
};

export const discountCouponsApi = {
  async list(): Promise<DiscountCoupon[]> {
    const { data, error } = await supabase
      .from("discount_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      assertCouponTables(error);
      throw error;
    }
    return (data ?? []) as DiscountCoupon[];
  },

  async upsert(input: DiscountCouponUpsertInput): Promise<DiscountCoupon> {
    const payload = {
      code: input.code.trim().toUpperCase(),
      label: input.label?.trim() ? input.label.trim() : null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_subtotal: input.min_subtotal,
      max_discount: input.max_discount,
      is_active: input.is_active,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      usage_limit: input.usage_limit,
      per_client_limit: input.per_client_limit,
    };

    const query = input.id
      ? supabase
          .from("discount_coupons")
          .update(payload)
          .eq("id", input.id)
          .select("*")
          .single()
      : supabase.from("discount_coupons").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) {
      assertCouponTables(error);
      throw error;
    }
    return data as DiscountCoupon;
  },

  async setActive(id: string, is_active: boolean): Promise<DiscountCoupon> {
    const { data, error } = await supabase
      .from("discount_coupons")
      .update({ is_active })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      assertCouponTables(error);
      throw error;
    }
    return data as DiscountCoupon;
  },
};
