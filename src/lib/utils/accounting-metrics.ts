import type { AccountingTransaction, Order, Product } from "@/types/database";
import { isIsoDateInRange } from "@/lib/utils/de-order-expenses";

export interface AccountingMetrics {
  salesIncome: number;
  manualIncome: number;
  totalIncome: number;
  salesLinkedExpense: number;
  manualExpense: number;
  totalExpense: number;
  netProfit: number;
  ledgerNet: number;
  paidRevenue: number;
  outstanding: number;
  stockValue: number;
  stockCostValue: number;
  expenseRatio: number | null;
  collectionRate: number | null;
}

const sumAmounts = (rows: AccountingTransaction[]) =>
  rows.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);

export function computeAccountingMetrics(params: {
  transactions: AccountingTransaction[];
  orders: Order[];
  products: Product[];
  dateFrom: string;
  dateTo: string;
}): AccountingMetrics {
  const { transactions, orders, products, dateFrom, dateTo } = params;

  const transactionsInRange = transactions.filter((t) => isIsoDateInRange(t.date, dateFrom, dateTo));
  const incomeTx = transactionsInRange.filter((t) => t.type === "income");
  const expenseTx = transactionsInRange.filter((t) => t.type === "expense");

  const salesIncome = sumAmounts(incomeTx.filter((t) => !!t.order_id));
  const manualIncome = sumAmounts(incomeTx.filter((t) => !t.order_id));
  const totalIncome = salesIncome + manualIncome;

  const salesLinkedExpense = sumAmounts(expenseTx.filter((t) => !!t.order_id));
  const manualExpense = sumAmounts(expenseTx.filter((t) => !t.order_id));
  const totalExpense = salesLinkedExpense + manualExpense;

  const ordersInRange = orders.filter((o) => o.date >= dateFrom && o.date <= dateTo);
  const outstanding = ordersInRange
    .filter((o) => o.payment_status === "Pending")
    .reduce((sum, o) => sum + o.grand_total, 0);

  const stockValue = products.reduce((sum, p) => sum + (p.price || 0) * p.stock_on_hand, 0);
  const stockCostValue = products.reduce(
    (sum, p) => sum + (p.cost ?? 0) * p.stock_on_hand,
    0,
  );

  const netProfit = totalIncome - totalExpense;
  const ledgerNet = manualIncome - manualExpense;

  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : null;
  const collectedBase = salesIncome + outstanding;
  const collectionRate = collectedBase > 0 ? salesIncome / collectedBase : null;

  return {
    salesIncome,
    manualIncome,
    totalIncome,
    salesLinkedExpense,
    manualExpense,
    totalExpense,
    netProfit,
    ledgerNet,
    paidRevenue: salesIncome,
    outstanding,
    stockValue,
    stockCostValue,
    expenseRatio,
    collectionRate,
  };
}
