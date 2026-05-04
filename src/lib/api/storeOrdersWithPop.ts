import { supabase } from "@/lib/supabase";

export type StoreOrderWithPop = {
  id: string;
  created_at: string;
  total_amount: number;
  order_status: string;
  has_pop: boolean;
  pop_url: string | null;
  pop_uploaded_at: string | null;
};

export async function listStoreOrdersWithPop(): Promise<StoreOrderWithPop[]> {
  const { data, error } = await supabase
    .from("store_orders")
    .select(`
      id,
      created_at,
      total_amount,
      order_status,
      store_payment_proofs (
        id,
        public_url,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const proofs = ((row.store_payment_proofs as Array<Record<string, unknown>> | undefined) ?? []).slice();
    proofs.sort(
      (a, b) =>
        +new Date(String(b.created_at || 0)) - +new Date(String(a.created_at || 0)),
    );
    const latest = proofs[0];

    return {
      id: String(row.id || ""),
      created_at: String(row.created_at || ""),
      total_amount: Number(row.total_amount || 0),
      order_status: String(row.order_status || ""),
      has_pop: !!latest,
      pop_url: latest?.public_url ? String(latest.public_url) : null,
      pop_uploaded_at: latest?.created_at ? String(latest.created_at) : null,
    };
  });
}
