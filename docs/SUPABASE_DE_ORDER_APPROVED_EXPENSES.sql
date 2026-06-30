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
