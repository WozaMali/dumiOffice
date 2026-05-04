import { supabase } from "@/lib/supabase";
import type { HomeBestseller } from "@/types/database";

export const homeBestsellersApi = {
  async list(): Promise<HomeBestseller[]> {
    const { data, error } = await supabase
      .from("home_bestsellers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as HomeBestseller[];
  },

  async upsert(input: {
    id?: string;
    product_id: string;
    badge_label?: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<HomeBestseller> {
    const payload: Partial<HomeBestseller> = {
      ...input,
    };

    const query = supabase
      .from("home_bestsellers")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    const { data, error } = await query;
    if (error) throw error;
    return data as HomeBestseller;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("home_bestsellers")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

