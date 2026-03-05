import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("dumisani@dumiessence.co.za");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message || "Login failed. Please check your details.");
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back to Dumi Essence.");
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Unexpected error while logging in.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="relative rounded-2xl border border-border/80 bg-[#111111] px-8 py-7 shadow-xl overflow-hidden glass-card">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-1">
              Dumi Essence
            </p>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <span>Sign in to your office</span>
              <LogIn className="h-5 w-5 text-primary" />
            </h1>
            <p className="text-xs text-muted-foreground mt-2">
              Access orders, inventory, accounting and fragrance sourcing in one place.
            </p>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Work email
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="pl-9 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                </span>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                For your test user you can use the email above and your Supabase password.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2 mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-background border-t-transparent animate-spin" />
                  <span className="text-xs">Signing you in…</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium tracking-wide">Sign in</span>
                </>
              )}
            </Button>
          </motion.form>

          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 border-t border-border/60 pt-4"
          >
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This login screen is powered by{" "}
              <span className="font-medium text-amber-300">Supabase Auth</span>. Once signed in,
              your session is remembered until you sign out in the settings page.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

