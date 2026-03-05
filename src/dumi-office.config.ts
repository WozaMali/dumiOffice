export type OfficeRouteId =
  | "dashboard"
  | "orders"
  | "inventory"
  | "oils"
  | "accounting"
  | "marketing"
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
  brandTagline: "Office Management",
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
        "High-level overview: total revenue, orders, stock items, customers, recent orders, low stock.",
      primaryTables: ["orders", "products"],
    },
    {
      id: "orders",
      label: "Orders",
      path: "/orders",
      description:
        "List and manage orders, statuses, payment state and totals.",
      primaryTables: ["orders", "order_items"],
    },
    {
      id: "inventory",
      label: "Inventory",
      path: "/inventory",
      description:
        "Manage stock levels and low-stock alerts for fragrances and sizes.",
      primaryTables: ["products", "product_sizes"],
    },
    {
      id: "oils",
      label: "Fragrance Purchase",
      path: "/oils",
      description:
        "Define oils, perfume alcohol, container sizes and pricing for order lists.",
      primaryTables: ["oils", "containers", "oil_prices"],
    },
    {
      id: "accounting",
      label: "Accounting",
      path: "/accounting",
      description:
        "Financial overview, revenue, payments and inventory value.",
      primaryTables: ["orders", "products", "inventory_movements"],
    },
    {
      id: "marketing",
      label: "Marketing",
      path: "/marketing",
      description:
        "Campaigns, featured products and banners used on the main site.",
      primaryTables: ["pages", "page_blocks", "media_assets"],
    },
    {
      id: "content",
      label: "Content",
      path: "/content",
      description:
        "CMS view of pages and sections (hero, carousels, storytelling blocks).",
      primaryTables: ["pages", "page_blocks", "media_assets"],
    },
    {
      id: "settings",
      label: "Settings",
      path: "/settings",
      description:
        "Office preferences: currency, shipping fees, notification emails, roles.",
      primaryTables: [],
    },
  ],
};

