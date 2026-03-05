import { supabase } from "@/lib/supabase";
import type { InventoryMovement, Product } from "@/types/database";

export const inventoryApi = {
  async adjustStock(options: {
    productId: string;
    delta: number;
    source: string;
    reason: string;
    reference?: string;
    createdBy?: string;
  }): Promise<InventoryMovement> {
    const { productId, delta, source, reason, reference, createdBy } = options;

    // Fetch current stock
    const { data: product, error: productError } = await supabase
      .from("products")
      .select<"*", Product>("*")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw productError || new Error("Product not found");
    }

    const stockBefore = product.stock_on_hand ?? 0;
    const stockAfter = stockBefore + delta;

    if (stockAfter < 0) {
      throw new Error("Stock level cannot go below zero");
    }

    // Update product stock
    const { error: updateError } = await supabase
      .from("products")
      .update({
        stock_on_hand: stockAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateError) {
      throw updateError;
    }

    // Log movement
    const { data: movement, error: movementError } = await supabase
      .from("inventory_movements")
      .insert({
        product_id: productId,
        source,
        reason,
        quantity_delta: delta,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference,
        created_by: createdBy,
      })
      .select()
      .single();

    if (movementError) {
      throw movementError;
    }

    return movement as InventoryMovement;
  },

  async listMovements(productId: string): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select<"*", InventoryMovement>("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },
};

