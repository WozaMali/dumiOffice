// Dumi Essence Office - Database Types

export type OrderChannel = "Online Orders" | "Boutique & Pop-up" | "Wholesale" | "Returns";
export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Returned";
export type OrderStage = "Scheduled" | "In Progress" | "Completed";
export type ProductCategory = "Perfume" | "Diffuser" | "Car Perfume";
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Failed";
export type CustomerType = "retail" | "wholesale" | "vip";
export type IncidentType = "courier_delay" | "damaged" | "wrong_item" | "spill" | "customer_complaint";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface Customer {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_type: CustomerType;
  lifetime_value: number;
  total_orders: number;
  first_order_date?: string;
  last_order_date?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
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
  sku: string;
  product_name: string;
  product_category: ProductCategory;
  product_type?: string;
  price: number;
  cost?: number;
  stock_on_hand: number;
  stock_reserved?: number;
  stock_threshold: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  reference: string;
  customer_id?: string;
  channel: OrderChannel;
  status: OrderStatus;
  stage: OrderStage;
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
  pickup_scheduled_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  location: string;
  score: string;
  findings: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
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

export interface ScentProforma {
  id: string;
  name: string;
  customer_name?: string;
  reference?: string;
  valid_until?: string;
  subtotal: number;
  vat: number;
  total: number;
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
