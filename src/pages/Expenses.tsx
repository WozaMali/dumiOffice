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
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  TrendingDown,
  Calendar,
  Hash,
  Megaphone,
  Package,
  Building2,
  Filter,
  Plus,
  FileUp,
  ChevronDown,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingApi } from "@/lib/api/accounting";
import type { AccountingTransaction, AccountingCategory } from "@/types/database";
import { useMemo, useState, useRef } from "react";

const formatCurrency = (amount: number) =>
  `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type TabId = "overview" | "ledger" | "category" | "campaign";

const EXPENSE_STREAM_HINTS: Record<string, string> = {
  "Campaign - Online": "Meta ads, Google ads, influencers, affiliate",
  "Campaign - Offline": "Events, pop-ups, print, signage, sampling",
  "Materials - Packaging": "Bottles, boxes, labels, caps, pumps",
  "Materials - Raw": "Oils, ethanol, diluents, concentrates",
  Operations: "Rent, utilities, shipping, admin, software",
  Other: "Miscellaneous expenses",
};

const Expenses = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: transactions = [], isLoading } = useQuery<AccountingTransaction[]>({
    queryKey: ["accountingTransactions"],
    queryFn: accountingApi.listTransactions,
  });

  const { data: categories = [] } = useQuery<AccountingCategory[]>({
    queryKey: ["accountingCategories"],
    queryFn: accountingApi.listCategories,
  });

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories]
  );

  const expenses = useMemo(
    () => transactions.filter((t) => t.type === "expense"),
    [transactions]
  );

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [filterDateTo, setFilterDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingTransaction | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category_id: "",
    campaign: "",
    vendor: "",
    description: "",
    amount: "",
    reference: "",
    lineItems: "",
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      const from = new Date(filterDateFrom);
      const to = new Date(filterDateTo);
      if (d < from || d > to) return false;
      if (filterCategory && e.category_id !== filterCategory) return false;
      if (filterCampaign && (e.campaign || "").toLowerCase() !== filterCampaign.toLowerCase())
        return false;
      if (filterVendor && (e.vendor || "").toLowerCase() !== filterVendor.toLowerCase())
        return false;
      return true;
    });
  }, [expenses, filterDateFrom, filterDateTo, filterCategory, filterCampaign, filterVendor]);

  const uniqueCampaigns = useMemo(
    () =>
      Array.from(new Set(expenses.map((e) => e.campaign).filter(Boolean))) as string[],
    [expenses]
  );
  const uniqueVendors = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.vendor).filter(Boolean))) as string[],
    [expenses]
  );

  const metrics = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth();
    const prevYear = new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear();

    const inMonth = (t: AccountingTransaction, m: number, y: number) => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    };

    const curMonthExpenses = expenses.filter((t) => inMonth(t, curMonth, curYear));
    const prevMonthExpenses = expenses.filter((t) => inMonth(t, prevMonth, prevYear));

    const curTotal = curMonthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const prevTotal = prevMonthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);

    const change = prevTotal > 0 ? curTotal - prevTotal : null;
    const changePct = prevTotal > 0 && change !== null ? (change / prevTotal) * 100 : null;

    const byCategory = expenses.reduce<Record<string, number>>((acc, t) => {
      const catId = t.category_id || "_uncategorized";
      acc[catId] = (acc[catId] ?? 0) + Math.abs(t.amount);
      return acc;
    }, {});
    const topCategoryId = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCategory = topCategoryId
      ? expenseCategories.find((c) => c.id === topCategoryId)?.name ?? "Uncategorized"
      : "-";

    const campaignTotal = expenses
      .filter((e) => e.campaign)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const materialCatIds = expenseCategories
      .filter((c) => c.name?.toLowerCase().includes("material") || c.name?.toLowerCase().includes("packaging") || c.name?.toLowerCase().includes("raw"))
      .map((c) => c.id);
    const materialsTotal = expenses
      .filter((e) => e.category_id && materialCatIds.includes(e.category_id))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const byVendor = expenses.reduce<Record<string, number>>((acc, t) => {
      const v = t.vendor || "_unknown";
      acc[v] = (acc[v] ?? 0) + Math.abs(t.amount);
      return acc;
    }, {});
    const topVendor = Object.entries(byVendor)
      .filter(([k]) => k !== "_unknown")
      .sort((a, b) => b[1] - a[1])[0];

    const byCampaign = expenses.reduce<Record<string, number>>((acc, t) => {
      if (!t.campaign) return acc;
      acc[t.campaign] = (acc[t.campaign] ?? 0) + Math.abs(t.amount);
      return acc;
    }, {});

    return {
      count: expenses.length,
      curMonthTotal: curTotal,
      prevMonthTotal: prevTotal,
      total,
      change,
      changePct,
      topCategory,
      campaignTotal,
      materialsTotal,
      topVendor: topVendor ? topVendor[0] : "-",
      topVendorAmount: topVendor ? topVendor[1] : 0,
      byCategory,
      byCampaign,
    };
  }, [expenses, expenseCategories]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Math.abs(Number(form.amount.replace(/[^0-9.-]/g, "")) || 0);
      const description = form.lineItems.trim()
        ? `${form.description.trim()}\n${form.lineItems.trim()}`
        : form.description.trim();

      const payload = {
        date: form.date,
        type: "expense" as const,
        category_id: form.category_id || null,
        campaign: form.campaign.trim() || null,
        vendor: form.vendor.trim() || null,
        description: description || null,
        amount: -amount,
        reference: form.reference.trim() || null,
      };

      let txn: AccountingTransaction;
      if (editing) {
        txn = await accountingApi.updateTransaction(editing.id, payload);
      } else {
        txn = await accountingApi.createTransaction(payload);
      }

      if (attachmentFile && txn?.id) {
        try {
          await accountingApi.uploadAttachment({
            transactionId: txn.id,
            file: attachmentFile,
          });
        } catch {
          toast.warning("Expense saved, but receipt upload failed.");
        }
      }
      return txn;
    },
    onSuccess: () => {
      toast.success(editing ? "Expense updated." : "Expense added.");
      queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
      setEditorOpen(false);
      setEditing(null);
      setAttachmentFile(null);
      resetForm();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || "Failed to save expense.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteTransaction(id),
    onSuccess: () => {
      toast.success("Expense deleted.");
      queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || "Failed to delete expense.");
    },
  });

  const resetForm = () =>
    setForm({
      date: new Date().toISOString().slice(0, 10),
      category_id: "",
      campaign: "",
      vendor: "",
      description: "",
      amount: "",
      reference: "",
      lineItems: "",
    });

  const openEditor = (exp?: AccountingTransaction) => {
    if (exp) {
      setEditing(exp);
      const desc = exp.description || "";
      const lines = desc.includes("\n") ? desc.split("\n").slice(1).join("\n") : "";
      const mainDesc = desc.includes("\n") ? desc.split("\n")[0] : desc;
      setForm({
        date: exp.date,
        category_id: exp.category_id ?? "",
        campaign: exp.campaign ?? "",
        vendor: exp.vendor ?? "",
        description: mainDesc,
        amount: String(Math.abs(exp.amount)),
        reference: exp.reference ?? "",
        lineItems: lines,
      });
    } else {
      setEditing(null);
      resetForm();
    }
    setAttachmentFile(null);
    setEditorOpen(true);
  };

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="Finance"
        title="Expenses"
        description="Track campaigns (online & offline), materials, operations, and all business spend in one place."
        actions={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4 mr-2" />
            New expense
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Holistic view</p>
            <p className="text-lg leading-7 text-foreground">
              Link expenses to campaigns, vendors, and categories. Use line items for material breakdowns. Receipts sync to the accounting ledger.
            </p>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            { id: "overview" as TabId, label: "Overview", icon: Receipt },
            { id: "ledger" as TabId, label: "Ledger", icon: Hash },
            { id: "category" as TabId, label: "By category", icon: Package },
            { id: "campaign" as TabId, label: "By campaign", icon: Megaphone },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-3 w-full"
            >
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <select
                className="h-8 text-xs rounded-md border border-input bg-background px-2 w-40"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="h-8 text-xs rounded-md border border-input bg-background px-2 w-40"
                value={filterCampaign}
                onChange={(e) => setFilterCampaign(e.target.value)}
              >
                <option value="">All campaigns</option>
                {uniqueCampaigns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="h-8 text-xs rounded-md border border-input bg-background px-2 w-40"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
              >
                <option value="">All vendors</option>
                {uniqueVendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="This month"
          value={formatCurrency(metrics.curMonthTotal)}
          change={
            metrics.changePct != null
              ? `${metrics.change! >= 0 ? "+" : ""}${metrics.changePct.toFixed(0)}% vs last month`
              : undefined
          }
          changeType={
            metrics.change == null ? "neutral" : metrics.change <= 0 ? "positive" : "negative"
          }
          icon={TrendingDown}
          index={0}
        />
        <StatCard
          title="Campaign spend"
          value={formatCurrency(metrics.campaignTotal)}
          change="Online + offline"
          changeType="neutral"
          icon={Megaphone}
          index={1}
        />
        <StatCard
          title="Materials"
          value={formatCurrency(metrics.materialsTotal)}
          change="Packaging & raw"
          changeType="neutral"
          icon={Package}
          index={2}
        />
        <StatCard
          title="Top vendor"
          value={metrics.topVendor === "-" ? "-" : metrics.topVendor.slice(0, 14) + (metrics.topVendor.length > 14 ? "…" : "")}
          change={
            metrics.topVendorAmount > 0 ? formatCurrency(metrics.topVendorAmount) : undefined
          }
          changeType="neutral"
          icon={Building2}
          index={3}
        />
        <StatCard
          title="Total (all time)"
          value={formatCurrency(metrics.total)}
          change={`${metrics.count} transactions`}
          changeType="neutral"
          icon={Receipt}
          index={4}
        />
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="data-shell p-6">
                <h3 className="section-title text-base mb-4">By category</h3>
                {Object.keys(metrics.byCategory).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categorized expenses yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {Object.entries(metrics.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([catId, amt]) => {
                        const name =
                          catId === "_uncategorized"
                            ? "Uncategorized"
                            : expenseCategories.find((c) => c.id === catId)?.name ?? catId;
                        const pct = metrics.total > 0 ? (amt / metrics.total) * 100 : 0;
                        return (
                          <li
                            key={catId}
                            className="flex justify-between items-center text-sm py-1.5 border-b border-border/20 last:border-0"
                          >
                            <span className="text-foreground">{name}</span>
                            <span className="text-rose-300 font-medium">
                              {formatCurrency(amt)} ({pct.toFixed(0)}%)
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
              <div className="data-shell p-6">
                <h3 className="section-title text-base mb-4">By campaign</h3>
                {Object.keys(metrics.byCampaign).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No campaign-linked expenses yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {Object.entries(metrics.byCampaign)
                      .sort((a, b) => b[1] - a[1])
                      .map(([campaign, amt]) => (
                        <li
                          key={campaign}
                          className="flex justify-between items-center text-sm py-1.5 border-b border-border/20 last:border-0"
                        >
                          <span className="text-foreground">{campaign}</span>
                          <span className="text-rose-300 font-medium">{formatCurrency(amt)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="data-shell p-6">
              <h3 className="section-title text-base mb-4">Recent expenses</h3>
              {filteredExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses in selected range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-left text-xs text-muted-foreground uppercase">
                      <th className="py-3">Date</th>
                      <th className="py-3">Description</th>
                      <th className="py-3">Category</th>
                      <th className="py-3">Campaign</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.slice(0, 8).map((e) => {
                      const cat = expenseCategories.find((c) => c.id === e.category_id);
                      return (
                        <tr key={e.id} className="border-b border-border/20">
                          <td className="py-3 text-muted-foreground">{e.date}</td>
                          <td className="py-3 font-medium">{e.description || "-"}</td>
                          <td className="py-3 text-muted-foreground">{cat?.name ?? "-"}</td>
                          <td className="py-3 text-muted-foreground">{e.campaign || "-"}</td>
                          <td className="py-3 text-right text-rose-300 font-medium">
                            {formatCurrency(Math.abs(e.amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "ledger" && (
          <motion.div
            key="ledger"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="data-shell"
          >
            <div className="section-header px-6 py-5">
              <div>
                <h2 className="section-title">Expense ledger</h2>
                <p className="section-copy">Full list with campaign, vendor, and category.</p>
              </div>
            </div>
            {isLoading ? (
              <div className="px-6 py-10 text-center text-[11px] text-muted-foreground">
                Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      {["Date", "Description", "Category", "Campaign", "Vendor", "Amount", "Reference"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        )
                      )}
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-10 text-center text-sm text-muted-foreground"
                        >
                          No expenses. Click &quot;+ New expense&quot;.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((e, i) => {
                        const cat = expenseCategories.find((c) => c.id === e.category_id);
                        return (
                          <motion.tr
                            key={e.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.02 * Math.min(i, 20) }}
                            className="border-b border-border/20 hover:bg-muted/30"
                          >
                            <td className="px-6 py-4 text-muted-foreground">{e.date}</td>
                            <td className="px-6 py-4 font-medium max-w-[200px] truncate" title={e.description || ""}>
                              {e.description || "-"}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{cat?.name ?? "-"}</td>
                            <td className="px-6 py-4 text-muted-foreground">{e.campaign || "-"}</td>
                            <td className="px-6 py-4 text-muted-foreground">{e.vendor || "-"}</td>
                            <td className="px-6 py-4 text-rose-300 font-medium whitespace-nowrap">
                              {formatCurrency(Math.abs(e.amount))}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-xs">{e.reference || "-"}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => openEditor(e)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => {
                                    if (
                                      !confirm(
                                        `Delete "${e.description || e.date}"? This cannot be undone.`
                                      )
                                    )
                                      return;
                                    deleteMutation.mutate(e.id);
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "category" && (
          <motion.div
            key="category"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {expenseCategories.length === 0 ? (
              <div className="data-shell p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Add expense categories in Accounting first.</p>
              </div>
            ) : (
              expenseCategories.map((cat) => {
                const catExpenses = filteredExpenses.filter((e) => e.category_id === cat.id);
                const total = catExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
                if (total === 0) return null;
                return (
                  <div key={cat.id} className="data-shell overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/30 flex justify-between items-center">
                      <h3 className="section-title text-base">{cat.name}</h3>
                      <span className="text-rose-300 font-medium">{formatCurrency(total)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/20 text-left text-xs text-muted-foreground">
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Description</th>
                          <th className="px-6 py-3">Vendor</th>
                          <th className="px-6 py-3">Campaign</th>
                          <th className="px-6 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catExpenses.map((e) => (
                          <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="px-6 py-3">{e.date}</td>
                            <td className="px-6 py-3 font-medium">{e.description || "-"}</td>
                            <td className="px-6 py-3 text-muted-foreground">{e.vendor || "-"}</td>
                            <td className="px-6 py-3 text-muted-foreground">{e.campaign || "-"}</td>
                            <td className="px-6 py-3 text-right text-rose-300">
                              {formatCurrency(Math.abs(e.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {activeTab === "campaign" && (
          <motion.div
            key="campaign"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {Object.keys(metrics.byCampaign).length === 0 ? (
              <div className="data-shell p-8 text-center">
                <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Link expenses to campaigns when adding them.</p>
              </div>
            ) : (
              Object.entries(metrics.byCampaign)
                .sort((a, b) => b[1] - a[1])
                .map(([campaign, total]) => {
                  const campExpenses = filteredExpenses.filter(
                    (e) => e.campaign?.toLowerCase() === campaign.toLowerCase()
                  );
                  return (
                    <div key={campaign} className="data-shell overflow-hidden">
                      <div className="px-6 py-4 border-b border-border/30 flex justify-between items-center">
                        <h3 className="section-title text-base">{campaign}</h3>
                        <span className="text-rose-300 font-medium">{formatCurrency(total)}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/20 text-left text-xs text-muted-foreground">
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Description</th>
                            <th className="px-6 py-3">Category</th>
                            <th className="px-6 py-3">Vendor</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campExpenses.map((e) => {
                            const cat = expenseCategories.find((c) => c.id === e.category_id);
                            return (
                              <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20">
                                <td className="px-6 py-3">{e.date}</td>
                                <td className="px-6 py-3 font-medium">{e.description || "-"}</td>
                                <td className="px-6 py-3 text-muted-foreground">{cat?.name ?? "-"}</td>
                                <td className="px-6 py-3 text-muted-foreground">{e.vendor || "-"}</td>
                                <td className="px-6 py-3 text-right text-rose-300">
                                  {formatCurrency(Math.abs(e.amount))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit expense modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>
              Record campaign spend, materials, operations, or any business spend. Use line items for material breakdowns.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const amt = Number(form.amount.replace(/[^0-9.-]/g, ""));
              if (!Number.isFinite(amt) || amt <= 0) {
                toast.error("Enter a valid amount.");
                return;
              }
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.category_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category_id: e.target.value }))
                  }
                >
                  <option value="">— No category —</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {form.category_id && (
                  <p className="text-[11px] text-muted-foreground">
                    {EXPENSE_STREAM_HINTS[
                      expenseCategories.find((c) => c.id === form.category_id)?.name ?? ""
                    ] ?? ""}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign (optional)</Label>
                <Input
                  value={form.campaign}
                  onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))}
                  placeholder="e.g. Valentine's Online, Pop-up JHB"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor / Supplier</Label>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder="e.g. ABC Packaging, Meta Ads"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="e.g. Packaging supplies, Facebook ads March"
              />
            </div>

            <div className="space-y-2">
              <Label>Line items / breakdown (optional)</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                value={form.lineItems}
                onChange={(e) => setForm((f) => ({ ...f, lineItems: e.target.value }))}
                placeholder="e.g. 100 bottles @ R5, 50 boxes @ R12"
              />
              <p className="text-[11px] text-muted-foreground">
                One line per item for material purchases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (R)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Reference / Invoice #</Label>
                <Input
                  value={form.reference}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reference: e.target.value }))
                  }
                  placeholder="e.g. INV-2024-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  {attachmentFile ? attachmentFile.name : "Choose file"}
                </Button>
                {attachmentFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {attachmentFile.name}
                  </span>
                )}
              </div>
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
                {saveMutation.isPending
                  ? "Saving…"
                  : editing
                  ? "Save changes"
                  : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Expenses;
