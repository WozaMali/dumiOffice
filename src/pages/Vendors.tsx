import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Receipt,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vendorsApi } from "@/lib/api/vendors";
import { accountingApi } from "@/lib/api/accounting";
import { fragranceApi } from "@/lib/api/fragrance";
import type {
  AccountingAttachment,
  AccountingCategory,
  AccountingTransaction,
  ScentProforma,
  Vendor,
} from "@/types/database";

const getMonthToDateRange = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalYmd = (x: Date) =>
    `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return {
    dateFrom: toLocalYmd(start),
    dateTo: toLocalYmd(d),
  };
};

const toLocalYmd = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Case- and spacing-insensitive match between expense `vendor` text and directory `name`. */
const normalizeVendorKey = (s: string | null | undefined) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Normalized DE-###### reference for comparisons. */
const normalizeDeRef = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

const isDeSequenceReference = (s: string | null | undefined) =>
  /^de-\d+$/i.test((s ?? "").trim());

/** DE-###### tokens in free text (e.g. expense descriptions), lowercased. */
const collectDeRefsInText = (s: string | null | undefined): Set<string> => {
  const out = new Set<string>();
  if (!s) return out;
  const re = /de-\d+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) != null) {
    out.add(m[0].toLowerCase());
  }
  return out;
};

const Vendors = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    "directory" | "expenses" | "summary" | "deOrders"
  >("directory");
  const { dateFrom: defaultSummaryFrom, dateTo: defaultSummaryTo } = getMonthToDateRange();
  const [summaryDateFrom, setSummaryDateFrom] = useState(defaultSummaryFrom);
  const [summaryDateTo, setSummaryDateTo] = useState(defaultSummaryTo);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const emptyForm = {
    name: "",
    vat_number: "",
    company_registration: "",
    street_address: "",
    suburb: "",
    city: "",
    province: "",
    country: "",
    postal_code: "",
    contact_name: "",
    contact_phone: "",
    email: "",
    notes: "",
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [evidenceProforma, setEvidenceProforma] = useState<ScentProforma | null>(null);
  const [expenseReferenceFilter, setExpenseReferenceFilter] = useState("");
  const [expenseVendorFilter, setExpenseVendorFilter] = useState("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "directory" || tab === "expenses" || tab === "summary" || tab === "deOrders") {
      setActiveTab(tab);
    }
    if (searchParams.has("vendor")) {
      setExpenseVendorFilter(decodeURIComponent(searchParams.get("vendor") || "").trim());
    } else {
      setExpenseVendorFilter("");
    }
    if (searchParams.has("ref")) {
      setExpenseReferenceFilter(searchParams.get("ref") ?? "");
    }
  }, [searchParams]);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: vendorsApi.list,
  });
  const { data: transactions = [] } = useQuery<AccountingTransaction[]>({
    queryKey: ["accountingTransactions"],
    queryFn: accountingApi.listTransactions,
  });
  const { data: attachmentsByTransactionId = {} } = useQuery<
    Record<string, AccountingAttachment[]>
  >({
    queryKey: ["accountingAttachmentsByTransaction", transactions.map((t) => t.id).join(",")],
    enabled: transactions.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        transactions.map(async (t) => {
          const attachments = await accountingApi.listAttachments(t.id);
          return [t.id, attachments] as const;
        }),
      );
      return Object.fromEntries(pairs);
    },
  });
  const { data: categories = [] } = useQuery<AccountingCategory[]>({
    queryKey: ["accountingCategories"],
    queryFn: accountingApi.listCategories,
  });
  const { data: scentProformas = [] } = useQuery<ScentProforma[]>({
    queryKey: ["scentProformas"],
    queryFn: fragranceApi.listProformas,
  });

  const createVendorMutation = useMutation({
    mutationFn: () => vendorsApi.create(form),
    onSuccess: () => {
      toast.success("Vendor added.");
      setForm(emptyForm);
      setVendorDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to add vendor."),
  });
  const updateVendorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof form }) =>
      vendorsApi.update(id, payload),
    onSuccess: () => {
      toast.success("Vendor updated.");
      setEditingVendorId(null);
      setForm(emptyForm);
      setVendorDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update vendor."),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.remove(id),
    onSuccess: () => {
      toast.success("Vendor removed.");
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to remove vendor."),
  });

  const alignExpenseVendorNamesMutation = useMutation({
    mutationFn: async () => {
      const byKey = new Map<string, Vendor>();
      vendors.forEach((v) => {
        const k = normalizeVendorKey(v.name);
        if (k && !byKey.has(k)) byKey.set(k, v);
      });
      let updated = 0;
      for (const t of expenseRecords) {
        const key = normalizeVendorKey(t.vendor);
        if (!key) continue;
        const v = byKey.get(key);
        if (!v) continue;
        if ((t.vendor || "").trim() === v.name.trim()) continue;
        await accountingApi.updateTransaction(t.id, { vendor: v.name });
        updated += 1;
      }
      return updated;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["accountingTransactions"] });
      toast.success(
        n > 0
          ? `Updated ${n} expense line(s) to use the exact directory vendor name.`
          : "All linked expense lines already use the directory vendor name.",
      );
    },
    onError: (err: any) =>
      toast.error(err?.message || "Failed to align expense vendor names."),
  });

  const expenseRecords = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .sort((a, b) => `${b.date} ${b.created_at}`.localeCompare(`${a.date} ${a.created_at}`)),
    [transactions],
  );

  /** One row per DE reference (latest); keeps non–DE-reference pro-formas by id. */
  const proformasDedupedByRef = useMemo(() => {
    const byKey = new Map<string, ScentProforma>();
    const sorted = [...scentProformas].sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
    sorted.forEach((pf) => {
      const r = normalizeDeRef(pf.reference);
      const key = r && isDeSequenceReference(pf.reference) ? `de:${r}` : `id:${pf.id}`;
      if (!byKey.has(key)) byKey.set(key, pf);
    });
    return Array.from(byKey.values()).sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
  }, [scentProformas]);

  const proformaRefSet = useMemo(() => {
    const s = new Set<string>();
    proformasDedupedByRef.forEach((pf) => {
      const r = normalizeDeRef(pf.reference);
      if (r && isDeSequenceReference(pf.reference)) s.add(r);
    });
    return s;
  }, [proformasDedupedByRef]);

  /**
   * Ledger lines that are not auto-generated twins of an Oils order.
   * DE expenses that match Order History (scent_proformas) use the pro-forma row as canonical.
   */
  const ledgerExpensesWithoutProformaTwin = useMemo(
    () =>
      expenseRecords.filter((t) => {
        const r = normalizeDeRef(t.reference);
        if (r && isDeSequenceReference(t.reference) && proformaRefSet.has(r)) {
          return false;
        }
        if (r && isDeSequenceReference(t.reference)) {
          const campaign = (t.campaign || "").trim().toLowerCase();
          if (campaign === "de orders") {
            return false;
          }
        }
        for (const dr of collectDeRefsInText(t.description)) {
          if (proformaRefSet.has(dr)) return false;
        }
        return true;
      }),
    [expenseRecords, proformaRefSet],
  );

  /** Collapse duplicate accounting lines for the same DE reference (keep newest). */
  const ledgerExpensesForVendorViews = useMemo(() => {
    const byDeRef = new Map<string, AccountingTransaction>();
    const rest: AccountingTransaction[] = [];
    for (const t of ledgerExpensesWithoutProformaTwin) {
      const r = (t.reference || "").trim();
      if (!isDeSequenceReference(r)) {
        rest.push(t);
        continue;
      }
      const key = r.toLowerCase();
      const prev = byDeRef.get(key);
      if (!prev || (t.created_at || "").localeCompare(prev.created_at || "") > 0) {
        byDeRef.set(key, t);
      }
    }
    return [...rest, ...byDeRef.values()].sort((a, b) =>
      `${b.date} ${b.created_at}`.localeCompare(`${a.date} ${a.created_at}`),
    );
  }, [ledgerExpensesWithoutProformaTwin]);

  const evidenceLinkedTransactions = useMemo(() => {
    if (!evidenceProforma) return [];
    const ref = (evidenceProforma.reference || "").trim();
    if (!ref) return [];
    return expenseRecords.filter((t) => {
      if ((t.reference || "").trim() === ref) return true;
      if (t.description?.includes(ref)) return true;
      return false;
    });
  }, [evidenceProforma, expenseRecords]);

  const evidenceLinkedAttachments = useMemo(() => {
    if (!evidenceLinkedTransactions.length) return [];
    return evidenceLinkedTransactions.flatMap((t) => {
      const attachments = attachmentsByTransactionId[t.id] ?? [];
      return attachments.map((attachment) => ({
        transaction: t,
        attachment,
      }));
    });
  }, [evidenceLinkedTransactions, attachmentsByTransactionId]);

  const vendorByNormalizedName = useMemo(() => {
    const m = new Map<string, Vendor>();
    vendors.forEach((v) => {
      const k = normalizeVendorKey(v.name);
      if (k && !m.has(k)) m.set(k, v);
    });
    return m;
  }, [vendors]);

  const expenseStatsByVendorId = useMemo(() => {
    const acc: Record<string, { count: number; total: number }> = {};
    ledgerExpensesForVendorViews.forEach((t) => {
      const v = vendorByNormalizedName.get(normalizeVendorKey(t.vendor));
      if (!v) return;
      if (!acc[v.id]) acc[v.id] = { count: 0, total: 0 };
      acc[v.id].count += 1;
      acc[v.id].total += Math.abs(t.amount);
    });
    return acc;
  }, [ledgerExpensesForVendorViews, vendorByNormalizedName]);

  const unmatchedExpenseLineCount = useMemo(
    () =>
      ledgerExpensesForVendorViews.filter((t) => {
        const key = normalizeVendorKey(t.vendor);
        if (!key) return true;
        return !vendorByNormalizedName.has(key);
      }).length,
    [ledgerExpensesForVendorViews, vendorByNormalizedName],
  );

  const filteredExpenseRecords = useMemo(() => {
    const q = expenseReferenceFilter.trim().toLowerCase();
    const v = expenseVendorFilter.trim().toLowerCase();
    let rows = ledgerExpensesForVendorViews;
    if (q) {
      rows = rows.filter((t) => {
        const ref = (t.reference || "").trim().toLowerCase();
        const desc = (t.description || "").toLowerCase();
        return ref === q || ref.includes(q) || desc.includes(q);
      });
    }
    if (v) {
      rows = rows.filter((t) => (t.vendor || "").trim().toLowerCase() === v);
    }
    return rows;
  }, [ledgerExpensesForVendorViews, expenseReferenceFilter, expenseVendorFilter]);

  const ledgerCoversProformaReference = (pfRef: string | null | undefined) => {
    const r = (pfRef || "").trim().toLowerCase();
    if (!r) return false;
    return expenseRecords.some((t) => {
      if ((t.reference || "").trim().toLowerCase() === r) return true;
      if ((t.description || "").toLowerCase().includes(r)) return true;
      return false;
    });
  };

  const resolveDirectoryVendorForProforma = (pf: ScentProforma): Vendor | null => {
    if (pf.vendor_id) {
      const byId = vendors.find((v) => v.id === pf.vendor_id);
      if (byId) return byId;
    }
    if (pf.customer_name) {
      return vendorByNormalizedName.get(normalizeVendorKey(pf.customer_name)) ?? null;
    }
    return null;
  };

  /** Oils order-history rows for the Expenses tab (same source as /oils Fragrance order history). */
  const filteredProformaOrdersForExpensesTab = useMemo(() => {
    const q = expenseReferenceFilter.trim().toLowerCase();
    const v = expenseVendorFilter.trim().toLowerCase();
    return proformasDedupedByRef.filter((pf) => {
      const pr = normalizeDeRef(pf.reference);
      const supplier = (pf.customer_name || "").trim().toLowerCase();
      const dir = resolveDirectoryVendorForProforma(pf);
      const dirName = (dir?.name || "").trim().toLowerCase();
      if (!q && !v) return true;
      if (q) {
        const refMatch = pr === q || pr.includes(q) || q.includes(pr);
        if (!refMatch) return false;
      }
      if (v) {
        if (supplier !== v && dirName !== v) return false;
      }
      return true;
    });
  }, [
    proformasDedupedByRef,
    expenseReferenceFilter,
    expenseVendorFilter,
    vendors,
    vendorByNormalizedName,
  ]);

  const proformaStatsByVendorId = useMemo(() => {
    const acc: Record<string, { count: number; total: number }> = {};
    proformasDedupedByRef.forEach((pf) => {
      const v = resolveDirectoryVendorForProforma(pf);
      if (!v) return;
      if (!acc[v.id]) acc[v.id] = { count: 0, total: 0 };
      acc[v.id].count += 1;
      acc[v.id].total += Number(pf.total ?? 0) || 0;
    });
    return acc;
  }, [proformasDedupedByRef, vendors, vendorByNormalizedName]);

  const proformaSpendInRange = useMemo(() => {
    const inRange = proformasDedupedByRef.filter((pf) => {
      const d = (pf.proforma_date || pf.created_at?.slice(0, 10) || "").toString();
      return d >= summaryDateFrom && d <= summaryDateTo;
    });
    const byKey: Record<
      string,
      { label: string; count: number; total: number; inDirectory: boolean }
    > = {};
    inRange.forEach((pf) => {
      const v = resolveDirectoryVendorForProforma(pf);
      const key = v?.id ?? `name:${normalizeVendorKey(pf.customer_name) || pf.id}`;
        const label = v?.name ?? (pf.customer_name?.trim() || "Unknown supplier");
      const inDirectory = !!v;
      if (!byKey[key]) {
        byKey[key] = { label, count: 0, total: 0, inDirectory };
      }
      byKey[key].count += 1;
      byKey[key].total += Number(pf.total ?? 0) || 0;
    });
    const rows = Object.entries(byKey)
      .map(([key, row]) => ({ key, ...row }))
      .sort((a, b) => b.total - a.total);
    const rangeTotal = inRange.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return { rows, rangeTotal, inRangeCount: inRange.length };
  }, [proformasDedupedByRef, summaryDateFrom, summaryDateTo, vendors, vendorByNormalizedName]);

  const spendSummary = useMemo(() => {
    const inRange = ledgerExpensesForVendorViews.filter(
      (t) => t.date >= summaryDateFrom && t.date <= summaryDateTo,
    );
    const byVendor = inRange.reduce<Record<string, { total: number; count: number }>>((acc, row) => {
      const key = (row.vendor || "Unassigned").trim() || "Unassigned";
      if (!acc[key]) acc[key] = { total: 0, count: 0 };
      acc[key].total += Math.abs(row.amount);
      acc[key].count += 1;
      return acc;
    }, {});
    const rows = Object.entries(byVendor)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
    const rangeTotal = inRange.reduce((s, t) => s + Math.abs(t.amount), 0);
    return { rows, rangeTotal, inRangeCount: inRange.length };
  }, [ledgerExpensesForVendorViews, summaryDateFrom, summaryDateTo]);

  const monthOnMonth = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const todayDay = now.getDate();

    const thisMonthFrom = toLocalYmd(new Date(curYear, curMonth, 1));
    const thisMonthTo = toLocalYmd(new Date(curYear, curMonth, todayDay));

    const prevRef = new Date(curYear, curMonth - 1, 1);
    const pYear = prevRef.getFullYear();
    const pMonth = prevRef.getMonth();
    const lastDayPrev = new Date(pYear, pMonth + 1, 0).getDate();
    const compareDay = Math.min(todayDay, lastDayPrev);
    const prevMonthFrom = toLocalYmd(new Date(pYear, pMonth, 1));
    const prevMonthTo = toLocalYmd(new Date(pYear, pMonth, compareDay));

    const sumIn = (from: string, to: string) =>
      ledgerExpensesForVendorViews
        .filter((t) => t.date >= from && t.date <= to)
        .reduce((s, t) => s + Math.abs(t.amount), 0);

    const currentPartial = sumIn(thisMonthFrom, thisMonthTo);
    const previousPartial = sumIn(prevMonthFrom, prevMonthTo);
    const delta = currentPartial - previousPartial;
    const pct = previousPartial > 0 ? (delta / previousPartial) * 100 : null;

    return {
      thisMonthFrom,
      thisMonthTo,
      prevMonthFrom,
      prevMonthTo,
      currentPartial,
      previousPartial,
      delta,
      pct,
    };
  }, [ledgerExpensesForVendorViews]);

  const metrics = useMemo(() => {
    const withContact = vendors.filter((v) => !!(v.contact_name || v.contact_phone || v.email)).length;
    const byVendor = ledgerExpensesForVendorViews.reduce<Record<string, number>>((acc, row) => {
      const key = row.vendor || "Unassigned";
      acc[key] = (acc[key] ?? 0) + Math.abs(row.amount);
      return acc;
    }, {});
    const topVendorFromExpensesOnly = Object.entries(byVendor).sort((a, b) => b[1] - a[1])[0];

    const linkedProformas = proformasDedupedByRef.filter((pf) => {
      if (pf.vendor_id && vendors.some((v) => v.id === pf.vendor_id)) return true;
      if (pf.customer_name && vendorByNormalizedName.has(normalizeVendorKey(pf.customer_name)))
        return true;
      return false;
    });
    /** Same scope as Vendor spend summary: ledger lines in range + DE order totals in range (no double count). */
    const totalSpend = spendSummary.rangeTotal + proformaSpendInRange.rangeTotal;

    let topVendorName = "-";
    let topVendorSpendAmt = 0;
    vendors.forEach((v) => {
      const exp = expenseStatsByVendorId[v.id]?.total ?? 0;
      const pf = proformaStatsByVendorId[v.id]?.total ?? 0;
      const combined = exp + pf;
      if (combined > topVendorSpendAmt) {
        topVendorSpendAmt = combined;
        topVendorName = v.name;
      }
    });
    if (topVendorSpendAmt === 0 && topVendorFromExpensesOnly?.[1]) {
      topVendorName = topVendorFromExpensesOnly[0];
      topVendorSpendAmt = topVendorFromExpensesOnly[1];
    }

    const proformaEvidenceWithoutLedger = proformasDedupedByRef.filter((pf) => {
      const ref = (pf.reference || "").trim();
      if (!ref) return false;
      return !ledgerCoversProformaReference(pf.reference);
    });
    const totalExpenseRecords =
      ledgerExpensesForVendorViews.length + proformaEvidenceWithoutLedger.length;

    return {
      total: vendors.length,
      withContact,
      totalExpenseRecords,
      totalSpend,
      topVendor: topVendorName,
      topVendorSpend: topVendorSpendAmt,
      deOrdersLinked: linkedProformas.length,
    };
  }, [
    vendors,
    ledgerExpensesForVendorViews,
    proformasDedupedByRef,
    vendorByNormalizedName,
    expenseStatsByVendorId,
    proformaStatsByVendorId,
  ]);

  const saveVendor = () => {
    if (!form.name.trim()) return;
    if (editingVendorId) {
      updateVendorMutation.mutate({ id: editingVendorId, payload: form });
      return;
    }
    createVendorMutation.mutate();
  };

  const openCreateDialog = () => {
    setEditingVendorId(null);
    setForm(emptyForm);
    setVendorDialogOpen(true);
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setForm({
      name: vendor.name || "",
      vat_number: vendor.vat_number || "",
      company_registration: vendor.company_registration || "",
      street_address: vendor.street_address || "",
      suburb: vendor.suburb || "",
      city: vendor.city || "",
      province: vendor.province || "",
      country: vendor.country || "",
      postal_code: vendor.postal_code || "",
      contact_name: vendor.contact_name || "",
      contact_phone: vendor.contact_phone || "",
      email: vendor.email || "",
      notes: vendor.notes || "",
    });
    setVendorDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="ops-workspace">
        <PageHero
          eyebrow="Supply Network"
          title="Vendors"
          description="Directory, accounting expenses, and fragrance DE orders (Oils pro-formas) linked by vendor_id or supplier name."
          actions={
            <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add vendor
            </Button>
          }
        />

        <div className="segmented-tabs mb-4">
          <button
            type="button"
            className={`segmented-tab ${activeTab === "directory" ? "segmented-tab-active" : ""}`}
            onClick={() => setActiveTab("directory")}
          >
            Vendor directory
          </button>
          <button
            type="button"
            className={`segmented-tab ${activeTab === "summary" ? "segmented-tab-active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            Vendor spend summary
          </button>
          <button
            type="button"
            className={`segmented-tab ${activeTab === "expenses" ? "segmented-tab-active" : ""}`}
            onClick={() => setActiveTab("expenses")}
          >
            Expense records
          </button>
          <button
            type="button"
            className={`segmented-tab ${activeTab === "deOrders" ? "segmented-tab-active" : ""}`}
            onClick={() => setActiveTab("deOrders")}
          >
            DE orders (Oils)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 text-xs">
          <div className="metric-card">
            <span className="metric-label">Total vendors</span>
            <span className="metric-value">{metrics.total}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">With contact details</span>
            <span className="metric-value">{metrics.withContact}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Expense records</span>
            <span className="metric-value">{metrics.totalExpenseRecords}</span>
            <span className="metric-note">Ledger lines + DE orders without a ledger match</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total spend</span>
            <span className="metric-value">R{metrics.totalSpend.toFixed(2)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Top vendor</span>
            <span className="metric-value">{metrics.topVendor === "-" ? "-" : metrics.topVendor}</span>
            <span className="metric-note">
              {metrics.topVendorSpend > 0 ? `R${metrics.topVendorSpend.toFixed(2)}` : "No spend yet"}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">DE orders linked</span>
            <span className="metric-value">{metrics.deOrdersLinked}</span>
            <span className="metric-note">Oils pro-formas → directory</span>
          </div>
        </div>

        {activeTab === "directory" && (
          <div className="data-shell overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">VAT</th>
                  <th className="px-4 py-3 text-left">Company Reg</th>
                  <th className="px-4 py-3 text-left">Street Address</th>
                  <th className="px-4 py-3 text-left">Surburb</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-left">Province</th>
                  <th className="px-4 py-3 text-left">Country</th>
                  <th className="px-4 py-3 text-left">Postal Code</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-4 py-3 text-right">DE orders</th>
                  <th className="px-4 py-3 text-right">Pro-forma total</th>
                  <th className="px-4 py-3 text-right">Linked expenses</th>
                  <th className="px-4 py-3 text-right">Spend (all time)</th>
                  <th className="px-4 py-3 text-right sticky right-0 bg-background/95 backdrop-blur">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && vendors.length === 0 && (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> No vendors yet.
                      </div>
                    </td>
                  </tr>
                )}
                {vendors.map((vendor) => {
                  const stats = expenseStatsByVendorId[vendor.id];
                  const pfStats = proformaStatsByVendorId[vendor.id];
                  return (
                  <tr key={vendor.id} className="border-b border-border/20">
                    <td className="px-4 py-3 font-medium text-foreground">{vendor.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.vat_number || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.company_registration || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.street_address || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.suburb || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.city || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.province || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.country || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.postal_code || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.contact_name || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.contact_phone || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.email || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendor.notes || "-"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {pfStats?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      R{(pfStats?.total ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {stats?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      R{(stats?.total ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right sticky right-0 bg-background/95 backdrop-blur">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 mr-2 text-xs"
                        onClick={() => openEditDialog(vendor)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteVendorMutation.mutate(vendor.id)}
                        disabled={deleteVendorMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="space-y-3">
            <div className="toolbar-panel">
              <div className="flex flex-wrap items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Range for vendor totals</span>
                <Input
                  type="date"
                  className="h-8 w-[140px] text-xs"
                  value={summaryDateFrom}
                  onChange={(e) => setSummaryDateFrom(e.target.value)}
                />
                <Input
                  type="date"
                  className="h-8 w-[140px] text-xs"
                  value={summaryDateTo}
                  onChange={(e) => setSummaryDateTo(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const { dateFrom, dateTo } = getMonthToDateRange();
                    setSummaryDateFrom(dateFrom);
                    setSummaryDateTo(dateTo);
                  }}
                >
                  This month to date
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="metric-card">
                <span className="metric-label">Month to date</span>
                <span className="metric-value">R{monthOnMonth.currentPartial.toFixed(2)}</span>
                <span className="metric-note">
                  {monthOnMonth.thisMonthFrom} – {monthOnMonth.thisMonthTo}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Same days last month</span>
                <span className="metric-value">R{monthOnMonth.previousPartial.toFixed(2)}</span>
                <span className="metric-note">
                  {monthOnMonth.prevMonthFrom} – {monthOnMonth.prevMonthTo}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Change (MoM)</span>
                <span
                  className={`metric-value ${
                    monthOnMonth.delta >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {monthOnMonth.delta >= 0 ? "+" : ""}R{monthOnMonth.delta.toFixed(2)}
                </span>
                <span className="metric-note">
                  {monthOnMonth.pct == null
                    ? "—"
                    : `${monthOnMonth.pct >= 0 ? "+" : ""}${monthOnMonth.pct.toFixed(1)}%`}
                </span>
              </div>
            </div>

            <div className="data-shell overflow-x-auto">
              <div className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Grouped by expense vendor text; &quot;Directory&quot; shows when it matches a vendor record
                  (same name, ignoring case and extra spaces).
                </div>
                <div className="text-muted-foreground">
                  {spendSummary.inRangeCount} line(s) · R{spendSummary.rangeTotal.toFixed(2)} in range
                </div>
              </div>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">Directory</th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {spendSummary.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No spend in this date range.
                      </td>
                    </tr>
                  ) : (
                    spendSummary.rows.map((row) => {
                      const share =
                        spendSummary.rangeTotal > 0
                          ? (row.total / spendSummary.rangeTotal) * 100
                          : 0;
                      const dirMatch = vendorByNormalizedName.get(
                        normalizeVendorKey(row.name),
                      );
                      return (
                        <tr key={row.name} className="border-b border-border/20">
                          <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                          <td className="px-4 py-3">
                            {dirMatch ? (
                              <Badge variant="outline" className="font-normal">
                                Matched · {dirMatch.name}
                              </Badge>
                            ) : row.name === "Unassigned" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Badge variant="secondary" className="font-normal">
                                No directory match
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                          <td className="px-4 py-3 text-right">R{row.total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-shell overflow-x-auto">
              <div className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Fragrance DE orders (Oils pro-formas) in the same date range. Linked when{" "}
                  <span className="font-medium">vendor_id</span> matches the directory or supplier name
                  matches (ignoring case and spaces).
                </div>
                <div className="text-muted-foreground">
                  {proformaSpendInRange.inRangeCount} order(s) · R{proformaSpendInRange.rangeTotal.toFixed(2)}{" "}
                  in range
                </div>
              </div>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-4 py-3 text-left">Supplier / group</th>
                    <th className="px-4 py-3 text-left">Directory</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Total (incl. VAT)</th>
                    <th className="px-4 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {proformaSpendInRange.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No DE orders in this date range.
                      </td>
                    </tr>
                  ) : (
                    proformaSpendInRange.rows.map((row) => {
                      const share =
                        proformaSpendInRange.rangeTotal > 0
                          ? (row.total / proformaSpendInRange.rangeTotal) * 100
                          : 0;
                      return (
                        <tr key={row.key} className="border-b border-border/20">
                          <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                          <td className="px-4 py-3">
                            {row.inDirectory ? (
                              <Badge variant="outline" className="font-normal">
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="font-normal">
                                Not in directory
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                          <td className="px-4 py-3 text-right">R{row.total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="data-shell overflow-x-auto">
            <div className="px-4 py-3 border-b border-border/30 text-xs flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4 shrink-0" />
                <span>
                  Expenses match a directory vendor when the vendor text is the same (ignoring case and
                  extra spaces).
                </span>
                {unmatchedExpenseLineCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {unmatchedExpenseLineCount} line(s) have no matching vendor name.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {expenseVendorFilter ? (
                  <Badge variant="secondary" className="font-normal gap-1.5">
                    Vendor: {expenseVendorFilter}
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline text-foreground/80"
                      onClick={() => {
                        setExpenseVendorFilter("");
                        setSearchParams(
                          (prev) => {
                            const n = new URLSearchParams(prev);
                            n.delete("vendor");
                            return n;
                          },
                          { replace: true },
                        );
                      }}
                    >
                      Clear
                    </button>
                  </Badge>
                ) : null}
                <Label className="text-muted-foreground whitespace-nowrap shrink-0">Reference</Label>
                <Input
                  className="h-8 w-[140px] font-mono text-xs"
                  placeholder="DE-000001"
                  value={expenseReferenceFilter}
                  onChange={(e) => setExpenseReferenceFilter(e.target.value)}
                  aria-label="Filter expenses by reference"
                />
                <span className="text-muted-foreground tabular-nums">
                  {filteredExpenseRecords.length + filteredProformaOrdersForExpensesTab.length} shown
                  {ledgerExpensesForVendorViews.length > 0
                    ? ` · ${ledgerExpensesForVendorViews.length} ledger line(s) (DE orders use Oils history)`
                    : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setExpenseReferenceFilter("")}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => alignExpenseVendorNamesMutation.mutate()}
                  disabled={alignExpenseVendorNamesMutation.isPending || vendors.length === 0}
                >
                  {alignExpenseVendorNamesMutation.isPending
                    ? "Aligning…"
                    : "Align expense names to directory"}
                </Button>
              </div>
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Directory</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledgerExpensesForVendorViews.length === 0 &&
                proformasDedupedByRef.length === 0 &&
                !expenseReferenceFilter.trim() &&
                !expenseVendorFilter.trim() ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No expenses yet. Create DE orders under Oils → Fragrance order history, or add
                      non-DE expenses in Accounting / Expenses.
                    </td>
                  </tr>
                ) : filteredExpenseRecords.length === 0 &&
                  filteredProformaOrdersForExpensesTab.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nothing matches this reference or vendor filter. Try clearing filters or adjust
                      the reference.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredExpenseRecords.map((row) => {
                      const category = categories.find((c) => c.id === row.category_id);
                      const dirVendor = vendorByNormalizedName.get(
                        normalizeVendorKey(row.vendor),
                      );
                      const nameDiffers =
                        dirVendor &&
                        (row.vendor || "").trim() !== dirVendor.name.trim();
                      return (
                        <tr key={row.id} className="border-b border-border/20">
                          <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                          <td className="px-4 py-3">{row.vendor || "—"}</td>
                          <td className="px-4 py-3">
                            {dirVendor ? (
                              <span className="inline-flex flex-col gap-0.5">
                                <Badge variant="outline" className="w-fit font-normal">
                                  {dirVendor.name}
                                </Badge>
                                {nameDiffers && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                    Use &quot;Align…&quot; to use exact directory spelling
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.description || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{category?.name || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.order_id || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.reference || "-"}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            R{Math.abs(row.amount).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProformaOrdersForExpensesTab.map((pf) => {
                      const dir = resolveDirectoryVendorForProforma(pf);
                      const dateStr = (
                        pf.proforma_date ||
                        pf.created_at?.slice(0, 10) ||
                        ""
                      ).toString();
                      const hasLedgerTwin = ledgerCoversProformaReference(pf.reference);
                      return (
                        <tr
                          key={`pf-order-history-${pf.id}`}
                          className="border-b border-border/20 bg-muted/25"
                        >
                          <td className="px-4 py-3 text-muted-foreground">{dateStr || "—"}</td>
                          <td className="px-4 py-3">{pf.customer_name || "—"}</td>
                          <td className="px-4 py-3">
                            {dir ? (
                              <Badge variant="outline" className="font-normal">
                                {dir.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {hasLedgerTwin
                              ? "Fragrance DE order (Oils order history — canonical; duplicate ledger lines hidden)."
                              : "Fragrance DE order (Oils order history). No matching ledger line yet."}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="font-normal">
                              Pro-forma
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">—</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {pf.reference || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            R{(Number(pf.total) || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "deOrders" && (
          <div className="data-shell overflow-x-auto">
            <div className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <span>
                All fragrance purchase orders from Oils (pro-formas). Directory match uses{" "}
                <span className="font-medium text-foreground">vendor_id</span> first, then supplier name.
              </span>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to="/oils">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Oils
                </Link>
              </Button>
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Supplier on order</th>
                  <th className="px-4 py-3 text-left">Directory</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {proformasDedupedByRef.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No pro-formas yet. Create orders under Oils → Pro-forma.
                    </td>
                  </tr>
                ) : (
                  [...proformasDedupedByRef]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((pf) => {
                      const dir = resolveDirectoryVendorForProforma(pf);
                      const dateStr = (
                        pf.proforma_date ||
                        pf.created_at?.slice(0, 10) ||
                        ""
                      ).toString();
                      const refTrim = (pf.reference || "").trim();
                      const linkedMatches = refTrim
                        ? expenseRecords.filter(
                            (t) =>
                              (t.reference || "").trim() === refTrim ||
                              (t.description || "").includes(refTrim),
                          )
                        : [];
                      const linkedCount = refTrim
                        ? linkedMatches.reduce(
                            (sum, t) => sum + (attachmentsByTransactionId[t.id]?.length ?? 0),
                            0,
                          )
                        : 0;
                      return (
                        <tr key={pf.id} className="border-b border-border/20">
                          <td className="px-4 py-3 text-muted-foreground">{dateStr || "—"}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {pf.reference || "—"}
                          </td>
                          <td className="px-4 py-3">{pf.customer_name || "—"}</td>
                          <td className="px-4 py-3">
                            {dir ? (
                              <Badge variant="outline" className="font-normal">
                                {dir.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="font-normal">
                                No match
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            R{(Number(pf.total) || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">
                            {pf.status || "pending"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setEvidenceProforma(pf)}
                              title="Show invoice/receipt attachments linked to this DE order"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {linkedCount > 0 ? `Attachments (${linkedCount})` : "Attachments"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={!!evidenceProforma}
        onOpenChange={(open) => {
          if (!open) setEvidenceProforma(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Attachments for this DE order</DialogTitle>
            <DialogDescription>
              {evidenceProforma ? (
                <>
                  Pro-forma reference{" "}
                  <span className="font-mono text-foreground">
                    {evidenceProforma.reference?.trim() || "—"}
                  </span>
                  {" · "}
                  Supplier: {evidenceProforma.customer_name || "—"}
                  {" · "}
                  Order total R{(Number(evidenceProforma.total) || 0).toFixed(2)}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {!evidenceProforma ? null : !(evidenceProforma.reference || "").trim() ? (
            <p className="text-sm text-muted-foreground">
              This order has no reference yet, so attachments cannot be matched automatically. Add a
              reference in Oils, then use the same value on Accounting entries.
            </p>
          ) : evidenceLinkedTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounting records found with this reference on the transaction or in the description
              (Oils saves lines like &quot;DE Order DE-000001 — …&quot;).
            </p>
          ) : evidenceLinkedAttachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Accounting record(s) exist for this DE reference, but no receipt/invoice attachments
              are uploaded yet. Open Accounting and click <span className="font-medium">Attach</span>{" "}
              on the matching REF row.
            </p>
          ) : (
            <div className="overflow-auto rounded-md border border-border/50 text-xs min-h-0 flex-1">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    <th className="px-3 py-2 text-left">Uploaded</th>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-left">Transaction date</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceLinkedAttachments.map(({ transaction, attachment }) => {
                    return (
                      <tr key={attachment.id} className="border-b border-border/20">
                        <td className="px-3 py-2 text-muted-foreground">
                          {attachment.uploaded_at?.slice(0, 10) || "—"}
                        </td>
                        <td className="px-3 py-2">{attachment.file_name || attachment.file_url}</td>
                        <td className="px-3 py-2 text-muted-foreground">{transaction.date}</td>
                        <td className="px-3 py-2">{transaction.vendor || "—"}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {transaction.reference || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {transaction.description || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEvidenceProforma(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={vendorDialogOpen}
        onOpenChange={(open) => {
          setVendorDialogOpen(open);
          if (!open) {
            setEditingVendorId(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingVendorId ? "Edit vendor" : "Add vendor"}</DialogTitle>
            <DialogDescription>
              Capture legal, contact, and address details for supplier records.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Vendor name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>VAT number</Label>
              <Input
                value={form.vat_number}
                onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Company reg #</Label>
              <Input
                value={form.company_registration}
                onChange={(e) => setForm((f) => ({ ...f, company_registration: e.target.value }))}
              />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <Label>Street Address</Label>
              <Input
                value={form.street_address}
                onChange={(e) => setForm((f) => ({ ...f, street_address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Surburb</Label>
              <Input
                value={form.suburb}
                onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Province</Label>
              <Input
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVendorDialogOpen(false);
                setEditingVendorId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveVendor}
              disabled={
                !form.name.trim() || createVendorMutation.isPending || updateVendorMutation.isPending
              }
            >
              {editingVendorId
                ? updateVendorMutation.isPending
                  ? "Saving..."
                  : "Save changes"
                : createVendorMutation.isPending
                  ? "Adding..."
                  : "Add vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Vendors;

