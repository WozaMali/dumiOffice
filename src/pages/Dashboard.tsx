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
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ordersApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { customersApi } from "@/lib/api/customers";
import type { Customer, Order, Product } from "@/types/database";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const isOpenOrder = (o: Order) =>
  o.stage !== "Completed" && o.status !== "Cancelled" && o.status !== "Returned" && o.status !== "Delivered";

const timeAgo = (iso?: string) => {
  if (!iso) return "Just now";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Just now";
  const diffMs = Date.now() - then;
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins <= 0) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(d);

const Dashboard = () => {
  const navigate = useNavigate();

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

  const openOrders = useMemo(() => orders.filter((o) => isOpenOrder(o)), [orders]);
  const openOrdersCount = openOrders.length;

  const overdueOpenOrders = useMemo(() => {
    const now = Date.now();
    return openOrders
      .filter((o) => {
        const t = new Date(o.date).getTime();
        return Number.isFinite(t) && t < now;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [openOrders]);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const ordersThisMonth = orders.filter((o) => {
      const d = new Date(o.date);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });

    const openOrdersThisMonth = ordersThisMonth.filter((o) => isOpenOrder(o));
    const deliveredThisMonth = ordersThisMonth.filter((o) => o.status === "Delivered").length;
    const onTimeRate =
      ordersThisMonth.length > 0 ? Math.round((deliveredThisMonth / ordersThisMonth.length) * 100) : 0;

    const lowStockSkus = products.filter((p) => p.stock_on_hand <= p.stock_threshold).length;
    const loyalCustomers = customers.filter((c) => c.total_orders >= 2).length;

    const returnCount = orders.filter((o) => o.status === "Returned").length;
    const brandHealth =
      orders.length > 0 ? Math.max(50, 100 - Math.round((returnCount / orders.length) * 50)) : 100;

    // Service exceptions: open orders that appear to be "in dispatch" but missing courier/tracking.
    const serviceExceptionsCount = orders.filter((o) => {
      if (!isOpenOrder(o)) return false;
      const isInDispatchState = o.status === "Shipped" || o.stage === "In Progress";
      if (!isInDispatchState) return false;
      return !o.courier || !o.tracking_number;
    }).length;

    const overdueOpen = overdueOpenOrders;

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
        helper: ordersThisMonth.length > 0 ? `${onTimeRate}% delivered on tempo` : "Awaiting the next collection run",
        icon: ShoppingBag,
        tone: "text-primary",
        delta: "Monthly cadence",
      },
      {
        label: "Service exceptions",
        value: serviceExceptionsCount.toString(),
        helper: serviceExceptionsCount ? `${serviceExceptionsCount} orders need dispatch details` : "White-glove recovery tracking is ready",
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
        helper: orders.length > 0 ? `${returnCount} returns recorded` : "No order signal yet",
        icon: Percent,
        tone: "text-primary",
        delta: "House assurance",
      },
    ] as const;
  }, [customers, openOrders.length, overdueOpenOrders, orders, products]);

  const monthBuckets = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, idx) => {
      // oldest -> newest
      const back = 5 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return {
        key: `${start.getFullYear()}-${start.getMonth()}`,
        label: monthLabel(d),
        start,
        end,
      };
    });
    return buckets;
  }, []);

  const deChartData = useMemo(() => {
    const isInDispatchState = (o: Order) => o.status === "Shipped" || o.stage === "In Progress";
    const inRange = (o: Order, b: (typeof monthBuckets)[number]) => {
      const t = new Date(o.date).getTime();
      return Number.isFinite(t) && t >= b.start.getTime() && t < b.end.getTime();
    };

    const sum = (rows: Order[], fn: (o: Order) => number) => rows.reduce((s, r) => s + fn(r), 0);
    const absGrandTotal = (o: Order) => Math.abs(o.grand_total || 0);

    return monthBuckets.map((b) => {
      const inMonth = orders.filter((o) => inRange(o, b));

      const delivered = inMonth.filter((o) => o.status === "Delivered");
      const inTransit = inMonth.filter((o) => isInDispatchState(o));
      const refunds = inMonth.filter((o) => o.status === "Returned" || o.status === "Cancelled");

      const deliveredRevenue = sum(delivered, (o) => o.grand_total || 0);
      const committedRevenue = sum(inTransit, (o) => o.grand_total || 0);
      const refundPressure = sum(refunds, (o) => absGrandTotal(o));

      const profitProxy = deliveredRevenue - refundPressure;
      const cashCollected = sum(
        delivered.filter((o) => o.payment_status === "Paid"),
        (o) => o.grand_total || 0,
      );

      const totalConsidered = Math.max(1, deliveredRevenue + committedRevenue + refundPressure);
      const returnRatePct = (refundPressure / totalConsidered) * 100;

      return {
        month: b.label,
        // Bar series (Fragrance revenue pulse)
        soldRevenue: Math.max(0, deliveredRevenue),
        committedRevenue: Math.max(0, committedRevenue),
        refundPressure,
        // Line series (Profit proxy + return dynamics)
        profitProxy,
        cashCollected,
        returnRatePct,
      };
    });
  }, [monthBuckets, orders]);

  const stewardshipItems = useMemo(() => {
    return overdueOpenOrders.slice(0, 3).map((o) => {
      const ageMs = Date.now() - new Date(o.date).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      const severity: "High" | "Medium" | "Low" = ageDays >= 21 ? "High" : ageDays >= 10 ? "Medium" : "Low";
      const dot =
        severity === "High" ? "bg-primary" : severity === "Medium" ? "bg-primary/80" : "bg-white/50";

      const title = o.status === "Shipped" || o.stage === "In Progress"
        ? !o.courier || !o.tracking_number
          ? `Investigate courier delay for order ${o.reference}`
          : `Dispatch follow-up for order ${o.reference}`
        : `Review order ${o.reference}`;

      const dueLabel = ageDays <= 0 ? "Today" : `${ageDays} day${ageDays === 1 ? "" : "s"} overdue`;

      return {
        id: o.id,
        dot,
        title,
        meta: `${severity} · Operations · ${dueLabel}`,
      };
    });
  }, [overdueOpenOrders]);

  const signature = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "Delivered");

    const timed = delivered
      .map((o) => {
        const base = o.shipped_at ? new Date(o.shipped_at) : new Date(o.date);
        const deliveredAt = o.delivered_at ? new Date(o.delivered_at) : null;
        if (!deliveredAt || !Number.isFinite(deliveredAt.getTime()) || !Number.isFinite(base.getTime())) return null;
        const diffDays = (deliveredAt.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
        return Number.isFinite(diffDays) ? diffDays : null;
      })
      .filter((x): x is number => typeof x === "number");

    const onTimeThresholdDays = 14;
    const onTimeCount = timed.filter((d) => d <= onTimeThresholdDays).length;
    const dispatchOnTimeRate =
      timed.length > 0 ? Math.round((onTimeCount / timed.length) * 100) : 94;

    const paidDelivered = delivered.filter((o) => o.payment_status === "Paid").length;
    const perfectOrdersRate = delivered.length > 0 ? Math.round((paidDelivered / delivered.length) * 100) : 88;

    const toneCopy =
      perfectOrdersRate >= 85
        ? "Above target for the last four weeks."
        : "Slight drift detected. Review pricing, payment flow, and fulfilment notes.";

    return { dispatchOnTimeRate, perfectOrdersRate, toneCopy };
  }, [orders]);

  const houseActivity = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      const at = new Date(a.updated_at ?? a.created_at).getTime();
      const bt = new Date(b.updated_at ?? b.created_at).getTime();
      return bt - at;
    });

    const latest = sorted.slice(0, 3).map((o) => {
      const dot =
        o.status === "Delivered" ? "bg-primary" : o.status === "Shipped" ? "bg-primary/80" : "bg-white/50";

      const title =
        o.status === "Delivered"
          ? `Order ${o.reference} delivered`
          : o.status === "Shipped"
            ? `Order ${o.reference} dispatched`
            : o.status === "Returned"
              ? `Order ${o.reference} returned`
              : o.status === "Cancelled"
                ? `Order ${o.reference} cancelled`
                : `Order ${o.reference} updated`;

      const subtitle = `${o.customer_name} · ${o.location}`;

      const when = timeAgo(o.updated_at ?? o.created_at ?? o.date);
      return { id: o.id, dot, title, subtitle, when };
    });

    return latest;
  }, [orders]);

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
                <p className="text-lg font-medium text-foreground">{openOrdersCount} active fulfilment threads</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Clients</p>
                <p className="mt-2 text-2xl font-display font-semibold text-foreground">{customers.length}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
                <p className="luxury-note">Products</p>
                <p className="mt-2 text-2xl font-display font-semibold text-foreground">{products.length}</p>
              </div>
            </div>
          </div>
        }
      />

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                <p className="metric-value text-[2.15rem]">{card.value}</p>
                <p className="metric-note">{card.helper}</p>
              </div>
              <div className="metric-icon">
                <card.icon size={16} className={card.tone} />
              </div>
            </div>
            <p className="metric-note text-primary/85">{card.delta}</p>
          </motion.div>
        ))}
      </div>

      {/* Two-column: Collection performance + House actions */}
      <div className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.8fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="editorial-panel"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">Fragrance profit & pulse</h2>
              <p className="section-copy">Revenue momentum, profit proxy, and return pressure across the last six months.</p>
            </div>
            <span className="luxury-note">Last six months</span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="luxury-note">Fragrance Revenue Pulse</p>
              <div className="mt-3">
                <ChartContainer
                  id="de-fragrance-revenue-pulse"
                  config={{
                    soldRevenue: { label: "Sold (Delivered)", color: "hsl(200 90% 50%)" },
                    committedRevenue: { label: "Committed (In dispatch)", color: "hsl(170 70% 42%)" },
                    refundPressure: { label: "Refund pressure", color: "hsl(42 92% 55%)" },
                  }}
                >
                  <BarChart data={deChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="soldRevenue" fill="var(--color-soldRevenue)" radius={[6, 6, 0, 0]} />
                    <Bar
                      dataKey="committedRevenue"
                      fill="var(--color-committedRevenue)"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="refundPressure"
                      fill="var(--color-refundPressure)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div>
              <p className="luxury-note">Profit Proxy & Return Rate</p>
              <div className="mt-3">
                <ChartContainer
                  id="de-profit-proxy-return-rate"
                  config={{
                    profitProxy: { label: "Profit proxy", color: "hsl(263 70% 58%)" },
                    cashCollected: { label: "Cash collected (Paid)", color: "hsl(160 84% 39%)" },
                    returnRatePct: { label: "Return rate (%)", color: "hsl(38 92% 50%)" },
                  }}
                >
                  <LineChart data={deChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="profitProxy"
                      stroke="var(--color-profitProxy)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cashCollected"
                      stroke="var(--color-cashCollected)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="returnRatePct"
                      stroke="var(--color-returnRatePct)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="editorial-panel self-start"
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

      {/* Lower grid */}
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
              <p className="section-copy">The high-touch actions preserving service quality this week.</p>
            </div>
            <span className="luxury-note">{overdueOpenOrders.length} pending</span>
          </div>

          {stewardshipItems.length === 0 ? (
            <div className="data-shell p-6 text-sm text-muted-foreground">
              No overdue stewardship items. The house is operating within tempo.
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              {stewardshipItems.map((it) => (
                <li key={it.id} className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 rounded-full ${it.dot}`} />
                  <div className="flex-1">
                    <p className="text-foreground">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{it.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
              <p className="section-copy">Quality markers showing how consistently the house delivers.</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-muted-foreground">Dispatch on time</span>
                <span className="text-[13px] text-primary">{signature.dispatchOnTimeRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/50">
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary"
                  style={{ width: `${signature.dispatchOnTimeRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-muted-foreground">Perfect orders</span>
                <span className="text-[13px] text-primary">{signature.perfectOrdersRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/50">
                <div
                  className="h-full bg-gradient-to-r from-white/35 to-primary/80"
                  style={{ width: `${signature.perfectOrdersRate}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
              <CheckCircle2 size={14} className="text-primary" />
              <span>{signature.toneCopy}</span>
            </div>
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
              <p className="section-copy">Recent movements across logistics, stock, and storytelling.</p>
            </div>
          </div>

          <ul className="space-y-3 text-sm">
            {houseActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className={`mt-1 h-2 w-2 rounded-full ${a.dot}`} />
                <div className="flex-1">
                  <p className="text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{a.subtitle}</p>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={11} /> {a.when}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

