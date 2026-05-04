s- Fragrance sourcing: scents, pro-forma, packaging
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

