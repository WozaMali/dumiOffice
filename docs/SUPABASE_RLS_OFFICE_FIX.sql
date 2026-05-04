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

