import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import StorefrontAuthDialog from "@/components/StorefrontAuthDialog";
import { ensureStoreClient } from "@/lib/api/storefront/clients";
import { storefrontApi } from "@/lib/api/storefront";

const WalkInClientForm = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const pendingSaveRef = useRef(false);

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    streetAddress: "",
    complex: "",
    suburb: "",
    city: "",
    province: "",
    postalCode: "",
  });

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value } as typeof form));
  };

  const loadStorefrontProfile = async () => {
    setLoadingProfile(true);
    try {
      const client = await ensureStoreClient();
      setClientId(client.id);
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || client.full_name || "",
        customerEmail: client.email || prev.customerEmail,
        customerPhone: prev.customerPhone || client.phone || "",
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare your client profile.";
      toast.error(message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const saveDetails = async () => {
    if (!clientId) {
      toast.error("Could not identify your secure client profile.");
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      toast.error("Please add your name and phone number.");
      return;
    }

    const hasAnyAddressInput = Boolean(
      form.streetAddress.trim() ||
        form.city.trim() ||
        form.postalCode.trim() ||
        form.suburb.trim() ||
        form.province.trim() ||
        form.complex.trim(),
    );

    if (
      hasAnyAddressInput &&
      (!form.streetAddress.trim() || !form.city.trim() || !form.postalCode.trim())
    ) {
      toast.error("For delivery address, add at least street address, city, and postal code.");
      return;
    }

    try {
      setSubmitting(true);

      const deliveryLine1 = hasAnyAddressInput
        ? [form.streetAddress.trim(), form.complex.trim(), form.suburb.trim(), form.province.trim()]
            .filter(Boolean)
            .join(", ")
        : "";

      await storefrontApi.updateClient(clientId, {
        full_name: form.customerName.trim(),
        phone: form.customerPhone.trim(),
      });

      if (hasAnyAddressInput) {
        await storefrontApi.saveAddress(clientId, {
          line1: deliveryLine1,
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
          country: "South Africa",
          isDefault: true,
          label: "Delivery",
        });
      }

      toast.success("Thank you, your client details have been saved.");
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      pendingSaveRef.current = true;
      setAuthDialogOpen(true);
      return;
    }
    pendingSaveRef.current = false;
    await saveDetails();
  };

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const hasSession = !!data.session;
      setAuthed(hasSession);
      setAuthDialogOpen(false);
      if (hasSession) {
        await loadStorefrontProfile();
      } else {
        setClientId(null);
      }
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setAuthed(!!session);
      if (session) {
        setAuthDialogOpen(false);
        await loadStorefrontProfile();
      } else {
        setClientId(null);
        setSubmitted(false);
        pendingSaveRef.current = false;
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-border/70 bg-card/80 p-6 shadow-xl">
        <div className="mb-6 text-center flex flex-col items-center gap-4">
          <img
            src="/Untitled-1.png"
            alt=""
            className="h-14 w-auto"
          />
          <div>
            <h1 className="text-2xl font-display font-semibold">
              {submitted ? "Thank you" : "Client card"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {submitted
                ? "Your details have been captured for future visits and orders."
                : "Please share a few details so we can look after your orders and fragrances properly."}
            </p>
          </div>
        </div>

        {!submitted && loadingProfile ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading your details…</p>
        ) : null}

        {submitted ? (
          <div className="text-center space-y-4 text-sm">
            <p className="text-muted-foreground">
              You can close this window, or let us know if anything needs to be updated.
            </p>
          </div>
        ) : (
          <form className="space-y-5 text-sm" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name *</Label>
                <Input
                  id="customerName"
                  value={form.customerName}
                  onChange={(e) => handleChange("customerName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone *</Label>
                <Input
                  id="customerPhone"
                  value={form.customerPhone}
                  onChange={(e) => handleChange("customerPhone", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Delivery address (optional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="streetAddress" className="text-xs">
                    Street address
                  </Label>
                  <Input
                    id="streetAddress"
                    value={form.streetAddress}
                    onChange={(e) => handleChange("streetAddress", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="complex" className="text-xs">
                    Complex / Building / Estate (optional)
                  </Label>
                  <Input
                    id="complex"
                    value={form.complex}
                    onChange={(e) => handleChange("complex", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="suburb" className="text-xs">
                    Suburb
                  </Label>
                  <Input
                    id="suburb"
                    value={form.suburb}
                    onChange={(e) => handleChange("suburb", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="province" className="text-xs">
                    Province
                  </Label>
                  <Input
                    id="province"
                    value={form.province}
                    onChange={(e) => handleChange("province", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="postalCode" className="text-xs">
                    Postal code
                  </Label>
                  <Input
                    id="postalCode"
                    value={form.postalCode}
                    onChange={(e) => handleChange("postalCode", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Submit details"}
              </Button>
            </div>
          </form>
        )}
      </div>
      <StorefrontAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSuccess={async () => {
          setAuthed(true);
          setAuthDialogOpen(false);
          await loadStorefrontProfile();
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            await saveDetails();
          }
        }}
        redirectPath="/walk-in"
      />
    </div>
  );
};

export default WalkInClientForm;

