import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/database";

export const productsApi = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("product_name");

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getBySku(sku: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("sku", sku)
      .single();

    if (error) throw error;
    return data;
  },

  async create(product: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStock(id: string, quantity: number): Promise<void> {
    const { error } = await supabase
      .from("products")
      .update({
        stock_on_hand: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },
};
