import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Image, Sparkles, Clock } from "lucide-react";

const heroSlides = [
  { title: "Valentine's Day Collection", status: "Active", lastUpdated: "Feb 14, 2026" },
  { title: "Spring Fragrance Preview", status: "Scheduled", lastUpdated: "Feb 25, 2026" },
  { title: "Oud Royal Feature", status: "Draft", lastUpdated: "Feb 20, 2026" },
];

const pictureCards = [
  { title: "Oud Royal Launch", type: "New Arrival", status: "Live" },
  { title: "Rose Noir Limited Edition", type: "Limited Edition", status: "Live" },
  { title: "Gift Set Promotion", type: "Promo", status: "Scheduled" },
  { title: "Spring Collection Teaser", type: "Seasonal", status: "Draft" },
];

const statusColors: Record<string, string> = {
  Active: "bg-success/20 text-success",
  Live: "bg-success/20 text-success",
  Scheduled: "bg-primary/20 text-primary",
  Draft: "bg-secondary text-secondary-foreground",
};

const Content = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-display font-bold text-foreground">
          Content Management
        </motion.h1>
        <p className="text-muted-foreground mt-1">Manage hero slides and picture cards for the DE App.</p>
      </div>

      {/* Hero Slides */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-primary" />
            <h2 className="text-lg font-display font-semibold text-foreground">Hero Slides</h2>
          </div>
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            + Add Slide
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {heroSlides.map((slide, i) => (
            <motion.div
              key={slide.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className="rounded-xl border border-border/30 bg-muted/30 overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <Image size={32} className="text-muted-foreground" />
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-foreground">{slide.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[slide.status]}`}>{slide.status}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> {slide.lastUpdated}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Picture Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image size={20} className="text-primary" />
            <h2 className="text-lg font-display font-semibold text-foreground">Picture Cards</h2>
          </div>
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            + Add Card
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pictureCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="rounded-xl border border-border/30 bg-muted/30 p-4 hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3">
                <Image size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{card.title}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{card.type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[card.status]}`}>{card.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default Content;
