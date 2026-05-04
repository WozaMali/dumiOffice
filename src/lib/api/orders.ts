import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, OrderStatusHistory } from "@/types/database";
import type { Product } from "@/types/database";

function extractUuidFromWebRef(value?: string | null): string | null {
  if (!value) return null;
  const m = value.trim().match(/^WEB-([a-f0-9]{32})$/i);
  if (!m) return null;
  const hex = m[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function resolveStoreOrderIdForOfficeOrder(order: Order): Promise<string | null> {
  const orderId = order.id?.trim();
  if (!orderId) return null;

  const { data: mapRow } = await supabase
    .from("store_office_order_map")
    .select("store_order_id")
    .eq("office_order_id", orderId)
    .maybeSingle();
  let storeOrderId = (mapRow as { store_order_id?: string } | null)?.store_order_id ?? null;
  if (storeOrderId) return storeOrderId;

  storeOrderId = extractUuidFromWebRef(order.reference) ?? extractUuidFromWebRef(order.payment_ref);
  if (storeOrderId) return storeOrderId;

  const email = (order.customer_email || "").trim().toLowerCase();
  if (!email) return null;

  const officeTotal = Number(order.grand_total || 0);
  const officeCreatedMs = new Date(String((order as unknown as { created_at?: string }).created_at || order.date || "")).getTime();
  const { data: guessedOrders } = await supabase
    .from("store_orders")
    .select("id, total_amount, created_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(25);
  const candidates =
    (guessedOrders as Array<{ id?: string; total_amount?: number; created_at?: string }> | null) ?? [];
  const best = candidates
    .map((c) => ({
      c,
      amountDiff: Math.abs(Number(c.total_amount || 0) - officeTotal),
      timeDiff: Number.isFinite(officeCreatedMs)
        ? Math.abs(new Date(c.created_at || "").getTime() - officeCreatedMs)
        : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.amountDiff - b.amountDiff || a.timeDiff - b.timeDiff)[0]?.c;
  return best?.id ?? null;
}

async function adjustProductStockWithMovement(options: {
  productId: string;
  delta: number;
  orderId?: string;
  source: string;
  reason: string;
  reference?: string;
  createdBy?: string;
}): Promise<void> {
  const { productId, delta, orderId, source, reason, reference, createdBy } = options;
  if (!productId || !Number.isFinite(delta) || delta === 0) return;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select<"*", Product>("*")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw productError || new Error("Product not found");
  }

  const stockBefore = Number(product.stock_on_hand ?? 0);
  const stockAfter = stockBefore + delta;
  if (stockAfter < 0) {
    throw new Error(`Stock level cannot go below zero for product ${productId}`);
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({
      stock_on_hand: stockAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (updateError) throw updateError;

  const { error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: productId,
      order_id: orderId,
      source,
      reason,
      quantity_delta: delta,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reference,
      created_by: createdBy,
    });
  if (movementError) throw movementError;
}

async function getOrderInventoryNetDelta(orderId: string): Promise<number> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("quantity_delta")
    .eq("order_id", orderId)
    .eq("source", "order");
  if (error) throw error;
  return ((data as Array<{ quantity_delta?: number }> | null) ?? []).reduce(
    (sum, row) => sum + Number(row.quantity_delta || 0),
    0,
  );
}

async function resolveInventoryProductIdFromOrderItem(item: Pick<OrderItem, "product_id" | "sku" | "product_name">): Promise<string | null> {
  const rawProductId = (item.product_id || "").trim();
  if (rawProductId) {
    const { data: byId } = await supabase
      .from("products")
      .select("id")
      .eq("id", rawProductId)
      .maybeSingle();
    const id = (byId as { id?: string } | null)?.id;
    if (id) return id;
  }

  const rawSku = (item.sku || "").trim();
  if (rawSku) {
    const { data: bySkuOrCode } = await supabase
      .from("products")
      .select("id")
      .or(`sku.eq.${rawSku},code.eq.${rawSku}`)
      .limit(1)
      .maybeSingle();
    const id = (bySkuOrCode as { id?: string } | null)?.id;
    if (id) return id;
  }

  const rawName = (item.product_name || "").trim();
  if (rawName) {
    const { data: byName } = await supabase
      .from("products")
      .select("id")
      .ilike("product_name", rawName)
      .limit(1)
      .maybeSingle();
    const id = (byName as { id?: string } | null)?.id;
    if (id) return id;
  }

  return null;
}

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

    const stockNetDelta = await getOrderInventoryNetDelta(id);

    const shouldDeductStock =
      (stage === "In Progress" || stage === "Completed") &&
      order.status !== "Cancelled" &&
      order.status !== "Returned" &&
      stockNetDelta >= 0;

    if (shouldDeductStock) {
      const items = await orderItemsApi.listByOrderId(id);
      for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
        const resolvedProductId = await resolveInventoryProductIdFromOrderItem(item);
        if (!resolvedProductId) continue;
        await adjustProductStockWithMovement({
          productId: resolvedProductId,
          delta: -item.quantity,
          orderId: id,
          source: "order",
          reason: `Stock deduction for order ${id}`,
          reference: order.reference || id,
          createdBy: changedBy || "system",
        });
      }
    }

    const shouldRestock =
      (status === "Cancelled" || status === "Returned") &&
      order.status !== "Cancelled" &&
      order.status !== "Returned" &&
      stockNetDelta < 0;

    if (shouldRestock) {
      const items = await orderItemsApi.listByOrderId(id);
      for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
        const resolvedProductId = await resolveInventoryProductIdFromOrderItem(item);
        if (!resolvedProductId) continue;
        await adjustProductStockWithMovement({
          productId: resolvedProductId,
          delta: item.quantity,
          orderId: id,
          source: "order",
          reason: `Restock from ${status.toLowerCase()} order ${id}`,
          reference: order.reference || id,
          createdBy: changedBy || "system",
        });
      }
    }

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
    const order = await this.getById(id);
    if (!order) throw new Error("Order not found");

    const stockNetDelta = await getOrderInventoryNetDelta(id);
    if (stockNetDelta < 0) {
      // Restock products from this order before deleting records.
      const orderItems = await orderItemsApi.listByOrderId(id);
      for (const item of orderItems) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
        const resolvedProductId = await resolveInventoryProductIdFromOrderItem(item);
        if (!resolvedProductId) continue;
        await adjustProductStockWithMovement({
          productId: resolvedProductId,
          delta: item.quantity,
          orderId: id,
          source: "order",
          reason: `Restock from deleted order ${id}`,
          reference: order.reference || id,
          createdBy: "system",
        });
      }
    }

    // Cascade manually to avoid FK/RLS surprises.
    // 1) Delete accounting transactions linked to this order (and their attachments)
    const { data: txData, error: txIdsError } = await supabase
      .from("accounting_transactions")
      .select("id")
      .eq("order_id", id);

    if (txIdsError) throw txIdsError;

    const txIds = (txData ?? []).map((t) => (t as any).id as string);
    if (txIds.length) {
      const { error: attErr } = await supabase
        .from("accounting_attachments")
        .delete()
        .in("transaction_id", txIds);
      if (attErr) throw attErr;
    }

    const { error: txDelErr } = await supabase
      .from("accounting_transactions")
      .delete()
      .eq("order_id", id);
    if (txDelErr) throw txDelErr;

    // 2) Delete items + status history for this order
    const { error: itemsErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", id);
    if (itemsErr) throw itemsErr;

    const { error: historyErr } = await supabase
      .from("order_status_history")
      .delete()
      .eq("order_id", id);
    if (historyErr) throw historyErr;

    // 3) Reverse loyalty points linked to this order (net effect),
    // then let the normal loyalty ledger capture the reversal entry.
    const { data: loyaltyRows, error: loyaltyReadErr } = await supabase
      .from("loyalty_point_transactions")
      .select("customer_id, points_delta")
      .eq("order_id", id);
    if (loyaltyReadErr) throw loyaltyReadErr;

    const byCustomer = new Map<string, number>();
    ((loyaltyRows as Array<{ customer_id?: string; points_delta?: number }> | null) ?? []).forEach((r) => {
      const customerId = (r.customer_id || "").trim();
      if (!customerId) return;
      byCustomer.set(customerId, (byCustomer.get(customerId) ?? 0) + Number(r.points_delta || 0));
    });

    for (const [customerId, netPointsForOrder] of byCustomer.entries()) {
      if (!Number.isFinite(netPointsForOrder) || netPointsForOrder === 0) continue;
      const reversal = -netPointsForOrder;
      const { error: loyaltyReverseErr } = await supabase.rpc("loyalty_apply_points", {
        p_customer_id: customerId,
        p_points_delta: reversal,
        p_reason: "Order deleted: points reversed",
        p_order_id: id,
        p_created_by: "system",
        p_reference: `order-delete:${id}:${customerId}`,
      });
      if (loyaltyReverseErr) throw loyaltyReverseErr;
    }

    // 4) Finally delete the order row
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  },

  async listDisplayItemsForOrder(order: Order): Promise<OrderItem[]> {
    const direct = await orderItemsApi.listByOrderId(order.id);
    if (direct.length > 0) return direct;

    const storeOrderId = await resolveStoreOrderIdForOfficeOrder(order);
    if (!storeOrderId) return [];

    const { data: rows, error } = await supabase
      .from("store_order_items")
      .select("id, product_name, product_id, quantity, unit_price, line_total")
      .eq("order_id", storeOrderId)
      .order("id", { ascending: true });
    if (error) throw error;

    return ((rows as Array<Record<string, unknown>> | null) ?? []).map((r) => ({
      id: String(r.id || ""),
      order_id: storeOrderId,
      product_id: r.product_id ? String(r.product_id) : "",
      product_name: String(r.product_name || "Item"),
      product_category: "Perfume",
      product_type: "",
      sku: r.product_id ? String(r.product_id) : "",
      image_url: "",
      quantity: Number(r.quantity || 0),
      unit_price: Number(r.unit_price || 0),
      discount: 0,
      tax: 0,
      line_total: Number(r.line_total || 0),
      fulfilment_status: "Pending",
      created_at: new Date().toISOString(),
    }));
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
