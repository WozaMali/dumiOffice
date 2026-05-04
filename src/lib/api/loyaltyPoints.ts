import { supabase } from "@/lib/supabase";
import type { LoyaltyPointTransaction } from "@/types/database";

/** R2.00 spent = 1 point (matches SQL loyalty_points_for_spend_zar). */
export function pointsForSpendZar(amountZar: number): number {
  if (!Number.isFinite(amountZar) || amountZar <= 0) return 0;
  return Math.max(0, Math.floor(amountZar / 2));
}

export const loyaltyPointsApi = {
  async listByCustomerId(customerId: string): Promise<LoyaltyPointTransaction[]> {
    const { data, error } = await supabase
      .from("loyalty_point_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as LoyaltyPointTransaction[];
  },

  async applyPoints(params: {
    customerId: string;
    pointsDelta: number;
    reason: string;
    orderId?: string | null;
    createdBy?: string | null;
    reference?: string | null;
  }): Promise<void> {
    const { error } = await supabase.rpc("loyalty_apply_points", {
      p_customer_id: params.customerId,
      p_points_delta: params.pointsDelta,
      p_reason: params.reason,
      p_order_id: params.orderId ?? null,
      p_created_by: params.createdBy ?? null,
      p_reference: params.reference ?? null,
    });
    if (error) throw error;
  },
};
