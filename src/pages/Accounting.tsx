import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { accountingApi } from "@/lib/api/accounting";
import { fragranceApi } from "@/lib/api/fragrance";
import type {
  Order,
  Product,
  AccountingTransaction,
  AccountingCategory,
  AccountingTransactionType,
  AccountingCategoryKind,
} from "@/types/database";
import {
  Banknote,
  Download,
  ListTree,
  Paperclip,
  RefreshCw,
  Target,
  AlertCircle,
  Calendar,
  TrendingUp,
  Package,
  Trash2,
  Settings2,
  Mail,
  CreditCard,
  LineChart,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/utils/bulk-actions";
import { exportAccountingExcel, exportAccountingPdf } from "@/lib/utils/accounting-export";

const formatCurrency = (amount: number) =>
  `R${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getMonthStartEnd = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
};

const Accounting = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getMonthStartEnd();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [transactionPanelOpen, setTransactionPanelOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "income" as AccountingTransactionType,
    category_id: "",
    description: "",
    amount: "",
    reference: "",
  });
  const [txnFilterType, setTxnFilterType] = useState<"all" | AccountingTransactionType>("all");
  const [attachmentTxnId, setAttachmentTxnId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [ledgerPage, setLedgerPage] = useState(0);
  const ledgerPageSize = 10;
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<AccountingCategoryKind>("income");

  const [clearLedgerOpen, setClearLedgerOpen] = useState(false);
  const [clearLedgerScope, setClearLedgerScope] = useState<"range" | "all">("range");
  const [accountingTab, setAccountingTab] = useState<"ledger" | "expenses">("ledger");
  const deSyncInFlightRef = useRef(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "expenses") {
      setAccountingTab("expenses");
      setTxnFilterType("expense");
      setLedgerPage(0);
    } else if (t === "ledger") {
      setAccountingTab("ledger");
    }
  }, [searchParams]);

  const { data: orders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["orders", "accounting"],
    queryFn: ordersApi.list,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", "accounting"],
    queryFn: productsApi.list,
  });

  const { data: categories = [] } = useQuery<AccountingCategory[]>({
    queryKey: ["accountingCategories"],
    queryFn: accountingApi.listCategories,
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery<AccountingTransaction[]>({
    queryKey: ["accountingTransactions"],
    queryFn: accountingApi.listTransactions,
  });
  const { data: scentProformas = [] } = useQuery({
    queryKey: ["scentProformas"],
    queryFn: fragranceApi.listProformas,
  });

  useEffect(() => {
    if (deSyncInFlightRef.current) return;
    if (!scentProformas.length) return;

    const normalizeRef = (value: string | null | undefined) => (value || "").trim().toLowerCase();
    const isDeRef = (value: string | null | undefined) => /^de-\d{6}$/i.test((value || "").trim());

    const existingRefs = new Set(
      transactions
        .map((t) => normalizeRef(t.reference))
        .filter((r) => !!r),
    );

    const missingProformas = scentProformas.filter((pf) => {
      const ref = normalizeRef(pf.reference);
      if (!isDeRef(ref)) return false;
      if (existingRefs.has(ref)) return false;
      return true;
    });

    if (!missingProformas.length) return;

    deSyncInFlightRef.current = true;
    (async () => {
      try {
        for (const pf of missingProformas) {
          const txDate = (pf.proforma_date || pf.created_at?.slice(0, 10) || "").toString();
          if (!txDate) continue;

          await accountingApi.createTransaction({
            date: txDate,
            type: "expense",
            amount: Number(pf.total ?? 0) || 0,
            description: `DE Order ${pf.reference || ""} - ${pf.customer_name || "Unknown vendor"}`,
            reference: pf.reference || undefined,
            vendor: pf.customer_name || undefined,
            campaign: "DE Orders",
            created_by: "Admin",
          });
        }
        queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
      } catch (err) {
        console.error("Failed syncing DE proformas into accounting ledger", err);
      } finally {
        deSyncInFlightRef.current = false;
      }
    })();
  }, [scentProformas, transactions, queryClient]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["orders", "accounting"] });
    queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["accountingCategories"] });
  };

  const createTxnMutation = useMutation({
    mutationFn: (input: {
      date: string;
      type: AccountingTransactionType;
      category_id?: string;
      description?: string;
      amount: number;
      reference?: string;
    }) =>
      accountingApi.createTransaction({
        ...input,
        created_by: "Admin",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
      setTransactionPanelOpen(false);
      setTxnForm({
        date: new Date().toISOString().slice(0, 10),
        type: "income",
        category_id: "",
        description: "",
        amount: "",
        reference: "",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (input: { name: string; kind: AccountingCategoryKind }) =>
      accountingApi.createCategory({ name: input.name, kind: input.kind }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountingCategories"] });
      setNewCategoryName("");
      setNewCategoryKind("income");
      toast.success("Category created");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create category"),
  });

  const clearLedgerMutation = useMutation({
    mutationFn: async () => {
      if (clearLedgerScope === "all") {
        return accountingApi.deleteAllTransactions();
      }
      return accountingApi.deleteTransactionsInRange({
        dateFrom,
        dateTo,
      });
    },
    onSuccess: (deletedCount) => {
      toast.success(
        `Ledger cleared. Deleted ${deletedCount} transaction${
          deletedCount === 1 ? "" : "s"
        }.`,
      );
      setClearLedgerOpen(false);
      setLedgerPage(0);
      refetchAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to clear ledger.");
    },
  });

  const ordersInRange = useMemo(() => {
    return orders.filter((o) => o.date >= dateFrom && o.date <= dateTo);
  }, [orders, dateFrom, dateTo]);

  const transactionsInRange = useMemo(() => {
    return transactions.filter((t) => t.date >= dateFrom && t.date <= dateTo);
  }, [transactions, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    // Revenue in this screen should come from accounting transactions,
    // so "Clear ledger" correctly drives this metric even if old orders still exist.
    const incomeTx = transactionsInRange.filter((t) => t.type === "income");
    const expenseTx = transactionsInRange.filter((t) => t.type === "expense");

    const salesIncome = incomeTx
      .filter((t) => !!t.order_id)
      .reduce((s, t) => s + t.amount, 0);
    const manualIncome = incomeTx
      .filter((t) => !t.order_id)
      .reduce((s, t) => s + t.amount, 0);

    const totalRevenue = salesIncome;
    const paidRevenue = salesIncome;
    const outstanding = ordersInRange
      .filter((o) => o.payment_status === "Pending")
      .reduce((sum, o) => sum + o.grand_total, 0);
    const stockValue = products.reduce((sum, p) => sum + (p.price || 0) * p.stock_on_hand, 0);

    const manualExpense = expenseTx
      // if an expense was linked to an order, treat it as sales-linked
      // (keeps the UI semantics consistent).
      .filter((t) => !t.order_id)
      .reduce((s, t) => s + t.amount, 0);

    return {
      totalRevenue,
      paidRevenue,
      outstanding,
      stockValue,
      manualIncome,
      manualExpense,
      pnlNet: manualIncome - manualExpense,
    };
  }, [ordersInRange, products, transactionsInRange]);

  const filteredTransactions = useMemo(() => {
    const effectiveType = accountingTab === "expenses" ? "expense" : txnFilterType;
    const byType = effectiveType === "all" ? transactionsInRange : transactionsInRange.filter((t) => t.type === effectiveType);
    return byType;
  }, [transactionsInRange, txnFilterType, accountingTab]);

  const ledgerTotals = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return { income, expense };
  }, [filteredTransactions]);

  const paginatedTransactions = useMemo(() => {
    const start = ledgerPage * ledgerPageSize;
    return filteredTransactions.slice(start, start + ledgerPageSize);
  }, [filteredTransactions, ledgerPage, ledgerPageSize]);
  const ledgerTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / ledgerPageSize));
  const expensesInRange = useMemo(
    () => transactionsInRange.filter((t) => t.type === "expense"),
    [transactionsInRange],
  );
  const expensesByVendor = useMemo(() => {
    return Object.entries(
      expensesInRange.reduce<Record<string, number>>((acc, row) => {
        const key = row.vendor || "Unassigned";
        acc[key] = (acc[key] ?? 0) + Math.abs(row.amount);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  }, [expensesInRange]);

  const uploadAttachmentMutation = useMutation({
    mutationFn: (params: { transactionId: string; file: File }) =>
      accountingApi.uploadAttachment({
        transactionId: params.transactionId,
        file: params.file,
        uploadedBy: "Admin",
      }),
    onSuccess: () => {
      // No need to refetch transactions; attachments are aux data.
      setAttachmentTxnId(null);
      setAttachmentFile(null);
    },
  });

  const handleExportLedgerCsv = () => {
    const headers = ["Date", "Type", "Category", "Description", "Amount", "Reference"];
    const rows = filteredTransactions.map((t) => {
      const category = categories.find((c) => c.id === t.category_id);
      return [
        t.date,
        t.type,
        category ? category.name : "",
        t.description || "",
        t.amount.toFixed(2),
        t.reference || "",
      ];
    });
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    downloadCSV(csv, `accounting-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportLedgerPdf = async () => {
    await exportAccountingPdf({
      transactions: filteredTransactions,
      categories,
      dateFrom,
      dateTo,
    });
  };

  const handleExportLedgerExcel = async () => {
    await exportAccountingExcel({
      transactions: filteredTransactions,
      categories,
      dateFrom,
      dateTo,
    });
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNumber = Number(txnForm.amount || "0");
    if (!amountNumber || amountNumber <= 0) return;
    createTxnMutation.mutate({
      date: txnForm.date,
      type: txnForm.type,
      category_id: txnForm.category_id || undefined,
      description: txnForm.description || undefined,
      amount: amountNumber,
      reference: txnForm.reference || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="ops-workspace">
      <PageHero
        eyebrow="House Ledger"
        title="Financial signal in the same black, charcoal, and gold language."
        description="Review revenue, outstanding balances, and manual entries in a ledger workspace that feels deliberate, calm, and premium."
        actions={
          <>
            <Button size="sm" onClick={() => setTransactionPanelOpen((o) => !o)} className="gap-1.5">
              + New transaction
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLedgerPdf} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLedgerExcel} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportLedgerCsv} className="gap-1.5 text-muted-foreground">
              CSV
            </Button>
          </>
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Revenue</p>
              <p className="mt-2 text-2xl font-display font-semibold text-foreground">{formatCurrency(metrics.paidRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="luxury-note">Outstanding</p>
              <p className="mt-2 text-2xl font-display font-semibold text-foreground">{formatCurrency(metrics.outstanding)}</p>
            </div>
          </div>
        }
      />

      {/* Date range & actions */}
      <div className="toolbar-panel mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setLedgerPage(0); }}
            className="h-8 w-[140px]"
          />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setLedgerPage(0); }}
            className="h-8 w-[140px]"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCategoriesOpen(true)} className="gap-1.5 text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          Manage categories
        </Button>
      </div>
      <div className="segmented-tabs mb-4">
        <button
          type="button"
          className={`segmented-tab ${accountingTab === "ledger" ? "segmented-tab-active" : ""}`}
          onClick={() => {
            setAccountingTab("ledger");
            setSearchParams(
              (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("tab");
                return n;
              },
              { replace: true },
            );
          }}
        >
          Ledger
        </button>
        <button
          type="button"
          className={`segmented-tab ${accountingTab === "expenses" ? "segmented-tab-active" : ""}`}
          onClick={() => {
            setAccountingTab("expenses");
            setTxnFilterType("expense");
            setLedgerPage(0);
            setSearchParams(
              (prev) => {
                const n = new URLSearchParams(prev);
                n.set("tab", "expenses");
                return n;
              },
              { replace: true },
            );
          }}
        >
          Expenses
        </button>
      </div>

      {/* Overview metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs flex-1 min-w-0">
          <div className="metric-card">
            <span className="metric-label">Total revenue</span>
            <span className="metric-value flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.paidRevenue)}
            </span>
            <span className="metric-note">Paid in period</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Outstanding</span>
            <span className="metric-value flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.outstanding)}
            </span>
            <span className="metric-note">Pending in period</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Ledger net</span>
            <span className="metric-value flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.manualIncome - metrics.manualExpense)}
            </span>
            <span className="metric-note">Income minus expense</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">P&amp;L (period)</span>
            <span className={`metric-value flex items-center gap-2 ${metrics.pnlNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              <TrendingUp className="h-4 w-4" />
              {formatCurrency(metrics.pnlNet)}
            </span>
            <span className="metric-note">Ledger income minus expense</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Stock value</span>
            <span className="metric-value flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.stockValue)}
            </span>
            <span className="metric-note">Selling price × stock on hand</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refetchAll} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setTransactionPanelOpen((o) => !o)} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            + New transaction
          </Button>
        </div>
      </div>

      {/* Transaction entry panel */}
      {transactionPanelOpen && accountingTab === "ledger" && (
        <div className="editorial-panel mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title text-[1.75rem]">Transaction entry</h2>
              <p className="section-copy">Record income and expenses for house bookkeeping.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransactionPanelOpen(false)}>Cancel</Button>
              <Button type="submit" form="transaction-entry-form" size="sm" disabled={createTxnMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {createTxnMutation.isPending ? "Saving…" : "Save & Apply"}
              </Button>
            </div>
          </div>
          <div className="segmented-tabs mb-4 border-0">
            <button type="button" className="segmented-tab segmented-tab-active">Details</button>
            <button type="button" className="segmented-tab">Notes</button>
          </div>
          <form id="transaction-entry-form" onSubmit={handleSubmitTransaction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={txnForm.type}
                  onChange={(e) => setTxnForm((f) => ({ ...f, type: e.target.value as AccountingTransactionType }))}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={txnForm.date}
                  onChange={(e) => setTxnForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference number</Label>
                <Input
                  placeholder="e.g. REF-2024-001"
                  value={txnForm.reference}
                  onChange={(e) => setTxnForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={txnForm.category_id}
                  onChange={(e) => setTxnForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (R) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={txnForm.amount}
                  onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reason / description</Label>
                <Input
                  placeholder="Enter reason"
                  value={txnForm.description}
                  onChange={(e) => setTxnForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {accountingTab === "expenses" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-xs">
            <div className="metric-card">
              <span className="metric-label">Total expenses</span>
              <span className="metric-value">{formatCurrency(expensesInRange.reduce((s, t) => s + Math.abs(t.amount), 0))}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Profit after expenses</span>
              <span className={`metric-value ${metrics.pnlNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatCurrency(metrics.pnlNet)}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Top vendor cost</span>
              <span className="metric-value">
                {expensesByVendor[0] ? `${expensesByVendor[0][0]} (${formatCurrency(expensesByVendor[0][1])})` : "-"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between rounded-xl border border-border/50 bg-muted/15 px-4 py-3 mb-4 text-xs">
            <p className="text-muted-foreground max-w-xl">
              Same accounting transactions as the Expenses and Vendors expense ledgers. Open either workspace with this date range (and vendor filter where supported).
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to={`/expenses?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&tab=ledger`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Expenses page
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to="/vendors?tab=expenses&ref=">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Vendors → Expenses
                </Link>
              </Button>
              {expensesByVendor[0] && expensesByVendor[0][0] !== "Unassigned" && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                    <Link
                      to={`/expenses?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&vendor=${encodeURIComponent(expensesByVendor[0][0])}&tab=ledger`}
                    >
                      Top vendor in Expenses
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                    <Link
                      to={`/vendors?tab=expenses&ref=&vendor=${encodeURIComponent(expensesByVendor[0][0])}`}
                    >
                      Top vendor in Vendors
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Current ledger */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Current ledger</h2>
          <p className="section-copy">A calmer ledger view for current income, expenses, transfers, and supporting receipts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportLedgerPdf} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLedgerExcel} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearLedgerOpen(true)}
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear ledger
          </Button>
          <Button variant="outline" size="sm" onClick={refetchAll} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="data-shell"
      >
        <div className="p-4 border-b border-border/30 flex flex-wrap items-center justify-between gap-2">
          <select
            className="filter-control h-9 text-xs"
            value={txnFilterType}
            onChange={(e) => { setTxnFilterType(e.target.value as any); setLedgerPage(0); }}
            disabled={accountingTab === "expenses"}
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            <ListTree className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No transactions yet. Use &quot;+ New transaction&quot; to record income and expenses.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-left py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="text-right py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Ref</th>
                  <th className="text-right py-3 px-6 text-[11px] text-muted-foreground uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((t) => {
                  const category = categories.find((c) => c.id === t.category_id);
                  const signColor =
                    t.type === "expense" ? "text-rose-300" : t.type === "income" ? "text-emerald-300" : "text-foreground";
                  const signedAmount =
                    t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount);
                  return (
                    <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-3 px-6 text-muted-foreground">{t.date}</td>
                      <td className="py-3 px-6 text-muted-foreground capitalize">{t.type}</td>
                      <td className="py-3 px-6 text-foreground">{category ? category.name : "—"}</td>
                      <td className="py-3 px-6 text-muted-foreground">{t.description || "—"}</td>
                      <td className={`py-3 px-6 text-right font-medium ${signColor}`}>{formatCurrency(signedAmount)}</td>
                      <td className="py-3 px-6 text-muted-foreground">{t.reference || "—"}</td>
                      <td className="py-3 px-6 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => { setAttachmentTxnId(t.id); setAttachmentFile(null); }}
                        >
                          <Paperclip size={12} /> Attach
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <tfoot>
              <tr className="border-t border-border/30 bg-muted/20">
                <td colSpan={7} className="px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>Total Records: {filteredTransactions.length}</span>
                    <span>Income: {formatCurrency(ledgerTotals.income)}</span>
                    <span>Expense: {formatCurrency(ledgerTotals.expense)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={ledgerPage <= 0}
                        onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-foreground">
                        Page {ledgerPage + 1} of {ledgerTotalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={ledgerPage >= ledgerTotalPages - 1}
                        onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages - 1, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </>
        )}
      </motion.div>

      {/* Attach receipt dialog */}
      <Dialog open={!!attachmentTxnId} onOpenChange={(open) => !open && setAttachmentTxnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach receipt</DialogTitle>
            <DialogDescription>
              Upload a PDF or image of the invoice or receipt for this transaction.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!attachmentTxnId || !attachmentFile) return;
              uploadAttachmentMutation.mutate({
                transactionId: attachmentTxnId,
                file: attachmentFile,
              });
            }}
            className="space-y-4 text-sm mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="receipt_file">Receipt file</Label>
              <Input
                id="receipt_file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAttachmentFile(file);
                }}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAttachmentTxnId(null);
                  setAttachmentFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploadAttachmentMutation.isPending || !attachmentFile}
              >
                {uploadAttachmentMutation.isPending ? "Uploading…" : "Upload receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clear ledger dialog */}
      <Dialog open={clearLedgerOpen} onOpenChange={setClearLedgerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear current ledger</DialogTitle>
            <DialogDescription>
              Delete accounting transactions from Supabase. Orders remain unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <Label>Scope</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={clearLedgerScope}
                onChange={(e) => setClearLedgerScope(e.target.value as any)}
              >
                <option value="range">This date range</option>
                <option value="all">All ledger entries</option>
              </select>
            </div>

            {clearLedgerScope === "range" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Deleting transactions where <span className="font-medium text-foreground">date</span>{" "}
                  is between <span className="font-medium text-foreground">{dateFrom}</span> and{" "}
                  <span className="font-medium text-foreground">{dateTo}</span>.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearLedgerOpen(false)}
              disabled={clearLedgerMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearLedgerMutation.isPending}
              onClick={() => {
                if (!confirm("This will permanently delete accounting transactions. Continue?")) return;
                clearLedgerMutation.mutate();
              }}
            >
              {clearLedgerMutation.isPending ? "Clearing…" : "Clear ledger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced features */}
      <div className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Advanced features
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Highlighted tools that help you move from basic bookkeeping to proactive, insight-driven financial management.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="glass-card rounded-lg border border-border/60 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Automated reports</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Monthly financial summaries emailed directly to key stakeholders.</li>
              <li>Optional ESG/SDG-aligned impact metrics if your perfume brand is sustainability-focused.</li>
            </ul>
          </div>
          <div className="glass-card rounded-lg border border-border/60 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Payment gateway integration</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Track online sales directly from your e‑commerce platform.</li>
              <li>Sync with WozaMali or other operational apps you are already running.</li>
            </ul>
          </div>
          <div className="glass-card rounded-lg border border-border/60 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Forecasting &amp; trends</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Predict demand for upcoming seasons based on historical performance.</li>
              <li>Suggested production adjustments generated from order, stock, and revenue patterns.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Manage categories dialog */}
      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
            <DialogDescription>
              Add income or expense categories for transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet. Add one below.</p>
            ) : (
              <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                {categories.map((c) => (
                  <li key={c.id} className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-foreground">{c.name}</span>
                    <span className="text-muted-foreground capitalize">{c.kind}</span>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newCategoryName.trim();
                if (!name) return;
                createCategoryMutation.mutate({ name, kind: newCategoryKind });
              }}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newCategoryKind}
                  onChange={(e) => setNewCategoryKind(e.target.value as AccountingCategoryKind)}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                </select>
              </div>
              <Button type="submit" size="sm" disabled={createCategoryMutation.isPending || !newCategoryName.trim()}>
                {createCategoryMutation.isPending ? "Adding…" : "Add category"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Accounting;

