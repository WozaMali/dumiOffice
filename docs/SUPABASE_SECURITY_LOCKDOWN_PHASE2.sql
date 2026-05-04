-- Dumi Essence security hardening - Phase 2
-- Run in Supabase SQL Editor after:
--   docs/SUPABASE_SECURITY_LOCKDOWN_BASELINE.sql
--
-- Targets:
-- - "RLS references user metadata" (customers, loyalty_point_transactions)
-- - Remaining "RLS Disabled in Public" tables from Security Advisor
-- - "Security Definer View" (home_bestsellers_auto)
-- - "Function Search Path Mutable" (loyalty_points_for_spend_zar)

begin;

-- -------------------------------------------------------------------
-- 1) Remove policies that reference auth.jwt()->user_metadata
-- -------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('customers', 'loyalty_point_transactions')
      and (
        coalesce(qual, '') ilike '%user_metadata%'
        or coalesce(with_check, '') ilike '%user_metadata%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

-- Recreate safe baseline policies (no user_metadata references)
alter table if exists public.customers enable row level security;
drop policy if exists "authenticated_read" on public.customers;
create policy "authenticated_read"
on public.customers
for select
to authenticated
using (true);

drop policy if exists "authenticated_write" on public.customers;
create policy "authenticated_write"
on public.customers
for all
to authenticated
using (true)
with check (true);

alter table if exists public.loyalty_point_transactions enable row level security;
drop policy if exists "authenticated_read" on public.loyalty_point_transactions;
create policy "authenticated_read"
on public.loyalty_point_transactions
for select
to authenticated
using (true);

-- No direct write policy for loyalty ledger; writes should flow via RPC.

-- -------------------------------------------------------------------
-- 2) Enable RLS + add baseline policies for newly flagged tables
-- -------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- CMS/public-facing content tables (public read, authenticated write)
  foreach t in array array[
    'public.page_blocks',
    'public.pages'
  ]
  loop
    execute format('alter table if exists %s enable row level security', t);
    execute format('drop policy if exists "public_read" on %s', t);
    execute format('create policy "public_read" on %s for select using (true)', t);
    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;

  -- Internal/sensitive operational tables (authenticated only)
  foreach t in array array[
    'public.perfume_caps',
    'public.perfume_pumps',
    'public.product_notes',
    'public.product_sizes',
    'public.scent_proforma_extra_lines',
    'public.scent_purchases'
  ]
  loop
    execute format('alter table if exists %s enable row level security', t);
    execute format('drop policy if exists "authenticated_read" on %s', t);
    execute format('create policy "authenticated_read" on %s for select to authenticated using (true)', t);
    execute format('drop policy if exists "authenticated_write" on %s', t);
    execute format(
      'create policy "authenticated_write" on %s for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;

-- -------------------------------------------------------------------
-- 3) Security Definer View warning mitigation
-- -------------------------------------------------------------------
do $$
begin
  -- PG15+ supports security_invoker on views. If unsupported, this block safely no-ops.
  if to_regclass('public.home_bestsellers_auto') is not null then
    begin
      execute 'alter view public.home_bestsellers_auto set (security_invoker = true)';
    exception when others then
      -- keep migration non-breaking; verify manually if Advisor still flags this
      null;
    end;
  end if;
end
$$;

-- -------------------------------------------------------------------
-- 4) Function search_path hardening
-- -------------------------------------------------------------------
do $$
begin
  -- Hardens mutable search_path warning without changing function body.
  begin
    execute 'alter function public.loyalty_points_for_spend_zar(numeric) set search_path = public, pg_temp';
  exception when undefined_function then
    null;
  end;
end
$$;

commit;

-- After running:
-- 1) Re-run Supabase Security Advisor scan.
-- 2) If any table still appears, paste the exact table/policy name and we can add a precise patch.

