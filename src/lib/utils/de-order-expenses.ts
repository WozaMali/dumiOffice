import { accountingApi } from "@/lib/api/accounting";
import type { AccountingTransaction, ScentProforma } from "@/types/database";

export const normalizeDeRef = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

export const isDeSequenceReference = (value: string | null | undefined) =>
  /^de-\d+$/i.test((value ?? "").trim());

export const isApprovedDeProforma = (pf: Pick<ScentProforma, "status">) =>
  (pf.status ?? "pending") === "approved";

export type ApprovedDeExpenseRow = {
  id: string;
  proformaId: string;
  transactionId?: string;
  date: string;
  invoiceDate?: string;
  vendor: string;
  description: string;
  reference: string;
  subtotal: number;
  vat: number;
  amount: number;
  status: "approved";
};

export function dedupeProformasByDeRef(proformas: ScentProforma[]): ScentProforma[] {
  const byKey = new Map<string, ScentProforma>();
  const sorted = [...proformas].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || ""),
  );
  for (const pf of sorted) {
    const ref = normalizeDeRef(pf.reference);
    const key =
      ref && isDeSequenceReference(pf.reference) ? `de:${ref}` : `id:${pf.id}`;
    if (!byKey.has(key)) byKey.set(key, pf);
  }
  return Array.from(byKey.values());
}

export function listApprovedDeProformas(proformas: ScentProforma[]): ScentProforma[] {
  return dedupeProformasByDeRef(proformas).filter(
    (pf) => isApprovedDeProforma(pf) && isDeSequenceReference(pf.reference),
  );
}

export function buildApprovedDeRefSet(proformas: ScentProforma[]): Set<string> {
  const refs = new Set<string>();
  for (const pf of listApprovedDeProformas(proformas)) {
    const ref = normalizeDeRef(pf.reference);
    if (ref) refs.add(ref);
  }
  return refs;
}

export function buildPendingDeRefSet(proformas: ScentProforma[]): Set<string> {
  const refs = new Set<string>();
  for (const pf of dedupeProformasByDeRef(proformas)) {
    if (isApprovedDeProforma(pf)) continue;
    const ref = normalizeDeRef(pf.reference);
    if (ref && isDeSequenceReference(pf.reference)) refs.add(ref);
  }
  return refs;
}

export function proformaForExpenseTransaction(
  tx: AccountingTransaction,
  proformas: ScentProforma[],
): ScentProforma | undefined {
  const approved = listApprovedDeProformas(proformas);
  const ref = normalizeDeRef(tx.reference);
  if (ref) {
    return approved.find((pf) => normalizeDeRef(pf.reference) === ref);
  }
  const desc = (tx.description || "").toLowerCase();
  return approved.find((pf) => {
    const r = normalizeDeRef(pf.reference);
    return r ? desc.includes(r) : false;
  });
}

export function getProformaExpenseDate(pf: ScentProforma): string {
  return (
    pf.proforma_date ||
    pf.invoice_date ||
    pf.created_at?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10)
  );
}

export function buildApprovedDeExpenseRows(
  proformas: ScentProforma[],
  transactions: AccountingTransaction[],
): ApprovedDeExpenseRow[] {
  return listApprovedDeProformas(proformas)
    .map((pf) => {
      const ref = (pf.reference || "").trim();
      const refKey = normalizeDeRef(ref);
      const tx = transactions.find(
        (t) =>
          t.type === "expense" &&
          refKey &&
          transactionMatchesApprovedDeRef(t, new Set([refKey])),
      );
      return {
        id: tx?.id ?? `pf-${pf.id}`,
        proformaId: pf.id,
        transactionId: tx?.id,
        date: getProformaExpenseDate(pf),
        invoiceDate: pf.invoice_date || undefined,
        vendor: (pf.customer_name || "").trim(),
        description: (pf.name || "Fragrance purchase").trim(),
        reference: ref,
        subtotal: Number(pf.subtotal ?? 0) || 0,
        vat: Number(pf.vat ?? 0) || 0,
        amount: Number(pf.total ?? 0) || 0,
        status: "approved" as const,
      };
    })
    .sort((a, b) => `${b.date} ${b.reference}`.localeCompare(`${a.date} ${a.reference}`));
}

export const toLocalIsoDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isIsoDateInRange = (date: string, from: string, to: string) => {
  const d = (date || "").slice(0, 10);
  if (!d) return false;
  if (from && d < from.slice(0, 10)) return false;
  if (to && d > to.slice(0, 10)) return false;
  return true;
};

export const getYearToDateRange = () => ({
  from: `${new Date().getFullYear()}-01-01`,
  to: toLocalIsoDate(),
});

/** Earliest approved DE order through today — keeps all approved orders visible by default. */
export const getApprovedDeExpenseDisplayRange = (proformas: ScentProforma[]) => {
  const approved = listApprovedDeProformas(proformas);
  if (approved.length === 0) return getYearToDateRange();
  const dates = approved.map(getProformaExpenseDate).sort();
  return { from: dates[0]!, to: toLocalIsoDate() };
};

export function filterApprovedDeExpenseRowsByDate(
  rows: ApprovedDeExpenseRow[],
  from: string,
  to: string,
): ApprovedDeExpenseRow[] {
  return rows.filter((row) => isIsoDateInRange(row.date, from, to));
}

/** Map approved DE row to a ledger transaction (uses linked row when present). */
export function approvedDeExpenseRowAsTransaction(
  row: ApprovedDeExpenseRow,
  transactions: AccountingTransaction[],
): AccountingTransaction {
  const linked = row.transactionId
    ? transactions.find((t) => t.id === row.transactionId)
    : undefined;
  if (linked) return linked;
  return {
    id: row.id,
    date: row.date,
    type: "expense",
    description: row.description,
    amount: -Math.abs(row.amount),
    currency: "ZAR",
    reference: row.reference,
    vendor: row.vendor,
    campaign: "DE Orders",
    created_at: row.date,
  };
}

/** Expense ledger lines auto-generated from Oils DE order history. */
export function isDeOrderExpenseTransaction(tx: AccountingTransaction): boolean {
  if (tx.type !== "expense") return false;
  if (normalizeDeRef(tx.reference) && isDeSequenceReference(tx.reference)) return true;
  if ((tx.campaign || "").trim().toLowerCase() === "de orders") return true;
  if (/de order\s+de-\d+/i.test(tx.description || "")) return true;
  return false;
}

export function transactionMatchesApprovedDeRef(
  tx: AccountingTransaction,
  approvedRefs: Set<string>,
): boolean {
  const ref = normalizeDeRef(tx.reference);
  if (ref && approvedRefs.has(ref)) return true;
  const desc = (tx.description || "").toLowerCase();
  for (const approvedRef of approvedRefs) {
    if (desc.includes(approvedRef)) return true;
  }
  return false;
}

export function filterApprovedDeOrderExpenses(
  transactions: AccountingTransaction[],
  proformas: ScentProforma[],
): AccountingTransaction[] {
  const approvedRefs = buildApprovedDeRefSet(proformas);
  return transactions.filter(
    (t) => t.type === "expense" && transactionMatchesApprovedDeRef(t, approvedRefs),
  );
}

async function findMaterialsCategoryId(): Promise<string | undefined> {
  const categories = await accountingApi.listCategories();
  return categories.find(
    (c) =>
      c.kind === "expense" &&
      /(material|packaging|raw|procurement|supplier|sourcing)/i.test(c.name || ""),
  )?.id;
}

function expectedExpenseFields(pf: ScentProforma, categoryId?: string) {
  const ref = (pf.reference || "").trim();
  return {
    date: getProformaExpenseDate(pf),
    type: "expense" as const,
    category_id: categoryId ?? null,
    amount: -Math.abs(Number(pf.total ?? 0)),
    description: (pf.name || "Fragrance purchase").trim(),
    reference: ref,
    vendor: pf.customer_name || undefined,
    campaign: "DE Orders",
  };
}

export async function createDeOrderExpenseFromProforma(
  pf: ScentProforma,
  options?: { categoryId?: string },
): Promise<AccountingTransaction | null> {
  if (!isApprovedDeProforma(pf)) return null;
  const ref = (pf.reference || "").trim();
  if (!ref || !isDeSequenceReference(ref)) return null;

  const categoryId = options?.categoryId ?? (await findMaterialsCategoryId());
  const fields = expectedExpenseFields(pf, categoryId);

  return accountingApi.createTransaction({
    ...fields,
    created_by: "Admin",
  });
}

export async function ensureDeOrderExpenseFromProforma(
  pf: ScentProforma,
): Promise<AccountingTransaction | null> {
  if (!isApprovedDeProforma(pf)) return null;
  const ref = normalizeDeRef(pf.reference);
  if (!ref || !isDeSequenceReference(pf.reference)) return null;

  const transactions = await accountingApi.listTransactions();
  const existing = transactions.find(
    (t) => isDeOrderExpenseTransaction(t) && transactionMatchesApprovedDeRef(t, new Set([ref])),
  );
  if (existing) return existing;

  return createDeOrderExpenseFromProforma(pf);
}

/**
 * Keeps accounting expenses aligned with Oils order history:
 * only approved DE orders have ledger expenses; pending orders are removed.
 */
export async function syncApprovedDeOrderExpenses(
  proformas: ScentProforma[],
  transactions: AccountingTransaction[],
): Promise<{ created: number; removed: number; deduped: number; updated: number }> {
  const approvedRefs = buildApprovedDeRefSet(proformas);
  const pendingRefs = buildPendingDeRefSet(proformas);
  const deExpenseTxs = transactions.filter(isDeOrderExpenseTransaction);

  const removedIds = new Set<string>();
  let removed = 0;

  for (const tx of deExpenseTxs) {
    if (transactionMatchesApprovedDeRef(tx, approvedRefs)) continue;

    const ref = normalizeDeRef(tx.reference);
    const linkedPending = ref ? pendingRefs.has(ref) : false;
    const isDeCampaign = (tx.campaign || "").trim().toLowerCase() === "de orders";
    const mentionsDeRef =
      (ref && isDeSequenceReference(tx.reference)) ||
      /de-\d+/i.test(tx.description || "");

    if (linkedPending || isDeCampaign || mentionsDeRef) {
      await accountingApi.deleteTransaction(tx.id);
      removedIds.add(tx.id);
      removed += 1;
    }
  }

  const remaining = transactions.filter((t) => !removedIds.has(t.id));
  const remainingDe = remaining.filter(isDeOrderExpenseTransaction);

  let deduped = 0;
  const byRef = new Map<string, AccountingTransaction[]>();
  for (const tx of remainingDe) {
    const ref = normalizeDeRef(tx.reference);
    if (!ref) continue;
    const list = byRef.get(ref) ?? [];
    list.push(tx);
    byRef.set(ref, list);
  }
  for (const group of byRef.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) =>
      `${a.created_at || ""}`.localeCompare(`${b.created_at || ""}`),
    );
    for (const tx of sorted.slice(0, -1)) {
      await accountingApi.deleteTransaction(tx.id);
      removedIds.add(tx.id);
      deduped += 1;
    }
  }

  let updated = 0;
  let created = 0;
  const seenRefs = new Set<string>();
  const categoryId = await findMaterialsCategoryId();

  for (const pf of listApprovedDeProformas(proformas)) {
    const ref = normalizeDeRef(pf.reference);
    if (!ref) continue;
    if (seenRefs.has(ref)) continue;
    seenRefs.add(ref);

    const expected = expectedExpenseFields(pf, categoryId);
    const existing = remaining.find(
      (t) =>
        !removedIds.has(t.id) &&
        isDeOrderExpenseTransaction(t) &&
        transactionMatchesApprovedDeRef(t, new Set([ref])),
    );

    if (existing) {
      const needsUpdate =
        Math.abs(Number(existing.amount) - Number(expected.amount)) > 0.009 ||
        existing.date !== expected.date ||
        (existing.vendor || "") !== (expected.vendor || "") ||
        (existing.description || "") !== expected.description ||
        (existing.reference || "").trim() !== (expected.reference || "").trim();

      if (needsUpdate) {
        await accountingApi.updateTransaction(existing.id, {
          date: expected.date,
          amount: expected.amount,
          vendor: expected.vendor ?? null,
          description: expected.description,
          reference: expected.reference,
          campaign: expected.campaign,
          category_id: expected.category_id,
        });
        updated += 1;
      }
      continue;
    }

    await createDeOrderExpenseFromProforma(pf, { categoryId });
    created += 1;
  }

  return { created, removed, deduped, updated };
}
