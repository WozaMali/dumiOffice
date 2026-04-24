import { useEffect, useState, type ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Image,
  Settings,
  Calculator,
  Truck,
  FlaskConical,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { dumiOfficeConfig, type OfficeRouteId } from "@/dumi-office.config";
import { supabase } from "@/lib/supabase";

const iconByRouteId: Record<OfficeRouteId, ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  dispatch: Truck,
  clients: Users,
  inventory: Package,
  oils: FlaskConical,
  vendors: Building2,
  accounting: Calculator,
  expenses: Receipt,
  marketing: Megaphone,
  content: Image,
  settings: Settings,
};

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string>("Admin");
  const [roleLabel, setRoleLabel] = useState<string>("Manager");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const user = data.user;
        const meta: any = user.user_metadata || {};
        const fullName: string | undefined = meta.full_name || meta.name;
        const email = user.email ?? "";
        const role: string | undefined = meta.role;

        if (fullName && fullName.trim().length > 0) {
          setDisplayName(fullName.trim());
        } else if (email) {
          setDisplayName(email.split("@")[0]);
        }

        if (role === "superadmin") {
          setRoleLabel("SuperAdmin");
        } else if (role === "admin") {
          setRoleLabel("Admin");
        } else if (role === "manager") {
          setRoleLabel("Manager");
        } else {
          setRoleLabel("User");
        }
      } catch {
        // ignore auth errors for display
      }
    };

    loadUser();
  }, []);

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border/80 bg-sidebar/95 backdrop-blur-2xl ${
        collapsed ? "w-16" : "w-64"
      } transition-[width] duration-300`}
    >
      <div className="shrink-0 border-b border-sidebar-border/80 p-4">
        <div className="mb-4 flex items-center">
          {!collapsed && (
            <div className="flex flex-1 items-center justify-center">
              <img src="/Untitled-1.png" alt="" className="h-10 w-auto" />
            </div>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
        {/* Removed extra promo block to keep sidebar copy minimal */}
      </div>

      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden p-4">
        {dumiOfficeConfig.routes.map((route) => {
          const Icon = iconByRouteId[route.id];
          const isActive = location.pathname === route.path;
          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={`sidebar-link ${isActive ? "sidebar-link-active gold-glow" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"} ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? route.label : route.description}
            >
              {Icon && (
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    isActive
                      ? "border-primary/25 bg-primary/12 text-primary"
                      : "border-transparent bg-white/[0.02] text-muted-foreground"
                  }`}
                >
                  <Icon size={18} />
                </span>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <span className="block text-sm font-medium">{route.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {route.description}
                  </span>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/80 p-4">
        <div className="flex items-center gap-3 rounded-[1.25rem] border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/12">
            <span className="text-xs font-semibold tracking-[0.18em] text-primary">DE</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
