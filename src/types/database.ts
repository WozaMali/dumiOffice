// Dumi Essence Office - Database Types

export type OrderChannel = "Online Orders" | "Boutique & Pop-up" | "Wholesale" | "Returns";
export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Returned";
export type OrderStage = "Scheduled" | "In Progress" | "Completed";
export type ProductCategory = "Perfume" | "Diffuser" | "Car Perfume";
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Failed";
export type CustomerType = "retail" | "wholesale" | "vip";
export type CustomerChannel = "Online" | "Walk-In" | "Pop Up" | "Wholesale";
export type IncidentType = "courier_delay" | "damaged" | "wrong_item" | "spill" | "customer_complaint";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface Customer {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  // Segmentation & channel
  customer_type: CustomerType;
  client_channel?: CustomerChannel;
  segment?: string[];
  lifetime_value: number;
  total_orders: number;
  total_spent?: number;
  average_order_value?: number;
  first_order_date?: string;
  last_order_date?: string;
  // Marketing & loyalty
  marketing_consent?: boolean;
  sms_consent?: boolean;
  email_consent?: boolean;
  loyalty_points?: number;
  loyalty_tier?: string;
  // Admin notes (Office only)
  admin_notes?: string;
  // Legacy fields kept optional for flexibility
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPointTransaction {
  id: string;
  customer_id: string;
  points_delta: number;
  balance_after: number;
  reason: string;
  order_id?: string | null;
  reference?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  address_type: string;
  address_line: string;
  suburb?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  // Unified storefront product identity
  code?: string;
  sku: string;
  product_name: string; // legacy name
  name?: string; // unified name
  product_category: ProductCategory; // legacy category
  category?: string; // unified category enum/text
  product_type?: string;
  // Fragrance metadata used for inventory view
  brand?: string;
  item?: string;
  inspired_by?: string;
  designer?: string;
  price: number; // legacy price
  base_price?: number; // unified price (used as fallback)
  // Optional per-size pricing for PDP size selector
  price_30ml?: number | null;
  price_50ml?: number | null;
  price_100ml?: number | null;
  cost?: number;
  stock_on_hand: number;
  stock_reserved?: number;
  stock_threshold: number;
  is_active: boolean;
  description?: string;
  // Storefront content fields
  collection_code?: string;
  short_description?: string;
  long_description?: string;
  default_size?: string;
  primary_image_path?: string;
  is_bestseller?: boolean;
  is_featured?: boolean;
  is_new?: boolean;
  // Additional reassurance copy block for PDP
  reassurance_copy?: string;
  created_at: string;
  updated_at: string;
}

// Additional storefront content tables
export interface ProductImage {
  id: string;
  product_id: string;
  kind: string;
  path: string;
  sort_order: number;
  created_at: string;
}

export type ProductNoteLevel = "top" | "middle" | "base";

export interface ProductNote {
  id: string;
  product_id: string;
  level: ProductNoteLevel;
  note: string;
  position: number;
  created_at: string;
}

export interface Order {
  id: string;
  reference: string;
  customer_id?: string;
  channel: OrderChannel;
  source?: string;
  status: OrderStatus;
  stage: OrderStage;
  fulfilment_status?: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  tax: number;
  grand_total: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method?: string;
  payment_provider?: string;
  payment_ref?: string;
  paid_at?: string;
  shipping_method?: string;
  courier?: string;
  tracking_number?: string;
  tracking_url?: string;
  pickup_scheduled_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  estimated_delivery_date?: string;
  location: string;
  score: string;
  findings: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  // Legacy office schema used customer_address; unified schema uses shipping_address/billing_address.
  customer_address?: string;
  shipping_address_id?: string;
  billing_address_id?: string;
  shipping_address?: string;
  billing_address?: string;
  internal_notes?: string;
  customer_notes?: string;
  date: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_category: ProductCategory;
  product_type?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  line_total: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status?: string;
  to_status: string;
  from_stage?: string;
  to_stage: string;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

export interface Incident {
  id: string;
  order_id?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  resolution?: string;
  status: IncidentStatus;
  reported_by?: string;
  resolved_by?: string;
  reported_at: string;
  resolved_at?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  order_id?: string;
  source: string;
  reason: string;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  reference?: string;
  created_by?: string;
  created_at: string;
}

export type AccountingCategoryKind = "income" | "expense" | "asset" | "liability" | "equity";

export interface AccountingCategory {
  id: string;
  code?: string;
  name: string;
  kind: AccountingCategoryKind;
  description?: string;
  created_at: string;
}

export type AccountingTransactionType = "income" | "expense" | "transfer" | "adjustment";

export interface AccountingTransaction {
  id: string;
  date: string;
  type: AccountingTransactionType;
  category_id?: string;
  description?: string;
  amount: number;
  currency: string;
  order_id?: string;
  reference?: string;
  vendor?: string;
  campaign?: string;
  created_by?: string;
  created_at: string;
}

export interface AccountingAttachment {
  id: string;
  transaction_id?: string;
  invoice_id?: string;
  file_url: string;
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  vat_number?: string;
  company_registration?: string;
  address?: string;
  street_address?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country?: string;
  postal_code?: string;
  contact_name?: string;
  contact_phone?: string;
  email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Fragrance sourcing tables

export interface ScentProduct {
  id: string;
  brand: string;
  item: string;
  inspired_by?: string;
  designer?: string;
  scent_type?: string;
  price_1kg?: number;
  price_500g?: number;
  price_200g?: number;
  price_100g?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type ScentProformaStatus = "pending" | "approved";

export interface ScentProforma {
  id: string;
  name: string;
  customer_name?: string;
  vendor_id?: string;
  reference?: string;
  proforma_date?: string;
  invoice_date?: string;
  valid_until?: string;
  subtotal: number;
  vat: number;
  total: number;
  status?: ScentProformaStatus;
  created_at: string;
  updated_at: string;
}

export interface ScentProformaLine {
  id: string;
  proforma_id: string;
  scent_product_id: string;
  qty_1kg: number;
  qty_500g: number;
  qty_200g: number;
  qty_100g: number;
  row_total: number;
  created_at: string;
}

export type ScentProformaExtraKind =
  | "bottle"
  | "print_fee"
  | "ethanol"
  | "pump"
  | "cap";

export interface ScentProformaExtraLine {
  id: string;
  proforma_id: string;
  kind: ScentProformaExtraKind;
  name: string;
  spec?: string;
  qty: number;
  line_total: number;
  created_at: string;
}

export interface FragranceBottleProduct {
  id: string;
  name: string;
  ml?: number;
  code?: string;
  colour?: string;
  shape?: string;
  price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PerfumePumpProduct {
  id: string;
  name: string;
  ml?: number;
  code?: string;
  colour?: string;
  price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PerfumeCapProduct {
  id: string;
  name: string;
  ml?: number;
  code?: string;
  colour?: string;
  price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ScentechEthanolProduct {
  id: string;
  name: string;
  liters?: number;
  price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Collections powering the storefront \"Shop the House\" tiles
export interface Collection {
  id: string;
  code: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  hero_image_url?: string;
  is_active?: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionProduct {
  id: string;
  collection_id: string;
  product_id: string;
  position: number;
  created_at: string;
}

// Home hero slides controlling the storefront hero area
export interface HomeHeroSlide {
  id: string;
  code: string;
  kicker?: string;
  headline: string;
  subheadline?: string;
  body?: string;
  primary_cta_label?: string;
  primary_cta_href?: string;
  secondary_cta_label?: string;
  secondary_cta_href?: string;
  collection_code?: string;
  product_id?: string;
  background_image_url?: string;
  background_video_url?: string;
  gallery_image_urls?: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Home page featured bestsellers
export interface HomeBestseller {
  id: string;
  product_id: string;
  badge_label?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Front-facing storefront popup configuration
export interface FrontPopup {
  id: string;
  code: string;
  is_active: boolean;
  headline?: string;
  body?: string;
  image_url?: string;
  cta_label?: string;
  cta_href?: string;
  dismiss_days: number;
  created_at: string;
  updated_at: string;
}

export type MarketingCampaignStatus = "Active" | "Scheduled" | "Completed" | "Draft";

export interface MarketingCampaign {
  id: string;
  name: string;
  status: MarketingCampaignStatus;
  sent: number;
  open_rate: number | null;
  click_rate: number | null;
  campaign_date: string | null; // YYYY-MM-DD
  revenue_impact: number;
  created_at: string;
  updated_at: string;
}
