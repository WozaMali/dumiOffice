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
      className="metric-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="metric-label">{title}</p>
          <p className="metric-value">{value}</p>
          {change && (
            <p className={`metric-note ${
              changeType === "positive" ? "text-success" :
              changeType === "negative" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="metric-icon">
          <Icon size={16} strokeWidth={2.25} />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
