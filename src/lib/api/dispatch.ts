import { supabase } from "@/lib/supabase";

type DispatchEventType =
  | "shipment_saved"
  | "marked_shipped"
  | "email_sent"
  | "email_draft_opened";

export interface DispatchEvent {
  id: string;
  order_id: string;
  event_type: DispatchEventType;
  payload: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
}

export const dispatchApi = {
  async logEvent(params: {
    orderId: string;
    eventType: DispatchEventType;
    payload?: Record<string, unknown>;
    createdBy?: string;
  }): Promise<void> {
    const { error } = await supabase.from("dispatch_events").insert({
      order_id: params.orderId,
      event_type: params.eventType,
      payload: params.payload ?? {},
      created_by: params.createdBy ?? "Dispatch Hub",
    });
    if (error) throw error;
  },

  async listEventsByOrderIds(orderIds: string[]): Promise<Record<string, DispatchEvent[]>> {
    if (!orderIds.length) return {};

    const { data, error } = await supabase
      .from("dispatch_events")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const grouped: Record<string, DispatchEvent[]> = {};
    for (const row of (data ?? []) as DispatchEvent[]) {
      if (!grouped[row.order_id]) grouped[row.order_id] = [];
      grouped[row.order_id].push(row);
    }
    return grouped;
  },
};

