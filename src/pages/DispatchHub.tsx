import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/api/orders";
import { dispatchApi } from "@/lib/api/dispatch";
import { generateShippingLabels, printLabels, sendShipmentUpdateEmail } from "@/lib/utils/bulk-actions";
import type { Order } from "@/types/database";
import { Mail, PackageCheck, Printer, Search, Truck } from "lucide-react";
import { toast } from "sonner";

const DispatchHub = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "needs-shipment" | "ready" | "completed">("all");
  const [shipmentForm, setShipmentForm] = useState({
    orderId: "",
    courier: "",
    trackingNumber: "",
    trackingUrl: "",
  });

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Order> }) => ordersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update shipment details.");
    },
  });

  const markShippedMutation = useMutation({
    mutationFn: (id: string) => ordersApi.updateStatus(id, "Shipped", "In Progress", "Dispatch Hub"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order marked as shipped.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to mark order as shipped.");
    },
  });

  const dispatchQueue = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        const hasShipment = !!o.courier && !!o.tracking_number;
        const isCompleted =
          o.stage === "Completed" ||
          o.status === "Delivered" ||
          o.status === "Cancelled" ||
          o.status === "Returned";

        if (view === "all") return true;
        if (view === "needs-shipment") return !hasShipment && !isCompleted;
        if (view === "ready") return hasShipment && !isCompleted;
        if (view === "completed") return isCompleted;
        return true;
      })
      .filter((o) => {
        if (!term) return true;
        return (
          o.customer_name.toLowerCase().includes(term) ||
          o.reference.toLowerCase().includes(term) ||
          o.id.toLowerCase().includes(term) ||
          (o.customer_email || "").toLowerCase().includes(term) ||
          (o.courier || "").toLowerCase().includes(term) ||
          (o.tracking_number || "").toLowerCase().includes(term)
        );
      });
  }, [orders, search, view]);

  const pendingShipment = dispatchQueue.filter((o) => !o.courier || !o.tracking_number).length;
  const readyToNotify = dispatchQueue.filter((o) => o.courier && o.tracking_number).length;

  const { data: dispatchEventsByOrder = {} } = useQuery({
    queryKey: ["dispatchEvents", dispatchQueue.map((o) => o.id).join(",")],
    queryFn: async () => {
      try {
        return await dispatchApi.listEventsByOrderIds(dispatchQueue.map((o) => o.id));
      } catch {
        return {};
      }
    },
    enabled: dispatchQueue.length > 0,
  });

  const eventLabel = (eventType: string) => {
    if (eventType === "shipment_saved") return "Shipment saved";
    if (eventType === "marked_shipped") return "Marked shipped";
    if (eventType === "email_sent") return "Email sent";
    if (eventType === "email_draft_opened") return "Email draft opened";
    return eventType;
  };

  const getDurationLabel = (fromIso: string, toIso: string) => {
    const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "0m";
    const totalMinutes = Math.round(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getOrderDurations = (orderId: string) => {
    const events = dispatchEventsByOrder[orderId] || [];
    const byType = [...events].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const shipmentSaved = byType.find((e) => e.event_type === "shipment_saved");
    const firstEmail = byType.find(
      (e) => e.event_type === "email_sent" || e.event_type === "email_draft_opened",
    );
    const markedShipped = byType.find((e) => e.event_type === "marked_shipped");

    return {
      saveToEmail:
        shipmentSaved && firstEmail
          ? getDurationLabel(shipmentSaved.created_at, firstEmail.created_at)
          : null,
      saveToShipped:
        shipmentSaved && markedShipped
          ? getDurationLabel(shipmentSaved.created_at, markedShipped.created_at)
          : null,
    };
  };

  const openShipmentPanel = (order: Order) => {
    setShipmentForm({
      orderId: order.id,
      courier: order.courier || "",
      trackingNumber: order.tracking_number || "",
      trackingUrl: order.tracking_url || "",
    });
    setShipmentOpen(true);
  };

  const handleSaveShipment = async (sendEmail: boolean) => {
    if (!shipmentForm.orderId) return;
    if (!shipmentForm.courier.trim()) {
      toast.error("Courier is required.");
      return;
    }
    if (!shipmentForm.trackingNumber.trim()) {
      toast.error("Tracking number is required.");
      return;
    }

    try {
      const updated = await updateOrderMutation.mutateAsync({
        id: shipmentForm.orderId,
        updates: {
          courier: shipmentForm.courier.trim(),
          tracking_number: shipmentForm.trackingNumber.trim(),
          tracking_url: shipmentForm.trackingUrl.trim() || undefined,
        },
      });

      if (sendEmail) {
        const result = await sendShipmentUpdateEmail(updated);
        if (!result.ok) {
          toast.error("Customer email is missing for this order.");
          return;
        }
        try {
          await dispatchApi.logEvent({
            orderId: updated.id,
            eventType: result.mode === "server" ? "email_sent" : "email_draft_opened",
            payload: {
              courier: updated.courier,
              tracking_number: updated.tracking_number,
            },
          });
        } catch {
          // non-blocking
        }
        toast.success(
          result.mode === "server"
            ? "Shipment saved and email sent."
            : "Shipment saved. Email draft opened.",
        );
      } else {
        toast.success("Shipment details saved.");
      }
      try {
        await dispatchApi.logEvent({
          orderId: updated.id,
          eventType: "shipment_saved",
          payload: {
            courier: updated.courier,
            tracking_number: updated.tracking_number,
            tracking_url: updated.tracking_url,
          },
        });
      } catch {
        // non-blocking
      }
      setShipmentOpen(false);
    } catch {
      // handled by mutation
    }
  };

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="Dispatch"
        title="Dispatch Hub for premium fulfilment."
        description="Capture courier details, print luxury labels, and send tracking updates with one clear flow."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              const html = generateShippingLabels(dispatchQueue);
              printLabels(html);
              toast.success(`Prepared ${dispatchQueue.length} labels.`);
            }}
          >
            <Printer className="h-4 w-4" />
            Print all labels
          </Button>
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Pending shipment details</p>
              <p className="mt-2 text-3xl font-display font-semibold text-foreground">{pendingShipment}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Ready to notify</p>
              <p className="mt-2 text-3xl font-display font-semibold text-foreground">{readyToNotify}</p>
            </div>
          </div>
        }
      />

      <div className="toolbar-panel mb-6">
        <div className="segmented-tabs text-xs">
          <button type="button" className={`segmented-tab ${view === "all" ? "segmented-tab-active" : ""}`} onClick={() => setView("all")}>
            All
          </button>
          <button type="button" className={`segmented-tab ${view === "needs-shipment" ? "segmented-tab-active" : ""}`} onClick={() => setView("needs-shipment")}>
            Needs shipment
          </button>
          <button type="button" className={`segmented-tab ${view === "ready" ? "segmented-tab-active" : ""}`} onClick={() => setView("ready")}>
            Ready to notify
          </button>
          <button type="button" className={`segmented-tab ${view === "completed" ? "segmented-tab-active" : ""}`} onClick={() => setView("completed")}>
            Completed
          </button>
        </div>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
          <Input
            type="text"
            placeholder="Search by customer, reference, courier or tracking..."
            className="w-full pl-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {isLoading && <div className="text-sm text-muted-foreground">Loading dispatch queue...</div>}
        {!isLoading && dispatchQueue.length === 0 && (
          <div className="editorial-panel text-sm text-muted-foreground">
            No orders found for this dispatch view.
          </div>
        )}
        {dispatchQueue.map((order) => {
          const hasShipment = !!order.courier && !!order.tracking_number;
          return (
            <div key={order.id} className="editorial-panel space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="luxury-note">{order.reference}</p>
                  <h3 className="text-lg font-semibold text-foreground">{order.customer_name}</h3>
                  <p className="text-xs text-muted-foreground">{order.customer_email || "No customer email"}</p>
                </div>
                <span className={hasShipment ? "status-pill-success" : "status-pill-gold"}>
                  {hasShipment ? "Ready" : "Needs shipment"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-muted-foreground">Courier</p>
                  <p className="mt-1 text-foreground">{order.courier || "Not set"}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-muted-foreground">Tracking</p>
                  <p className="mt-1 text-foreground font-mono">{order.tracking_number || "Not set"}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {(order as any).shipping_address || order.customer_address || "No delivery address captured."}
              </p>

              {!!dispatchEventsByOrder[order.id]?.length && (
                <div className="rounded-md border border-border/60 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Dispatch timeline</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const d = getOrderDurations(order.id);
                      return (
                        <>
                          {d.saveToEmail && (
                            <span className="status-pill-muted text-[10px]">Save &gt; Email: {d.saveToEmail}</span>
                          )}
                          {d.saveToShipped && (
                            <span className="status-pill-muted text-[10px]">Save &gt; Shipped: {d.saveToShipped}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    {dispatchEventsByOrder[order.id].slice(0, 3).map((event) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{eventLabel(event.event_type)}</span>
                          {event.created_by && (
                            <span className="status-pill-muted text-[10px]">{event.created_by}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setTimelineOrderId(order.id);
                        setTimelineOpen(true);
                      }}
                    >
                      View full timeline
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openShipmentPanel(order)}>
                  <Truck className="h-4 w-4" />
                  Shipment & Notify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const html = generateShippingLabels([order]);
                    printLabels(html);
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Print label
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!hasShipment) {
                      toast.error("Add courier and tracking first.");
                      return;
                    }
                    markShippedMutation.mutate(order.id, {
                      onSuccess: async () => {
                        try {
                          await dispatchApi.logEvent({
                            orderId: order.id,
                            eventType: "marked_shipped",
                            payload: {
                              courier: order.courier,
                              tracking_number: order.tracking_number,
                            },
                          });
                        } catch {
                          // non-blocking
                        }
                      },
                    });
                  }}
                >
                  <PackageCheck className="h-4 w-4" />
                  Mark shipped
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!hasShipment) {
                      toast.error("Add courier and tracking first.");
                      return;
                    }
                    sendShipmentUpdateEmail(order).then((result) => {
                      if (!result.ok) {
                        toast.error("Customer email is missing.");
                        return;
                      }
                      dispatchApi
                        .logEvent({
                          orderId: order.id,
                          eventType:
                            result.mode === "server"
                              ? "email_sent"
                              : "email_draft_opened",
                          payload: {
                            courier: order.courier,
                            tracking_number: order.tracking_number,
                          },
                        })
                        .catch(() => undefined);
                      if (result.mode === "server") {
                        toast.success("Shipment update email sent.");
                      } else {
                        toast.success("Email draft opened.");
                      }
                    });
                  }}
                >
                  <Mail className="h-4 w-4" />
                  Email update
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={shipmentOpen} onOpenChange={setShipmentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Shipment update</DialogTitle>
            <DialogDescription>
              Paste courier + tracking details, then save or email the customer instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dispatch-courier">Courier</Label>
              <Input
                id="dispatch-courier"
                value={shipmentForm.courier}
                onChange={(e) => setShipmentForm((prev) => ({ ...prev, courier: e.target.value }))}
                placeholder="e.g. The Courier Guy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispatch-tracking">Tracking number</Label>
              <Input
                id="dispatch-tracking"
                value={shipmentForm.trackingNumber}
                onChange={(e) => setShipmentForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                placeholder="Paste waybill / tracking code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispatch-tracking-url">Tracking link (optional)</Label>
              <Input
                id="dispatch-tracking-url"
                value={shipmentForm.trackingUrl}
                onChange={(e) => setShipmentForm((prev) => ({ ...prev, trackingUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipmentOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSaveShipment(false)} disabled={updateOrderMutation.isPending}>
              Save shipment
            </Button>
            <Button onClick={() => handleSaveShipment(true)} disabled={updateOrderMutation.isPending}>
              <Mail className="h-4 w-4" />
              Save & email customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={timelineOpen}
        onOpenChange={(open) => {
          setTimelineOpen(open);
          if (!open) setTimelineOrderId(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispatch timeline</DialogTitle>
            <DialogDescription>
              Full event history for {timelineOrderId || "selected order"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(timelineOrderId && dispatchEventsByOrder[timelineOrderId]?.length
              ? dispatchEventsByOrder[timelineOrderId]
              : []
            ).map((event) => (
              <div
                key={event.id}
                className="rounded-md border border-border/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {eventLabel(event.event_type)}
                    </span>
                    {event.created_by && (
                      <span className="status-pill-muted text-[10px]">
                        {event.created_by}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                {!!event.payload &&
                  Object.keys(event.payload).length > 0 && (
                    <pre className="mt-2 overflow-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
{JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
              </div>
            ))}
            {timelineOrderId &&
              (!dispatchEventsByOrder[timelineOrderId] ||
                dispatchEventsByOrder[timelineOrderId].length === 0) && (
                <p className="text-sm text-muted-foreground">No timeline events found for this order.</p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DispatchHub;

