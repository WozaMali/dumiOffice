import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { motion } from "framer-motion";
import { Mail, Eye, MousePointerClick, TrendingUp } from "lucide-react";

const campaigns = [
  { name: "Valentine's Collection Launch", status: "Active", sent: 1240, openRate: "42%", clickRate: "12%", date: "Feb 14, 2026" },
  { name: "VIP Early Access - Spring", status: "Scheduled", sent: 0, openRate: "-", clickRate: "-", date: "Mar 1, 2026" },
  { name: "New Arrival: Oud Royal", status: "Completed", sent: 890, openRate: "38%", clickRate: "9%", date: "Feb 10, 2026" },
  { name: "Weekend Flash Sale", status: "Completed", sent: 2100, openRate: "51%", clickRate: "18%", date: "Feb 8, 2026" },
  { name: "Customer Loyalty Rewards", status: "Draft", sent: 0, openRate: "-", clickRate: "-", date: "-" },
];

const statusColors: Record<string, string> = {
  Active: "bg-success/20 text-success",
  Scheduled: "bg-primary/20 text-primary",
  Completed: "bg-muted text-muted-foreground",
  Draft: "bg-secondary text-secondary-foreground",
};

const Marketing = () => {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-display font-bold text-foreground">
            Marketing
          </motion.h1>
          <p className="text-muted-foreground mt-1">Email campaigns and customer engagement.</p>
        </div>
        <button className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          + New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Campaigns" value="24" icon={Mail} index={0} />
        <StatCard title="Avg Open Rate" value="41%" change="+3% vs last month" changeType="positive" icon={Eye} index={1} />
        <StatCard title="Avg Click Rate" value="14%" change="+1.5% vs last month" changeType="positive" icon={MousePointerClick} index={2} />
        <StatCard title="Revenue Impact" value="R12,400" change="From email sales" changeType="positive" icon={TrendingUp} index={3} />
      </div>

      {/* Campaigns List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30">
          <h2 className="text-lg font-display font-semibold text-foreground">Campaigns</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              {["Campaign", "Status", "Sent", "Open Rate", "Click Rate", "Date"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => (
              <motion.tr
                key={c.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 * i }}
                className="border-b border-border/20 hover:bg-muted/20 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-foreground">{c.name}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[c.status]}`}>{c.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{c.sent.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-foreground">{c.openRate}</td>
                <td className="px-6 py-4 text-sm text-foreground">{c.clickRate}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{c.date}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </DashboardLayout>
  );
};

export default Marketing;
