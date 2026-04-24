import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Mail, Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { marketingCampaignsApi } from "@/lib/api/marketingCampaigns";
import type { MarketingCampaign, MarketingCampaignStatus } from "@/types/database";
import { useMemo, useState } from "react";

const Marketing = () => {
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["marketingCampaigns"],
    queryFn: () => marketingCampaignsApi.list(),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [form, setForm] = useState<{
    name: string;
    status: MarketingCampaignStatus;
    sent: string;
    openRate: string;
    clickRate: string;
    date: string; // YYYY-MM-DD
    revenueImpact: string;
  }>({
    name: "",
    status: "Draft",
    sent: "0",
    openRate: "",
    clickRate: "",
    date: "",
    revenueImpact: "0",
  });

  const statusColors: Record<MarketingCampaignStatus, string> = {
    Active: "status-pill-success",
    Scheduled: "status-pill-gold",
    Completed: "status-pill-muted",
    Draft: "status-pill-muted",
  };

  const fmtMoney = (amount: number) =>
    `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fmtPercent = (v: number | null) => {
    if (v === null || v === undefined) return "-";
    return `${v.toFixed(0)}%`;
  };

  const metrics = useMemo(() => {
    const count = campaigns.length;
    const avg = (vals: (number | null)[]) => {
      const real = vals.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      if (real.length === 0) return null;
      return real.reduce((s, x) => s + x, 0) / real.length;
    };

    // Compare this month vs last month using campaign_date.
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth();
    const prevYear = new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear();

    const inMonth = (c: MarketingCampaign, m: number, y: number) => {
      if (!c.campaign_date) return false;
      const d = new Date(c.campaign_date);
      return d.getMonth() === m && d.getFullYear() === y;
    };

    const cur = campaigns.filter((c) => inMonth(c, curMonth, curYear));
    const prev = campaigns.filter((c) => inMonth(c, prevMonth, prevYear));

    const curOpen = avg(cur.map((c) => c.open_rate));
    const prevOpen = avg(prev.map((c) => c.open_rate));
    const curClick = avg(cur.map((c) => c.click_rate));
    const prevClick = avg(prev.map((c) => c.click_rate));

    const avgOpen = avg(campaigns.map((c) => c.open_rate));
    const avgClick = avg(campaigns.map((c) => c.click_rate));

    const revenueImpact = campaigns.reduce((s, c) => s + (c.revenue_impact || 0), 0);

    const openChange =
      prevOpen != null && curOpen != null ? curOpen - prevOpen : null;
    const clickChange =
      prevClick != null && curClick != null ? curClick - prevClick : null;

    return {
      count,
      avgOpen,
      avgClick,
      revenueImpact,
      openChange,
      clickChange,
    };
  }, [campaigns]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parseNumberOrNull = (raw: string) => {
        const cleaned = raw.trim().replace(/[^0-9.\-]/g, "");
        if (cleaned === "") return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
      };

      const sent = Number(form.sent || "0") || 0;
      const openRateVal = parseNumberOrNull(form.openRate);
      const clickRateVal = parseNumberOrNull(form.clickRate);
      const revenueImpactVal = Number(form.revenueImpact || "0") || 0;

      return marketingCampaignsApi.upsert({
        id: editing?.id,
        name: form.name.trim(),
        status: form.status,
        sent,
        open_rate: openRateVal,
        click_rate: clickRateVal,
        campaign_date: form.date.trim() === "" ? null : form.date,
        revenue_impact: revenueImpactVal,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Campaign updated." : "Campaign created.");
      queryClient.invalidateQueries({ queryKey: ["marketingCampaigns"] });
      setEditorOpen(false);
      setEditing(null);
      setForm({
        name: "",
        status: "Draft",
        sent: "0",
        openRate: "",
        clickRate: "",
        date: "",
        revenueImpact: "0",
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save campaign.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingCampaignsApi.delete(id),
    onSuccess: () => {
      toast.success("Campaign deleted.");
      queryClient.invalidateQueries({ queryKey: ["marketingCampaigns"] });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete campaign.");
    },
  });

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="Launch Studio"
        title="Collection launches with cinematic polish."
        description="Orchestrate campaign cadence, private previews, and client engagement with the same black, charcoal, and gold language shaping the rest of the house."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                status: "Draft",
                sent: "0",
                openRate: "",
                clickRate: "",
                date: "",
                revenueImpact: "0",
              });
              setEditorOpen(true);
            }}
          >
            + New campaign
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Current posture</p>
            <p className="text-lg leading-7 text-foreground">
              {campaigns.some((c) => c.status === "Active")
                ? "Active campaigns are currently running."
                : "No active campaigns right now. You can schedule drafts or upcoming launches."}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6">
        <StatCard title="Total Campaigns" value={`${metrics.count}`} icon={Mail} index={0} />
        <StatCard
          title="Avg Open Rate"
          value={metrics.avgOpen == null ? "-" : `${metrics.avgOpen.toFixed(0)}%`}
          change={
            metrics.openChange == null
              ? undefined
              : `${metrics.openChange >= 0 ? "+" : ""}${metrics.openChange.toFixed(1)}% vs last month`
          }
          changeType={
            metrics.openChange == null ? "neutral" : metrics.openChange >= 0 ? "positive" : "negative"
          }
          icon={Eye}
          index={1}
        />
        <StatCard
          title="Avg Click Rate"
          value={metrics.avgClick == null ? "-" : `${metrics.avgClick.toFixed(0)}%`}
          change={
            metrics.clickChange == null
              ? undefined
              : `${metrics.clickChange >= 0 ? "+" : ""}${metrics.clickChange.toFixed(1)}% vs last month`
          }
          changeType={
            metrics.clickChange == null ? "neutral" : metrics.clickChange >= 0 ? "positive" : "negative"
          }
          icon={MousePointerClick}
          index={2}
        />
        <StatCard
          title="Revenue Impact"
          value={fmtMoney(metrics.revenueImpact)}
          change="Based on recorded impact"
          changeType="positive"
          icon={TrendingUp}
          index={3}
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="data-shell">
        <div className="section-header px-6 py-5">
          <div>
            <h2 className="section-title">Campaign ledger</h2>
            <p className="section-copy">A premium view of current launches, previews, and completed collection moments.</p>
          </div>
        </div>
        {isLoading ? (
          <div className="px-6 py-10 text-center text-[11px] text-muted-foreground">Loading campaigns…</div>
        ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              {["Campaign", "Status", "Sent", "Open Rate", "Click Rate", "Date"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">{h}</th>
              ))}
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No campaigns yet. Click “+ New campaign”.
                </td>
              </tr>
            ) : (
              campaigns.map((c, i) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 * i }}
                className="border-b border-border/20 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-foreground">{c.name}</td>
                <td className="px-6 py-4">
                  <span className={statusColors[c.status]}>{c.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{c.sent.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-foreground">{fmtPercent(c.open_rate)}</td>
                <td className="px-6 py-4 text-sm text-foreground">{fmtPercent(c.click_rate)}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{c.campaign_date ? c.campaign_date : "-"}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setEditing(c);
                        setForm({
                          name: c.name,
                          status: c.status,
                          sent: String(c.sent ?? 0),
                          openRate: c.open_rate == null ? "" : String(c.open_rate),
                          clickRate: c.click_rate == null ? "" : String(c.click_rate),
                          date: c.campaign_date ?? "",
                          revenueImpact: String(c.revenue_impact ?? 0),
                        });
                        setEditorOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
                        deleteMutation.mutate(c.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </motion.tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </motion.div>

      {/* Campaign editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "Create campaign"}</DialogTitle>
            <DialogDescription>Record launch cadence and tracked metrics.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) {
                toast.error("Campaign name is required.");
                return;
              }
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Valentine's Collection Launch" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MarketingCampaignStatus }))}
                >
                  <option value="Active">Active</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Sent</Label>
                <Input type="number" min={0} value={form.sent} onChange={(e) => setForm((f) => ({ ...f, sent: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Open rate (%)</Label>
                <Input type="number" min={0} step={0.01} value={form.openRate} onChange={(e) => setForm((f) => ({ ...f, openRate: e.target.value }))} placeholder="e.g. 42" />
              </div>
              <div className="space-y-2">
                <Label>Click rate (%)</Label>
                <Input type="number" min={0} step={0.01} value={form.clickRate} onChange={(e) => setForm((f) => ({ ...f, clickRate: e.target.value }))} placeholder="e.g. 12" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Revenue impact (R)</Label>
              <Input type="number" min={0} step={0.01} value={form.revenueImpact} onChange={(e) => setForm((f) => ({ ...f, revenueImpact: e.target.value }))} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saveMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Marketing;
