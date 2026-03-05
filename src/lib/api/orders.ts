import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, OrderStatusHistory } from "@/types/database";

export const ordersApi = {
  async list(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(order: Partial<Order>): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Order>): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(
    id: string,
    status: Order["status"],
    stage: Order["stage"],
    changedBy?: string,
    notes?: string,
  ): Promise<void> {
    const order = await this.getById(id);
    if (!order) throw new Error("Order not found");

    await this.update(id, { status, stage });

    await supabase.from("order_status_history").insert({
      order_id: id,
      from_status: order.status,
      to_status: status,
      from_stage: order.stage,
      to_stage: stage,
      changed_by: changedBy,
      notes,
    });
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  },
};

export const orderItemsApi = {
  async listByOrderId(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (error) throw error;
    return data ?? [];
  },

  async create(item: Partial<OrderItem>): Promise<OrderItem> {
    const { data, error } = await supabase
      .from("order_items")
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async bulkCreate(items: Partial<OrderItem>[]): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from("order_items")
      .insert(items)
      .select();

    if (error) throw error;
    return data ?? [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("order_items").delete().eq("id", id);
    if (error) throw error;
  },
};

export const orderHistoryApi = {
  async listByOrderId(orderId: string): Promise<OrderStatusHistory[]> {
    const { data, error } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },
};
