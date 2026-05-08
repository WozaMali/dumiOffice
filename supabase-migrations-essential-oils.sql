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

