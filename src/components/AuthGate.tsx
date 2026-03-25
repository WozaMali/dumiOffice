import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type AuthStatus = "checking" | "authed" | "unauth";

const isOfficeUser = (user: User | null | undefined) => {
  const role = user?.user_metadata?.role;
  return role === "superadmin" || role === "admin" || role === "manager";
};

const AuthGate = () => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error || !data.session || !isOfficeUser(data.session.user)) {
        if (data.session && !isOfficeUser(data.session.user)) {
          await supabase.auth.signOut();
        }
        setStatus("unauth");
        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
        }
      } else {
        setStatus("authed");
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session && isOfficeUser(session.user)) {
        setStatus("authed");
        if (location.pathname === "/login") {
          navigate("/", { replace: true });
        }
      } else {
        if (session && !isOfficeUser(session.user)) {
          supabase.auth.signOut().catch(() => undefined);
        }
        setStatus("unauth");
        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
        }
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#020617] to-[#111827]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground tracking-wide">
            Preparing your Dumi Essence office…
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default AuthGate;

