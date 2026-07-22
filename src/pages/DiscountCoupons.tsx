import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import StatCard from "@/components/StatCard";
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
import { Switch } from "@/components/ui/switch";
import { discountCouponsApi } from "@/lib/api/discountCoupons";
import type { DiscountCoupon, DiscountCouponType } from "@/types/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Percent, Tag, Ticket, ToggleLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CouponForm = {
  code: string;
  label: string;
  discount_type: DiscountCouponType;
  discount_value: string;
  min_subtotal: string;
  max_discount: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  usage_limit: string;
  per_client_limit: string;
};

const emptyForm = (): CouponForm => ({
  code: "",
  label: "",
  discount_type: "percent",
  discount_value: "10",
  min_subtotal: "0",
  max_discount: "",
  is_active: true,
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  per_client_limit: "1",
});

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formFromCoupon(c: DiscountCoupon): CouponForm {
  return {
    code: c.code,
    label: c.label ?? "",
    discount_type: c.discount_type,
    discount_value: String(c.discount_value ?? ""),
    min_subtotal: String(c.min_subtotal ?? 0),
    max_discount: c.max_discount == null ? "" : String(c.max_discount),
    is_active: c.is_active,
    starts_at: toDatetimeLocalValue(c.starts_at),
    ends_at: toDatetimeLocalValue(c.ends_at),
    usage_limit: c.usage_limit == null ? "" : String(c.usage_limit),
    per_client_limit: c.per_client_limit == null ? "" : String(c.per_client_limit),
  };
}

function parseOptionalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const DiscountCoupons = () => {
  const queryClient = useQueryClient();
  const {
    data: coupons = [],
    isLoading,
    error,
  } = useQuery<DiscountCoupon[]>({
    queryKey: ["discountCoupons"],
    queryFn: () => discountCouponsApi.list(),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCoupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const fmtMoney = (amount: number) =>
    `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const formatDiscount = (c: DiscountCoupon) => {
    if (c.discount_type === "percent") {
      const cap = c.max_discount != null ? ` (cap ${fmtMoney(c.max_discount)})` : "";
      return `${c.discount_value}%${cap}`;
    }
    return fmtMoney(c.discount_value);
  };

  const formatUsage = (c: DiscountCoupon) => {
    const used = c.usage_count ?? 0;
    if (c.usage_limit == null) return `${used} / ∞`;
    return `${used} / ${c.usage_limit}`;
  };

  const metrics = useMemo(() => {
    const active = coupons.filter((c) => c.is_active).length;
    const totalUses = coupons.reduce((s, c) => s + (c.usage_count || 0), 0);
    const percentCount = coupons.filter((c) => c.discount_type === "percent").length;
    return {
      total: coupons.length,
      active,
      totalUses,
      percentCount,
    };
  }, [coupons]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const code = form.code.trim().toUpperCase();
      if (!code) throw new Error("Coupon code is required.");

      const discountValue = Number(form.discount_value);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error("Discount value must be greater than 0.");
      }
      if (form.discount_type === "percent" && (discountValue < 1 || discountValue > 100)) {
        throw new Error("Percent discount must be between 1 and 100.");
      }

      const minSubtotal = Number(form.min_subtotal || "0");
      if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
        throw new Error("Minimum subtotal must be 0 or greater.");
      }

      const maxDiscount = parseOptionalNumber(form.max_discount);
      const usageLimit = parseOptionalNumber(form.usage_limit);
      const perClientLimit = parseOptionalNumber(form.per_client_limit);

      if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
        throw new Error("Usage limit must be a positive whole number.");
      }
      if (perClientLimit != null && (!Number.isInteger(perClientLimit) || perClientLimit <= 0)) {
        throw new Error("Per-client limit must be a positive whole number.");
      }

      const startsAt = fromDatetimeLocalValue(form.starts_at);
      const endsAt = fromDatetimeLocalValue(form.ends_at);
      if (form.starts_at.trim() && !startsAt) throw new Error("Invalid start date.");
      if (form.ends_at.trim() && !endsAt) throw new Error("Invalid end date.");
      if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
        throw new Error("Start must be before end.");
      }

      return discountCouponsApi.upsert({
        id: editing?.id,
        code,
        label: form.label.trim() || null,
        discount_type: form.discount_type,
        discount_value: discountValue,
        min_subtotal: minSubtotal,
        max_discount: form.discount_type === "percent" ? maxDiscount : null,
        is_active: form.is_active,
        starts_at: startsAt,
        ends_at: endsAt,
        usage_limit: usageLimit,
        per_client_limit: perClientLimit,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Coupon updated." : "Coupon created.");
      queryClient.invalidateQueries({ queryKey: ["discountCoupons"] });
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyForm());
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to save coupon.";
      toast.error(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      discountCouponsApi.setActive(id, is_active),
    onSuccess: (row) => {
      toast.success(row.is_active ? "Coupon activated." : "Coupon deactivated.");
      queryClient.invalidateQueries({ queryKey: ["discountCoupons"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to update coupon.";
      toast.error(message);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (c: DiscountCoupon) => {
    setEditing(c);
    setForm(formFromCoupon(c));
    setEditorOpen(true);
  };

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="Checkout promos"
        title="Discount coupons for the storefront."
        description="Create and manage codes validated at Checkout. Discount applies to product subtotal only — shipping stays full price."
        actions={<Button onClick={openCreate}>+ New coupon</Button>}
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Shared SQL</p>
            <p className="text-lg leading-7 text-foreground">
              Codes stay private. Shoppers enter a code; Checkout calls{" "}
              <span className="font-medium">validate_discount_coupon</span>.
            </p>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-4">
        <StatCard title="Total coupons" value={`${metrics.total}`} icon={Ticket} index={0} />
        <StatCard title="Active" value={`${metrics.active}`} icon={ToggleLeft} index={1} />
        <StatCard title="Total redemptions" value={`${metrics.totalUses}`} icon={Tag} index={2} />
        <StatCard title="Percent offers" value={`${metrics.percentCount}`} icon={Percent} index={3} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="data-shell"
      >
        <div className="section-header px-6 py-5">
          <div>
            <h2 className="section-title">Coupon ledger</h2>
            <p className="section-copy">
              Toggle active instead of deleting when a code has already been used.
            </p>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="px-6 py-10 text-center text-[11px] text-muted-foreground">
            Loading coupons…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  {["Code", "Label", "Discount", "Min cart", "Usage", "Per client", "Window", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No coupons yet. Click “+ New coupon”.
                    </td>
                  </tr>
                ) : (
                  coupons.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.03 * i }}
                      className="border-b border-border/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-sm font-medium text-foreground">
                        {c.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.label || "—"}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{formatDiscount(c)}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {fmtMoney(c.min_subtotal ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{formatUsage(c)}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {c.per_client_limit ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {c.starts_at || c.ends_at
                          ? `${c.starts_at ? new Date(c.starts_at).toLocaleDateString("en-ZA") : "…"} → ${
                              c.ends_at ? new Date(c.ends_at).toLocaleDateString("en-ZA") : "…"
                            }`
                          : "Always"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={c.is_active ? "status-pill-success" : "status-pill-muted"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={toggleMutation.isPending}
                            onClick={() =>
                              toggleMutation.mutate({ id: c.id, is_active: !c.is_active })
                            }
                          >
                            {c.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription>
              Discount applies to product subtotal only. Default per-client limit is 1 for one-time
              promos.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="WELCOME10"
                  className="font-mono uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Label (optional)</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Welcome 10%"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discount_type: e.target.value as DiscountCouponType,
                    }))
                  }
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (ZAR)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{form.discount_type === "percent" ? "Percent (1–100)" : "Amount (ZAR)"}</Label>
                <Input
                  type="number"
                  min={form.discount_type === "percent" ? 1 : 0.01}
                  max={form.discount_type === "percent" ? 100 : undefined}
                  step={form.discount_type === "percent" ? 1 : 0.01}
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Min product subtotal (ZAR)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.min_subtotal}
                  onChange={(e) => setForm((f) => ({ ...f, min_subtotal: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max discount cap (percent only)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.max_discount}
                  onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))}
                  placeholder="Optional"
                  disabled={form.discount_type !== "percent"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Global usage limit</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.usage_limit}
                  onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Per-client limit</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.per_client_limit}
                  onChange={(e) => setForm((f) => ({ ...f, per_client_limit: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {editing && (
              <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Usage count: <span className="font-medium text-foreground">{editing.usage_count}</span>
                {editing.usage_limit != null ? ` / ${editing.usage_limit}` : " / unlimited"} (read-only)
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Starts at</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends at</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive codes fail validation at checkout.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DiscountCoupons;
