import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { dumiOfficeConfig } from "@/dumi-office.config";
import { LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <header className="h-14 border-b border-border bg-card/60 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {dumiOfficeConfig.appName}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
              <Search size={14} className="text-muted-foreground" />
              <input
                className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-52"
                placeholder="Search orders, customers, products"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-2"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
