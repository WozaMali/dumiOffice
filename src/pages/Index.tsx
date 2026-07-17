import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShoppingBag,
  ShoppingCart,
  Package,
  Users,
  Percent,
  MessageCircle,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ordersApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { customersApi } from "@/lib/api/customers";
import type { Customer, Order, Product } from "@/types/database";

const Index = () => {
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });

  const navigate = useNavigate();
  const openOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.stage !== "Completed" &&
          o.status !== "Cancelled" &&
          o.status !== "Returned",
      ).length,
    [orders],
  );

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const openOrders = orders.filter(
      (o) =>
        o.stage !== "Completed" &&
        o.status !== "Cancelled" &&
        o.status !== "Returned",
    );

    const overdueOpen = openOrders.filter((o) => {
      const d = new Date(o.date);
      return d < now && o.stage !== "Completed";
    });

    const ordersThisMonth = orders.filter((o) => {
      const d = new Date(o.date);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });

    const deliveredThisMonth = ordersThisMonth.filter(
      (o) => o.status === "Delivered",
    ).length;
    const onTimeRate =
      ordersThisMonth.length > 0
        ? Math.round((deliveredThisMonth / ordersThisMonth.length) * 100)
        : 0;

    const lowStockSkus = products.filter(
      (p) => p.stock_on_hand <= p.stock_threshold,
    ).length;

    const loyalCustomers = customers.filter((c) => c.total_orders >= 2).length;

    const returnCount = orders.filter((o) => o.status === "Returned").length;
    const brandHealth =
      orders.length > 0
        ? Math.max(50, 100 - Math.round((returnCount / orders.length) * 50))
        : 100;

    return [
      {
        label: "Orders in motion",
        value: openOrders.length.toString(),
        helper: overdueOpen.length ? `${overdueOpen.length} needing attention` : "Steady fulfilment rhythm",
        icon: ShoppingCart,
        tone: "text-primary",
        delta: "Client fulfilment",
      },
      {
        label: "Orders this month",
        value: ordersThisMonth.length.toString(),
        helper:
          ordersThisMonth.length > 0
            ? `${onTimeRate}% delivered on tempo`
            : "Awaiting the next collection run",
        icon: ShoppingBag,
        tone: "text-primary",
        delta: "Monthly cadence",
      },
      {
        label: "Service exceptions",
        value: "0",
        helper: "White-glove recovery tracking is ready",
        icon: AlertTriangle,
        tone: "text-primary",
        delta: "Guest experience",
      },
      {
        label: "Low stock SKUs",
        value: lowStockSkus.toString(),
        helper: lowStockSkus ? "Replenishment should be scheduled" : "House stock is composed",
        icon: Package,
        tone: "text-primary",
        delta: "Atelier stock",
      },
      {
        label: "Returning clients",
        value: loyalCustomers.toString(),
        helper: `${customers.length} client relationships in total`,
        icon: Users,
        tone: "text-primary",
        delta: "Clienteling",
      },
      {
        label: "Fulfilment confidence",
        value: `${brandHealth}%`,
        helper:
          orders.length > 0
            ? `${returnCount} returns recorded`
            : "No order signal yet",
        icon: Percent,
        tone: "text-primary",
        delta: "House assurance",
      },
    ];
  }, [orders, products, customers]);

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="House Overview"
        title="The fragrance house, composed in one view."
        description="Track launches, client fulfilment, stock posture, and the rhythms shaping Dumi Essence. This overview is designed to feel less like a dashboard and more like a command chamber for the house."
        actions={
          <>
            <Button onClick={() => navigate("/orders")}>
              Review client orders
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory")}>
              Open stock view
            </Button>
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="metric-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="luxury-note">Today&apos;s pulse</p>
                <p className="text-lg font-medium text-foreground">
                  {openOrdersCount} active fulfilment threads
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Clients</p>
                <p className="mt-2 text-2xl font-display font-semibold text-foreground">
                  {customers.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Products</p>
                <p className="mt-2 text-2xl font-display font-semibold text-foreground">
                  {products.length}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="metric-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">{card.label}</p>
                <p className="metric-value">{card.value}</p>
                <p className="metric-note">{card.helper}</p>
              </div>
              <div className="metric-icon">
                <card.icon size={16} className={card.tone} />
              </div>
            </div>
            <p className="metric-note text-primary/85">
              {card.delta}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.8fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">Collection performance</h2>
              <p className="section-copy">
                A cinematic snapshot of recent trading rhythm across the last six months.
              </p>
            </div>
            <span className="luxury-note">Last six months</span>
          </div>
          <div className="flex h-56 items-end gap-3">
            {["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"].map((month, i) => (
              <div key={month} className="flex flex-1 flex-col items-center justify-end gap-3">
                <div className="flex h-40 w-full items-end gap-1 rounded-[1.25rem] border border-border/60 bg-background/35 px-2 pb-2">
                  <div
                    className="flex-1 rounded-full bg-gradient-to-t from-primary/70 to-primary"
                    style={{ height: `${40 + i * 8}%` }}
                  />
                  <div
                    className="flex-1 rounded-full bg-gradient-to-t from-primary/30 to-primary/70"
                    style={{ height: `${25 + i * 5}%` }}
                  />
                  <div
                    className="flex-1 rounded-full bg-gradient-to-t from-white/15 to-white/40"
                    style={{ height: `${15 + i * 3}%` }}
                  />
                </div>
                <span className="luxury-note tracking-[0.22em]">{month}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">House actions</h2>
              <p className="section-copy">Move into the workflows that shape the guest experience today.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="flex items-start justify-between rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 text-left transition-colors hover:border-primary/40"
            >
              <div>
                <span className="luxury-note">Service recovery</span>
                <p className="mt-2 text-base font-medium text-foreground">Review a sensitive order</p>
                <p className="mt-1 text-sm text-muted-foreground">Respond to a courier delay, return, or fulfilment concern.</p>
              </div>
              <AlertTriangle size={16} className="mt-1 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/inventory")}
              className="flex items-start justify-between rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 text-left transition-colors hover:border-primary/40"
            >
              <div>
                <span className="luxury-note">Stock</span>
                <p className="mt-2 text-base font-medium text-foreground">Start a stock review</p>
                <p className="mt-1 text-sm text-muted-foreground">Validate thresholds and protect top-selling collections.</p>
              </div>
              <Activity size={16} className="mt-1 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/marketing")}
              className="flex items-start justify-between rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 text-left transition-colors hover:border-primary/40"
            >
              <div>
                <span className="luxury-note">Launch studio</span>
                <p className="mt-2 text-base font-medium text-foreground">Shape the next launch</p>
                <p className="mt-1 text-sm text-muted-foreground">Prepare a collection preview, invitation, or campaign beat.</p>
              </div>
              <MessageCircle size={16} className="mt-1 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/accounting")}
              className="flex items-start justify-between rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 text-left transition-colors hover:border-primary/40"
            >
              <div>
                <span className="luxury-note">House ledger</span>
                <p className="mt-2 text-base font-medium text-foreground">Open financial signal</p>
                <p className="mt-1 text-sm text-muted-foreground">Review revenue, outstanding balances, and inventory value.</p>
              </div>
              <BarChart3 size={16} className="mt-1 text-primary" />
            </button>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">Stewardship queue</h2>
              <p className="section-copy">High-touch actions from live inventory and open orders.</p>
            </div>
            <span className="luxury-note">
              {products.filter((p) => p.stock_on_hand <= p.stock_threshold).length + openOrdersCount} signals
            </span>
          </div>
          <ul className="space-y-3 text-sm">
            {products
              .filter((p) => p.stock_on_hand <= p.stock_threshold)
              .slice(0, 3)
              .map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-foreground">Low stock: {p.product_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.stock_on_hand} on hand · threshold {p.stock_threshold}
                    </p>
                  </div>
                </li>
              ))}
            {openOrdersCount > 0 && (
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary/80" />
                <div className="flex-1">
                  <p className="text-foreground">{openOrdersCount} order{openOrdersCount === 1 ? "" : "s"} in motion</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Open fulfilment · Orders</p>
                </div>
              </li>
            )}
            {products.filter((p) => p.stock_on_hand <= p.stock_threshold).length === 0 &&
              openOrdersCount === 0 && (
                <li className="text-sm text-muted-foreground">
                  No pending stewardship items. Inventory and orders look clear.
                </li>
              )}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">Fulfilment signature</h2>
              <p className="section-copy">Quality markers from this month&apos;s order signal.</p>
            </div>
          </div>
          <div className="space-y-4 text-sm">
            {(() => {
              const now = new Date();
              const monthOrders = orders.filter((o) => {
                const d = new Date(o.date);
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
              });
              const delivered = monthOrders.filter((o) => o.status === "Delivered").length;
              const onTime =
                monthOrders.length > 0 ? Math.round((delivered / monthOrders.length) * 100) : 0;
              const perfect =
                monthOrders.length > 0
                  ? Math.round(
                      ((monthOrders.length -
                        monthOrders.filter((o) => o.status === "Returned" || o.status === "Cancelled")
                          .length) /
                        monthOrders.length) *
                        100,
                    )
                  : 0;
              return (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-muted-foreground">Delivered this month</span>
                      <span className="text-[13px] text-primary">{onTime}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background/50">
                      <div
                        className="h-full bg-gradient-to-r from-primary/60 to-primary"
                        style={{ width: `${onTime}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-muted-foreground">Clean orders</span>
                      <span className="text-[13px] text-primary">{perfect}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background/50">
                      <div
                        className="h-full bg-gradient-to-r from-white/35 to-primary/80"
                        style={{ width: `${perfect}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                    <CheckCircle2 size={14} className="text-primary" />
                    <span>
                      {monthOrders.length > 0
                        ? `${monthOrders.length} order${monthOrders.length === 1 ? "" : "s"} this month`
                        : "No orders this month yet"}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">House activity</h2>
              <p className="section-copy">Recent movements from live orders and clients.</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-foreground">
                    {o.reference || o.id} · {o.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {o.customer_name || "Client"} · {o.stage || "Open"}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={11} />
                  {o.date ? new Date(o.date).toLocaleDateString() : "—"}
                </span>
              </li>
            ))}
            {orders.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No order activity yet. New orders will appear here.
              </li>
            )}
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
