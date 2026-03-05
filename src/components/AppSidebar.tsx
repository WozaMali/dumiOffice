import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Megaphone, Image, Settings, Calculator, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { dumiOfficeConfig, type OfficeRouteId } from "@/dumi-office.config";

const iconByRouteId: Record<OfficeRouteId, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  inventory: Package,
  oils: FlaskConical,
  accounting: Calculator,
  marketing: Megaphone,
  content: Image,
  settings: Settings,
};

const AppSidebar = () => {
  const location = useLocation();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50"
    >
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="font-display text-2xl font-bold gold-text">{dumiOfficeConfig.brandName}</h1>
        <p className="text-xs text-muted-foreground mt-1 font-body">{dumiOfficeConfig.brandTagline}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {dumiOfficeConfig.routes.map((route) => {
          const Icon = iconByRouteId[route.id];
          const isActive = location.pathname === route.path;
          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              {Icon && <Icon size={18} />}
              <span className="text-sm font-medium">{route.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-semibold">DE</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Admin</p>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
