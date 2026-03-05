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
