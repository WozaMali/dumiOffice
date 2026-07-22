import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { productsApi } from "@/lib/api/products";
import { resellersApi } from "@/lib/api/resellers";
import { generateStockPriceListPdf } from "@/lib/utils/stock-price-pdf";
import type {
  PriceTier,
  Product,
  ProductTierPrice,
  ResellerAccount,
  ResellerAccountStatus,
} from "@/types/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  Download,
  Handshake,
  PauseCircle,
  Pencil,
  Plus,
  Tags,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type AccountForm = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  vat_number: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  status: ResellerAccountStatus;
  price_tier_id: string;
  payment_terms: string;
  credit_limit: string;
  moq_units: string;
  notes: string;
};

const emptyAccountForm = (): AccountForm => ({
  business_name: "",
  contact_name: "",
  email: "",
  phone: "",
  vat_number: "",
  address_line: "",
  city: "",
  province: "",
  postal_code: "",
  status: "pending",
  price_tier_id: "",
  payment_terms: "COD",
  credit_limit: "",
  moq_units: "",
  notes: "",
});

function formFromAccount(a: ResellerAccount): AccountForm {
  return {
    business_name: a.business_name,
    contact_name: a.contact_name ?? "",
    email: a.email ?? "",
    phone: a.phone ?? "",
    vat_number: a.vat_number ?? "",
    address_line: a.address_line ?? "",
    city: a.city ?? "",
    province: a.province ?? "",
    postal_code: a.postal_code ?? "",
    status: a.status,
    price_tier_id: a.price_tier_id ?? "",
    payment_terms: a.payment_terms ?? "COD",
    credit_limit: a.credit_limit == null ? "" : String(a.credit_limit),
    moq_units: a.moq_units == null ? "" : String(a.moq_units),
    notes: a.notes ?? "",
  };
}

function parseOptionalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function statusBadge(status: ResellerAccountStatus) {
  if (status === "approved") return "default" as const;
  if (status === "suspended") return "destructive" as const;
  return "secondary" as const;
}

function productLabel(p: Product) {
  return (p.name || p.product_name || p.sku || "Product").trim();
}

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `R${Number(n).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const Resellers = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"accounts" | "prices">("accounts");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ResellerAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyAccountForm);
  const [priceTierId, setPriceTierId] = useState<string>("");
  const [priceSearch, setPriceSearch] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, { price_30ml: string; price_50ml: string; price_100ml: string; price_200ml: string }>
  >({});

  const {
    data: tiers = [],
    error: tiersError,
    isLoading: tiersLoading,
  } = useQuery<PriceTier[]>({
    queryKey: ["priceTiers"],
    queryFn: () => resellersApi.listTiers(),
  });

  const {
    data: accounts = [],
    error: accountsError,
    isLoading: accountsLoading,
  } = useQuery<ResellerAccount[]>({
    queryKey: ["resellerAccounts"],
    queryFn: () => resellersApi.listAccounts(),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  const stockTier = useMemo(
    () => tiers.filter((t) => t.code !== "retail"),
    [tiers],
  );

  const activePriceTierId = priceTierId || stockTier[0]?.id || "";

  const { data: tierPrices = [], isLoading: pricesLoading } = useQuery<ProductTierPrice[]>({
    queryKey: ["productTierPrices", activePriceTierId],
    enabled: Boolean(activePriceTierId),
    queryFn: () => resellersApi.listTierPrices(activePriceTierId),
  });

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const priceByProductId = useMemo(
    () => new Map(tierPrices.map((r) => [r.product_id, r])),
    [tierPrices],
  );

  const metrics = useMemo(() => {
    const approved = accounts.filter((a) => a.status === "approved").length;
    const pending = accounts.filter((a) => a.status === "pending").length;
    const suspended = accounts.filter((a) => a.status === "suspended").length;
    return {
      total: accounts.length,
      approved,
      pending,
      suspended,
      tiers: stockTier.length,
    };
  }, [accounts, stockTier.length]);

  const filteredProducts = useMemo(() => {
    const q = priceSearch.trim().toLowerCase();
    const list = products.slice().sort((a, b) => productLabel(a).localeCompare(productLabel(b)));
    if (!q) return list;
    return list.filter((p) => {
      const hay = `${productLabel(p)} ${p.sku} ${p.product_category} ${p.item || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, priceSearch]);

  const draftFor = (productId: string) => {
    const existing = priceDrafts[productId];
    if (existing) return existing;
    const row = priceByProductId.get(productId);
    return {
      price_30ml: row?.price_30ml == null ? "" : String(row.price_30ml),
      price_50ml: row?.price_50ml == null ? "" : String(row.price_50ml),
      price_100ml: row?.price_100ml == null ? "" : String(row.price_100ml),
      price_200ml: row?.price_200ml == null ? "" : String(row.price_200ml),
    };
  };

  const saveAccountMutation = useMutation({
    mutationFn: async () => {
      const credit = parseOptionalNumber(form.credit_limit);
      const moq = parseOptionalNumber(form.moq_units);
      if (form.credit_limit.trim() && credit == null) throw new Error("Invalid credit limit.");
      if (form.moq_units.trim() && (moq == null || !Number.isInteger(moq) || moq <= 0)) {
        throw new Error("MOQ must be a positive whole number.");
      }
      return resellersApi.upsertAccount({
        id: editing?.id,
        business_name: form.business_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        vat_number: form.vat_number,
        address_line: form.address_line,
        city: form.city,
        province: form.province,
        postal_code: form.postal_code,
        status: form.status,
        price_tier_id: form.price_tier_id || null,
        payment_terms: form.payment_terms,
        credit_limit: credit,
        moq_units: moq,
        notes: form.notes,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Reseller updated." : "Reseller created.");
      queryClient.invalidateQueries({ queryKey: ["resellerAccounts"] });
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyAccountForm());
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save reseller.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ResellerAccountStatus }) =>
      resellersApi.setAccountStatus(id, status),
    onSuccess: (row) => {
      toast.success(`Status set to ${row.status}.`);
      queryClient.invalidateQueries({ queryKey: ["resellerAccounts"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    },
  });

  const savePriceMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!activePriceTierId) throw new Error("Select a price tier first.");
      const d = draftFor(productId);
      return resellersApi.upsertTierPrice({
        product_id: productId,
        tier_id: activePriceTierId,
        price_30ml: parseOptionalNumber(d.price_30ml),
        price_50ml: parseOptionalNumber(d.price_50ml),
        price_100ml: parseOptionalNumber(d.price_100ml),
        price_200ml: parseOptionalNumber(d.price_200ml),
      });
    },
    onSuccess: () => {
      toast.success("Stock price saved.");
      queryClient.invalidateQueries({ queryKey: ["productTierPrices", activePriceTierId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save price.");
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      const tier = tiers.find((t) => t.id === activePriceTierId);
      if (!tier) throw new Error("Select a trade tier to export.");
      await generateStockPriceListPdf({
        products,
        tier,
        tierPrices,
      });
    },
    onSuccess: () => toast.success("Stock price list PDF downloaded."),
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "PDF export failed.");
    },
  });

  const openCreate = () => {
    setEditing(null);
    const stock = stockTier.find((t) => t.code === "stock") ?? stockTier[0];
    setForm({ ...emptyAccountForm(), price_tier_id: stock?.id ?? "" });
    setEditorOpen(true);
  };

  const openEdit = (a: ResellerAccount) => {
    setEditing(a);
    setForm(formFromAccount(a));
    setEditorOpen(true);
  };

  const setupError =
    (tiersError as Error | null)?.message ||
    (accountsError as Error | null)?.message ||
    null;

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="Trade partners"
        title="Resellers and stock pricing."
        description="Onboard approved resellers, assign trade tiers, and maintain the stock price book used for wholesale quotes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTab("prices")}>
              Price book
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> New reseller
            </Button>
          </div>
        }
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Shared SQL</p>
            <p className="text-lg leading-7 text-foreground">
              Run <span className="font-medium">SUPABASE_RESELLERS_AND_STOCK_PRICES.sql</span> once,
              then manage accounts and tier prices here.
            </p>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-4">
        <StatCard title="Resellers" value={`${metrics.total}`} icon={Handshake} index={0} />
        <StatCard title="Approved" value={`${metrics.approved}`} icon={BadgeCheck} index={1} />
        <StatCard title="Pending" value={`${metrics.pending}`} icon={Building2} index={2} />
        <StatCard title="Trade tiers" value={`${metrics.tiers}`} icon={Tags} index={3} />
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          variant={tab === "accounts" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("accounts")}
        >
          Accounts
        </Button>
        <Button
          variant={tab === "prices" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("prices")}
        >
          Stock prices
        </Button>
      </div>

      {setupError ? (
        <div className="data-shell px-6 py-10 text-center text-sm text-muted-foreground">
          {setupError}
        </div>
      ) : tab === "accounts" ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-shell"
        >
          <div className="section-header px-6 py-5">
            <div>
              <h2 className="section-title">Reseller accounts</h2>
              <p className="section-copy">
                Approve partners, set payment terms, and assign Stock or Key Account pricing.
              </p>
            </div>
          </div>

          {tiersLoading || accountsLoading ? (
            <div className="px-6 py-10 text-center text-[11px] text-muted-foreground">
              Loading resellers…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    {[
                      "Business",
                      "Contact",
                      "Tier",
                      "Terms",
                      "Status",
                      "Credit",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        No resellers yet. Click “New reseller”.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((a) => {
                      const tier = a.price_tier_id ? tierById.get(a.price_tier_id) : null;
                      return (
                        <tr key={a.id} className="border-b border-border/20">
                          <td className="px-6 py-4">
                            <div className="font-medium">{a.business_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[a.city, a.province].filter(Boolean).join(", ") || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div>{a.contact_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.email || a.phone || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">{tier?.name || "Default stock"}</td>
                          <td className="px-6 py-4 text-sm">{a.payment_terms || "COD"}</td>
                          <td className="px-6 py-4">
                            <Badge variant={statusBadge(a.status)}>{a.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-sm">{money(a.credit_limit)}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                              </Button>
                              {a.status !== "approved" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    statusMutation.mutate({ id: a.id, status: "approved" })
                                  }
                                >
                                  Approve
                                </Button>
                              )}
                              {a.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    statusMutation.mutate({ id: a.id, status: "suspended" })
                                  }
                                >
                                  <PauseCircle className="mr-1 h-3.5 w-3.5" /> Suspend
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-shell"
        >
          <div className="section-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-title">Stock price book</h2>
              <p className="section-copy">
                Set explicit trade prices per size. Blank cells use retail minus the tier default
                discount.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px]">
                <Label className="mb-1 block text-xs">Tier</Label>
                <Select
                  value={activePriceTierId}
                  onValueChange={(v) => {
                    setPriceTierId(v);
                    setPriceDrafts({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockTier.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.default_discount_percent}% fallback)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Label className="mb-1 block text-xs">Search</Label>
                <Input
                  value={priceSearch}
                  onChange={(e) => setPriceSearch(e.target.value)}
                  placeholder="Name, SKU, category…"
                />
              </div>
              <Button
                variant="outline"
                disabled={!activePriceTierId || exportPdfMutation.isPending}
                onClick={() => exportPdfMutation.mutate()}
              >
                <Download className="mr-1 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>

          {!activePriceTierId ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No trade tiers found. Run the reseller SQL first.
            </div>
          ) : pricesLoading ? (
            <div className="px-6 py-10 text-center text-[11px] text-muted-foreground">
              Loading prices…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Product", "SKU", "Retail 50ml", "30ml", "50ml", "100ml", "200ml", ""].map(
                      (h) => (
                        <th
                          key={h || "actions"}
                          className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const d = draftFor(p.id);
                    return (
                      <tr key={p.id} className="border-b border-border/20">
                        <td className="px-4 py-3 text-sm font-medium">{productLabel(p)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-3 text-sm">{money(p.price_50ml ?? p.base_price ?? p.price)}</td>
                        {(
                          [
                            ["price_30ml", d.price_30ml],
                            ["price_50ml", d.price_50ml],
                            ["price_100ml", d.price_100ml],
                            ["price_200ml", d.price_200ml],
                          ] as const
                        ).map(([key, value]) => (
                          <td key={key} className="px-2 py-2">
                            <Input
                              className="h-8 w-[96px]"
                              value={value}
                              onChange={(e) =>
                                setPriceDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: { ...draftFor(p.id), [key]: e.target.value },
                                }))
                              }
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savePriceMutation.isPending}
                            onClick={() => savePriceMutation.mutate(p.id)}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reseller" : "New reseller"}</DialogTitle>
            <DialogDescription>
              Capture trade partner details and assign a price tier for stock pricing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Business name</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contact name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>VAT number</Label>
              <Input
                value={form.vat_number}
                onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Payment terms</Label>
              <Input
                value={form.payment_terms}
                onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address_line}
                onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <Label>Province</Label>
              <Input
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              />
            </div>
            <div>
              <Label>Postal code</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as ResellerAccountStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price tier</Label>
              <Select
                value={form.price_tier_id || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, price_tier_id: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (stock)</SelectItem>
                  {stockTier.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit limit (R)</Label>
              <Input
                value={form.credit_limit}
                onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
              />
            </div>
            <div>
              <Label>MOQ (units)</Label>
              <Input
                value={form.moq_units}
                onChange={(e) => setForm((f) => ({ ...f, moq_units: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saveAccountMutation.isPending}
              onClick={() => saveAccountMutation.mutate()}
            >
              {editing ? "Save changes" : "Create reseller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Resellers;
