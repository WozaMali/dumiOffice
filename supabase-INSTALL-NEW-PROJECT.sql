-- =============================================================================
-- DUMI OFFICE + STOREFRONT - ALL-IN-ONE SUPABASE INSTALL
-- Updated: 2026-07-16T04:10 (skip missing tables in security lockdown)
-- Paste entire file into Supabase SQL Editor and Run
-- Buckets: docs/SUPABASE_STORAGE_BUCKETS.md
-- =============================================================================


-- #############################################################################
-- SECTION: BASE UNIFIED SCHEMA
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-schema-unified.sql
-- ---------------------------------------------------------------------------
-- ============================================
-- DUMI ESSENCE - UNIFIED DATABASE SCHEMA
-- ============================================
-- Shared by: Office App (Admin) + Main App (Customer-facing)
-- Version: 1.0
-- Last updated: 2026-02-27
--
-- This schema supports:
-- - Office App: Order management, inventory, fulfilment, reporting
-- - Main App: Customer portal, product browsing, cart, checkout, order tracking
--
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For password hashing if needed

-- ============================================
-- DROP EXISTING TABLES (if running fresh)
-- ============================================
-- CAUTION: This will delete all data!
-- Comment out this section if you want to preserve existing data

DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS collection_products CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS discount_code_usage CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- USERS TABLE (Supabase Auth integration)
-- ============================================
-- Links to Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer', -- customer, admin, warehouse, customer_service
  customer_id UUID, -- Links to customers table for customer role
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
-- Used by both Office (admin view) and Main App (customer account)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic info
  customer_name TEXT NOT NULL,
  customer_email TEXT UNIQUE,
  customer_phone TEXT,
  
  -- Customer segmentation
  customer_type TEXT DEFAULT 'retail', -- retail, wholesale, vip, corporate
  segment TEXT[], -- ['first-time', 'repeat', 'high-value', 'at-risk']
  
  -- Business metrics
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,
  first_order_date DATE,
  last_order_date DATE,
  
  -- Marketing
  marketing_consent BOOLEAN DEFAULT false,
  sms_consent BOOLEAN DEFAULT false,
  email_consent BOOLEAN DEFAULT false,
  
  -- Loyalty (future)
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'bronze', -- bronze, silver, gold, platinum
  
  -- Admin notes (Office only)
  admin_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADDRESSES TABLE
-- ============================================
-- Used by both Office (order fulfilment) and Main App (checkout)
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Address details
  address_type TEXT DEFAULT 'delivery', -- delivery, billing, office, collection
  address_line TEXT NOT NULL,
  address_line_2 TEXT,
  suburb TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'South Africa',
  
  -- Preferences
  is_default BOOLEAN DEFAULT false,
  delivery_instructions TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
-- Used by both Office (inventory management) and Main App (product catalog)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Product identity
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL, -- Perfume, Diffuser, Car Perfume, Gift Set, Accessories
  product_type TEXT, -- EDP 50ml, Reed Diffuser, Vent Clip, etc
  slug TEXT UNIQUE, -- For URLs: oud-royal-50ml
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2), -- Admin only
  compare_at_price DECIMAL(10,2), -- For showing discounts
  
  -- Inventory
  stock_on_hand INTEGER DEFAULT 0,
  stock_threshold INTEGER DEFAULT 5,
  stock_reserved INTEGER DEFAULT 0, -- Items in unpaid carts
  allow_backorder BOOLEAN DEFAULT false,
  
  -- Product details (Main App)
  description TEXT,
  short_description TEXT,
  ingredients TEXT,
  fragrance_notes TEXT, -- JSON: {"top": ["bergamot"], "heart": ["rose"], "base": ["oud"]}
  size_ml INTEGER,
  weight_grams INTEGER,
  
  -- SEO (Main App)
  meta_title TEXT,
  meta_description TEXT,
  
  -- Media
  image_url TEXT,
  images TEXT[], -- Array of image URLs
  video_url TEXT,
  
  -- Organization
  collection TEXT, -- Winter Stories, Summer Breeze, etc
  tags TEXT[], -- ['bestseller', 'new-arrival', 'limited-edition']
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT VARIANTS TABLE (Future)
-- ============================================
-- For products with multiple options (size, scent, etc)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant details
  variant_name TEXT NOT NULL, -- "50ml", "100ml", "Gift Set"
  sku TEXT UNIQUE NOT NULL,
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  
  -- Inventory
  stock_on_hand INTEGER DEFAULT 0,
  
  -- Options
  option1_name TEXT, -- "Size"
  option1_value TEXT, -- "50ml"
  option2_name TEXT, -- "Scent"
  option2_value TEXT, -- "Oud Royal"
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CARTS TABLE (Main App)
-- ============================================
-- Shopping cart for Main App
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id TEXT, -- For guest users
  
  -- Status
  status TEXT DEFAULT 'active', -- active, abandoned, converted
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  abandoned_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

-- ============================================
-- CART ITEMS TABLE (Main App)
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  -- Item details
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE
-- ============================================
-- Used by both Office (fulfilment) and Main App (order history)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, -- DE-1050
  reference TEXT UNIQUE NOT NULL, -- WEB-20260227-1050
  customer_id UUID REFERENCES customers(id),
  
  -- Order source
  channel TEXT NOT NULL, -- Online Orders, Boutique & Pop-up, Wholesale, Returns, Main App
  source TEXT, -- web, mobile, pos, api
  
  -- Order status
  status TEXT NOT NULL DEFAULT 'Processing', -- Processing, Shipped, Delivered, Cancelled, Returned
  stage TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed
  fulfilment_status TEXT DEFAULT 'unfulfilled', -- unfulfilled, partial, fulfilled
  
  -- Financial
  subtotal DECIMAL(10,2) DEFAULT 0,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  
  -- Discount codes (Main App)
  discount_code TEXT,
  discount_type TEXT, -- percentage, fixed, free_shipping
  discount_value DECIMAL(10,2),
  
  -- Payment
  payment_status TEXT DEFAULT 'Pending', -- Pending, Paid, Refunded, Failed, Partially_Refunded
  payment_method TEXT, -- Card, EFT, Cash, COD, PayFast, Yoco
  payment_provider TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Shipping
  shipping_method TEXT, -- Standard, Express, Same-day, Collection
  courier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  pickup_scheduled_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  estimated_delivery_date DATE,
  
  -- Fulfilment (Office)
  location TEXT, -- Johannesburg Warehouse, Rosebank Boutique
  score TEXT DEFAULT '-',
  findings TEXT DEFAULT 'Awaiting picking',
  
  -- Customer details (denormalized for quick access)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Addresses
  shipping_address_id UUID REFERENCES addresses(id),
  billing_address_id UUID REFERENCES addresses(id),
  shipping_address TEXT, -- Snapshot
  billing_address TEXT, -- Snapshot
  
  -- Notes
  internal_notes TEXT, -- Office only
  customer_notes TEXT, -- Visible to customer
  
  -- Customer communication (Main App)
  confirmation_sent_at TIMESTAMPTZ,
  shipping_notification_sent_at TIMESTAMPTZ,
  delivery_notification_sent_at TIMESTAMPTZ,
  
  -- Metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
-- Used by both Office and Main App
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL, -- References orders(id) but can't use FK due to TEXT type
  product_id UUID REFERENCES products(id),
  
  -- Product snapshot (in case product changes later)
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL,
  product_type TEXT,
  sku TEXT,
  image_url TEXT,
  
  -- Line details
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  
  -- Fulfilment
  fulfilment_status TEXT DEFAULT 'unfulfilled', -- unfulfilled, fulfilled, returned
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER STATUS HISTORY TABLE
-- ============================================
-- Audit trail for both Office and Main App
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL, -- References orders(id) but can't use FK due to TEXT type
  
  -- Status change
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  
  -- Who and why
  changed_by TEXT,
  changed_by_role TEXT, -- admin, customer, system
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INCIDENTS TABLE
-- ============================================
-- Quality and fulfilment issues (Office)
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT, -- References orders(id) but can't use FK due to TEXT type
  product_id UUID REFERENCES products(id),
  
  -- Incident details
  incident_type TEXT NOT NULL, -- courier_delay, damaged, wrong_item, spill, customer_complaint, quality_issue
  severity TEXT DEFAULT 'medium', -- low, medium, high, critical
  category TEXT, -- fulfilment, quality, courier, customer_service
  
  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  
  -- Status
  status TEXT DEFAULT 'open', -- open, investigating, resolved, closed
  
  -- Assignment
  reported_by TEXT,
  assigned_to TEXT,
  resolved_by TEXT,
  
  -- Dates
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVIEWS TABLE (Main App)
-- ============================================
-- Product reviews from customers
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  order_id TEXT, -- References orders(id) but can't use FK due to TEXT type
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT NOT NULL,
  
  -- Verification
  is_verified_purchase BOOLEAN DEFAULT false,
  
  -- Moderation
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  moderated_by TEXT,
  moderated_at TIMESTAMPTZ,
  
  -- Helpfulness
  helpful_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WISHLISTS TABLE (Main App)
-- ============================================
-- Customer wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Wishlist details
  name TEXT DEFAULT 'My Wishlist',
  is_default BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WISHLIST ITEMS TABLE (Main App)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOUNT CODES TABLE (Both apps)
-- ============================================
-- Promo codes for Main App, managed in Office
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Code details
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Discount
  discount_type TEXT NOT NULL, -- percentage, fixed, free_shipping
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Conditions
  minimum_order_value DECIMAL(10,2),
  maximum_discount DECIMAL(10,2),
  applies_to TEXT, -- all, specific_products, specific_categories
  applies_to_ids TEXT[], -- Product or category IDs
  
  -- Usage limits
  usage_limit INTEGER, -- Total uses allowed
  usage_count INTEGER DEFAULT 0,
  usage_limit_per_customer INTEGER,
  
  -- Validity
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOUNT CODE USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discount_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_code_id UUID REFERENCES discount_codes(id),
  customer_id UUID REFERENCES customers(id),
  order_id TEXT, -- References orders(id) but can't use FK due to TEXT type
  
  -- Usage details
  discount_amount DECIMAL(10,2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COLLECTIONS TABLE (Main App)
-- ============================================
-- Product collections (Winter Stories, Summer Breeze, etc)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Collection details
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Media
  image_url TEXT,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COLLECTION PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS collection_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Ordering
  position INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE (Main App)
-- ============================================
-- In-app notifications for customers
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Notification details
  type TEXT NOT NULL, -- order_update, shipping_update, promotion, system
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Links
  link_url TEXT,
  link_text TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOG TABLE (Both apps)
-- ============================================
-- Global activity log for auditing
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Activity details
  entity_type TEXT NOT NULL, -- order, product, customer, etc
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL, -- created, updated, deleted, status_changed
  
  -- Actor
  actor_id UUID,
  actor_role TEXT, -- admin, customer, system
  actor_name TEXT,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(customer_email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);

-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(product_category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(stage);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Order Status History
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);

-- Incidents
CREATE INDEX IF NOT EXISTS idx_incidents_order_id ON incidents(order_id);
CREATE INDEX IF NOT EXISTS idx_incidents_product_id ON incidents(product_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Carts
CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Wishlists
CREATE INDEX IF NOT EXISTS idx_wishlists_customer_id ON wishlists(customer_id);

-- Discount Codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON discount_codes(is_active);

-- Activity Log
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PERMISSIVE POLICIES (For testing - tighten in production)
-- ============================================

-- Products: Public read, admin write
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Products are manageable by admins" ON products FOR ALL USING (true); -- TODO: Add auth check

-- Orders: Customers see their own, admins see all
CREATE POLICY "Customers can view their own orders" ON orders FOR SELECT USING (true); -- TODO: Add customer_id check
CREATE POLICY "Admins can manage all orders" ON orders FOR ALL USING (true); -- TODO: Add role check

-- Reviews: Public read, customers write their own
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Customers can create reviews" ON reviews FOR INSERT WITH CHECK (true); -- TODO: Add customer check

-- Carts: Customers manage their own
CREATE POLICY "Customers can manage their own carts" ON carts FOR ALL USING (true); -- TODO: Add customer_id check

-- Wishlists: Customers manage their own
CREATE POLICY "Customers can manage their own wishlists" ON wishlists FOR ALL USING (true); -- TODO: Add customer_id check

-- Discount codes: Public read active codes, admins manage
CREATE POLICY "Active discount codes are viewable" ON discount_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage discount codes" ON discount_codes FOR ALL USING (true); -- TODO: Add role check

-- Collections: Public read active, admins manage
CREATE POLICY "Collections are viewable by everyone" ON collections FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage collections" ON collections FOR ALL USING (true); -- TODO: Add role check

-- For other tables, allow all for now (tighten in production)
CREATE POLICY "Allow all operations" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON addresses FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON product_variants FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON cart_items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON order_status_history FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON incidents FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON wishlist_items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON discount_code_usage FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON collection_products FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON activity_log FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON profiles FOR ALL USING (true);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample products (Dumi Essence catalog)
INSERT INTO products (sku, product_name, product_category, product_type, price, cost, stock_on_hand, stock_threshold, description, short_description, slug, is_featured) VALUES
('DE-OR50', 'Oud Royal 50ml', 'Perfume', 'EDP 50ml', 1250.00, 450.00, 3, 10, 
  'A luxurious blend of rare oud wood and precious spices, creating an opulent and sophisticated fragrance that commands attention.',
  'Luxurious oud wood with precious spices',
  'oud-royal-50ml', true),
('DE-OR100', 'Oud Royal 100ml', 'Perfume', 'EDP 100ml', 2400.00, 850.00, 18, 15,
  'The signature Oud Royal scent in a generous 100ml bottle. Perfect for those who appreciate the finest in luxury fragrances.',
  'Signature luxury oud fragrance',
  'oud-royal-100ml', true),
('DE-RN100', 'Rose Noir 100ml', 'Perfume', 'EDP 100ml', 890.00, 320.00, 5, 15,
  'Dark roses meet mysterious spices in this captivating evening fragrance. Elegant, sensual, and unforgettable.',
  'Dark roses with mysterious spices',
  'rose-noir-100ml', false),
('DE-AVS', 'Amber Velvet Set', 'Perfume', 'Gift Set', 2100.00, 750.00, 24, 10,
  'A complete fragrance experience featuring Amber Velvet EDP 50ml, body lotion, and shower gel. Beautifully packaged for gifting.',
  'Complete amber fragrance gift set',
  'amber-velvet-set', true),
('DE-JD30', 'Jasmine Dreams 30ml', 'Perfume', 'EDP 30ml', 650.00, 230.00, 32, 8,
  'Fresh jasmine petals dance with citrus notes in this light, romantic fragrance. Perfect for everyday wear.',
  'Fresh jasmine with citrus notes',
  'jasmine-dreams-30ml', false),
('DE-MI50', 'Musk Intense 50ml', 'Perfume', 'EDP 50ml', 980.00, 350.00, 14, 12,
  'Pure, sensual musk enhanced with warm amber. A timeless fragrance that lingers beautifully on the skin.',
  'Pure sensual musk with amber',
  'musk-intense-50ml', false),
('DE-VS30', 'Vanilla Silk 30ml', 'Perfume', 'EDP 30ml', 550.00, 195.00, 2, 8,
  'Creamy vanilla wrapped in soft silk notes. Comforting, sweet, and utterly addictive.',
  'Creamy vanilla with silk notes',
  'vanilla-silk-30ml', false),
('DE-OR-RD', 'Oud Royal Reed Diffuser', 'Diffuser', 'Reed Diffuser', 450.00, 160.00, 12, 5,
  'Bring the luxury of Oud Royal into your space. Long-lasting reed diffuser fills your home with opulent fragrance for up to 3 months.',
  'Luxury oud home fragrance',
  'oud-royal-reed-diffuser', false),
('DE-RN-RD', 'Rose Noir Reed Diffuser', 'Diffuser', 'Reed Diffuser', 420.00, 150.00, 8, 5,
  'Transform your space with the mysterious elegance of Rose Noir. Lasts up to 3 months.',
  'Dark rose home fragrance',
  'rose-noir-reed-diffuser', false),
('DE-OR-CAR', 'Oud Royal Car Diffuser', 'Car Perfume', 'Vent Clip', 180.00, 65.00, 25, 10,
  'Take the luxury of Oud Royal on the road. Easy vent clip design provides weeks of elegant fragrance.',
  'Luxury car fragrance',
  'oud-royal-car-diffuser', false)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (id, customer_name, customer_email, customer_phone, customer_type, lifetime_value, total_orders, first_order_date, last_order_date, marketing_consent, email_consent) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Amara Nkosi', 'amara@example.com', '+27 82 000 0001', 'retail', 1250.00, 1, '2026-02-27', '2026-02-27', true, true),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'Lindiwe Mokoena', 'lindiwe@example.com', '+27 72 000 0002', 'retail', 890.00, 1, '2026-02-26', '2026-02-26', true, true),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'Thabo Khumalo', 'thabo@example.com', '+27 73 000 0003', 'vip', 2100.00, 1, '2026-02-25', '2026-02-25', true, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample addresses
INSERT INTO addresses (customer_id, address_type, address_line, suburb, city, postal_code, is_default) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'delivery', '12 Rosewood Lane', 'Sandton', 'Johannesburg', '2196', true),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'delivery', '8 Jacaranda Street', 'Hatfield', 'Pretoria', '0083', true),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'delivery', 'Unit 5, Parkview Lofts', 'Rosebank', 'Johannesburg', '2193', true);

-- Insert sample collections
INSERT INTO collections (name, slug, description, is_active, published_at) VALUES
('Winter Stories', 'winter-stories', 'Warm, rich fragrances perfect for the colder months. Featuring oud, amber, and spice notes.', true, NOW()),
('Summer Breeze', 'summer-breeze', 'Light, fresh scents that capture the essence of summer. Citrus, jasmine, and aquatic notes.', true, NOW()),
('Gift Sets', 'gift-sets', 'Beautifully curated fragrance gift sets perfect for any occasion.', true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES FOR PRODUCTION
-- ============================================
-- 
-- 1. Authentication:
--    - Implement Supabase Auth for both apps
--    - Update RLS policies to check auth.uid() and role
--    - Link profiles.id to auth.users(id)
--
-- 2. Security:
--    - Tighten RLS policies (currently permissive for testing)
--    - Add role-based access control (admin, customer, warehouse)
--    - Validate all inputs on both client and server
--    - Use environment variables for all secrets
--
-- 3. Performance:
--    - Add pagination for large datasets
--    - Consider materialized views for analytics
--    - Monitor slow queries and add indexes as needed
--    - Implement caching strategy (Redis, Supabase cache)
--
-- 4. Data Integrity:
--    - Add CHECK constraints for enum-like fields
--    - Add foreign key constraints where missing
--    - Implement soft deletes for critical data
--    - Regular backups (Supabase provides automatic backups)
--
-- 5. Features to Add:
--    - Email notifications (order confirmation, shipping updates)
--    - SMS notifications (delivery alerts)
--    - Inventory reservations (when item added to cart)
--    - Stock alerts (low stock notifications)
--    - Customer loyalty program
--    - Referral system
--    - Gift cards
--    - Subscription boxes
--
-- ============================================
-- END OF SCHEMA
-- ============================================


-- #############################################################################
-- SECTION: OFFICE DOMAIN EXTENSIONS
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-migrations-inventory-movements.sql
-- ---------------------------------------------------------------------------
-- Migration: Add inventory_movements table for Dumi Essence
-- Safe to run on an existing unified schema (no drops)

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT,
  source TEXT NOT NULL, -- manual_adjustment, sale, return, purchase_order
  reason TEXT NOT NULL, -- count, damage, theft, sample, correction, other
  quantity_delta INTEGER NOT NULL, -- positive = increase, negative = decrease
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference TEXT, -- free-text reference (order id, PO number, incident id)
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
  ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
  ON inventory_movements(created_at DESC);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Permissive policy for now (tighten in production)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_movements'
      AND policyname = 'Allow all operations on inventory_movements'
  ) THEN
    CREATE POLICY "Allow all operations on inventory_movements"
      ON inventory_movements FOR ALL USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-migrations-accounting.sql
-- ---------------------------------------------------------------------------
-- Accounting tables for Dumi Essence
-- Safe to run on existing unified schema (no drops)

-- ============================================
-- ACCOUNTING CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE, -- optional short code e.g. SALES, RENT
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- income, expense, asset, liability, equity
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACCOUNTING TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL, -- income, expense, transfer, adjustment
  category_id UUID REFERENCES accounting_categories(id),
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  order_id TEXT, -- optional link to orders.id
  reference TEXT, -- free text (invoice no, receipt, etc)
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_transactions_date
  ON accounting_transactions(date DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_transactions_category
  ON accounting_transactions(category_id);

ALTER TABLE accounting_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (tighten in production)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_categories'
      AND policyname = 'Allow all operations on accounting_categories'
  ) THEN
    CREATE POLICY "Allow all operations on accounting_categories"
      ON accounting_categories FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_transactions'
      AND policyname = 'Allow all operations on accounting_transactions'
  ) THEN
    CREATE POLICY "Allow all operations on accounting_transactions"
      ON accounting_transactions FOR ALL USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-migrations-accounting-attachments.sql
-- ---------------------------------------------------------------------------
-- Attachments for accounting (receipts, invoices)
-- Safe to run on top of existing schema

CREATE TABLE IF NOT EXISTS accounting_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES accounting_transactions(id) ON DELETE CASCADE,
  invoice_id UUID, -- reserved for future purchase_invoices
  file_url TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_attachments_txn
  ON accounting_attachments(transaction_id);

ALTER TABLE accounting_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_attachments'
      AND policyname = 'Allow all operations on accounting_attachments'
  ) THEN
    CREATE POLICY "Allow all operations on accounting_attachments"
      ON accounting_attachments FOR ALL USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_EXPENSES_EXTEND.sql
-- ---------------------------------------------------------------------------
-- Extend accounting_transactions for richer expense tracking
-- Run after supabase-migrations-accounting.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Add vendor/supplier and campaign context for expenses
ALTER TABLE accounting_transactions
  ADD COLUMN IF NOT EXISTS vendor TEXT,
  ADD COLUMN IF NOT EXISTS campaign TEXT;

-- Optional: add common expense categories (run if you have none)
-- INSERT INTO accounting_categories (name, kind, code, description) VALUES
--   ('Campaign - Online', 'expense', 'CAMP-ONLINE', 'Ads, influencers, Meta, Google'),
--   ('Campaign - Offline', 'expense', 'CAMP-OFFLINE', 'Events, pop-ups, print, signage'),
--   ('Materials - Packaging', 'expense', 'MAT-PKG', 'Bottles, boxes, labels, caps'),
--   ('Materials - Raw', 'expense', 'MAT-RAW', 'Oils, ethanol, diluents'),
--   ('Operations', 'expense', 'OPS', 'Rent, utilities, shipping, admin'),
--   ('Other', 'expense', 'OTHER', 'Miscellaneous');

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_VENDORS_SETUP.sql
-- ---------------------------------------------------------------------------
-- Vendors master table for DE Orders and Expenses

create extension if not exists "pgcrypto";

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  vat_number text null,
  company_registration text null,
  address text null,
  street_address text null,
  suburb text null,
  city text null,
  province text null,
  country text null,
  postal_code text null,
  contact_name text null,
  contact_phone text null,
  email text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible updates when table already existed before these fields were added.
alter table public.vendors add column if not exists vat_number text null;
alter table public.vendors add column if not exists company_registration text null;
alter table public.vendors add column if not exists address text null;
alter table public.vendors add column if not exists street_address text null;
alter table public.vendors add column if not exists suburb text null;
alter table public.vendors add column if not exists city text null;
alter table public.vendors add column if not exists province text null;
alter table public.vendors add column if not exists country text null;
alter table public.vendors add column if not exists postal_code text null;

create or replace function public.set_updated_at_vendors()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at_vendors();

alter table public.vendors enable row level security;

drop policy if exists vendors_select_authenticated on public.vendors;
create policy vendors_select_authenticated
on public.vendors
for select
to authenticated
using (true);

drop policy if exists vendors_insert_authenticated on public.vendors;
create policy vendors_insert_authenticated
on public.vendors
for insert
to authenticated
with check (true);

drop policy if exists vendors_update_authenticated on public.vendors;
create policy vendors_update_authenticated
on public.vendors
for update
to authenticated
using (true)
with check (true);

drop policy if exists vendors_delete_authenticated on public.vendors;
create policy vendors_delete_authenticated
on public.vendors
for delete
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-migrations-fragrance-sourcing.sql
-- ---------------------------------------------------------------------------
-- Fragrance sourcing: scents, pro-forma, packaging
-- Safe to run on top of existing schema

-- 1) Master list of scents purchased from suppliers
CREATE TABLE IF NOT EXISTS scent_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand TEXT NOT NULL DEFAULT 'Dumi Essence',
  item TEXT NOT NULL,
  inspired_by TEXT,
  designer TEXT,
  scent_type TEXT,
  price_1kg NUMERIC(12,2),
  price_500g NUMERIC(12,2),
  price_200g NUMERIC(12,2),
  price_100g NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Pro-forma headers
CREATE TABLE IF NOT EXISTS scent_proformas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  customer_name TEXT,
  reference TEXT,
  valid_until DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  vat NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Pro-forma line items
CREATE TABLE IF NOT EXISTS scent_proforma_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proforma_id UUID NOT NULL REFERENCES scent_proformas(id) ON DELETE CASCADE,
  scent_product_id UUID NOT NULL REFERENCES scent_products(id) ON DELETE RESTRICT,
  qty_1kg NUMERIC(12,3) DEFAULT 0,
  qty_500g NUMERIC(12,3) DEFAULT 0,
  qty_200g NUMERIC(12,3) DEFAULT 0,
  qty_100g NUMERIC(12,3) DEFAULT 0,
  row_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scent_proforma_lines_proforma
  ON scent_proforma_lines(proforma_id);

-- 4) Packaging master data
CREATE TABLE IF NOT EXISTS fragrance_bottle_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ml INTEGER,
  code TEXT,
  colour TEXT,
  shape TEXT,
  price NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfume_pump_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ml INTEGER,
  code TEXT,
  colour TEXT,
  price NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfume_cap_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ml INTEGER,
  code TEXT,
  colour TEXT,
  price NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Simple open RLS policies (adjust for production as needed)
ALTER TABLE scent_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE scent_proformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE scent_proforma_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fragrance_bottle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfume_pump_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfume_cap_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scent_products'
      AND policyname = 'Allow all on scent_products'
  ) THEN
    CREATE POLICY "Allow all on scent_products"
      ON scent_products FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scent_proformas'
      AND policyname = 'Allow all on scent_proformas'
  ) THEN
    CREATE POLICY "Allow all on scent_proformas"
      ON scent_proformas FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scent_proforma_lines'
      AND policyname = 'Allow all on scent_proforma_lines'
  ) THEN
    CREATE POLICY "Allow all on scent_proforma_lines"
      ON scent_proforma_lines FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fragrance_bottle_products'
      AND policyname = 'Allow all on fragrance_bottle_products'
  ) THEN
    CREATE POLICY "Allow all on fragrance_bottle_products"
      ON fragrance_bottle_products FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'perfume_pump_products'
      AND policyname = 'Allow all on perfume_pump_products'
  ) THEN
    CREATE POLICY "Allow all on perfume_pump_products"
      ON perfume_pump_products FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'perfume_cap_products'
      AND policyname = 'Allow all on perfume_cap_products'
  ) THEN
    CREATE POLICY "Allow all on perfume_cap_products"
      ON perfume_cap_products FOR ALL USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- SOURCE: supabase-migrations-essential-oils.sql
-- ---------------------------------------------------------------------------
-- Essential oils master list (SKU / Product / Price / Size)
-- Safe to run on top of existing schema

CREATE TABLE IF NOT EXISTS essential_oil_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  product TEXT NOT NULL,
  size TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE essential_oil_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'essential_oil_products'
      AND policyname = 'Allow all on essential_oil_products'
  ) THEN
    CREATE POLICY "Allow all on essential_oil_products"
      ON essential_oil_products FOR ALL USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_SCENT_PROFORMA_VENDOR_AND_DATES.sql
-- ---------------------------------------------------------------------------
-- Link DE pro-formas to vendors and support date controls.
-- Run once in Supabase SQL editor.

alter table public.scent_proformas
  add column if not exists vendor_id uuid null references public.vendors(id) on delete set null,
  add column if not exists proforma_date date null,
  add column if not exists invoice_date date null;

create index if not exists idx_scent_proformas_vendor_id on public.scent_proformas(vendor_id);
create index if not exists idx_scent_proformas_proforma_date on public.scent_proformas(proforma_date);
create index if not exists idx_scent_proformas_invoice_date on public.scent_proformas(invoice_date);

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_DE_ORDER_APPROVED_EXPENSES.sql
-- ---------------------------------------------------------------------------
-- DE order approval + expense alignment (Oils order history → Accounting / Expenses / Vendors)
-- Run once in Supabase SQL editor.

-- 1) Approval status on fragrance purchase orders (pro-formas)
ALTER TABLE public.scent_proformas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.scent_proformas
  DROP CONSTRAINT IF EXISTS scent_proformas_status_check;

ALTER TABLE public.scent_proformas
  ADD CONSTRAINT scent_proformas_status_check
  CHECK (status IN ('pending', 'approved'));

CREATE INDEX IF NOT EXISTS idx_scent_proformas_status ON public.scent_proformas(status);
CREATE INDEX IF NOT EXISTS idx_scent_proformas_reference ON public.scent_proformas(reference);

-- 2) Mark your existing approved DE orders (adjust references if yours differ)
UPDATE public.scent_proformas
SET
  status = 'approved',
  updated_at = NOW()
WHERE UPPER(TRIM(reference)) IN ('DE-000001', 'DE-000002', 'DE-000003')
  AND status IS DISTINCT FROM 'approved';

-- 3) Remove ledger expenses for pending / stale DE orders (app re-syncs approved rows on next visit)
DELETE FROM public.accounting_attachments aa
USING public.accounting_transactions t
WHERE aa.transaction_id = t.id
  AND t.type = 'expense'
  AND (
    LOWER(TRIM(t.campaign)) = 'de orders'
    OR LOWER(TRIM(t.reference)) ~ '^de-[0-9]+$'
    OR LOWER(COALESCE(t.description, '')) LIKE '%de order de-%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.scent_proformas pf
    WHERE pf.status = 'approved'
      AND LOWER(TRIM(pf.reference)) = LOWER(TRIM(t.reference))
  );

DELETE FROM public.accounting_transactions t
WHERE t.type = 'expense'
  AND (
    LOWER(TRIM(t.campaign)) = 'de orders'
    OR LOWER(TRIM(t.reference)) ~ '^de-[0-9]+$'
    OR LOWER(COALESCE(t.description, '')) LIKE '%de order de-%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.scent_proformas pf
    WHERE pf.status = 'approved'
      AND LOWER(TRIM(pf.reference)) = LOWER(TRIM(t.reference))
  );

-- 4) Insert accounting expenses for approved DE orders (one row per reference)
INSERT INTO public.accounting_transactions (
  date,
  type,
  description,
  amount,
  currency,
  reference,
  vendor,
  campaign,
  created_by
)
SELECT
  COALESCE(pf.invoice_date, pf.proforma_date, (pf.created_at AT TIME ZONE 'UTC')::date) AS date,
  'expense' AS type,
  COALESCE(NULLIF(TRIM(pf.name), ''), 'Fragrance purchase') AS description,
  -ABS(COALESCE(pf.total, 0)) AS amount,
  'ZAR' AS currency,
  TRIM(pf.reference) AS reference,
  NULLIF(TRIM(pf.customer_name), '') AS vendor,
  'DE Orders' AS campaign,
  'Admin' AS created_by
FROM public.scent_proformas pf
WHERE pf.status = 'approved'
  AND pf.reference IS NOT NULL
  AND LOWER(TRIM(pf.reference)) ~ '^de-[0-9]+$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounting_transactions t
    WHERE t.type = 'expense'
      AND LOWER(TRIM(t.reference)) = LOWER(TRIM(pf.reference))
  );

-- Verify (should list DE-000001, DE-000002, DE-000003 when approved)
SELECT
  pf.reference,
  pf.status,
  pf.customer_name AS vendor,
  pf.name AS description,
  pf.subtotal,
  pf.vat,
  pf.total,
  pf.proforma_date,
  pf.invoice_date,
  t.id AS ledger_id,
  t.amount AS ledger_amount
FROM public.scent_proformas pf
LEFT JOIN public.accounting_transactions t
  ON t.type = 'expense'
 AND LOWER(TRIM(t.reference)) = LOWER(TRIM(pf.reference))
WHERE pf.status = 'approved'
ORDER BY pf.reference;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_DISPATCH_HUB.sql
-- ---------------------------------------------------------------------------
-- Optional Dispatch Hub schema extensions
-- This is NOT required for current UI functionality.
-- Apply when you want persistent dispatch audit trails and editable email templates.

create table if not exists dispatch_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'shipment_saved',
    'marked_shipped',
    'email_sent',
    'email_draft_opened'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispatch_events_order_id
  on dispatch_events(order_id);

create index if not exists idx_dispatch_events_created_at
  on dispatch_events(created_at desc);

create table if not exists notification_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into notification_templates (code, subject, body)
values (
  'shipment_update_default',
  'Your Dumi Essence order is on the way ({reference})',
  'Hi {customer_name},

Your order has been prepared and handed over for delivery.

Order reference: {reference}
Courier: {courier}
Tracking number: {tracking_number}
Tracking link: {tracking_url}

If you need any support, simply reply and our team will assist.

Warm regards,
Dumi Essence'
)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_MARKETING_CAMPAIGNS.sql
-- ---------------------------------------------------------------------------
-- Marketing campaigns table + RLS for Office CRUD
-- Run this in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Draft',
  sent integer not null default 0,
  open_rate numeric(6,2),
  click_rate numeric(6,2),
  campaign_date date,
  revenue_impact numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.marketing_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_campaigns_set_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_set_updated_at
before update on public.marketing_campaigns
for each row
execute function public.marketing_set_updated_at();

alter table public.marketing_campaigns enable row level security;

-- Authenticated users (Office) can read/write everything
drop policy if exists "marketing_campaigns_office_select" on public.marketing_campaigns;
create policy "marketing_campaigns_office_select"
on public.marketing_campaigns
for select
to authenticated
using (true);

drop policy if exists "marketing_campaigns_office_write" on public.marketing_campaigns;
create policy "marketing_campaigns_office_write"
on public.marketing_campaigns
for all
to authenticated
using (true)
with check (true);


-- #############################################################################
-- SECTION: STOREFRONT AUTH / CRM / LOYALTY
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_STOREFRONT_AUTH_CHECKOUT.sql
-- ---------------------------------------------------------------------------
-- Dumi Essence: Storefront auth + protected checkout schema
-- Safe for existing office schema: uses separate "store_*" tables.
-- Target: PostgreSQL / Supabase SQL Editor

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Storefront clients linked to Supabase Auth users
-- ------------------------------------------------------------
create table if not exists public.store_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  phone text,
  member_since_year int not null default 2026,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_clients_set_updated_at on public.store_clients;
create trigger store_clients_set_updated_at
before update on public.store_clients
for each row
execute function public.set_updated_at();

-- One client can have many saved addresses.
create table if not exists public.store_client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.store_clients(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_client_addresses_client_id
on public.store_client_addresses (client_id);

create unique index if not exists idx_store_client_addresses_one_default
on public.store_client_addresses (client_id)
where is_default = true;

drop trigger if exists store_client_addresses_set_updated_at on public.store_client_addresses;
create trigger store_client_addresses_set_updated_at
before update on public.store_client_addresses
for each row
execute function public.set_updated_at();

-- Notification and marketing preferences (1 row per client)
create table if not exists public.store_client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.store_clients(id) on delete cascade,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  marketing_emails boolean not null default true,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  consent_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_client_preferences_set_updated_at on public.store_client_preferences;
create trigger store_client_preferences_set_updated_at
before update on public.store_client_preferences
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Storefront checkout orders (kept separate from office "orders")
-- ------------------------------------------------------------
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.store_clients(id) on delete set null,
  email text not null,
  phone text,
  first_name text not null,
  last_name text not null,
  address_line1 text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  payment_method text not null check (payment_method in ('card', 'paypal', 'bank')),
  order_status text not null default 'processing' check (order_status in ('processing', 'shipped', 'delivered', 'cancelled')),
  subtotal_amount numeric(12,2) not null check (subtotal_amount >= 0),
  shipping_amount numeric(12,2) not null check (shipping_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_orders_client_id on public.store_orders (client_id);
create index if not exists idx_store_orders_email on public.store_orders (email);
create index if not exists idx_store_orders_created_at on public.store_orders (created_at desc);

drop trigger if exists store_orders_set_updated_at on public.store_orders;
create trigger store_orders_set_updated_at
before update on public.store_orders
for each row
execute function public.set_updated_at();

create table if not exists public.store_order_items (
  id bigserial primary key,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  size_ml int not null check (size_ml > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_order_items_order_id on public.store_order_items (order_id);

-- Proof of payment metadata (files in Storage bucket payment_proofs)
create table if not exists public.store_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.store_orders(id) on delete cascade,
  client_id uuid references public.store_clients(id) on delete set null,
  public_url text,
  storage_path text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_payment_proofs_order_id
  on public.store_payment_proofs (order_id);
create index if not exists idx_store_payment_proofs_client_id
  on public.store_payment_proofs (client_id);
create index if not exists idx_store_payment_proofs_created_at
  on public.store_payment_proofs (created_at desc);

-- Existing deployments: add consent fields if table already exists.
alter table if exists public.store_client_preferences
  add column if not exists terms_accepted_at timestamptz;

alter table if exists public.store_client_preferences
  add column if not exists privacy_accepted_at timestamptz;

alter table if exists public.store_client_preferences
  add column if not exists consent_version text not null default 'v1';

-- ------------------------------------------------------------
-- RLS for client-facing ownership
-- ------------------------------------------------------------
alter table public.store_clients enable row level security;
alter table public.store_client_addresses enable row level security;
alter table public.store_client_preferences enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_payment_proofs enable row level security;

drop policy if exists store_clients_select_own on public.store_clients;
create policy store_clients_select_own
on public.store_clients
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists store_clients_update_own on public.store_clients;
create policy store_clients_update_own
on public.store_clients
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists store_clients_insert_own on public.store_clients;
create policy store_clients_insert_own
on public.store_clients
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists store_client_addresses_crud_own on public.store_client_addresses;
create policy store_client_addresses_crud_own
on public.store_client_addresses
for all
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_client_preferences_crud_own on public.store_client_preferences;
create policy store_client_preferences_crud_own
on public.store_client_preferences
for all
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_orders_select_own on public.store_orders;
create policy store_orders_select_own
on public.store_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_order_items_select_own on public.store_order_items;
create policy store_order_items_select_own
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_payment_proofs_select_own on public.store_payment_proofs;
create policy store_payment_proofs_select_own
on public.store_payment_proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_payment_proofs_insert_own on public.store_payment_proofs;
create policy store_payment_proofs_insert_own
on public.store_payment_proofs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

-- Checkout inserts should be done by secure server endpoints (service role),
-- or with additional insert policies after anti-abuse rules are defined.

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_STORE_PAYMENT_PROOFS.sql
-- ---------------------------------------------------------------------------
-- Storefront proof-of-payment metadata (files live in Storage bucket: payment_proofs).
-- Safe to re-run. Required by Office Orders PoP UI + storeOrdersWithPop API.

create table if not exists public.store_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.store_orders(id) on delete cascade,
  client_id uuid references public.store_clients(id) on delete set null,
  public_url text,
  storage_path text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_payment_proofs_order_id
  on public.store_payment_proofs (order_id);

create index if not exists idx_store_payment_proofs_client_id
  on public.store_payment_proofs (client_id);

create index if not exists idx_store_payment_proofs_created_at
  on public.store_payment_proofs (created_at desc);

alter table public.store_payment_proofs enable row level security;

-- Shopper: read/write own proofs
drop policy if exists store_payment_proofs_select_own on public.store_payment_proofs;
create policy store_payment_proofs_select_own
on public.store_payment_proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_payment_proofs_insert_own on public.store_payment_proofs;
create policy store_payment_proofs_insert_own
on public.store_payment_proofs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

-- Office: read all (service role bypasses RLS; authenticated office staff need this)
drop policy if exists "store_payment_proofs_office_authenticated_select_all" on public.store_payment_proofs;
create policy "store_payment_proofs_office_authenticated_select_all"
on public.store_payment_proofs
for select
using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_LOYALTY_POINTS.sql
-- ---------------------------------------------------------------------------
-- Dumi Essence: loyalty points (office customers)
-- Rule: R2.00 spent = 1 point → floor(amount_zar / 2) points.
-- Run in Supabase SQL Editor after your core customers/orders schema exists.

-- Balance on customer row (fast display; ledger is source of truth for history)
alter table if exists public.customers
  add column if not exists loyalty_points int not null default 0;

create table if not exists public.loyalty_point_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  points_delta int not null,
  balance_after int not null,
  reason text not null,
  order_id text,
  reference text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_tx_customer_id
  on public.loyalty_point_transactions (customer_id, created_at desc);

-- Idempotency: same reference per customer only once (e.g. earn:order:<uuid>)
create unique index if not exists idx_loyalty_tx_customer_reference
  on public.loyalty_point_transactions (customer_id, reference)
  where reference is not null;

-- Points from spend in ZAR (grand total)
create or replace function public.loyalty_points_for_spend_zar(amount_zar numeric)
returns int
language sql
immutable
strict
as $$
  select greatest(0, floor(amount_zar / 2))::int;
$$;

-- Atomically apply points and append ledger row (idempotent when reference is set)
create or replace function public.loyalty_apply_points(
  p_customer_id uuid,
  p_points_delta int,
  p_reason text,
  p_order_id text default null,
  p_created_by text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_new int;
begin
  if p_points_delta is null or p_points_delta = 0 then
    return;
  end if;

  if p_reference is not null then
    if exists (
      select 1
      from public.loyalty_point_transactions t
      where t.customer_id = p_customer_id
        and t.reference = p_reference
    ) then
      return;
    end if;
  end if;

  select coalesce(c.loyalty_points, 0)
  into v_current
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception 'customer not found';
  end if;

  v_new := v_current + p_points_delta;
  if v_new < 0 then
    raise exception 'loyalty balance cannot be negative';
  end if;

  update public.customers c
  set loyalty_points = v_new,
      updated_at = now()
  where c.id = p_customer_id;

  insert into public.loyalty_point_transactions (
    customer_id,
    points_delta,
    balance_after,
    reason,
    order_id,
    created_by,
    reference
  ) values (
    p_customer_id,
    p_points_delta,
    v_new,
    p_reason,
    p_order_id,
    p_created_by,
    p_reference
  );
end;
$$;

grant execute on function public.loyalty_points_for_spend_zar(numeric) to authenticated;
grant execute on function public.loyalty_apply_points(uuid, int, text, text, text, text) to authenticated;

alter table public.loyalty_point_transactions enable row level security;

drop policy if exists loyalty_tx_select_office on public.loyalty_point_transactions;
create policy loyalty_tx_select_office
on public.loyalty_point_transactions
for select
to authenticated
using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '')
    in ('superadmin', 'admin', 'manager')
);

-- Writes go through loyalty_apply_points (security definer); no direct insert policy for clients.

-- If you already deployed an older rule, re-run only the
-- `create or replace function public.loyalty_points_for_spend_zar` block above.
-- Past ledger rows are unchanged; adjust balances manually if needed.

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_CRM_SYNC_FROM_STORE_RPC.sql
-- ---------------------------------------------------------------------------
-- Dumi: sync public.store_clients → public.customers (+ default public.addresses)
-- Run in Supabase SQL Editor (fixes Office /clients not updating when RLS blocks direct writes).
--
-- Why: browser sync used customersApi + RLS policies on customers/addresses. If policies are
-- missing, wrong, or conflict with office policies, updates never apply. This RPC runs as
-- SECURITY DEFINER and only allows: auth.uid() = store_clients.auth_user_id and store email
-- matches auth.users email.

create or replace function public.sync_crm_from_store_client(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text;
  sc record;
  sa record;
  v_cid uuid;
  v_aid uuid;
  v_name text;
  v_marketing boolean;
  v_sms boolean;
  v_email_pref boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select u.email into v_auth_email from auth.users u where u.id = v_uid;
  if v_auth_email is null or length(trim(v_auth_email)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_auth_email');
  end if;

  select * into sc
  from public.store_clients
  where id = p_client_id and auth_user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'store_client_not_found');
  end if;

  if lower(trim(sc.email)) <> lower(trim(v_auth_email)) then
    return jsonb_build_object('ok', false, 'error', 'store_email_must_match_login');
  end if;

  v_name := coalesce(nullif(trim(sc.full_name), ''), split_part(lower(trim(sc.email)), '@', 1));

  v_marketing := coalesce(
    (select p.marketing_emails from public.store_client_preferences p where p.client_id = p_client_id),
    true
  );
  v_sms := coalesce(
    (select p.sms_notifications from public.store_client_preferences p where p.client_id = p_client_id),
    false
  );
  v_email_pref := coalesce(
    (select p.email_notifications from public.store_client_preferences p where p.client_id = p_client_id),
    true
  );

  select * into sa
  from public.store_client_addresses
  where client_id = p_client_id
  order by is_default desc, created_at desc nulls last
  limit 1;

  -- address is chosen by: default first (if present), otherwise latest

  select c.id into v_cid
  from public.customers c
  where c.customer_email is not null
    and lower(trim(c.customer_email)) = lower(trim(sc.email))
  limit 1;

  if v_cid is null then
    insert into public.customers (
      customer_name,
      customer_email,
      customer_phone,
      marketing_consent,
      sms_consent,
      email_consent,
      client_channel,
      customer_type,
      lifetime_value,
      total_orders
    ) values (
      v_name,
      lower(trim(sc.email)),
      nullif(trim(sc.phone), ''),
      v_marketing,
      v_sms,
      v_email_pref,
      'Online',
      'retail',
      0,
      0
    )
    returning id into v_cid;
  else
    update public.customers c
    set
      customer_name = v_name,
      customer_email = lower(trim(sc.email)),
      customer_phone = nullif(trim(sc.phone), ''),
      marketing_consent = v_marketing,
      sms_consent = v_sms,
      email_consent = v_email_pref,
      client_channel = 'Online',
      updated_at = now()
    where c.id = v_cid;
  end if;

  if sa.id is not null
     and length(trim(coalesce(sa.line1, ''))) > 0
     and length(trim(coalesce(sa.city, ''))) > 0
     and length(trim(coalesce(sa.postal_code, ''))) > 0 then

    select a.id into v_aid
    from public.addresses a
    where a.customer_id = v_cid and a.is_default = true
    limit 1;

    if v_aid is null then
      insert into public.addresses (
        customer_id,
        address_type,
        address_line,
        suburb,
        city,
        province,
        postal_code,
        country,
        is_default
      ) values (
        v_cid,
        'delivery',
        trim(sa.line1),
        coalesce(nullif(trim(sa.suburb), ''), ''),
        trim(sa.city),
        coalesce(nullif(trim(sa.province), ''), ''),
        trim(sa.postal_code),
        coalesce(nullif(trim(sa.country), ''), 'South Africa'),
        true
      );
    else
      update public.addresses a
      set
        address_type = 'delivery',
        address_line = trim(sa.line1),
        suburb = coalesce(nullif(trim(sa.suburb), ''), ''),
        city = trim(sa.city),
        province = coalesce(nullif(trim(sa.province), ''), ''),
        postal_code = trim(sa.postal_code),
        country = coalesce(nullif(trim(sa.country), ''), 'South Africa'),
        is_default = true,
        updated_at = now()
      where a.id = v_aid;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'customer_id', v_cid);
end;
$$;

revoke all on function public.sync_crm_from_store_client(uuid) from public;
grant execute on function public.sync_crm_from_store_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_STOREFRONT_CUSTOMERS_SYNC_RLS.sql
-- ---------------------------------------------------------------------------
-- Dumi: let signed-in storefront / walk-in shoppers sync into office CRM (`public.customers`)
-- so http://localhost:8080/clients (and production /clients) shows the same name, phone,
-- marketing flags, and default delivery address after they save on /walk-in.
--
-- Prefer (recommended): docs/SUPABASE_CRM_SYNC_FROM_STORE_RPC.sql — SECURITY DEFINER RPC so sync
-- works even when these RLS policies are missing or conflict with office policies.
--
-- Run in Supabase → SQL Editor after `customers` and `addresses` exist.
--
-- Prereq: the app calls `customersApi.syncFromStorefrontWalkIn` with the same email as
-- `auth.users.email` / `auth.jwt()->>'email'` (Google sign-in is fine; match is case-insensitive).
--
-- If RLS is OFF on these tables, the app already syncs — you can skip this file.
--
-- If RLS is ON: add the policies below IN ADDITION TO whatever your office staff uses
-- (e.g. broad SELECT/ALL for authenticated admins). Multiple permissive policies combine with OR.

-- ---------------------------------------------------------------------------
-- customers (storefront self-service: same row as JWT email)
-- ---------------------------------------------------------------------------

drop policy if exists "customers_storefront_select_own_email" on public.customers;
create policy "customers_storefront_select_own_email"
on public.customers
for select
to authenticated
using (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

drop policy if exists "customers_storefront_insert_own_email" on public.customers;
create policy "customers_storefront_insert_own_email"
on public.customers
for insert
to authenticated
with check (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

drop policy if exists "customers_storefront_update_own_email" on public.customers;
create policy "customers_storefront_update_own_email"
on public.customers
for update
to authenticated
using (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
)
with check (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

-- ---------------------------------------------------------------------------
-- addresses (default delivery row tied to that customer)
-- ---------------------------------------------------------------------------

drop policy if exists "addresses_storefront_select_own_customer" on public.addresses;
create policy "addresses_storefront_select_own_customer"
on public.addresses
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = addresses.customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);

drop policy if exists "addresses_storefront_insert_own_customer" on public.addresses;
create policy "addresses_storefront_insert_own_customer"
on public.addresses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);

drop policy if exists "addresses_storefront_update_own_customer" on public.addresses;
create policy "addresses_storefront_update_own_customer"
on public.addresses
for update
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = addresses.customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
)
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_OFFICE_READ_CRM.sql
-- ---------------------------------------------------------------------------
-- Dumi: let office staff (authenticated) read all public.customers + public.addresses
-- so Create order can prefill phone + delivery from CRM rows synced from the storefront.
--
-- Run in Supabase SQL Editor only if:
--   - addressesApi.listByCustomerId / customersApi.getById return empty or errors for valid clients, OR
--   - Create order shows blank phone/address after the client saved profile in the shop.
--
-- RLS on these tables often has only "shopper can touch own row" policies; office users are also
-- authenticated, so they need a separate permissive SELECT (or role-based policies in production).

alter table if exists public.customers enable row level security;
alter table if exists public.addresses enable row level security;

drop policy if exists customers_office_authenticated_select_all on public.customers;
create policy customers_office_authenticated_select_all
on public.customers
for select
to authenticated
using (true);

drop policy if exists addresses_office_authenticated_select_all on public.addresses;
create policy addresses_office_authenticated_select_all
on public.addresses
for select
to authenticated
using (true);

-- Tighten later: replace using (true) with e.g. (auth.jwt() ->> 'app_role') = 'office'
-- after you set custom claims on staff users.

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_OFFICE_PREFILL_FROM_STORE_RPC.sql
-- ---------------------------------------------------------------------------
-- Office "Create order" prefill: read live storefront profile + default address by CRM customer id.
-- Use when public.addresses is empty or staff RLS cannot read it, but store_clients / store_client_addresses exist.
--
-- Run in Supabase SQL Editor. The app calls: rpc('office_prefill_from_store', { p_customer_id }).

create or replace function public.office_prefill_from_store(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  sc record;
  sa record;
begin
  if p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_customer_id');
  end if;

  select lower(trim(customer_email)) into v_email
  from public.customers
  where id = p_customer_id;

  if v_email is null or length(v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_customer_email');
  end if;

  select * into sc
  from public.store_clients
  where lower(trim(email)) = v_email
  order by updated_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'source', 'none');
  end if;

  return jsonb_build_object(
    'ok', true,
    'source', 'store',
    'full_name', sc.full_name,
    'phone', sc.phone,
    'line1', (
      select a.line1 from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'suburb', (
      select a.suburb from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'city', (
      select a.city from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'province', (
      select a.province from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'postal_code', (
      select a.postal_code from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'country', (
      select a.country from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    )
  );
end;
$$;

revoke all on function public.office_prefill_from_store(uuid) from public;
grant execute on function public.office_prefill_from_store(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_OFFICE_CLIENT_LIST_DISPLAY_RPC.sql
-- ---------------------------------------------------------------------------
-- Office Clients table: merge public.customers with live storefront (store_clients + store_client_addresses)
-- when CRM rows are stale or address only exists on the shop.
--
-- Run in Supabase SQL Editor. App calls: rpc('office_client_list_display').

create or replace function public.office_client_list_display()
returns table (
  customer_id uuid,
  display_name text,
  display_phone text,
  address_summary text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as customer_id,
    coalesce(
      nullif(trim(sc.full_name), ''),
      nullif(trim(c.customer_name), ''),
      ''
    )::text as display_name,
    coalesce(
      nullif(trim(sc.phone), ''),
      nullif(trim(c.customer_phone), '')
    )::text as display_phone,
    coalesce(
      case
        when trim(coalesce(a.line1, '')) <> '' then
          trim(both ' ' from concat_ws(', ',
            nullif(trim(a.line1), ''),
            nullif(trim(a.suburb), ''),
            nullif(trim(a.city), ''),
            nullif(trim(a.province), ''),
            nullif(trim(a.postal_code), '')
          ))
        when trim(coalesce(ad.address_line, '')) <> '' then
          trim(both ' ' from concat_ws(', ',
            nullif(trim(ad.address_line), ''),
            nullif(trim(ad.suburb), ''),
            nullif(trim(ad.city), ''),
            nullif(trim(ad.province), ''),
            nullif(trim(ad.postal_code), '')
          ))
        else ''
      end,
      ''
    )::text as address_summary
  from public.customers c
  left join public.store_clients sc
    on lower(trim(sc.email)) = lower(trim(c.customer_email))
  left join lateral (
    select *
    from public.store_client_addresses a2
    where a2.client_id = sc.id
    order by a2.updated_at desc nulls last
    limit 1
  ) a on true
  left join lateral (
    select *
    from public.addresses ad2
    where ad2.customer_id = c.id
    order by ad2.is_default desc, ad2.updated_at desc nulls last
    limit 1
  ) ad on true
$$;

revoke all on function public.office_client_list_display() from public;
grant execute on function public.office_client_list_display() to authenticated;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_SYNC_STORE_ORDERS_TO_OFFICE.sql
-- ---------------------------------------------------------------------------
-- Dumi: Sync storefront store_orders -> Office orders / order_items
-- Run in Supabase SQL Editor after:
-- - Storefront tables exist (docs/SUPABASE_STOREFRONT_AUTH_CHECKOUT.sql)
-- - Office order tables exist (public.orders + public.order_items as used by the Office app)
--
-- This script:
-- - Creates a small mapping table to prevent duplicates
-- - Adds a SECURITY DEFINER function to upsert an Office order from a store_order
-- - Adds a trigger to keep office orders up to date when store_orders are inserted/updated
--
-- Notes:
-- - This expects your Office `public.orders` schema to include the columns used by the app:
--   reference, channel, status, stage, subtotal, shipping_fee, discount, tax, grand_total, currency,
--   payment_status, payment_method, payment_provider, payment_ref, customer_name, customer_email,
--   customer_phone, location, date, created_at, updated_at.
-- - If your Office `public.orders` uses different column names, adjust the INSERT/UPDATE fields.

create extension if not exists pgcrypto;

-- 1) Map storefront order -> office order to stay idempotent
create table if not exists public.store_office_order_map (
  store_order_id uuid primary key references public.store_orders(id) on delete cascade,
  -- Office `orders.id` is `text` in this project, not uuid.
  office_order_id text not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_store_office_order_map_office_order_id
on public.store_office_order_map (office_order_id);

-- 2) Helper: map store order_status -> office status/stage
create or replace function public.office_status_from_store_order_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'processing'))
    when 'delivered' then 'Delivered'
    when 'shipped' then 'Shipped'
    when 'cancelled' then 'Cancelled'
    else 'Processing'
  end;
$$;

create or replace function public.office_stage_from_store_order_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'processing'))
    when 'delivered' then 'Completed'
    when 'cancelled' then 'Completed'
    else 'In Progress'
  end;
$$;

-- 3) Main: Upsert Office order + items from a store_order id
create or replace function public.sync_office_order_from_store_order(p_store_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  so record;
  oi record;
  v_office_order_id text;
  v_reference text;
  v_customer_name text;
  v_office_status text;
  v_office_stage text;
  v_shipping_address text;
  v_product_uuid uuid;
begin
  -- Load store order
  select *
  into so
  from public.store_orders
  where id = p_store_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'store_order_not_found');
  end if;

  -- Stable reference to prevent duplicates (fits office prefix style)
  v_reference := 'WEB-' || replace(so.id::text, '-', '');
  v_reference := substr(v_reference, 1, 20); -- keep references shortish

  v_customer_name := trim(coalesce(so.first_name, '') || ' ' || coalesce(so.last_name, ''));
  if v_customer_name = '' then
    v_customer_name := split_part(coalesce(so.email, ''), '@', 1);
  end if;

  v_office_status := public.office_status_from_store_order_status(so.order_status);
  v_office_stage := public.office_stage_from_store_order_status(so.order_status);

  v_shipping_address := trim(both ' ' from concat_ws(', ',
    nullif(trim(coalesce(so.address_line1, '')), ''),
    nullif(trim(coalesce(so.suburb, '')), ''),
    nullif(trim(coalesce(so.city, '')), ''),
    nullif(trim(coalesce(so.province, '')), ''),
    nullif(trim(coalesce(so.postal_code, '')), ''),
    nullif(trim(coalesce(so.country, '')), '')
  ));

  -- Resolve existing mapping (idempotent)
  select m.office_order_id
  into v_office_order_id
  from public.store_office_order_map m
  where m.store_order_id = so.id;

  -- If the mapping table is empty (fresh deploy) but the office order already exists
  -- (same unique reference), adopt it instead of inserting a duplicate.
  if v_office_order_id is null then
    select o.id
    into v_office_order_id
    from public.orders o
    where o.reference = v_reference
    limit 1;

    if v_office_order_id is not null then
      insert into public.store_office_order_map (store_order_id, office_order_id)
      values (so.id, v_office_order_id)
      on conflict (store_order_id) do update
        set office_order_id = excluded.office_order_id;
    end if;
  end if;

  if v_office_order_id is null then
    -- Create a new office order
    insert into public.orders (
      reference,
      channel,
      source,
      status,
      stage,
      fulfilment_status,
      subtotal,
      shipping_fee,
      discount,
      tax,
      grand_total,
      currency,
      payment_status,
      payment_method,
      payment_provider,
      payment_ref,
      paid_at,
      shipping_method,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      location,
      date
    ) values (
      v_reference,
      'Online Orders',
      'Storefront',
      v_office_status,
      v_office_stage,
      'unfulfilled',
      coalesce(so.subtotal_amount, 0),
      coalesce(so.shipping_amount, 0),
      0,
      0,
      coalesce(so.total_amount, 0),
      'ZAR',
      case when lower(coalesce(so.order_status, 'processing')) = 'delivered' then 'Paid' else 'Pending' end,
      nullif(trim(coalesce(so.payment_method, '')), ''),
      'payfast',
      v_reference,
      null,
      null,
      v_customer_name,
      lower(trim(so.email)),
      nullif(trim(coalesce(so.phone, '')), ''),
      nullif(v_shipping_address, ''),
      coalesce(nullif(trim(so.city), ''), 'Online'),
      coalesce(so.created_at::date, now()::date)
    )
    returning id into v_office_order_id;

    insert into public.store_office_order_map (store_order_id, office_order_id)
    values (so.id, v_office_order_id);
  else
    -- Update the existing office order (keep status/stage in sync)
    update public.orders o
    set
      status = v_office_status,
      stage = v_office_stage,
      source = 'Storefront',
      subtotal = coalesce(so.subtotal_amount, 0),
      shipping_fee = coalesce(so.shipping_amount, 0),
      grand_total = coalesce(so.total_amount, 0),
      payment_method = nullif(trim(coalesce(so.payment_method, '')), ''),
      customer_name = v_customer_name,
      customer_email = lower(trim(so.email)),
      customer_phone = nullif(trim(coalesce(so.phone, '')), ''),
      shipping_address = nullif(v_shipping_address, ''),
      location = coalesce(nullif(trim(so.city), ''), 'Online'),
      updated_at = now()
    where o.id = v_office_order_id;
  end if;

  -- Replace items to avoid drift (simple and reliable)
  delete from public.order_items
  where order_id = v_office_order_id;

  for oi in
    select *
    from public.store_order_items
    where order_id = so.id
    order by id asc
  loop
    -- storefront store_order_items.product_id is text; office order_items.product_id is uuid
    begin
      v_product_uuid := oi.product_id::uuid;
    exception when others then
      v_product_uuid := null;
    end;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      product_category,
      product_type,
      sku,
      image_url,
      quantity,
      unit_price,
      discount,
      tax,
      line_total
      , fulfilment_status
    ) values (
      v_office_order_id,
      v_product_uuid,
      oi.product_name,
      'Perfume',
      null,
      null,
      oi.image_url,
      oi.quantity,
      oi.unit_price,
      0,
      0,
      oi.line_total,
      'unfulfilled'
    );
  end loop;

  return jsonb_build_object('ok', true, 'office_order_id', v_office_order_id, 'reference', v_reference);
end;
$$;

revoke all on function public.sync_office_order_from_store_order(uuid) from public;
grant execute on function public.sync_office_order_from_store_order(uuid) to authenticated;

-- 4) Trigger: run sync automatically on insert/update of store_orders
create or replace function public.trg_sync_office_order_from_store_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only sync when we have an email (identity) and totals
  if new.email is null or length(trim(new.email)) = 0 then
    return new;
  end if;
  perform public.sync_office_order_from_store_order(new.id);
  return new;
end;
$$;

drop trigger if exists store_orders_sync_office on public.store_orders;
create trigger store_orders_sync_office
after insert or update of order_status, subtotal_amount, shipping_amount, total_amount
on public.store_orders
for each row
execute function public.trg_sync_office_order_from_store_orders();

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_OFFICE_READ_STOREFRONT_ORDERS_AND_POP.sql
-- ---------------------------------------------------------------------------
-- Office read access for storefront order + PoP tables
-- Run in Supabase SQL Editor as a privileged user.
--
-- Why:
-- Office UI reads these storefront tables to show synced line items and proof-of-payment links.
-- Without explicit SELECT policies for authenticated office sessions, queries can return empty rows.
--
-- NOTE: DROP/CREATE POLICY requires the table to exist. Policies are applied only when present.

do $$
begin
  if to_regclass('public.store_orders') is not null then
    execute 'alter table public.store_orders enable row level security';
    execute 'drop policy if exists "store_orders_office_authenticated_select_all" on public.store_orders';
    execute $p$
      create policy "store_orders_office_authenticated_select_all"
      on public.store_orders
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_order_items') is not null then
    execute 'alter table public.store_order_items enable row level security';
    execute 'drop policy if exists "store_order_items_office_authenticated_select_all" on public.store_order_items';
    execute $p$
      create policy "store_order_items_office_authenticated_select_all"
      on public.store_order_items
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_payment_proofs') is not null then
    execute 'alter table public.store_payment_proofs enable row level security';
    execute 'drop policy if exists "store_payment_proofs_office_authenticated_select_all" on public.store_payment_proofs';
    execute $p$
      create policy "store_payment_proofs_office_authenticated_select_all"
      on public.store_payment_proofs
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_office_order_map') is not null then
    execute 'alter table public.store_office_order_map enable row level security';
    execute 'drop policy if exists "store_office_order_map_office_authenticated_select_all" on public.store_office_order_map';
    execute $p$
      create policy "store_office_order_map_office_authenticated_select_all"
      on public.store_office_order_map
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_STORE_ORDERS_DELETE_REVERSE_POINTS.sql
-- ---------------------------------------------------------------------------
-- Reverse Office loyalty points when a storefront order is deleted
-- Run in Supabase SQL Editor.
--
-- Context:
-- - Storefront orders live in: public.store_orders
-- - Office orders live in: public.orders
-- - Mapping lives in: public.store_office_order_map (store_order_id -> office_order_id)
-- - Loyalty ledger lives in: public.loyalty_point_transactions (order_id is the OFFICE order id as text)
--
-- This trigger ensures deleting a storefront order also reverses any loyalty points
-- previously awarded for the mapped office order.

create or replace function public.reverse_loyalty_points_for_store_order_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office_order_id text;
  v_customer_id uuid;
  v_net_points int;
begin
  -- Find the mapped office order id (text)
  select office_order_id
  into v_office_order_id
  from public.store_office_order_map
  where store_order_id = old.id
  limit 1;

  if v_office_order_id is null or v_office_order_id = '' then
    return old;
  end if;

  -- Reverse per customer (net points tied to that office order)
  for v_customer_id, v_net_points in
    select customer_id, coalesce(sum(points_delta), 0)::int
    from public.loyalty_point_transactions
    where order_id = v_office_order_id
    group by customer_id
  loop
    if v_net_points is null or v_net_points = 0 then
      continue;
    end if;

    perform public.loyalty_apply_points(
      v_customer_id,
      -v_net_points,
      'Store order deleted: points reversed',
      v_office_order_id,
      'system',
      'store-delete:' || old.id::text || ':' || v_customer_id::text
    );
  end loop;

  -- Optional: remove mapping row so it doesn't point to a deleted store order
  delete from public.store_office_order_map
  where store_order_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_reverse_points_on_store_order_delete on public.store_orders;
create trigger trg_reverse_points_on_store_order_delete
after delete on public.store_orders
for each row
execute function public.reverse_loyalty_points_for_store_order_delete();


-- #############################################################################
-- SECTION: CONTENT / CMS / PERSONALISATION
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_HOME_HERO_SLIDES.sql
-- ---------------------------------------------------------------------------
-- Creates home_hero_slides for storefront hero + Office content cards.
-- Run in Supabase SQL Editor (Dashboard → SQL → New query). Safe to re-run.
--
-- Related: client-notes section header seed lives in docs/SUPABASE_HOME_CLIENT_NOTES.sql

create extension if not exists pgcrypto;

create table if not exists public.home_hero_slides (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kicker text null,
  headline text not null,
  subheadline text null,
  body text null,
  primary_cta_label text null,
  primary_cta_href text null,
  secondary_cta_label text null,
  secondary_cta_href text null,
  collection_code text null,
  product_id uuid null,
  background_image_url text null,
  background_video_url text null,
  gallery_image_urls text[] null,
  image_rotation_seconds integer null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_hero_slides
  add column if not exists image_rotation_seconds integer null;

alter table public.home_hero_slides
  add column if not exists background_image_url_mobile text null;

-- Align product_id type with products.id, then add optional FK
do $$
declare
  products_id_type text;
  hero_product_id_type text;
begin
  if to_regclass('public.products') is null then
    return;
  end if;

  select c.udt_name
  into products_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  if products_id_type is null then
    return;
  end if;

  alter table public.home_hero_slides
    drop constraint if exists home_hero_slides_product_id_fkey;

  select c.udt_name
  into hero_product_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'home_hero_slides'
    and c.column_name = 'product_id';

  if hero_product_id_type is null then
    if products_id_type = 'uuid' then
      alter table public.home_hero_slides add column product_id uuid null;
    else
      alter table public.home_hero_slides add column product_id text null;
    end if;
  elsif hero_product_id_type is distinct from products_id_type then
    if products_id_type = 'uuid' then
      alter table public.home_hero_slides
        alter column product_id type uuid
        using case
          when product_id is null or btrim(product_id) = '' then null
          else product_id::uuid
        end;
    else
      alter table public.home_hero_slides
        alter column product_id type text using product_id::text;
    end if;
  end if;

  alter table public.home_hero_slides
    add constraint home_hero_slides_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
end $$;

create index if not exists idx_home_hero_slides_active_sort
  on public.home_hero_slides (is_active, sort_order, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_home_hero_slides_updated_at on public.home_hero_slides;
create trigger set_home_hero_slides_updated_at
before update on public.home_hero_slides
for each row
execute function public.set_updated_at();

alter table public.home_hero_slides enable row level security;

grant select on public.home_hero_slides to anon, authenticated;
grant select, insert, update, delete on public.home_hero_slides to authenticated;

drop policy if exists "home_hero_slides_public_read_active" on public.home_hero_slides;
create policy "home_hero_slides_public_read_active"
on public.home_hero_slides
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "home_hero_slides_office_manage" on public.home_hero_slides;
create policy "home_hero_slides_office_manage"
on public.home_hero_slides
for all
to authenticated
using (true)
with check (true);

-- Main hero (top banner) — edit image/copy in Office Content
insert into public.home_hero_slides (
  code, kicker, headline, subheadline,
  primary_cta_label, primary_cta_href,
  secondary_cta_label, secondary_cta_href,
  is_active, sort_order
)
values (
  'home-main',
  'July Promo',
  'BUY X3 FOR R499.99',
  'Modern fragrance house',
  'Shop Female Fragrances',
  '/shop',
  'Discover Your Signature',
  '/know-your-scent',
  true,
  1
)
on conflict (code) do nothing;

-- New Arrivals content card (not main hero rotation)
insert into public.home_hero_slides (
  code, kicker, headline, subheadline,
  primary_cta_label, primary_cta_href,
  is_active, sort_order
)
values (
  'fresh-in-store',
  'New Arrivals',
  'Fresh In Store',
  'Just landed — the newest additions to the house.',
  'Shop new arrivals',
  '/shop',
  true,
  900
)
on conflict (code) do nothing;

-- Personalisation page + home card
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body,
  primary_cta_label, primary_cta_href,
  is_active, sort_order
)
values (
  'put-your-name-on-it',
  'Personalisation',
  'Put Your Name On It',
  'Make it yours with a name on the label.',
  'Personalise your perfume for an extra R20.',
  'Request personalisation',
  '/personalisation',
  true,
  910
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  body = excluded.body,
  primary_cta_label = excluded.primary_cta_label,
  primary_cta_href = excluded.primary_cta_href,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- After uploading images in Office (hero-assets bucket), set paths like:
-- update public.home_hero_slides
-- set
--   background_image_url = 'home-hero/images/desktop.jpg',
--   background_image_url_mobile = 'home-hero/images/mobile.jpg',
--   updated_at = now()
-- where code = 'put-your-name-on-it';
-- Home carousel desktop: 2880×1228 or 1440×614. Home carousel mobile: 1080×1920 (9:16).
-- Other hero slides/cards: use 2400×1350 or 1920×1080 (16:9). Keep subject in center 60%.

-- Gift Guide page hero
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, is_active, sort_order
)
values (
  'gift-guide-hero',
  'Curated Gifting',
  'The luxury gift guide for fragrance that feels intimate and memorable.',
  'From milestone gifts to thoughtful gestures, each edit is designed to feel elevated in tone, packaging, and emotion from the first glance to the final note.',
  true,
  930
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Gift Edits cards (Office: set background_image_url per card)
insert into public.home_hero_slides (
  code, headline, subheadline, collection_code, primary_cta_label, is_active, sort_order
)
values
  (
    'gift-edit-for-him',
    'For Him',
    'Bold, commanding scents that embody strength and dignity.',
    'mens',
    'Shop Gifts for Him',
    true,
    941
  ),
  (
    'gift-edit-for-her',
    'For Her',
    'Elegant, timeless fragrances that celebrate grace and beauty.',
    'womens',
    'Shop Gifts for Her',
    true,
    942
  ),
  (
    'gift-edit-for-everyone',
    'For Everyone',
    'Balanced, versatile scents perfect for any occasion.',
    'unisex',
    'Shop Gifts for Everyone',
    true,
    943
  )
on conflict (code) do update set
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  collection_code = excluded.collection_code,
  primary_cta_label = excluded.primary_cta_label,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Our Journey page (hero + promise section — set background_image_url in Office)
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body, is_active, sort_order
)
values (
  'our-journey-hero',
  'The House Story',
  'Our Journey',
  null,
  null,
  true,
  960
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body, is_active, sort_order
)
values (
  'our-journey-promise',
  'Our Promise',
  'Built for trust and longevity',
  'We are committed to growing Dumi Essence responsibly: improving products, experience, and communication without overstating impact.',
  'This page will continue to evolve with verified milestones so our community can see real progress over time.',
  true,
  961
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  body = excluded.body,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- After uploading in Office (hero-assets bucket):
-- update public.home_hero_slides
-- set background_image_url = 'home-hero/images/our-journey-banner.jpg', updated_at = now()
-- where code = 'our-journey-hero';
--
-- update public.home_hero_slides
-- set background_image_url = 'home-hero/images/our-journey-promise.jpg', updated_at = now()
-- where code = 'our-journey-promise';

notify pgrst, 'reload schema';

select
  (select count(*) from public.home_hero_slides where is_active = true) as active_slide_count;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_HOME_CLIENT_NOTES.sql
-- ---------------------------------------------------------------------------
-- Home page "Client Notes" testimonials (storefront Index → Client Notes section)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: docs/SUPABASE_HOME_HERO_SLIDES.sql (home_hero_slides table)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Testimonial cards
-- ---------------------------------------------------------------------------
create table if not exists public.home_client_notes (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  location text not null,
  quote text not null,
  rating numeric(2, 1) not null default 5.0 check (rating >= 0 and rating <= 5),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_client_notes_active_sort
  on public.home_client_notes (is_active, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses set_updated_at if present)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_home_client_notes_updated_at on public.home_client_notes;
create trigger set_home_client_notes_updated_at
before update on public.home_client_notes
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.home_client_notes enable row level security;

grant select on public.home_client_notes to anon, authenticated;
grant select, insert, update, delete on public.home_client_notes to authenticated;

drop policy if exists "home_client_notes_public_read_active" on public.home_client_notes;
create policy "home_client_notes_public_read_active"
on public.home_client_notes
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "home_client_notes_office_manage" on public.home_client_notes;
create policy "home_client_notes_office_manage"
on public.home_client_notes
for all
to authenticated
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Section header copy (home_hero_slides code = client-notes)
-- ---------------------------------------------------------------------------
insert into public.home_hero_slides (
  code, kicker, headline, is_active, sort_order
)
values (
  'client-notes',
  'Client Notes',
  'What people remember after the first wear.',
  true,
  920
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed testimonials (matches current storefront hardcoded fallbacks)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.home_client_notes limit 1) then
    insert into public.home_client_notes (client_name, location, quote, rating, sort_order, is_active)
    values
      (
        'Nolwazi M.',
        'Johannesburg',
        'Midnight Amber lasts all day on my skin, and the dry-down is soft, warm, and addictive.',
        5.0,
        1,
        true
      ),
      (
        'Lerato K.',
        'Cape Town',
        'I get compliments every time I wear Velvet Rose - it opens fresh and settles into a rich, elegant perfume trail.',
        5.0,
        2,
        true
      ),
      (
        'Thabo D.',
        'Pretoria',
        'Ubuntu Noir smells premium and masculine without being too heavy; projection is perfect for both office and evenings.',
        5.0,
        3,
        true
      );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  (select count(*) from public.home_client_notes where is_active = true) as testimonial_count;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_STOREFRONT_COLLECTIONS.sql
-- ---------------------------------------------------------------------------
-- Storefront "Shop the House" collection cards (Office Content → Storefront collections)
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Main app: read docs/STOREFRONT_COLLECTIONS.md for query + image URL resolver.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Extend collections table for Office + storefront
-- ---------------------------------------------------------------------------
alter table public.collections
  add column if not exists code text;

alter table public.collections
  add column if not exists tagline text;

alter table public.collections
  add column if not exists hero_image_url text;

-- Storefront useFeaturedCollections reads `image` (mirrors hero_image_url)
alter table public.collections
  add column if not exists image text;

-- Legacy column from older schemas
alter table public.collections
  add column if not exists image_url text;

-- Backfill code + hero image from legacy columns
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

update public.collections
set hero_image_url = image_url
where (hero_image_url is null or btrim(hero_image_url) = '')
  and image_url is not null
  and btrim(image_url) <> '';

-- Normalize legacy diffuser code (Office used "diffusers"; storefront expects "diffuser")
update public.collections
set code = 'diffuser',
    slug = 'diffuser'
where code in ('diffusers', 'diffuser')
   or slug in ('diffusers', 'diffuser');

-- Backfill any remaining null codes from slug (needed for a full unique index)
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

-- Full unique indexes (partial indexes cannot be used with ON CONFLICT (col))
drop index if exists idx_collections_code_unique;
create unique index if not exists idx_collections_code_unique
  on public.collections (code);

create unique index if not exists idx_collections_slug_unique
  on public.collections (slug);

-- ---------------------------------------------------------------------------
-- Product categories (cosmetics lines) — text column, no enum lock
-- ---------------------------------------------------------------------------
-- Office inventory categories: Perfume, Diffuser, Car Perfume, Shower Gel, Body Lotion, Body Oil
-- Assign collection_code on products when linking to shop cards:
--   car-perfumes  → Car Perfume products
--   cosmetics     → Shower Gel / Body Lotion / Body Oil (grouped under one shop card)

-- ---------------------------------------------------------------------------
-- Seed / upsert shop collection cards
-- ---------------------------------------------------------------------------
insert into public.collections (code, slug, name, tagline, description, is_active, published_at)
values
  (
    'mens',
    'mens',
    'Men''s Line',
    'Structured signatures with warmth, woods, and presence.',
    'Structured signatures with warmth, woods, and presence.',
    true,
    now()
  ),
  (
    'womens',
    'womens',
    'Women''s Line',
    'Polished florals and luminous amber compositions.',
    'Polished florals and luminous amber compositions.',
    true,
    now()
  ),
  (
    'unisex',
    'unisex',
    'Unisex Line',
    'Modern, versatile luxury for everyday wear.',
    'Modern, versatile luxury for everyday wear.',
    true,
    now()
  ),
  (
    'diffuser',
    'diffuser',
    'Diffusers Line',
    'Room-fresh sophistication, amplified.',
    'Room-fresh sophistication, amplified.',
    true,
    now()
  ),
  (
    'car-perfumes',
    'car-perfumes',
    'Car Perfume',
    'Compact scent for every drive — fresh, warm, unmistakably Dumi.',
    'Car vent clips and cabin fragrance.',
    true,
    now()
  ),
  (
    'cosmetics',
    'cosmetics',
    'Cosmetics',
    'Body care essentials — lotions, shower gels, and body oils.',
    'Lotions, shower gels, and body oils for everyday ritual.',
    true,
    now()
  )
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- If slug conflicts differ from code (e.g. old diffusers row), align by code
update public.collections c
set
  slug = v.code,
  name = v.name,
  tagline = v.tagline,
  is_active = true
from (values
  ('mens', 'Men''s Line', 'Structured signatures with warmth, woods, and presence.'),
  ('womens', 'Women''s Line', 'Polished florals and luminous amber compositions.'),
  ('unisex', 'Unisex Line', 'Modern, versatile luxury for everyday wear.'),
  ('diffuser', 'Diffusers Line', 'Room-fresh sophistication, amplified.'),
  ('car-perfumes', 'Car Perfume', 'Compact scent for every drive — fresh, warm, unmistakably Dumi.'),
  ('cosmetics', 'Cosmetics', 'Body care essentials — lotions, shower gels, and body oils.')
) as v(code, name, tagline)
where c.code = v.code;

-- ---------------------------------------------------------------------------
-- RLS (storefront public read)
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;

grant select on public.collections to anon, authenticated;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "collections_public_read_active" on public.collections;
create policy "collections_public_read_active"
on public.collections
for select
to anon, authenticated
using (coalesce(is_active, true) = true);

drop policy if exists "collections_office_manage" on public.collections;
create policy "collections_office_manage"
on public.collections
for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';

select code, slug, name, hero_image_url is not null as has_image
from public.collections
where code in ('mens', 'womens', 'unisex', 'diffuser', 'car-perfumes', 'cosmetics')
order by code;

-- ---------------------------------------------------------------------------
-- After uploading to hero-assets bucket (Office Content → Upload image, or
-- Storage → hero-assets → collections/), set paths like:
-- ---------------------------------------------------------------------------
-- update public.collections
-- set hero_image_url = 'collections/mens-hero.jpg', updated_at = now()
-- where code = 'mens';
--
-- update public.collections
-- set hero_image_url = 'collections/womens-hero.jpg', updated_at = now()
-- where code = 'womens';
--
-- update public.collections
-- set hero_image_url = 'collections/unisex-hero.jpg', updated_at = now()
-- where code = 'unisex';
--
-- update public.collections
-- set hero_image_url = 'collections/diffuser-hero.jpg', updated_at = now()
-- where code = 'diffuser';
--
-- update public.collections
-- set hero_image_url = 'collections/car-perfumes-hero.jpg', updated_at = now()
-- where code = 'car-perfumes';
--
-- update public.collections
-- set hero_image_url = 'collections/cosmetics-hero.jpg', updated_at = now()
-- where code = 'cosmetics';

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_COLLECTIONS_SEED.sql
-- ---------------------------------------------------------------------------
-- Seed missing collection rows for Office / storefront carousel.
-- Run in Supabase if diffuser, car-perfumes, or cosmetics are missing.
-- Requires: unique index on collections.code (see SUPABASE_STOREFRONT_COLLECTIONS.sql).

alter table public.collections
  add column if not exists code text;

alter table public.collections
  add column if not exists tagline text;

alter table public.collections
  add column if not exists hero_image_url text;

-- Main app useFeaturedCollections reads `image` when Supabase is connected
alter table public.collections
  add column if not exists image text;

-- Ensure no null codes before unique index (re-run safe)
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

-- Full unique index required for ON CONFLICT (code)
drop index if exists idx_collections_code_unique;
create unique index idx_collections_code_unique
  on public.collections (code);

insert into public.collections (code, slug, name, tagline, description, is_active)
values
  (
    'diffuser',
    'diffuser',
    'Diffuser',
    'Elevated spaces',
    'Interior fragrance designed for elevated spaces.',
    true
  ),
  (
    'car-perfumes',
    'car-perfumes',
    'Car Perfumes',
    'Refined drive',
    'Travel scent experiences for a refined drive.',
    true
  ),
  (
    'cosmetics',
    'cosmetics',
    'Cosmetics',
    'Beauty essentials',
    'Beauty and body essentials curated with the Dumi touch.',
    true
  )
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Keep `image` in sync with hero_image_url for storefront hooks
update public.collections
set image = hero_image_url
where hero_image_url is not null
  and btrim(hero_image_url) <> ''
  and (image is null or btrim(image) = '' or image = hero_image_url);

notify pgrst, 'reload schema';

select code, name, hero_image_url, image
from public.collections
where code in ('diffuser', 'car-perfumes', 'cosmetics')
order by code;

-- Set images after upload to hero-assets (Office Content → Upload, or Storage):
-- update public.collections
-- set hero_image_url = 'collections/diffuser-hero.jpg',
--     image = 'collections/diffuser-hero.jpg',
--     updated_at = now()
-- where code = 'diffuser';
--
-- update public.collections
-- set hero_image_url = 'collections/car-perfumes-hero.jpg',
--     image = 'collections/car-perfumes-hero.jpg',
--     updated_at = now()
-- where code = 'car-perfumes';
--
-- update public.collections
-- set hero_image_url = 'collections/cosmetics-hero.jpg',
--     image = 'collections/cosmetics-hero.jpg',
--     updated_at = now()
-- where code = 'cosmetics';

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_BUNDLE_SPECIALS.sql
-- ---------------------------------------------------------------------------
-- Pick-and-mix fragrance bundle specials (storefront /specials/:code)
-- Run once in Supabase SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Parent bundle (price, copy, hero image)
-- ---------------------------------------------------------------------------
create table if not exists public.bundle_specials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  headline text,
  subheadline text,
  description text,
  hero_image_url text,
  bundle_price numeric(10, 2) not null,
  compare_at_price numeric(10, 2),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Selection slots (tabs on storefront — e.g. Men's ×3, or His & Hers Men's ×2 + Women's ×2)
-- collection_code filters products.collection_code for the pick grid
-- ---------------------------------------------------------------------------
create table if not exists public.bundle_special_slots (
  id uuid primary key default gen_random_uuid(),
  bundle_special_id uuid not null references public.bundle_specials(id) on delete cascade,
  slot_code text not null,
  tab_label text not null,
  collection_code text not null,
  pick_count integer not null default 1 check (pick_count > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bundle_special_id, slot_code)
);

create index if not exists idx_bundle_special_slots_bundle
  on public.bundle_special_slots(bundle_special_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_bundle_specials_updated_at on public.bundle_specials;
create trigger set_bundle_specials_updated_at
before update on public.bundle_specials
for each row execute function public.set_updated_at();

drop trigger if exists set_bundle_special_slots_updated_at on public.bundle_special_slots;
create trigger set_bundle_special_slots_updated_at
before update on public.bundle_special_slots
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bundle_specials enable row level security;
alter table public.bundle_special_slots enable row level security;

grant select on public.bundle_specials to anon, authenticated;
grant select, insert, update, delete on public.bundle_specials to authenticated;
grant select on public.bundle_special_slots to anon, authenticated;
grant select, insert, update, delete on public.bundle_special_slots to authenticated;

drop policy if exists "bundle_specials_public_read" on public.bundle_specials;
create policy "bundle_specials_public_read"
on public.bundle_specials
for select to anon, authenticated
using (is_active = true);

drop policy if exists "bundle_specials_office_manage" on public.bundle_specials;
create policy "bundle_specials_office_manage"
on public.bundle_specials
for all to authenticated
using (true) with check (true);

drop policy if exists "bundle_special_slots_public_read" on public.bundle_special_slots;
create policy "bundle_special_slots_public_read"
on public.bundle_special_slots
for select to anon, authenticated
using (
  exists (
    select 1 from public.bundle_specials b
    where b.id = bundle_special_id and b.is_active = true
  )
);

drop policy if exists "bundle_special_slots_office_manage" on public.bundle_special_slots;
create policy "bundle_special_slots_office_manage"
on public.bundle_special_slots
for all to authenticated
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed the four launch bundles
-- ---------------------------------------------------------------------------
insert into public.bundle_specials (
  code, name, headline, subheadline, bundle_price, compare_at_price, is_active, sort_order
)
values
  (
    'mens-trio',
    'Men''s Trio',
    'Pick any 3 Men''s fragrances',
    'Curate your own trio from the Men''s line.',
    599.99,
    750.00,
    true,
    0
  ),
  (
    'unisex-trio',
    'Unisex Trio',
    'Pick any 3 Unisex fragrances',
    'Mix and match from the Unisex collection.',
    599.99,
    750.00,
    true,
    1
  ),
  (
    'womens-trio',
    'Women''s Trio',
    'Pick any 3 Women''s fragrances',
    'Build your trio from the Women''s line.',
    499.99,
    650.00,
    true,
    2
  ),
  (
    'his-and-hers',
    'His & Hers',
    '2 Men''s + 2 Women''s',
    'The perfect pair — two from each line.',
    699.99,
    900.00,
    true,
    3
  )
on conflict (code) do update set
  name = excluded.name,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  bundle_price = excluded.bundle_price,
  compare_at_price = excluded.compare_at_price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Slots (delete + re-insert per bundle on seed for idempotency)
delete from public.bundle_special_slots
where bundle_special_id in (
  select id from public.bundle_specials
  where code in ('mens-trio', 'unisex-trio', 'womens-trio', 'his-and-hers')
);

insert into public.bundle_special_slots (
  bundle_special_id, slot_code, tab_label, collection_code, pick_count, sort_order
)
select b.id, s.slot_code, s.tab_label, s.collection_code, s.pick_count, s.sort_order
from public.bundle_specials b
join (
  values
    ('mens-trio', 'mens', 'Men''s', 'mens', 3, 0),
    ('unisex-trio', 'unisex', 'Unisex', 'unisex', 3, 0),
    ('womens-trio', 'womens', 'Women''s', 'womens', 3, 0),
    ('his-and-hers', 'mens', 'Men''s', 'mens', 2, 0),
    ('his-and-hers', 'womens', 'Women''s', 'womens', 2, 1)
) as s(bundle_code, slot_code, tab_label, collection_code, pick_count, sort_order)
  on b.code = s.bundle_code;

-- Normalize legacy bundle hero paths (Office used bundles/ before bundle-specials/)
update public.bundle_specials
set
  hero_image_url = replace(
    regexp_replace(hero_image_url, '^hero-assets/', ''),
    'bundles/',
    'bundle-specials/'
  ),
  updated_at = now()
where hero_image_url is not null
  and (
    hero_image_url like 'bundles/%'
    or hero_image_url like 'hero-assets/bundles/%'
    or hero_image_url like 'hero-assets/bundle-specials/%'
  );

notify pgrst, 'reload schema';

select
  (select count(*) from public.bundle_specials where is_active = true) as bundle_count,
  (select count(*) from public.bundle_special_slots) as slot_count;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_FRONT_POPUPS.sql
-- ---------------------------------------------------------------------------
-- Creates the front_popups table used by the storefront popup.
-- Run this in Supabase SQL editor (or your migration system).

create table if not exists public.front_popups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  is_active boolean not null default false,
  headline text null,
  body text null,
  image_url text null,
  cta_label text null,
  cta_href text null,
  dismiss_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_front_popups_updated_at on public.front_popups;
create trigger set_front_popups_updated_at
before update on public.front_popups
for each row
execute function public.set_updated_at();

-- Row Level Security
alter table public.front_popups enable row level security;

-- Storefront (anon) can read ONLY active popups
drop policy if exists "front_popups_public_read_active" on public.front_popups;
create policy "front_popups_public_read_active"
on public.front_popups
for select
to anon
using (is_active = true);

-- Office (authenticated) can manage popups
drop policy if exists "front_popups_office_manage" on public.front_popups;
create policy "front_popups_office_manage"
on public.front_popups
for all
to authenticated
using (true)
with check (true);

-- Seed the default code used by the app
insert into public.front_popups (code, is_active, dismiss_days)
values ('home-entry', false, 7)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_PERSONALISATION_REPAIR.sql
-- ---------------------------------------------------------------------------
-- Personalisation — run this ONE file in Supabase → SQL Editor → Run
-- Safe to re-run. Creates tables, repairs missing columns, seeds data, reloads API schema.
--
-- After success you should see one row below with settings_count = 1, fonts_count >= 3.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.personalisation_settings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fee numeric(10, 2) not null default 20,
  preview_image_url text,
  preview_image_mens text,
  preview_image_womens text,
  preview_image_unisex text,
  preview_image_diffuser text,
  label_top_pct numeric(5, 2) not null default 42,
  label_left_pct numeric(5, 2) not null default 50,
  label_width_pct numeric(5, 2) not null default 72,
  placeholder_text text not null default 'Your Name',
  max_name_length integer not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personalisation_fonts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  font_family text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair columns on partial / older installs
alter table public.personalisation_settings
  add column if not exists fee numeric(10, 2) not null default 20,
  add column if not exists preview_image_url text,
  add column if not exists preview_image_mens text,
  add column if not exists preview_image_womens text,
  add column if not exists preview_image_unisex text,
  add column if not exists preview_image_diffuser text,
  add column if not exists label_top_pct numeric(5, 2) not null default 42,
  add column if not exists label_left_pct numeric(5, 2) not null default 50,
  add column if not exists label_width_pct numeric(5, 2) not null default 72,
  add column if not exists label_top_pct_mens numeric(5, 2),
  add column if not exists label_left_pct_mens numeric(5, 2),
  add column if not exists label_width_pct_mens numeric(5, 2),
  add column if not exists label_top_pct_womens numeric(5, 2),
  add column if not exists label_left_pct_womens numeric(5, 2),
  add column if not exists label_width_pct_womens numeric(5, 2),
  add column if not exists label_top_pct_unisex numeric(5, 2),
  add column if not exists label_left_pct_unisex numeric(5, 2),
  add column if not exists label_width_pct_unisex numeric(5, 2),
  add column if not exists label_top_pct_diffuser numeric(5, 2),
  add column if not exists label_left_pct_diffuser numeric(5, 2),
  add column if not exists label_width_pct_diffuser numeric(5, 2),
  add column if not exists placeholder_text text not null default 'Your Name',
  add column if not exists max_name_length integer not null default 20,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.personalisation_fonts
  add column if not exists label text,
  add column if not exists font_family text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_personalisation_settings_updated_at on public.personalisation_settings;
create trigger set_personalisation_settings_updated_at
before update on public.personalisation_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_personalisation_fonts_updated_at on public.personalisation_fonts;
create trigger set_personalisation_fonts_updated_at
before update on public.personalisation_fonts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants (Office authenticated write, storefront anon read active rows)
-- ---------------------------------------------------------------------------
alter table public.personalisation_settings enable row level security;
alter table public.personalisation_fonts enable row level security;

grant select on public.personalisation_settings to anon, authenticated;
grant select, insert, update, delete on public.personalisation_settings to authenticated;
grant select on public.personalisation_fonts to anon, authenticated;
grant select, insert, update, delete on public.personalisation_fonts to authenticated;

drop policy if exists "personalisation_settings_public_read" on public.personalisation_settings;
create policy "personalisation_settings_public_read"
on public.personalisation_settings
for select to anon, authenticated
using (is_active = true);

drop policy if exists "personalisation_fonts_public_read" on public.personalisation_fonts;
create policy "personalisation_fonts_public_read"
on public.personalisation_fonts
for select to anon, authenticated
using (is_active = true);

drop policy if exists "personalisation_settings_office_manage" on public.personalisation_settings;
create policy "personalisation_settings_office_manage"
on public.personalisation_settings
for all to authenticated
using (true) with check (true);

drop policy if exists "personalisation_fonts_office_manage" on public.personalisation_fonts;
create policy "personalisation_fonts_office_manage"
on public.personalisation_fonts
for all to authenticated
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into public.personalisation_settings (
  code,
  fee,
  preview_image_url,
  label_top_pct,
  label_left_pct,
  label_width_pct,
  placeholder_text,
  max_name_length,
  is_active
)
values (
  'default',
  20,
  null,
  42,
  50,
  72,
  'Your Name',
  20,
  true
)
on conflict (code) do nothing;

insert into public.personalisation_fonts (code, label, font_family, sort_order, is_active)
values
  ('hiragenda', 'Hiragenda', '"Hiragenda", sans-serif', 0, true),
  ('ocean-trace', 'Ocean Trace-Personal', '"Ocean Trace-Personal", cursive', 1, true),
  ('chillax', 'Chillax Family', '"Chillax", "Chillax Family", sans-serif', 2, true)
on conflict (code) do update set
  label = excluded.label,
  font_family = excluded.font_family,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

update public.personalisation_fonts
set is_active = false, updated_at = now()
where code in ('classic-serif', 'modern-sans', 'elegant-script', 'bold-caps');

-- Tell PostgREST / Supabase API to pick up the new tables
notify pgrst, 'reload tables';
notify pgrst, 'reload schema';
select pg_notification_queue_usage();

-- Verification (should show settings_count = 1, fonts_count >= 3)
select
  (select count(*) from public.personalisation_settings) as settings_count,
  (select count(*) from public.personalisation_fonts where is_active = true) as fonts_count;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_PERSONALISATION_LABEL_POSITIONS.sql
-- ---------------------------------------------------------------------------
-- Per-category label position on personalisation bottle previews.
-- Run in Supabase SQL Editor (safe to re-run).

alter table public.personalisation_settings
  add column if not exists label_top_pct_mens numeric(5, 2),
  add column if not exists label_left_pct_mens numeric(5, 2),
  add column if not exists label_width_pct_mens numeric(5, 2),
  add column if not exists label_top_pct_womens numeric(5, 2),
  add column if not exists label_left_pct_womens numeric(5, 2),
  add column if not exists label_width_pct_womens numeric(5, 2),
  add column if not exists label_top_pct_unisex numeric(5, 2),
  add column if not exists label_left_pct_unisex numeric(5, 2),
  add column if not exists label_width_pct_unisex numeric(5, 2),
  add column if not exists label_top_pct_diffuser numeric(5, 2),
  add column if not exists label_left_pct_diffuser numeric(5, 2),
  add column if not exists label_width_pct_diffuser numeric(5, 2);

-- Copy legacy single position into each category where not set yet
update public.personalisation_settings
set
  label_top_pct_mens = coalesce(label_top_pct_mens, label_top_pct, 42),
  label_left_pct_mens = coalesce(label_left_pct_mens, label_left_pct, 50),
  label_width_pct_mens = coalesce(label_width_pct_mens, label_width_pct, 72),
  label_top_pct_womens = coalesce(label_top_pct_womens, label_top_pct, 42),
  label_left_pct_womens = coalesce(label_left_pct_womens, label_left_pct, 50),
  label_width_pct_womens = coalesce(label_width_pct_womens, label_width_pct, 72),
  label_top_pct_unisex = coalesce(label_top_pct_unisex, label_top_pct, 42),
  label_left_pct_unisex = coalesce(label_left_pct_unisex, label_left_pct, 50),
  label_width_pct_unisex = coalesce(label_width_pct_unisex, label_width_pct, 72),
  label_top_pct_diffuser = coalesce(label_top_pct_diffuser, label_top_pct, 42),
  label_left_pct_diffuser = coalesce(label_left_pct_diffuser, label_left_pct, 50),
  label_width_pct_diffuser = coalesce(label_width_pct_diffuser, label_width_pct, 72),
  updated_at = now()
where code = 'default';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_PERSONALISATION_FONTS_UPDATE.sql
-- ---------------------------------------------------------------------------
-- Update personalisation fonts to house brand typefaces.
-- Run in Supabase SQL Editor (safe to re-run).

insert into public.personalisation_fonts (code, label, font_family, sort_order, is_active)
values
  ('hiragenda', 'Hiragenda', '"Hiragenda", sans-serif', 0, true),
  ('ocean-trace', 'Ocean Trace-Personal', '"Ocean Trace-Personal", cursive', 1, true),
  ('chillax', 'Chillax Family', '"Chillax", "Chillax Family", sans-serif', 2, true)
on conflict (code) do update set
  label = excluded.label,
  font_family = excluded.font_family,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

update public.personalisation_fonts
set is_active = false, updated_at = now()
where code in ('classic-serif', 'modern-sans', 'elegant-script', 'bold-caps');

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_PERSONALISATION_RELOAD_API.sql
-- ---------------------------------------------------------------------------
-- Run when personalisation tables exist in Table Editor but Office shows PGRST205.
-- Run ALL statements below, then wait 15 seconds and hard-refresh Office Content.

-- 1) Confirm tables exist in this project (should return 2 rows)
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('personalisation_settings', 'personalisation_fonts');

-- 2) Ensure API roles can access them
grant usage on schema public to anon, authenticated, service_role;
grant select on public.personalisation_settings to anon, authenticated;
grant select, insert, update, delete on public.personalisation_settings to authenticated;
grant select on public.personalisation_fonts to anon, authenticated;
grant select, insert, update, delete on public.personalisation_fonts to authenticated;

-- 3) Bump table metadata (helps PostgREST notice DDL)
comment on table public.personalisation_settings is 'storefront personalisation settings';
comment on table public.personalisation_fonts is 'storefront personalisation fonts';

-- 4) Force PostgREST schema reload
notify pgrst, 'reload tables';
notify pgrst, 'reload schema';
select pg_notification_queue_usage();

-- 5) Confirm row counts (should be settings_count = 1, fonts_count = 3)
select
  (select count(*) from public.personalisation_settings) as settings_count,
  (select count(*) from public.personalisation_fonts where is_active = true) as fonts_count;

-- If Office STILL shows "schema cache" after 15s:
-- Supabase Dashboard → Project Settings → General → Restart project
-- Then hard-refresh Office Content (Ctrl+Shift+R).



-- #############################################################################
-- SECTION: STORAGE BUCKET BOOTSTRAP (product_assets + accounting-files)
-- #############################################################################

insert into storage.buckets (id, name, public)
values ('product_assets', 'product_assets', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('accounting-files', 'accounting-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated read accounting-files" on storage.objects;
create policy "Authenticated read accounting-files"
on storage.objects for select
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated insert accounting-files" on storage.objects;
create policy "Authenticated insert accounting-files"
on storage.objects for insert
with check (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update accounting-files" on storage.objects;
create policy "Authenticated update accounting-files"
on storage.objects for update
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated')
with check (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete accounting-files" on storage.objects;
create policy "Authenticated delete accounting-files"
on storage.objects for delete
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

-- #############################################################################
-- SECTION: STORAGE BUCKETS + POLICIES
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_RLS_OFFICE_FIX.sql
-- ---------------------------------------------------------------------------
-- Supabase RLS + Storage policy fix for the Office app (browser/anon key)
-- Run this in Supabase Dashboard → SQL Editor.
--
-- What it enables:
-- - Storage uploads to bucket: product_assets (and reads)
-- - Product content reads/writes for: product_notes, product_images (if present)
--
-- IMPORTANT:
-- - These policies are intentionally permissive for speed of setup.
-- - For production, replace auth.role() checks with your own role/claims model.

-- ============================================
-- Storage (bucket: product_assets)
-- ============================================

-- Public read (useful for storefront + previews)
DROP POLICY IF EXISTS "Public read product_assets" ON storage.objects;
CREATE POLICY "Public read product_assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product_assets');

-- Authenticated upload (Office users)
DROP POLICY IF EXISTS "Authenticated insert product_assets" ON storage.objects;
CREATE POLICY "Authenticated insert product_assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product_assets'
  AND auth.role() = 'authenticated'
);

-- Authenticated update/delete (optional; allows replace/cleanup)
DROP POLICY IF EXISTS "Authenticated update product_assets" ON storage.objects;
CREATE POLICY "Authenticated update product_assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product_assets'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated delete product_assets" ON storage.objects;
CREATE POLICY "Authenticated delete product_assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product_assets'
  AND auth.role() = 'authenticated'
);

-- ============================================
-- Product content tables (if they exist)
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.product_notes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.product_notes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Office read product_notes" ON public.product_notes';
    EXECUTE 'DROP POLICY IF EXISTS "Office write product_notes" ON public.product_notes';
    EXECUTE 'CREATE POLICY "Office read product_notes"
      ON public.product_notes
      FOR SELECT
      USING (auth.role() = ''authenticated'' OR auth.role() = ''anon'')';
    EXECUTE 'CREATE POLICY "Office write product_notes"
      ON public.product_notes
      FOR ALL
      USING (auth.role() = ''authenticated'')
      WITH CHECK (auth.role() = ''authenticated'')';
  END IF;

  IF to_regclass('public.product_images') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Office read product_images" ON public.product_images';
    EXECUTE 'DROP POLICY IF EXISTS "Office write product_images" ON public.product_images';
    EXECUTE 'CREATE POLICY "Office read product_images"
      ON public.product_images
      FOR SELECT
      USING (auth.role() = ''authenticated'' OR auth.role() = ''anon'')';
    EXECUTE 'CREATE POLICY "Office write product_images"
      ON public.product_images
      FOR ALL
      USING (auth.role() = ''authenticated'')
      WITH CHECK (auth.role() = ''authenticated'')';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_HERO_ASSETS_STORAGE.sql
-- ---------------------------------------------------------------------------
-- hero-assets bucket for Office uploads (hero slides, collections, bundles, personalisation).
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Fixes Office upload 400s for paths like bundle-specials/mens-trio.png when policies were missing.

insert into storage.buckets (id, name, public)
values ('hero-assets', 'hero-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read (storefront + Office previews)
drop policy if exists "Public read hero-assets" on storage.objects;
create policy "Public read hero-assets"
on storage.objects
for select
using (bucket_id = 'hero-assets');

-- Authenticated Office uploads
drop policy if exists "Authenticated insert hero-assets" on storage.objects;
create policy "Authenticated insert hero-assets"
on storage.objects
for insert
with check (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated update hero-assets" on storage.objects;
create policy "Authenticated update hero-assets"
on storage.objects
for update
using (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated delete hero-assets" on storage.objects;
create policy "Authenticated delete hero-assets"
on storage.objects
for delete
using (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_PAYMENT_PROOFS_STORAGE.sql
-- ---------------------------------------------------------------------------
-- Supabase Storage setup for Proof of Payment files (bucket: payment_proofs)
-- Run in Supabase SQL Editor.
--
-- Canonical file path:
--   payment_proofs/clients/<store_client_id>/<filename>
--
-- This enables:
-- - Office app (authenticated users) to read/list/view PoP files
-- - Authenticated users to upload/update/delete PoP files in this bucket

insert into storage.buckets (id, name, public)
values ('payment_proofs', 'payment_proofs', false)
on conflict (id) do nothing;

-- Read/list for Office users
drop policy if exists "Authenticated read payment_proofs" on storage.objects;
create policy "Authenticated read payment_proofs"
on storage.objects
for select
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Upload for authenticated users
drop policy if exists "Authenticated insert payment_proofs" on storage.objects;
create policy "Authenticated insert payment_proofs"
on storage.objects
for insert
with check (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Optional: allow replace/update
drop policy if exists "Authenticated update payment_proofs" on storage.objects;
create policy "Authenticated update payment_proofs"
on storage.objects
for update
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Optional: allow delete
drop policy if exists "Authenticated delete payment_proofs" on storage.objects;
create policy "Authenticated delete payment_proofs"
on storage.objects
for delete
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);


-- #############################################################################
-- SECTION: SECURITY LOCKDOWN
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_SECURITY_LOCKDOWN_BASELINE.sql
-- ---------------------------------------------------------------------------
-- Dumi Essence baseline security lockdown
-- Run in Supabase SQL Editor (production + staging).
--
-- Goal:
-- 1) Remove CRITICAL "RLS disabled in public" exposure.
-- 2) Avoid jwt user_metadata role checks in new policies.
-- 3) Keep storefront public-read tables readable.
--
-- NOTE:
-- Skips tables that do not exist (DROP POLICY requires the relation).
-- This is a baseline hardening step. After this, you can tighten further
-- with role-specific policies (superadmin/admin/manager) using app_metadata.

begin;

-- -------------------------------
-- Utility: create policies safely
-- -------------------------------
do $$
declare
  t text;
begin
  -- ---------- Public storefront-readable tables ----------
  -- Keep these readable by anon/authenticated users.
  foreach t in array array[
    'public.categories',
    'public.collections',
    'public.home_bestsellers',
    'public.home_client_notes',
    'public.home_hero_slides',
    'public.personalisation_settings',
    'public.personalisation_fonts',
    'public.media_assets',
    'public.front_popups',
    'public.bundle_specials',
    'public.bundle_special_slots',
    'public.products'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', t);

    execute format('drop policy if exists "public_read" on %s', t);
    execute format(
      'create policy "public_read" on %s for select using (true)',
      t
    );

    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;

  -- ---------- Sensitive office/internal tables ----------
  -- Block anon completely; allow authenticated app access.
  foreach t in array array[
    'public.customers',
    'public.addresses',
    'public.orders',
    'public.order_items',
    'public.order_status_history',
    'public.incidents',
    'public.deliveries',
    'public.dispatch_events',
    'public.fragrance_bottles',
    'public.loyalty_point_transactions',
    'public.notification_templates',
    'public.page_block_media',
    'public.store_orders',
    'public.store_order_items',
    'public.store_payment_proofs',
    'public.store_office_order_map',
    'public.store_clients',
    'public.accounting_transactions',
    'public.accounting_categories',
    'public.accounting_attachments',
    'public.vendors',
    'public.scent_products',
    'public.scent_proformas',
    'public.scent_proforma_lines',
    'public.inventory_movements'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', t);

    execute format('drop policy if exists "authenticated_read" on %s', t);
    execute format(
      'create policy "authenticated_read" on %s for select to authenticated using (true)',
      t
    );

    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;

commit;

-- Optional quick check after running:
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_SECURITY_LOCKDOWN_PHASE2.sql
-- ---------------------------------------------------------------------------
-- Dumi Essence security hardening - Phase 2
-- Run in Supabase SQL Editor after:
--   docs/SUPABASE_SECURITY_LOCKDOWN_BASELINE.sql
--
-- Targets:
-- - "RLS references user metadata" (customers, loyalty_point_transactions)
-- - Remaining "RLS Disabled in Public" tables from Security Advisor
-- - "Security Definer View" (home_bestsellers_auto)
-- - "Function Search Path Mutable" (loyalty_points_for_spend_zar)
--
-- Skips tables that do not exist.

begin;

-- -------------------------------------------------------------------
-- 1) Remove policies that reference auth.jwt()->user_metadata
-- -------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('customers', 'loyalty_point_transactions')
      and (
        coalesce(qual, '') ilike '%user_metadata%'
        or coalesce(with_check, '') ilike '%user_metadata%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

-- Recreate safe baseline policies (no user_metadata references)
do $$
begin
  if to_regclass('public.customers') is not null then
    execute 'alter table public.customers enable row level security';
    execute 'drop policy if exists "authenticated_read" on public.customers';
    execute 'create policy "authenticated_read" on public.customers for select to authenticated using (true)';
    execute 'drop policy if exists "authenticated_write" on public.customers';
    execute 'create policy "authenticated_write" on public.customers for all to authenticated using (true) with check (true)';
  end if;

  if to_regclass('public.loyalty_point_transactions') is not null then
    execute 'alter table public.loyalty_point_transactions enable row level security';
    execute 'drop policy if exists "authenticated_read" on public.loyalty_point_transactions';
    execute 'create policy "authenticated_read" on public.loyalty_point_transactions for select to authenticated using (true)';
    -- No direct write policy for loyalty ledger; writes should flow via RPC.
  end if;
end
$$;

-- -------------------------------------------------------------------
-- 2) Enable RLS + add baseline policies for newly flagged tables
-- -------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- CMS/public-facing content tables (public read, authenticated write)
  foreach t in array array[
    'public.page_blocks',
    'public.pages'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists "public_read" on %s', t);
    execute format('create policy "public_read" on %s for select using (true)', t);
    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;

  -- Internal/sensitive operational tables (authenticated only)
  foreach t in array array[
    'public.perfume_caps',
    'public.perfume_pumps',
    'public.product_notes',
    'public.product_sizes',
    'public.product_images',
    'public.scent_proforma_extra_lines',
    'public.scent_purchases',
    'public.essential_oil_products'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists "authenticated_read" on %s', t);
    execute format('create policy "authenticated_read" on %s for select to authenticated using (true)', t);
    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;

-- -------------------------------------------------------------------
-- 3) Security Definer View warning mitigation
-- -------------------------------------------------------------------
do $$
begin
  -- PG15+ supports security_invoker on views. If unsupported, this block safely no-ops.
  if to_regclass('public.home_bestsellers_auto') is not null then
    begin
      execute 'alter view public.home_bestsellers_auto set (security_invoker = true)';
    exception when others then
      -- keep migration non-breaking; verify manually if Advisor still flags this
      null;
    end;
  end if;
end
$$;

-- -------------------------------------------------------------------
-- 4) Function search_path hardening
-- -------------------------------------------------------------------
do $$
begin
  -- Hardens mutable search_path warning without changing function body.
  begin
    execute 'alter function public.loyalty_points_for_spend_zar(numeric) set search_path = public, pg_temp';
  exception when undefined_function then
    null;
  end;
end
$$;

commit;

-- After running:
-- 1) Re-run Supabase Security Advisor scan.
-- 2) If any table still appears, paste the exact table/policy name and we can add a precise patch.


-- #############################################################################
-- SECTION: OPTIONAL ONE-TIME BACKFILLS (safe to skip on greenfield)
-- #############################################################################

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_BACKFILL_OFFICE_ORDER_ITEMS_FROM_STORE.sql
-- ---------------------------------------------------------------------------
-- Backfill Office `order_items` from Storefront `store_order_items`
-- so Office Inventory can calculate stock-out using Orders data.
--
-- Assumptions:
-- - Office orders live in `orders`
-- - Storefront orders live in `store_orders`
-- - Storefront items live in `store_order_items`
-- - Mapping (best) is in `store_office_order_map(office_order_id, store_order_id)`
-- - Some orders can be inferred via reference/payment_ref `WEB-<32hex>` (optional)
--
-- Safe to run multiple times: uses NOT EXISTS to avoid duplicates.

begin;

-- 1) Optional helper: extract store UUID from "WEB-<hex>" references
create or replace function public.office_extract_store_uuid(web_ref text)
returns uuid
language plpgsql
immutable
as $$
declare
  hex text;
begin
  if web_ref is null then
    return null;
  end if;
  if web_ref !~* '^WEB-[a-f0-9]{32}$' then
    return null;
  end if;
  hex := lower(substring(web_ref from 5));
  return (substr(hex,1,8) || '-' || substr(hex,9,4) || '-' || substr(hex,13,4) || '-' || substr(hex,17,4) || '-' || substr(hex,21,12))::uuid;
end;
$$;

-- 2) Build a mapping set using the explicit map table, plus inferred WEB refs (if present)
with inferred as (
  select
    o.id as office_order_id,
    coalesce(
      m.store_order_id::text,
      public.office_extract_store_uuid(o.reference)::text,
      public.office_extract_store_uuid(o.payment_ref)::text
    ) as store_order_id
  from public.orders o
  left join public.store_office_order_map m
    on m.office_order_id = o.id
),
mapped as (
  select office_order_id, store_order_id
  from inferred
  where store_order_id is not null and length(store_order_id) > 0
),
src_items as (
  select
    m.office_order_id,
    soi.product_id::text as product_id_text,
    soi.product_name,
    soi.quantity::int as quantity,
    soi.unit_price::numeric as unit_price,
    soi.line_total::numeric as line_total
  from mapped m
  join public.store_order_items soi
    on soi.order_id::text = m.store_order_id
)
insert into public.order_items (
  order_id,
  product_id,
  product_name,
  product_category,
  product_type,
  sku,
  quantity,
  unit_price,
  discount,
  tax,
  line_total,
  created_at
)
select
  s.office_order_id,
  case
    when s.product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then s.product_id_text::uuid
    else null
  end as product_id,
  s.product_name,
  'Perfume'::text as product_category,
  null::text as product_type,
  -- Your rule: Orders SKU = Inventory DE Name.
  -- Persist it so Office can compute stock-out reliably from `order_items`.
  s.product_name as sku,
  s.quantity,
  s.unit_price,
  0::numeric as discount,
  0::numeric as tax,
  s.line_total,
  now() as created_at
from src_items s
where not exists (
  select 1
  from public.order_items oi
  where oi.order_id = s.office_order_id
    and oi.product_name = s.product_name
    and oi.quantity = s.quantity
    and coalesce(oi.unit_price, 0) = coalesce(s.unit_price, 0)
);

commit;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_BACKFILL_REVERSE_POINTS_FOR_DELETED_STORE_ORDERS.sql
-- ---------------------------------------------------------------------------
-- One-time backfill: reverse points for storefront orders already deleted
-- Run in Supabase SQL Editor AFTER deploying:
--   docs/SUPABASE_STORE_ORDERS_DELETE_REVERSE_POINTS.sql
--
-- What it does:
-- - Finds mapping rows where store_order_id no longer exists in public.store_orders
-- - Reverses any loyalty points tied to the mapped office_order_id
-- - Deletes the stale mapping row

begin;

do $$
declare
  r record;
  v_customer_id uuid;
  v_net_points int;
begin
  for r in
    select m.store_order_id, m.office_order_id
    from public.store_office_order_map m
    left join public.store_orders so on so.id = m.store_order_id
    where so.id is null
  loop
    -- Reverse per customer (net points tied to that office order id)
    for v_customer_id, v_net_points in
      select customer_id, coalesce(sum(points_delta), 0)::int
      from public.loyalty_point_transactions
      where order_id = r.office_order_id
      group by customer_id
    loop
      if v_net_points is null or v_net_points = 0 then
        continue;
      end if;

      perform public.loyalty_apply_points(
        v_customer_id,
        -v_net_points,
        'Backfill: store order previously deleted, points reversed',
        r.office_order_id,
        'system',
        'store-delete-backfill:' || r.store_order_id::text || ':' || v_customer_id::text
      );
    end loop;

    -- Remove stale mapping
    delete from public.store_office_order_map
    where store_order_id = r.store_order_id;
  end loop;
end;
$$;

commit;

-- Follow-up: recompute balances from ledger (optional but recommended)
-- Run docs/SUPABASE_LOYALTY_RECONCILE_AFTER_ORDER_DELETES.sql

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_LOYALTY_RECONCILE_AFTER_ORDER_DELETES.sql
-- ---------------------------------------------------------------------------
-- Reconcile loyalty points after order deletions / historical drift
-- Run in Supabase SQL Editor.
--
-- Use this when customers still show points but related orders are gone.

begin;

-- 1) Remove orphan loyalty entries that reference a deleted/non-existent order.
delete from public.loyalty_point_transactions t
where t.order_id is not null
  and not exists (
    select 1
    from public.orders o
    where o.id::text = t.order_id
  );

-- 1b) Also remove ledger rows with missing customers (safety).
delete from public.loyalty_point_transactions t
where not exists (
  select 1
  from public.customers c
  where c.id = t.customer_id
);

-- 2) Recompute customer loyalty_points from remaining transaction ledger.
update public.customers c
set loyalty_points = coalesce(x.points_total, 0),
    updated_at = now()
from (
  select customer_id, coalesce(sum(points_delta), 0)::int as points_total
  from public.loyalty_point_transactions
  group by customer_id
) x
where c.id = x.customer_id;

-- 3) Ensure customers with no ledger rows are zeroed.
update public.customers c
set loyalty_points = 0,
    updated_at = now()
where not exists (
  select 1
  from public.loyalty_point_transactions t
  where t.customer_id = c.id
)
and coalesce(c.loyalty_points, 0) <> 0;

commit;

-- Optional check:
-- select id, full_name, loyalty_points from public.customers order by loyalty_points desc, full_name;

-- ---------------------------------------------------------------------------
-- SOURCE: docs\SUPABASE_HOME_HERO_SLIDES_REMOVE_GIFT_PERFECT_BULLETS.sql
-- ---------------------------------------------------------------------------
-- Remove legacy gift-guide section headers and feature bullets from home_hero_slides.
-- Run once in Supabase SQL Editor, then refresh Office Content → Hero moments.

delete from public.home_hero_slides
where code in (
  -- Perfect Gift bullets (previous cleanup)
  'gift-perfect-presence',
  'gift-perfect-unboxing',
  'gift-perfect-match',
  'gift-perfect-personal',
  'gift-perfect-heart',
  -- Section headers + feature bullets
  'gift-perfect-section',
  'gift-edits-section',
  'gift-guide-feature-presentation',
  'gift-guide-feature-categories',
  'gift-guide-feature-premium'
);

notify pgrst, 'reload schema';

select count(*) as remaining_rows
from public.home_hero_slides
where code in (
  'gift-perfect-presence',
  'gift-perfect-unboxing',
  'gift-perfect-match',
  'gift-perfect-personal',
  'gift-perfect-heart',
  'gift-perfect-section',
  'gift-edits-section',
  'gift-guide-feature-presentation',
  'gift-guide-feature-categories',
  'gift-guide-feature-premium'
);

