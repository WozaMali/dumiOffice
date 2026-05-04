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

