import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { User, Bell, Shield, Palette } from "lucide-react";

const SettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-display font-bold text-foreground">
          Settings
        </motion.h1>
        <p className="text-muted-foreground mt-1">Manage your account and app preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { icon: User, title: "Profile", desc: "Manage your personal information and account details." },
          { icon: Bell, title: "Notifications", desc: "Configure email and push notification preferences." },
          { icon: Shield, title: "Security", desc: "Password, two-factor authentication, and access control." },
          { icon: Palette, title: "Appearance", desc: "Customize the look and feel of your dashboard." },
        ].map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="glass-card p-6 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <section.icon size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-display font-semibold text-foreground">{section.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{section.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
