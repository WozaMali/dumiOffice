import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Mail, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const isOfficeRole = (role: unknown) =>
  role === "superadmin" || role === "admin" || role === "manager";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("dumisani@dumiessence.co.za");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) {
        toast.error(error.message || "Google sign in failed.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted || !data.session) return;
      const role = data.session.user.user_metadata?.role;
      if (!isOfficeRole(role)) {
        await supabase.auth.signOut();
        toast.error("This Google account is not authorized for office access.");
        return;
      }
      navigate("/", { replace: true });
    };

    handleSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted || !session) return;
      const role = session.user.user_metadata?.role;
      if (!isOfficeRole(role)) {
        await supabase.auth.signOut();
        toast.error("This account is not authorized for office access.");
        return;
      }
      navigate("/", { replace: true });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,176,92,0.18),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(214,176,92,0.08),transparent_20%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border/70 bg-black/40 shadow-[0_50px_120px_-70px_rgba(0,0,0,0.98)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]"
      >
        <section className="relative overflow-hidden px-8 py-10 md:px-12 md:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,176,92,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_45%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-10">
            <div>
              <p className="page-eyebrow">Dumi Essence Office</p>
              <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-none text-foreground md:text-7xl">
                A cinematic command center for the fragrance house.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
                Step into a luxury workspace designed for launches, sourcing, fulfilment, and the day-to-day stewardship of every Dumi Essence collection.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  label: "Launches",
                  value: "Editorial",
                  copy: "Shape releases and private previews with a premium visual cadence.",
                },
                {
                  label: "Operations",
                  value: "Refined",
                  copy: "Manage client orders, stock posture, and logistics with composure.",
                },
                {
                  label: "Sourcing",
                  value: "Atelier",
                  copy: "Review scent, packaging, and pro-forma purchasing in one scene.",
                },
              ].map((item) => (
                <div key={item.label} className="glass-card p-5">
                  <p className="luxury-note">{item.label}</p>
                  <p className="mt-3 text-2xl font-display font-semibold text-foreground">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-border/70 bg-card/70 px-6 py-8 backdrop-blur-xl md:px-8 lg:border-l lg:border-t-0 lg:px-10 lg:py-12">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            className="editorial-panel"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Private Access</p>
                <h2 className="mt-3 flex items-center gap-3 text-3xl font-semibold text-foreground">
                  Enter the workspace
                  <LogIn className="h-5 w-5 text-primary" />
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Sign in to continue into client orders, stock curation, campaign planning, and fragrance sourcing.
                </p>
              </div>
              <div className="metric-icon shrink-0">
                <Sparkles size={18} />
              </div>
            </div>

            <motion.form
              onSubmit={handleSubmit}
              className="space-y-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
              </Button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card/70 px-2 text-muted-foreground">or use email</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Work email
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-primary">
                    <Mail className="h-4 w-4" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-11 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-primary">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-11 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs leading-6 text-muted-foreground">
                  Use the sample email above with your Supabase password for the current house account.
                </p>
              </div>

              <Button type="submit" className="w-full justify-center gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                    <span>Opening workspace…</span>
                  </>
                ) : (
                  <>
                    <span>Enter workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 rounded-[1.25rem] border border-border/70 bg-background/40 px-4 py-4"
            >
              <p className="text-xs leading-6 text-muted-foreground">
                Secure access is powered by <span className="font-medium text-primary">Supabase Auth</span>. Your session remains active until you choose to sign out.
              </p>
            </motion.div>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
};

export default Login;

