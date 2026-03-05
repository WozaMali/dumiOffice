-- Dumi Essence Office - Complete Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_type TEXT DEFAULT 'retail', -- retail, wholesale, vip
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  first_order_date DATE,
  last_order_date DATE,
  tags TEXT[], -- ['first-time', 'vip', 'high-ltv']
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  address_type TEXT DEFAULT 'delivery', -- delivery, billing, office
  address_line TEXT NOT NULL,
  suburb TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'South Africa',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL, -- Perfume, Diffuser, Car Perfume
  product_type TEXT, -- EDP 50ml, Reed Diffuser, etc
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock_on_hand INTEGER DEFAULT 0,
  stock_threshold INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, -- DE-1050
  reference TEXT UNIQUE NOT NULL, -- WEB-20260227-1050
  customer_id UUID REFERENCES customers(id),
  
  -- Order details
  channel TEXT NOT NULL, -- Online Orders, Boutique & Pop-up, Wholesale, Returns
  status TEXT NOT NULL DEFAULT 'Processing', -- Processing, Shipped, Delivered, Cancelled, Returned
  stage TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed
  
  -- Financial
  subtotal DECIMAL(10,2) DEFAULT 0,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  
  -- Payment
  payment_status TEXT DEFAULT 'Pending', -- Pending, Paid, Refunded, Failed
  payment_method TEXT, -- Card, EFT, Cash, COD
  payment_provider TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Shipping
  shipping_method TEXT, -- Standard, Express, Same-day, Collection
  courier TEXT,
  tracking_number TEXT,
  pickup_scheduled_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Fulfilment
  location TEXT, -- Johannesburg Warehouse, Rosebank Boutique
  score TEXT DEFAULT '-',
  findings TEXT DEFAULT 'Awaiting picking',
  
  -- Customer details (denormalized for quick access)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT,
  
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
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  -- Product snapshot (in case product changes later)
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL,
  product_type TEXT,
  sku TEXT,
  
  -- Line details
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER STATUS HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INCIDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT REFERENCES orders(id),
  incident_type TEXT NOT NULL, -- courier_delay, damaged, wrong_item, spill, customer_complaint
  severity TEXT DEFAULT 'medium', -- low, medium, high, critical
  description TEXT NOT NULL,
  resolution TEXT,
  status TEXT DEFAULT 'open', -- open, investigating, resolved, closed
  reported_by TEXT,
  resolved_by TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(stage);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(product_category);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(customer_email);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample products
INSERT INTO products (sku, product_name, product_category, product_type, price, cost, stock_on_hand, stock_threshold) VALUES
('DE-OR50', 'Oud Royal 50ml', 'Perfume', 'EDP 50ml', 1250.00, 450.00, 3, 10),
('DE-OR100', 'Oud Royal 100ml', 'Perfume', 'EDP 100ml', 2400.00, 850.00, 18, 15),
('DE-RN100', 'Rose Noir 100ml', 'Perfume', 'EDP 100ml', 890.00, 320.00, 5, 15),
('DE-AVS', 'Amber Velvet Set', 'Perfume', 'Gift Set', 2100.00, 750.00, 24, 10),
('DE-JD30', 'Jasmine Dreams 30ml', 'Perfume', 'EDP 30ml', 650.00, 230.00, 32, 8),
('DE-MI50', 'Musk Intense 50ml', 'Perfume', 'EDP 50ml', 980.00, 350.00, 14, 12),
('DE-VS30', 'Vanilla Silk 30ml', 'Perfume', 'EDP 30ml', 550.00, 195.00, 2, 8),
('DE-OR-RD', 'Oud Royal Reed Diffuser', 'Diffuser', 'Reed Diffuser', 450.00, 160.00, 12, 5),
('DE-RN-RD', 'Rose Noir Reed Diffuser', 'Diffuser', 'Reed Diffuser', 420.00, 150.00, 8, 5),
('DE-OR-CAR', 'Oud Royal Car Diffuser', 'Car Perfume', 'Vent Clip', 180.00, 65.00, 25, 10)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (id, customer_name, customer_email, customer_phone, customer_type, lifetime_value, total_orders, first_order_date, last_order_date) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Amara Nkosi', 'amara@example.com', '+27 82 000 0001', 'retail', 1250.00, 1, '2026-02-27', '2026-02-27'),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'Lindiwe Mokoena', 'lindiwe@example.com', '+27 72 000 0002', 'retail', 890.00, 1, '2026-02-26', '2026-02-26'),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'Thabo Khumalo', 'thabo@example.com', '+27 73 000 0003', 'vip', 2100.00, 1, '2026-02-25', '2026-02-25')
ON CONFLICT (id) DO NOTHING;

-- Insert sample addresses
INSERT INTO addresses (customer_id, address_type, address_line, suburb, city, postal_code) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'delivery', '12 Rosewood Lane', 'Sandton', 'Johannesburg', '2196'),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'delivery', '8 Jacaranda Street', 'Hatfield', 'Pretoria', '0083'),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'delivery', 'Unit 5, Parkview Lofts', 'Rosebank', 'Johannesburg', '2193');

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - tighten later with auth)
CREATE POLICY "Allow all operations" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON addresses FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON order_status_history FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON incidents FOR ALL USING (true);
