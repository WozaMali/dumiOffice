import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHero from "@/components/PageHero";
import { motion } from "framer-motion";
import { User, Bell, Shield, Palette, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  applyMode as doApplyMode,
  applyTheme as doApplyTheme,
  getStoredMode,
  getStoredTheme,
  type ColorModeId,
  type ColorSchemeId,
} from "@/lib/theme";

const NOTIFY_ORDERS = "dumi-settings-notify-orders";
const NOTIFY_INVENTORY = "dumi-settings-notify-inventory";
const NOTIFY_MARKETING = "dumi-settings-notify-marketing";
const SIDEBAR_COLLAPSED = "dumi-sidebar-collapsed";

const COLOR_SCHEMES: { id: ColorSchemeId; label: string; swatch: string }[] = [
  { id: "gold", label: "Gold", swatch: "hsl(42, 52%, 61%)" },
  { id: "emerald", label: "Emerald", swatch: "hsl(160, 84%, 39%)" },
  { id: "rose", label: "Rose", swatch: "hsl(346, 77%, 50%)" },
  { id: "slate", label: "Slate", swatch: "hsl(215, 25%, 55%)" },
  { id: "amber", label: "Amber", swatch: "hsl(38, 92%, 50%)" },
  { id: "violet", label: "Violet", swatch: "hsl(263, 70%, 58%)" },
];

const getStored = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v != null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const setStored = (key: string, value: boolean) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("profile");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Notifications
  const [notifyOrders, setNotifyOrders] = useState(() => getStored(NOTIFY_ORDERS, true));
  const [notifyInventory, setNotifyInventory] = useState(() => getStored(NOTIFY_INVENTORY, true));
  const [notifyMarketing, setNotifyMarketing] = useState(() => getStored(NOTIFY_MARKETING, false));

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Appearance
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getStored(SIDEBAR_COLLAPSED, false),
  );
  const [colorScheme, setColorScheme] = useState<ColorSchemeId>(getStoredTheme);
  const [colorMode, setColorMode] = useState<ColorModeId>(() => getStoredMode());

  useEffect(() => {
    setColorScheme(getStoredTheme());
    setColorMode(getStoredMode());
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const meta: Record<string, unknown> = (data.user.user_metadata as Record<string, unknown>) || {};
      setDisplayName(String(meta.full_name || meta.name || data.user.email?.split("@")[0] || ""));
      setEmail(data.user.email ?? "");
    };
    loadUser();
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName.trim() || undefined },
      });
      if (error) {
        toast.error(error.message || "Failed to update profile.");
        return;
      }
      toast.success("Profile updated.");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Unexpected error.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message || "Failed to update password.");
        return;
      }
      toast.success("Password updated. You may need to sign in again.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Unexpected error.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotifyOrdersChange = (checked: boolean) => {
    setNotifyOrders(checked);
    setStored(NOTIFY_ORDERS, checked);
  };
  const handleNotifyInventoryChange = (checked: boolean) => {
    setNotifyInventory(checked);
    setStored(NOTIFY_INVENTORY, checked);
  };
  const handleNotifyMarketingChange = (checked: boolean) => {
    setNotifyMarketing(checked);
    setStored(NOTIFY_MARKETING, checked);
  };

  const handleSidebarCollapsedChange = (checked: boolean) => {
    setSidebarCollapsed(checked);
    setStored(SIDEBAR_COLLAPSED, checked);
    toast.success("Sidebar preference saved. Reload to apply.");
  };

  const handleColorSchemeChange = (id: ColorSchemeId) => {
    setColorScheme(id);
    doApplyTheme(id);
    toast.success(`Switched to ${COLOR_SCHEMES.find((s) => s.id === id)?.label ?? id}.`);
  };

  const handleColorModeChange = (mode: ColorModeId) => {
    setColorMode(mode);
    doApplyMode(mode);
    toast.success(mode === "light" ? "Day mode enabled." : "Dark mode enabled.");
  };

  return (
    <DashboardLayout>
      <PageHero
        eyebrow="House Settings"
        title="Preferences and governance for the workspace."
        description="Manage identity, notification flow, security posture, and appearance while staying inside the same luxury black, grey, and gold environment."
        aside={
          <div className="space-y-3">
            <p className="luxury-note">Control surface</p>
            <p className="text-lg leading-7 text-foreground">
              Profile, security, alerts, and visual preferences live together in one quieter configuration area.
            </p>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 border border-border/60 p-1">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User size={16} />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell size={16} />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield size={16} />
            Security
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Palette size={16} />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="editorial-panel"
          >
            <div className="flex items-start gap-4">
              <div className="metric-icon shrink-0">
                <User size={20} className="text-primary" />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-base font-display font-semibold text-foreground">Profile</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Refine your identity, account details, and house-facing presentation.
                  </p>
                </div>
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Account details</CardTitle>
                    <CardDescription>Your display name is used in the sidebar and across the workspace.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Display name</Label>
                      <Input
                        id="profile-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input
                        id="profile-email"
                        value={email}
                        disabled
                        className="opacity-70 cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                    </div>
                    <Button onClick={handleSaveProfile} disabled={profileSaving} className="gap-2">
                      {profileSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                      Save profile
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="notifications">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="editorial-panel"
          >
            <div className="flex items-start gap-4">
              <div className="metric-icon shrink-0">
                <Bell size={20} className="text-primary" />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-base font-display font-semibold text-foreground">Notifications</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Control launch alerts, operational emails, and team updates.
                  </p>
                </div>
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Alert preferences</CardTitle>
                    <CardDescription>Choose which notifications you receive.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Order alerts</p>
                        <p className="text-sm text-muted-foreground">New orders and fulfilment updates.</p>
                      </div>
                      <Switch checked={notifyOrders} onCheckedChange={handleNotifyOrdersChange} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Inventory alerts</p>
                        <p className="text-sm text-muted-foreground">Low stock and restock reminders.</p>
                      </div>
                      <Switch checked={notifyInventory} onCheckedChange={handleNotifyInventoryChange} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Marketing updates</p>
                        <p className="text-sm text-muted-foreground">Campaign launches and marketing news.</p>
                      </div>
                      <Switch checked={notifyMarketing} onCheckedChange={handleNotifyMarketingChange} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="security">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="editorial-panel"
          >
            <div className="flex items-start gap-4">
              <div className="metric-icon shrink-0">
                <Shield size={20} className="text-primary" />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-base font-display font-semibold text-foreground">Security</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review password discipline, access control, and protection layers.
                  </p>
                </div>
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Change password</CardTitle>
                    <CardDescription>Set a new password. You may be signed out after updating.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pw-new">New password</Label>
                      <Input
                        id="pw-new"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pw-confirm">Confirm new password</Label>
                      <Input
                        id="pw-confirm"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button onClick={handleChangePassword} disabled={passwordSaving} className="gap-2">
                      {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                      Update password
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="appearance">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="editorial-panel"
          >
            <div className="flex items-start gap-4">
              <div className="metric-icon shrink-0">
                <Palette size={20} className="text-primary" />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-base font-display font-semibold text-foreground">Appearance</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adjust the visual atmosphere of your workspace and dashboards.
                  </p>
                </div>
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Colour scheme</CardTitle>
                    <CardDescription>Choose an accent colour for the workspace.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {COLOR_SCHEMES.map((scheme) => (
                        <button
                          key={scheme.id}
                          type="button"
                          onClick={() => handleColorSchemeChange(scheme.id)}
                          className={`group flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
                            colorScheme === scheme.id
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-border/60 hover:border-primary/40 hover:bg-white/[0.02]"
                          }`}
                        >
                          <span
                            className="h-10 w-10 rounded-full shadow-inner ring-2 ring-white/10"
                            style={{ backgroundColor: scheme.swatch }}
                          />
                          <span className="text-xs font-medium text-foreground">{scheme.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Theme mode</CardTitle>
                    <CardDescription>Switch between day (light) and dark viewing.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Day mode</p>
                        <p className="text-sm text-muted-foreground">Use a lighter background and panels.</p>
                      </div>
                      <Switch
                        checked={colorMode === "light"}
                        onCheckedChange={(checked) => handleColorModeChange(checked ? "light" : "dark")}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-base">Layout</CardTitle>
                    <CardDescription>Customise default layout behaviour.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Collapsed sidebar by default</p>
                        <p className="text-sm text-muted-foreground">Start with a compact sidebar on page load.</p>
                      </div>
                      <Switch checked={sidebarCollapsed} onCheckedChange={handleSidebarCollapsedChange} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default SettingsPage;
