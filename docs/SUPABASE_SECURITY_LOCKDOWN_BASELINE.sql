-- Dumi Essence baseline security lockdown
-- Run in Supabase SQL Editor (production + staging).
--
-- Goal:
-- 1) Remove CRITICAL "RLS disabled in public" exposure.
-- 2) Avoid jwt user_metadata role checks in new policies.
-- 3) Keep storefront public-read tables readable.
--
-- NOTE:
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
    'public.home_bestsellers',
    'public.home_hero_slides',
    'public.media_assets'
  ]
  loop
    execute format('alter table if exists %s enable row level security', t);

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
    'public.deliveries',
    'public.dispatch_events',
    'public.fragrance_bottles',
    'public.loyalty_point_transactions',
    'public.notification_templates',
    'public.page_block_media'
  ]
  loop
    execute format('alter table if exists %s enable row level security', t);

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
--   and tablename in (
--     'categories', 'customers', 'deliveries', 'dispatch_events', 'fragrance_bottles',
--     'home_bestsellers', 'home_hero_slides', 'loyalty_point_transactions',
--     'media_assets', 'notification_templates', 'page_block_media'
--   )
-- order by tablename;

