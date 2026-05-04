import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface StorefrontAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  redirectPath?: string;
}

type AuthMode = "signin" | "signup";

const StorefrontAuthDialog = ({
  open,
  onOpenChange,
  onSuccess,
  redirectPath,
}: StorefrontAuthDialogProps) => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const resetFields = () => {
    setPassword("");
    if (mode === "signin") setFullName("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Enter email and password to continue.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message || "Sign in failed.");
          return;
        }
        toast.success("Signed in. You can continue to checkout.");
        onOpenChange(false);
        onSuccess?.();
        resetFields();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: "customer",
            full_name: fullName.trim() || undefined,
            app_scope: "storefront",
          },
        },
      });

      if (error) {
        toast.error(error.message || "Sign up failed.");
        return;
      }

      if (!data.session) {
        toast.success("Account created. Check your email to verify, then sign in.");
        setMode("signin");
        setPassword("");
        return;
      }

      toast.success("Account created. You can continue to checkout.");
      onOpenChange(false);
      onSuccess?.();
      resetFields();
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAuth = async () => {
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}${redirectPath ?? window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) {
        toast.error(error.message || "Google sign in failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="storefront-theme max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue checkout</DialogTitle>
          <DialogDescription>
            Your checkout and address details are saved in your private account.
          </DialogDescription>
        </DialogHeader>

        <div className="segmented-tabs text-xs">
          <button
            type="button"
            className={`segmented-tab ${mode === "signin" ? "segmented-tab-active" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`segmented-tab ${mode === "signup" ? "segmented-tab-active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleAuth}
          disabled={busy}
        >
          Continue with Google
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or use email</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="storefront-full-name">Full name</Label>
              <Input
                id="storefront-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="storefront-email">Email</Label>
            <Input
              id="storefront-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storefront-password">Password</Label>
            <Input
              id="storefront-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in and continue"
                : "Create account and continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StorefrontAuthDialog;
