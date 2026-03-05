import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
}

const StatCard = ({ title, value, change, changeType = "neutral", icon: Icon, index = 0 }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-body">{title}</p>
          <p className="text-3xl font-display font-bold mt-2 text-foreground">{value}</p>
          {change && (
            <p className={`text-xs mt-2 font-medium ${
              changeType === "positive" ? "text-success" :
              changeType === "negative" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={20} className="text-primary" />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
