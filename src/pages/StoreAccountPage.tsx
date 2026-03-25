import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, MapPin, Package, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ensureStoreClient } from "@/lib/api/storefront/clients";
import { storefrontApi, type StoreClient, type StoreClientAddressRow } from "@/lib/api/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StorefrontAuthDialog from "@/components/StorefrontAuthDialog";
import { toast } from "sonner";

/** Storefront account: store_* tables per docs/client_data_schema.sql */
type AccountTab = "profile" | "orders" | "addresses";

const StoreAccountPage = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<StoreClient | null>(null);
  const [addresses, setAddresses] = useState<StoreClientAddressRow[]>([]);
  const [orderCount, setOrderCount] = useState(0);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [addrLabel, setAddrLabel] = useState("Home");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrSuburb, setAddrSuburb] = useState("");
  const [addrProvince, setAddrProvince] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry] = useState("South Africa");
  const [addrSaving, setAddrSaving] = useState(false);

  const reloadProfile = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAuthed(false);
      setClient(null);
      setOrderCount(0);
      return;
    }
    setAuthed(true);
    setEmail(auth.user.email ?? "");
    const meta = (auth.user.user_metadata || {}) as Record<string, unknown>;
    const c = await ensureStoreClient();
    setClient(c);
    setOrderCount(await storefrontApi.countOrdersForClient(c.id));
    setFullName(
      String(meta.full_name ?? meta.name ?? c.full_name ?? "").trim() || String(c.full_name ?? ""),
    );
    setPhone(
      String(meta.phone ?? meta.phone_number ?? c.phone ?? "").trim() || String(c.phone ?? ""),
    );
    setAddresses(await storefrontApi.listAddresses(c.id));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setAuthed(false);
          setAuthDialogOpen(true);
          return;
        }
        setAuthed(true);
        await reloadProfile();
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Could not load account.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setAuthChecked(true);
        }
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setAuthed(!!session);
      if (session) {
        setAuthDialogOpen(false);
        try {
          await reloadProfile();
        } catch (e) {
          console.error(e);
        }
      } else {
        setClient(null);
        setAddresses([]);
        setOrderCount(0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [reloadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setProfileSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Profile update returned no user.");
      const updated = await storefrontApi.applyAuthUserToStoreAndOffice(data.user);
      setClient(updated);
      toast.success("Profile saved. Office /clients will match after refresh.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!addrLine1.trim() || !addrCity.trim() || !addrPostal.trim()) {
      toast.error("Add street address, city, and postal code.");
      return;
    }
    setAddrSaving(true);
    try {
      await storefrontApi.saveAddress(client.id, {
        label: addrLabel.trim() || "Home",
        line1: addrLine1.trim(),
        suburb: addrSuburb.trim() || undefined,
        province: addrProvince.trim() || undefined,
        city: addrCity.trim(),
        postalCode: addrPostal.trim(),
        country: addrCountry,
        isDefault: true,
      });
      setAddresses(await storefrontApi.listAddresses(client.id));
      setAddrLine1("");
      setAddrSuburb("");
      setAddrProvince("");
      setAddrCity("");
      setAddrPostal("");
      toast.success("Address saved and synced to the office.");
    } catch (addErr: unknown) {
      toast.error(addErr instanceof Error ? addErr.message : "Could not save address.");
    } finally {
      setAddrSaving(false);
    }
  };

  const handleRemoveAddress = async (id: string) => {
    if (!client) return;
    try {
      await storefrontApi.deleteAddress(client.id, id);
      setAddresses(await storefrontApi.listAddresses(client.id));
      toast.success("Address removed.");
    } catch (rmErr: unknown) {
      toast.error(rmErr instanceof Error ? rmErr.message : "Could not remove address.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/shop/mens");
  };

  /** Placeholder until linked to loyalty / customers.loyalty_tier — see docs/STOREFRONT_LOYALTY_AND_SQL.md */
  const tierLabel = "Essence";
  const initial = (fullName || email || "?").trim().slice(0, 2).toUpperCase();

  if (!authChecked || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your account…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm md:px-6">
          <Link
            to="/shop/mens"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            <span>Shop</span>
          </Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Office
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        {!authed ? (
          <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">Sign in to manage your profile and addresses.</p>
            <Button className="mt-6" type="button" onClick={() => setAuthDialogOpen(true)}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-10 flex flex-col gap-4 rounded-3xl border border-border/60 bg-card/40 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                  {initial}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{fullName || "Your account"}</h1>
                  <p className="text-sm text-muted-foreground">{email}</p>
                  {phone ? <p className="text-sm text-muted-foreground">{phone}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">Orders</p>
                  <p className="text-lg font-semibold text-foreground">{orderCount}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">Wishlist</p>
                  <p className="text-lg font-semibold text-foreground">0</p>
                  {/* Not from store_*; use app context (e.g. useFavorites) when wishlist is implemented */}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">Client tier</p>
                  <p className="text-lg font-semibold text-foreground">{tierLabel}</p>
                  <p className="text-xs">Member since {client?.member_since_year ?? new Date().getFullYear()}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              <nav className="flex flex-row flex-wrap gap-2 md:flex-col md:gap-1">
                {(
                  [
                    ["profile", "Profile", User],
                    ["orders", "Orders", Package],
                    ["addresses", "Addresses", MapPin],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      activeTab === id
                        ? "bg-primary/15 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </nav>

              <div className="min-h-[320px] rounded-3xl border border-border/50 bg-card/30 p-6 md:p-8">
                {activeTab === "profile" && (
                  <div>
                    <h2 className="text-lg font-semibold">Profile information</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Changes here update the shop and your record in Office under Clients.
                    </p>
                    <form className="mt-6 max-w-lg space-y-4" onSubmit={handleSaveProfile}>
                      <div className="space-y-2">
                        <Label htmlFor="acc-full">Full name</Label>
                        <Input
                          id="acc-full"
                          value={fullName}
                          onChange={(ev) => setFullName(ev.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-email">Email</Label>
                        <Input id="acc-email" type="email" value={email} readOnly className="opacity-80" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-phone">Phone</Label>
                        <Input
                          id="acc-phone"
                          type="tel"
                          value={phone}
                          onChange={(ev) => setPhone(ev.target.value)}
                          placeholder="e.g. 072 123 4567"
                        />
                      </div>
                      <Button type="submit" disabled={profileSaving} className="mt-2 w-full sm:w-auto">
                        {profileSaving ? "Saving…" : "Save changes"}
                      </Button>
                    </form>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div>
                    <h2 className="text-lg font-semibold">Orders</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Order history will appear here as checkout is connected to your account.
                    </p>
                  </div>
                )}

                {activeTab === "addresses" && (
                  <div>
                    <h2 className="text-lg font-semibold">Saved addresses</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your default address syncs to the office CRM for deliveries.
                    </p>

                    <div className="mt-6 space-y-4">
                      {addresses.map((a) => (
                        <div
                          key={a.id}
                          className="relative rounded-2xl border border-border/60 bg-background/40 p-4 pr-20"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {a.label}
                            {a.is_default ? " · Default" : ""}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed">
                            {a.line1}
                            <br />
                            {[a.suburb, a.province].filter(Boolean).join(", ")}
                            <br />
                            {a.city}, {a.postal_code}
                            <br />
                            {a.country}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-3 top-3 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveAddress(a.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>

                    <form className="mt-8 max-w-xl space-y-4 border-t border-border/40 pt-8" onSubmit={handleAddAddress}>
                      <p className="font-medium">Add new address</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="na-label">Label</Label>
                          <Input id="na-label" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="na-country">Country</Label>
                          <Input id="na-country" value={addrCountry} readOnly />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="na-line1">Street address</Label>
                        <Input id="na-line1" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="na-suburb">Suburb</Label>
                          <Input id="na-suburb" value={addrSuburb} onChange={(e) => setAddrSuburb(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="na-province">Province</Label>
                          <Input id="na-province" value={addrProvince} onChange={(e) => setAddrProvince(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="na-city">City</Label>
                          <Input id="na-city" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="na-postal">Postal code</Label>
                          <Input id="na-postal" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
                        </div>
                      </div>
                      <Button type="submit" disabled={addrSaving}>
                        {addrSaving ? "Saving…" : "Add new address"}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <StorefrontAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSuccess={async () => {
          setAuthed(true);
          setAuthDialogOpen(false);
          setLoading(true);
          try {
            await reloadProfile();
          } finally {
            setLoading(false);
          }
        }}
        redirectPath="/account"
      />
    </div>
  );
};

export default StoreAccountPage;
