import { ReactNode, useMemo, useState } from "react";
import AppSidebar from "./AppSidebar";
import { dumiOfficeConfig } from "@/dumi-office.config";
import { LogOut, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "dumi-sidebar-collapsed";

const getInitialSidebarCollapsed = () => {
  try {
    const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return v != null ? JSON.parse(v) : false;
  } catch {
    return false;
  }
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => {
          setSidebarCollapsed((c) => {
            const next = !c;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
            return next;
          });
        }}
      />
      <div
        className={`relative flex min-h-screen flex-1 flex-col transition-[margin-left] duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,176,92,0.08),transparent_22%),radial-gradient(circle_at_15%_15%,rgba(214,176,92,0.05),transparent_18%)]" />
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 px-4 py-4 md:px-8 lg:px-10 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="luxury-note">{dumiOfficeConfig.appName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-foreground">{dumiOfficeConfig.brandTagline}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-primary/70 md:block" />
                  <span className="text-muted-foreground">{currentDate}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex min-w-[260px] items-center gap-3 rounded-full border border-border/70 bg-card/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Search size={15} className="text-primary" />
                <input
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Search clients, fragrances, collections"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 self-start md:self-auto"
                onClick={handleLogout}
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="relative z-10 flex-1 px-4 py-6 md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
