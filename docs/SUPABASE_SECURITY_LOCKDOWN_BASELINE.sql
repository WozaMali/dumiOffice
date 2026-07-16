-- Dumi Essence baseline security lockdown
-- Run in Supabase SQL Editor (production + staging).
--
-- Goal:
-- 1) Remove CRITICAL "RLS disabled in public" exposure.
-- 2) Avoid jwt user_metadata role checks in new policies.
-- 3) Keep storefront public-read tables readable.
--
-- NOTE:
-- Skips tables that do not exist (DROP POLICY requires the relation).
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
    'public.collections',
    'public.home_bestsellers',
    'public.home_client_notes',
    'public.home_hero_slides',
    'public.personalisation_settings',
    'public.personalisation_fonts',
    'public.media_assets',
    'public.front_popups',
    'public.bundle_specials',
    'public.bundle_special_slots',
    'public.products'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', t);

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
    'public.addresses',
    'public.orders',
    'public.order_items',
    'public.order_status_history',
    'public.incidents',
    'public.deliveries',
    'public.dispatch_events',
    'public.fragrance_bottles',
    'public.loyalty_point_transactions',
    'public.notification_templates',
    'public.page_block_media',
    'public.store_orders',
    'public.store_order_items',
    'public.store_payment_proofs',
    'public.store_office_order_map',
    'public.store_clients',
    'public.accounting_transactions',
    'public.accounting_categories',
    'public.accounting_attachments',
    'public.vendors',
    'public.scent_products',
    'public.scent_proformas',
    'public.scent_proforma_lines',
    'public.inventory_movements'
  ]
  loop
    if to_regclass(t) is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', t);

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
-- order by tablename;
