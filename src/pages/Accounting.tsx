import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { accountingApi } from "@/lib/api/accounting";
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
  Settings2,
  Mail,
  CreditCard,
  LineChart,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/utils/bulk-actions";

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

  const ordersInRange = useMemo(() => {
    return orders.filter((o) => o.date >= dateFrom && o.date <= dateTo);
  }, [orders, dateFrom, dateTo]);

  const transactionsInRange = useMemo(() => {
    return transactions.filter((t) => t.date >= dateFrom && t.date <= dateTo);
  }, [transactions, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const totalRevenue = ordersInRange.reduce((sum, o) => sum + o.grand_total, 0);
    const paidRevenue = ordersInRange
      .filter((o) => o.payment_status === "Paid")
      .reduce((sum, o) => sum + o.grand_total, 0);
    const outstanding = ordersInRange
      .filter((o) => o.payment_status === "Pending")
      .reduce((sum, o) => sum + o.grand_total, 0);
    const stockValue = products.reduce((sum, p) => sum + (p.price || 0) * p.stock_on_hand, 0);

    const incomeTx = transactionsInRange.filter((t) => t.type === "income");
    const expenseTx = transactionsInRange.filter((t) => t.type === "expense");
    const manualIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
    const manualExpense = expenseTx.reduce((s, t) => s + t.amount, 0);

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
    const byType = txnFilterType === "all" ? transactionsInRange : transactionsInRange.filter((t) => t.type === txnFilterType);
    return byType;
  }, [transactionsInRange, txnFilterType]);

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

  const handleExportLedger = () => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold text-foreground"
          >
            Accounting Management
          </motion.h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue, payments, and manual transactions for Dumi Essence.
          </p>
        </div>
      </div>

      {/* Date range & actions */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
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

      {/* Overview metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs flex-1 min-w-0">
          <div className="glass-card px-4 py-3 flex flex-col gap-1">
            <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Total revenue</span>
            <span className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.paidRevenue)}
            </span>
            <span className="text-muted-foreground text-[11px]">Paid in period</span>
          </div>
          <div className="glass-card px-4 py-3 flex flex-col gap-1">
            <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Outstanding</span>
            <span className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.outstanding)}
            </span>
            <span className="text-muted-foreground text-[11px]">Pending in period</span>
          </div>
          <div className="glass-card px-4 py-3 flex flex-col gap-1">
            <span className="text-muted-foreground uppercase tracking-wide text-[11px]">Ledger net</span>
            <span className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              {formatCurrency(metrics.manualIncome - metrics.manualExpense)}
            </span>
            <span className="text-muted-foreground text-[11px]">Income − expense</span>
          </div>
          <div className="glass-card px-4 py-3 flex flex-col gap-1">
            <span className="text-muted-foreground uppercase tracking-wide text-[11px]">P&L (period)</span>
            <span className={`text-lg font-semibold flex items-center gap-2 ${metrics.pnlNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              <TrendingUp className="h-4 w-4" />
              {formatCurrency(metrics.pnlNet)}
            </span>
            <span className="text-muted-foreground text-[11px]">Ledger income − expense</span>
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
      {transactionPanelOpen && (
        <div className="glass-card rounded-lg border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Transaction entry</h2>
              <p className="text-sm text-muted-foreground">Record income and expenses for bookkeeping.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransactionPanelOpen(false)}>Cancel</Button>
              <Button type="submit" form="transaction-entry-form" size="sm" disabled={createTxnMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {createTxnMutation.isPending ? "Saving…" : "Save & Apply"}
              </Button>
            </div>
          </div>
          <div className="flex gap-1 border-b border-border mb-4">
            <button type="button" className="px-3 py-2 text-sm font-medium border-b-2 border-primary text-primary -mb-px">Details</button>
            <button type="button" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Notes</button>
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

      {/* Current ledger */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Current ledger</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportLedger} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
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
        className="glass-card overflow-hidden"
      >
        <div className="p-4 border-b border-border/30 flex flex-wrap items-center justify-between gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={txnFilterType}
            onChange={(e) => { setTxnFilterType(e.target.value as any); setLedgerPage(0); }}
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
    </DashboardLayout>
  );
};

export default Accounting;

