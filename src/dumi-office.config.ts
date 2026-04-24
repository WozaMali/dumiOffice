export type OfficeRouteId =
  | "dashboard"
  | "orders"
  | "dispatch"
  | "clients"
  | "inventory"
  | "oils"
  | "vendors"
  | "accounting"
  | "expenses"
  | "content"
  | "settings";

export interface OfficeRouteConfig {
  id: OfficeRouteId;
  label: string;
  path: string;
  description: string;
  primaryTables: string[];
}

export interface DumiOfficeConfig {
  appName: string;
  brandName: string;
  brandTagline: string;
  supabaseEnv: {
    url: string;
    anonKey: string;
  };
  routes: OfficeRouteConfig[];
}

export const dumiOfficeConfig: DumiOfficeConfig = {
  appName: "Dumi Essence Office",
  brandName: "Dumi Essence",
  brandTagline: "Fragrance operations workspace",
  supabaseEnv: {
    url: "VITE_SUPABASE_URL",
    anonKey: "VITE_SUPABASE_ANON_KEY",
  },
  routes: [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/",
      description:
        "Cinematic view of house performance, fulfilment rhythm, stock posture, and client activity.",
      primaryTables: ["orders", "products"],
    },
    {
      id: "orders",
      label: "Orders",
      path: "/orders",
      description:
        "Steward client orders from creation through dispatch, delivery, payment, and aftercare.",
      primaryTables: ["orders", "order_items"],
    },
    {
      id: "dispatch",
      label: "Dispatch Hub",
      path: "/dispatch",
      description:
        "Capture courier details, print premium labels, and send customer tracking updates.",
      primaryTables: ["orders"],
    },
    {
      id: "clients",
      label: "Clients",
      path: "/clients",
      description:
        "Keep a calm register of online, walk-in, pop-up, and wholesale clients.",
      primaryTables: ["customers", "addresses", "orders"],
    },
    {
      id: "inventory",
      label: "Inventory",
      path: "/inventory",
      description:
        "Manage finished stock, availability, low-stock alerts, and replenishment readiness.",
      primaryTables: ["products", "product_sizes"],
    },
    {
      id: "oils",
      label: "DE Orders",
      path: "/oils",
      description:
        "Manage DE orders: sourcing procurement, packaging components, ethanol, and pro-forma purchasing.",
      primaryTables: ["oils", "containers", "oil_prices"],
    },
    {
      id: "vendors",
      label: "Vendors",
      path: "/vendors",
      description:
        "Maintain supplier records used in DE purchasing and expense tracking.",
      primaryTables: ["vendors", "scent_proformas", "accounting_transactions"],
    },
    {
      id: "accounting",
      label: "Accounting",
      path: "/accounting",
      description:
        "Track revenue, manual transactions, and the financial health of the house.",
      primaryTables: ["orders", "products", "inventory_movements"],
    },
    {
      id: "expenses",
      label: "Expenses",
      path: "/expenses",
      description:
        "Track and manage business expenses with clear categories for house bookkeeping.",
      primaryTables: ["accounting_transactions", "accounting_categories"],
    },
    {
      id: "content",
      label: "Content",
      path: "/content",
      description:
        "Shape the house narrative through hero moments, editorial assets, and visual storytelling.",
      primaryTables: ["pages", "page_blocks", "media_assets"],
    },
    {
      id: "settings",
      label: "Settings",
      path: "/settings",
      description:
        "Manage preferences for identity, notifications, access, and operational defaults.",
      primaryTables: [],
    },
  ],
};

