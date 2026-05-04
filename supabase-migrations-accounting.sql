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

