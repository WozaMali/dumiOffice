import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { Search, Plus, Users, Filter, Link2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { customersApi, addressesApi, type OfficeClientListDisplayRow } from "@/lib/api/customers";
import { loyaltyPointsApi } from "@/lib/api/loyaltyPoints";
import type { Customer, CustomerChannel, CustomerType } from "@/types/database";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type ClientChannelTab = "All" | "Online" | "Walk-In / Pop-Up" | "Wholesale";

const resolveChannel = (customer: Customer): CustomerChannel => {
  if (customer.client_channel) return customer.client_channel;
  if (customer.customer_type === "wholesale") return "Wholesale";
  return "Online";
};

/** CRM row + storefront overlay for list / Order link (see office_client_list_display RPC). */
type ClientViewRow = Customer & {
  displayName: string;
  displayPhone: string;
  addressSummary: string;
};

const Clients = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: customers = [], isLoading, error } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });

  const { data: officeDisplay = [] } = useQuery<OfficeClientListDisplayRow[]>({
    queryKey: ["customers", "officeDisplay"],
    queryFn: customersApi.fetchOfficeListDisplay,
    // Always refresh so /clients immediately reflects updated storefront profile
    // (names/phones/addresses) for all clients.
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const [channelTab, setChannelTab] = useState<ClientChannelTab>("All");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: loyaltyHistory = [] } = useQuery({
    queryKey: ["loyaltyPointTransactions", selectedCustomer?.id],
    queryFn: () => loyaltyPointsApi.listByCustomerId(selectedCustomer!.id),
    enabled: !!selectedCustomer,
  });
  const [createOpen, setCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerType: "retail" as CustomerType,
    clientChannel: "Online" as CustomerChannel,
    marketingConsent: true,
    smsConsent: false,
    emailConsent: true,
    adminNotes: "",
    streetAddress: "",
    complex: "",
    suburb: "",
    city: "",
    province: "",
    postalCode: "",
  });

  const handleCreateChange = (field: keyof typeof createForm, value: string | boolean) => {
    setCreateForm((prev) => ({ ...prev, [field]: value } as typeof createForm));
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      await customersApi.delete(id);
    },
    onSuccess: () => {
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers", "officeDisplay"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete client");
    },
  });

  const displayById = useMemo(() => {
    const m = new Map<string, OfficeClientListDisplayRow>();
    officeDisplay.forEach((r) => m.set(r.customer_id, r));
    return m;
  }, [officeDisplay]);

  const mergedCustomers = useMemo((): ClientViewRow[] => {
    return customers.map((c) => {
      const o = displayById.get(c.id);
      return {
        ...c,
        displayName:
          (o?.display_name && o.display_name.trim()) ||
          (c.customer_name && c.customer_name.trim()) ||
          "—",
        displayPhone:
          (o?.display_phone && o.display_phone.trim()) ||
          (c.customer_phone && c.customer_phone.trim()) ||
          "",
        addressSummary: (o?.address_summary && o.address_summary.trim()) || "",
      };
    });
  }, [customers, displayById]);

  const handleDeleteCustomer = (client: ClientViewRow) => {
    const confirmed = window.confirm(`Delete client "${client.displayName}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteCustomerMutation.mutate(client.id);
  };

  const handleCreateOrderForCustomer = async (client: ClientViewRow) => {
    const channel = resolveChannel(client);
    const params = new URLSearchParams();
    params.set("customerId", client.id);
    params.set("customerName", client.displayName);
    if (client.customer_email) params.set("customerEmail", client.customer_email);
    if (client.displayPhone) params.set("customerPhone", client.displayPhone);
    params.set("clientChannel", channel);

    try {
      const addresses = await addressesApi.listByCustomerId(client.id);
      const addr = addresses.find((a) => a.is_default) ?? addresses[0];
      if (addr) {
        if (addr.address_line) params.set("deliveryLine1", addr.address_line);
        if (addr.suburb) params.set("deliverySuburb", addr.suburb);
        if (addr.city) params.set("deliveryCity", addr.city);
        if (addr.province) params.set("deliveryProvince", addr.province);
        if (addr.postal_code) params.set("deliveryPostal", addr.postal_code);
      }
    } catch (e) {
      console.warn("Could not load CRM addresses for order prefill; run docs/SUPABASE_OFFICE_READ_CRM.sql if this persists.", e);
    }

    navigate(`/orders?${params.toString()}`);
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Customer> = {
        customer_name: createForm.customerName.trim(),
        customer_email: createForm.customerEmail.trim() || undefined,
        customer_phone: createForm.customerPhone.trim() || undefined,
        customer_type: createForm.customerType,
        client_channel: createForm.clientChannel,
        marketing_consent: !!createForm.marketingConsent,
        sms_consent: !!createForm.smsConsent,
        email_consent: !!createForm.emailConsent,
        admin_notes: createForm.adminNotes.trim() || undefined,
      };

      const created = await customersApi.create(payload);

      // Create a default delivery address if provided
      if (
        createForm.streetAddress.trim() &&
        createForm.suburb.trim() &&
        createForm.city.trim() &&
        createForm.province.trim() &&
        createForm.postalCode.trim()
      ) {
        await addressesApi.create({
          customer_id: created.id,
          address_type: "delivery",
          address_line: createForm.streetAddress.trim(),
          suburb: createForm.suburb.trim(),
          city: createForm.city.trim(),
          province: createForm.province.trim(),
          postal_code: createForm.postalCode.trim(),
          is_default: true,
        });
      }

      return created;
    },
    onSuccess: () => {
      toast.success("Client saved");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers", "officeDisplay"] });
      setCreateOpen(false);
      setCreateForm({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        customerType: "retail",
        clientChannel: "Online",
        marketingConsent: true,
        smsConsent: false,
        emailConsent: true,
        adminNotes: "",
        streetAddress: "",
        complex: "",
        suburb: "",
        city: "",
        province: "",
        postalCode: "",
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save client");
    },
  });

  const totals = useMemo(() => {
    const total = mergedCustomers.length;
    let online = 0;
    let walkIn = 0;
    let wholesale = 0;

    mergedCustomers.forEach((c) => {
      const ch = resolveChannel(c);
      if (ch === "Online") online += 1;
      else if (ch === "Wholesale") wholesale += 1;
      else walkIn += 1; // Walk-In or Pop Up
    });

    return { total, online, walkIn, wholesale };
  }, [mergedCustomers]);

  const filteredCustomers = useMemo(() => {
    return mergedCustomers.filter((c) => {
      const channel = resolveChannel(c);

      if (channelTab === "Online" && channel !== "Online") return false;
      if (channelTab === "Wholesale" && channel !== "Wholesale") return false;
      if (channelTab === "Walk-In / Pop-Up" && !(channel === "Walk-In" || channel === "Pop Up")) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        c.displayName.toLowerCase().includes(term) ||
        (c.customer_email && c.customer_email.toLowerCase().includes(term)) ||
        (c.displayPhone && c.displayPhone.toLowerCase().includes(term)) ||
        (c.addressSummary && c.addressSummary.toLowerCase().includes(term))
      );
    });
  }, [mergedCustomers, channelTab, search]);

  const selectedView = useMemo((): ClientViewRow | null => {
    if (!selectedCustomer) return null;
    return mergedCustomers.find((m) => m.id === selectedCustomer.id) ?? null;
  }, [selectedCustomer, mergedCustomers]);

  return (
    <DashboardLayout>
      <div className="ops-workspace">
        <PageHero
          eyebrow="Clients"
          title="Keep a clean, client-ready register."
          description="Track online, walk-in, pop-up, and wholesale relationships in one calm view."
          actions={
            <>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New client
              </Button>
              <Button variant="outline" asChild>
                <a href="/walk-in" target="_blank" rel="noopener noreferrer">
                  <Link2 className="h-4 w-4" />
                  Client self-registration
                </a>
              </Button>
            </>
          }
          aside={
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Active clients</p>
                <p className="mt-2 text-3xl font-display font-semibold text-foreground">{totals.total}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Wholesale</p>
                <p className="mt-2 text-3xl font-display font-semibold text-foreground">{totals.wholesale}</p>
              </div>
            </div>
          }
        />

        {/* Top counters */}
        <div className="mb-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="metric-card">
            <span className="metric-label">Total clients</span>
            <span className="metric-value text-[2.15rem]">{totals.total}</span>
            <span className="metric-note">Across all channels</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Online</span>
            <span className="metric-value text-[2.15rem]">{totals.online}</span>
            <span className="metric-note">Storefront clients</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Walk-in / Pop-up</span>
            <span className="metric-value text-[2.15rem]">{totals.walkIn}</span>
            <span className="metric-note">Boutique & events</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Wholesale</span>
            <span className="metric-value text-[2.15rem]">{totals.wholesale}</span>
            <span className="metric-note">Stockists & partners</span>
          </div>
        </div>

        {/* Channel tabs & search */}
        <div className="toolbar-panel mb-3">
          <div className="segmented-tabs">
            {(["All", "Online", "Walk-In / Pop-Up", "Wholesale"] as ClientChannelTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setChannelTab(tab)}
                className={`segmented-tab ${channelTab === tab ? "segmented-tab-active" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="luxury-note">{filteredCustomers.length} clients</span>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
              <Input
                type="text"
                placeholder="Search clients..."
                className="w-48 pl-10 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground"
            >
              <Filter size={12} />
              Simple view
            </button>
          </div>
        </div>

        {/* Clients table */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="data-shell">
          {isLoading && (
            <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">Loading clients…</div>
          )}
          {error && (
            <div className="px-4 py-6 text-center text-[11px] text-rose-400">
              Failed to load clients. Check your Supabase connection.
            </div>
          )}
          {!isLoading && !error && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  {[
                    "Client",
                    "Channel",
                    "Type",
                    "Phone",
                    "Address",
                    "Email",
                    "Points",
                    "First order",
                    "Last order",
                    "Lifetime value",
                    "Orders",
                    "Actions",
                  ].map(
                    (h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="text-muted-foreground" />
                        <p className="text-sm text-foreground">No clients found</p>
                        <p className="text-[11px] text-muted-foreground">
                          {mergedCustomers.length === 0 ? "Capture your first client to get started" : "Try adjusting your filters"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((client, i) => {
                    const ch = resolveChannel(client);
                    return (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.03 * i }}
                        className="border-b border-border/40 transition-colors hover:bg-background/40"
                      >
                        <td className="px-4 py-3 text-[11px] text-foreground">
                          <div className="flex flex-col">
                            <span className="font-semibold">{client.displayName}</span>
                            {client.admin_notes && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                                {client.admin_notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{ch}</td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">
                          {client.customer_type === "wholesale"
                            ? "Wholesale"
                            : client.customer_type === "vip"
                              ? "VIP"
                              : "Retail"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{client.displayPhone || "—"}</td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-[200px]">
                          <span className="line-clamp-2" title={client.addressSummary || undefined}>
                            {client.addressSummary || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-[220px] truncate">
                          {client.customer_email || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-medium text-foreground">
                          {typeof client.loyalty_points === "number" ? client.loyalty_points : 0}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">
                          {client.first_order_date || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">
                          {client.last_order_date || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-foreground">
                          {typeof client.lifetime_value === "number" ? `R${client.lifetime_value.toFixed(2)}` : "R0.00"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">
                          {typeof client.total_orders === "number" ? client.total_orders : 0}
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-emerald-300 underline"
                              onClick={() => setSelectedCustomer(client)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="text-primary underline"
                              onClick={() => void handleCreateOrderForCustomer(client)}
                            >
                              Order
                            </button>
                            <button
                              type="button"
                              className="text-rose-300 underline"
                              onClick={() => handleDeleteCustomer(client)}
                              disabled={deleteCustomerMutation.isPending}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* View client dialog */}
        <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
          {selectedCustomer && (
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedView?.displayName ?? selectedCustomer.customer_name}</DialogTitle>
                <DialogDescription>Shop and CRM fields combined when available.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Channel</p>
                    <p className="text-foreground mt-1">{resolveChannel(selectedCustomer)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Client type</p>
                    <p className="text-foreground mt-1">
                      {selectedCustomer.customer_type === "wholesale"
                        ? "Wholesale"
                        : selectedCustomer.customer_type === "vip"
                          ? "VIP"
                          : "Retail"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Email</p>
                    <p className="text-foreground mt-1">{selectedCustomer.customer_email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Phone</p>
                    <p className="text-foreground mt-1">
                      {selectedView?.displayPhone || selectedCustomer.customer_phone || "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Delivery (shop / CRM)</p>
                  <p className="text-foreground mt-1 whitespace-pre-wrap">
                    {selectedView?.addressSummary?.trim() || "—"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">First order</p>
                    <p className="text-foreground mt-1">{selectedCustomer.first_order_date || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Last order</p>
                    <p className="text-foreground mt-1">{selectedCustomer.last_order_date || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Total orders</p>
                    <p className="text-foreground mt-1">
                      {typeof selectedCustomer.total_orders === "number" ? selectedCustomer.total_orders : 0}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Lifetime value</p>
                    <p className="text-foreground mt-1">
                      {typeof selectedCustomer.lifetime_value === "number"
                        ? `R${selectedCustomer.lifetime_value.toFixed(2)}`
                        : "R0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Loyalty points</p>
                    <p className="text-foreground mt-1">
                      {typeof selectedCustomer.loyalty_points === "number" ? selectedCustomer.loyalty_points : 0}
                      <span className="block text-[11px] text-muted-foreground mt-1">
                        R2.00 spent = 1 point (awarded when a paid order is marked Delivered).
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Marketing consent</p>
                    <p className="text-foreground mt-1">
                      {selectedCustomer.marketing_consent ? "Opted in" : "No consent"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Points history</p>
                  {loyaltyHistory.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No loyalty transactions yet.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border/60">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-border/60 text-left text-muted-foreground">
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2">Δ</th>
                            <th className="px-2 py-2">Balance</th>
                            <th className="px-2 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loyaltyHistory.map((row) => (
                            <tr key={row.id} className="border-b border-border/40">
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                                {new Date(row.created_at).toLocaleString()}
                              </td>
                              <td className={`px-2 py-1.5 font-medium ${row.points_delta >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
                                {row.points_delta >= 0 ? `+${row.points_delta}` : row.points_delta}
                              </td>
                              <td className="px-2 py-1.5 text-foreground">{row.balance_after}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">
                                {row.reason}
                                {row.order_id ? ` · ${row.order_id.slice(0, 8)}…` : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {selectedCustomer.admin_notes && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Admin notes</p>
                    <p className="text-foreground bg-muted/30 p-2 rounded">{selectedCustomer.admin_notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Create client dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
              <DialogDescription>Capture a new online, walk-in, pop-up, or wholesale client.</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4 text-sm mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!createForm.customerName.trim()) {
                  toast.error("Client name is required");
                  return;
                }
                createCustomerMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client name *</Label>
                  <Input
                    id="clientName"
                    value={createForm.customerName}
                    onChange={(e) => handleCreateChange("customerName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientType">Client type</Label>
                  <select
                    id="clientType"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={createForm.customerType}
                    onChange={(e) => handleCreateChange("customerType", e.target.value as CustomerType)}
                  >
                    <option value="retail">Retail</option>
                    <option value="vip">VIP</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={createForm.customerEmail}
                    onChange={(e) => handleCreateChange("customerEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone</Label>
                  <Input
                    id="clientPhone"
                    value={createForm.customerPhone}
                    onChange={(e) => handleCreateChange("customerPhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientChannel">Channel</Label>
                  <select
                    id="clientChannel"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={createForm.clientChannel}
                    onChange={(e) => handleCreateChange("clientChannel", e.target.value as CustomerChannel)}
                  >
                    <option value="Online">Online Orders</option>
                    <option value="Walk-In">Walk-In</option>
                    <option value="Pop Up">Pop Up</option>
                    <option value="Wholesale">Wholesale</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Delivery address *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="streetAddress" className="text-xs">
                      Street address
                    </Label>
                    <Input
                      id="streetAddress"
                      value={createForm.streetAddress}
                      onChange={(e) => handleCreateChange("streetAddress", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="complex" className="text-xs">
                      Complex / Building / Estate (optional)
                    </Label>
                    <Input
                      id="complex"
                      value={createForm.complex}
                      onChange={(e) => handleCreateChange("complex", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="suburb" className="text-xs">
                      Suburb
                    </Label>
                    <Input
                      id="suburb"
                      value={createForm.suburb}
                      onChange={(e) => handleCreateChange("suburb", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-xs">
                      City
                    </Label>
                    <Input
                      id="city"
                      value={createForm.city}
                      onChange={(e) => handleCreateChange("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="province" className="text-xs">
                      Province
                    </Label>
                    <Input
                      id="province"
                      value={createForm.province}
                      onChange={(e) => handleCreateChange("province", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="postalCode" className="text-xs">
                      Postal code
                    </Label>
                    <Input
                      id="postalCode"
                      value={createForm.postalCode}
                      onChange={(e) => handleCreateChange("postalCode", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Notes</Label>
                <Input
                  id="adminNotes"
                  placeholder="Fragrance preferences, sensitivities, VIP context…"
                  value={createForm.adminNotes}
                  onChange={(e) => handleCreateChange("adminNotes", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mt-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.marketingConsent}
                    onChange={(e) => handleCreateChange("marketingConsent", e.target.checked)}
                  />
                  <span>Marketing consent</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.smsConsent}
                    onChange={(e) => handleCreateChange("smsConsent", e.target.checked)}
                  />
                  <span>SMS</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.emailConsent}
                    onChange={(e) => handleCreateChange("emailConsent", e.target.checked)}
                  />
                  <span>Email</span>
                </label>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending ? "Saving…" : "Save client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Clients;

