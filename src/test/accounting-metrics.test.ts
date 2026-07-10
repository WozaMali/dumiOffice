import { describe, it, expect } from "vitest";
import { computeAccountingMetrics } from "@/lib/utils/accounting-metrics";
import type { AccountingTransaction, Order, Product } from "@/types/database";

const baseOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: "order-1",
    reference: "ORD-001",
    channel: "Online Orders",
    status: "Delivered",
    stage: "Completed",
    subtotal: 1000,
    shipping_fee: 0,
    discount: 0,
    tax: 0,
    grand_total: 1000,
    currency: "ZAR",
    payment_status: "Pending",
    location: "JHB",
    score: "",
    findings: "",
    customer_name: "Test",
    date: "2026-03-15",
    created_at: "2026-03-15",
    ...overrides,
  }) as Order;

const baseProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: "prod-1",
    sku: "SKU-1",
    product_name: "Test",
    product_category: "Perfume",
    price: 500,
    cost: 200,
    stock_on_hand: 10,
    stock_threshold: 5,
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  }) as Product;

const txn = (overrides: Partial<AccountingTransaction>): AccountingTransaction =>
  ({
    id: "tx-1",
    date: "2026-03-10",
    type: "income",
    amount: 0,
    currency: "ZAR",
    created_at: "2026-03-10",
    ...overrides,
  }) as AccountingTransaction;

describe("computeAccountingMetrics", () => {
  it("calculates net profit from all income minus all expenses", () => {
    const transactions = [
      txn({ id: "1", type: "income", amount: 5000, order_id: "order-1" }),
      txn({ id: "2", type: "income", amount: 1200 }),
      txn({ id: "3", type: "expense", amount: 800 }),
      txn({ id: "4", type: "expense", amount: 400, order_id: "order-1" }),
    ];

    const metrics = computeAccountingMetrics({
      transactions,
      orders: [],
      products: [],
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });

    expect(metrics.salesIncome).toBe(5000);
    expect(metrics.manualIncome).toBe(1200);
    expect(metrics.totalIncome).toBe(6200);
    expect(metrics.totalExpense).toBe(1200);
    expect(metrics.netProfit).toBe(5000);
    expect(metrics.ledgerNet).toBe(400);
  });

  it("sums outstanding from pending orders in range", () => {
    const metrics = computeAccountingMetrics({
      transactions: [],
      orders: [
        baseOrder({ grand_total: 1929.9, payment_status: "Pending" }),
        baseOrder({ id: "order-2", date: "2025-12-01", grand_total: 500, payment_status: "Pending" }),
      ],
      products: [],
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });

    expect(metrics.outstanding).toBe(1929.9);
  });

  it("computes stock value at sell price and cost", () => {
    const metrics = computeAccountingMetrics({
      transactions: [],
      orders: [],
      products: [baseProduct({ price: 500, cost: 200, stock_on_hand: 10 })],
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });

    expect(metrics.stockValue).toBe(5000);
    expect(metrics.stockCostValue).toBe(2000);
  });
});
