import DashboardLayout from "@/components/DashboardLayout";
import {
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
} from "lucide-react";
import { motion } from "framer-motion";

const kpis = [
  { label: "Open orders", value: "12", helper: "3 overdue", icon: ShoppingCart, tone: "text-amber-300", delta: "-8%" },
  { label: "Orders this month", value: "47", helper: "94% on time", icon: ShoppingBag, tone: "text-yellow-300", delta: "+12%" },
  { label: "Active incidents", value: "3", helper: "1 courier issue", icon: AlertTriangle, tone: "text-amber-400", delta: "-25%" },
  { label: "Low stock SKUs", value: "8", helper: "Watch Oud & Rose", icon: Package, tone: "text-yellow-400", delta: "0%" },
  { label: "Loyal customers", value: "156", helper: "+5 this week", icon: Users, tone: "text-amber-200", delta: "+5%" },
  { label: "Brand health", value: "91%", helper: "Above target", icon: Percent, tone: "text-yellow-300", delta: "+3%" },
];

const Index = () => {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold text-foreground"
        >
          Dumi Essence Quality Dashboard
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back! Here&apos;s your fragrance business overview.
        </p>
      </div>

      {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpis.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="kpi-card glass-card bg-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">{card.label}</p>
                <p className="text-xl font-semibold mt-2 text-foreground">{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{card.helper}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#020617] flex items-center justify-center">
                <card.icon size={16} className={card.tone} />
              </div>
            </div>
            <p className={`mt-3 text-[11px] font-medium ${card.delta.startsWith("-") ? "text-rose-400" : "text-yellow-300"}`}>
              {card.delta} vs last period
            </p>
          </motion.div>
        ))}
      </div>

      {/* Middle charts + quick actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-5 xl:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Sales performance</h2>
            <span className="text-[11px] text-muted-foreground">Last 6 months</span>
          </div>
          {/* Simple bar placeholder to echo the reference without charts lib */}
          <div className="flex items-end gap-3 h-40">
            {["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"].map((month, i) => (
              <div key={month} className="flex flex-col items-center justify-end flex-1 gap-2">
                <div className="w-full rounded-md bg-card border border-border flex items-end gap-1 px-1 pb-1 h-28">
                  <div className="flex-1 rounded-sm bg-amber-500" style={{ height: `${40 + i * 8}%` }} />
                  <div className="flex-1 rounded-sm bg-yellow-400" style={{ height: `${25 + i * 5}%` }} />
                  <div className="flex-1 rounded-sm bg-zinc-400/80" style={{ height: `${15 + i * 3}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">{month}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <button className="flex flex-col items-start rounded-lg bg-card px-4 py-3 border border-border/60 hover:border-amber-400/60">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20">
                <AlertTriangle size={14} className="text-rose-400" />
              </span>
              <span className="font-medium text-foreground">Log incident</span>
              <span className="text-[11px] text-muted-foreground mt-1">Courier delay or spill</span>
            </button>
            <button className="flex flex-col items-start rounded-lg bg-card px-4 py-3 border border-border/60 hover:border-amber-400/60">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10">
                <Activity size={14} className="text-yellow-300" />
              </span>
              <span className="font-medium text-foreground">Start stock check</span>
              <span className="text-[11px] text-muted-foreground mt-1">Run a quick cycle count</span>
            </button>
            <button className="flex flex-col items-start rounded-lg bg-card px-4 py-3 border border-border/60 hover:border-amber-400/60">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10">
                <MessageCircle size={14} className="text-yellow-300" />
              </span>
              <span className="font-medium text-foreground">New campaign</span>
              <span className="text-[11px] text-muted-foreground mt-1">Launch a fragrance promo</span>
            </button>
            <button className="flex flex-col items-start rounded-lg bg-card px-4 py-3 border border-border/60 hover:border-amber-400/60">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
                <BarChart3 size={14} className="text-amber-300" />
              </span>
              <span className="font-medium text-foreground">View KPIs</span>
              <span className="text-[11px] text-muted-foreground mt-1">Sales & stock analytics</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Bottom row: tasks, compliance, activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Upcoming tasks</h2>
            <span className="text-[11px] text-muted-foreground">5 pending</span>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
              <div className="flex-1">
                <p className="text-foreground">Investigate courier delay for order DE-1042</p>
                <p className="text-[11px] text-muted-foreground mt-1">High · Incident · Today</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              <div className="flex-1">
                <p className="text-foreground">Review Oud Royal low stock threshold</p>
                <p className="text-[11px] text-muted-foreground mt-1">Medium · Inventory · Tomorrow</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
              <div className="flex-1">
                <p className="text-foreground">Approve “Autumn Collection” email campaign</p>
                <p className="text-[11px] text-muted-foreground mt-1">Low · Marketing · This week</p>
              </div>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Fulfilment health</h2>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-muted-foreground">Dispatch on time</span>
                <span className="text-[13px] text-yellow-300">94%</span>
              </div>
              <div className="h-2 rounded-full bg-[#020617] overflow-hidden">
                <div className="h-full w-[94%] bg-gradient-to-r from-amber-500 to-yellow-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-muted-foreground">Perfect orders</span>
                <span className="text-[13px] text-yellow-300">88%</span>
              </div>
              <div className="h-2 rounded-full bg-[#020617] overflow-hidden">
                <div className="h-full w-[88%] bg-gradient-to-r from-zinc-400 to-yellow-200" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
              <CheckCircle2 size={14} className="text-yellow-300" />
              <span>Above target for the last 4 weeks.</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
              <div className="flex-1">
                <p className="text-foreground">Order DE-1051 dispatched</p>
                <p className="text-[11px] text-muted-foreground mt-1">Oud Royal 50ml · Johannesburg</p>
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> 10 min ago
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              <div className="flex-1">
                <p className="text-foreground">Low stock alert updated</p>
                <p className="text-[11px] text-muted-foreground mt-1">Rose Noir 100ml threshold set to 10</p>
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> 25 min ago
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              <div className="flex-1">
                <p className="text-foreground">“Winter Stories” hero updated</p>
                <p className="text-[11px] text-muted-foreground mt-1">Content · Homepage hero slide</p>
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> 1 hour ago
              </span>
            </li>
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
