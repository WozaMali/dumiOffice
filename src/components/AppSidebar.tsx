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
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { dumiOfficeConfig, type OfficeRouteId } from "@/dumi-office.config";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  content: Image,
  settings: Settings,
};

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AppSidebar = ({ collapsed, onToggle, mobileOpen = false, onMobileClose }: AppSidebarProps) => {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border/80 bg-sidebar/95 backdrop-blur-2xl",
        "w-64 transition-[width,transform] duration-300 ease-out",
        collapsed ? "lg:w-16" : "lg:w-64",
        mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        "lg:translate-x-0",
      )}
    >
      <div className="border-b border-sidebar-border/80 p-4">
        <div className="mb-4 flex items-center gap-2">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center",
              collapsed ? "max-lg:flex lg:hidden" : "flex",
            )}
          >
            <img src="/Untitled-1.png" alt="" className="h-10 w-auto max-w-full" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 border-sidebar-border bg-sidebar-accent/60 text-muted-foreground hover:border-primary/40 hover:text-primary lg:hidden"
            aria-label="Close menu"
            onClick={() => onMobileClose?.()}
          >
            <X size={16} />
          </Button>
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto hidden h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
        {/* Removed extra promo block to keep sidebar copy minimal */}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {dumiOfficeConfig.routes.map((route) => {
          const Icon = iconByRouteId[route.id];
          const isActive = location.pathname === route.path;
          return (
            <NavLink
              key={route.path}
              to={route.path}
              onClick={() => onMobileClose?.()}
              className={cn(
                "sidebar-link",
                isActive ? "sidebar-link-active gold-glow" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed ? "max-lg:justify-start lg:justify-center" : "",
              )}
              title={collapsed ? route.label : route.description}
            >
              {Icon && (
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                    isActive
                      ? "border-primary/25 bg-primary/12 text-primary"
                      : "border-transparent bg-white/[0.02] text-muted-foreground",
                  )}
                >
                  <Icon size={18} />
                </span>
              )}
              <div
                className={cn(
                  "min-w-0",
                  collapsed ? "max-lg:block lg:hidden" : "block",
                )}
              >
                <span className="block text-sm font-medium">{route.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {route.description}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/80 p-4">
        <div className="flex items-center gap-3 rounded-[1.25rem] border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/12">
            <span className="text-xs font-semibold tracking-[0.18em] text-primary">DE</span>
          </div>
          <div
            className={cn(
              "min-w-0 flex-1",
              collapsed ? "max-lg:block lg:hidden" : "block",
            )}
          >
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
