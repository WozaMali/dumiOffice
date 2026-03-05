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

