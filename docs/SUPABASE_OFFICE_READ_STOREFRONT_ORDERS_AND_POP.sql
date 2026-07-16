-- Office read access for storefront order + PoP tables
-- Run in Supabase SQL Editor as a privileged user.
--
-- Why:
-- Office UI reads these storefront tables to show synced line items and proof-of-payment links.
-- Without explicit SELECT policies for authenticated office sessions, queries can return empty rows.
--
-- NOTE: DROP/CREATE POLICY requires the table to exist. Policies are applied only when present.

do $$
begin
  if to_regclass('public.store_orders') is not null then
    execute 'alter table public.store_orders enable row level security';
    execute 'drop policy if exists "store_orders_office_authenticated_select_all" on public.store_orders';
    execute $p$
      create policy "store_orders_office_authenticated_select_all"
      on public.store_orders
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_order_items') is not null then
    execute 'alter table public.store_order_items enable row level security';
    execute 'drop policy if exists "store_order_items_office_authenticated_select_all" on public.store_order_items';
    execute $p$
      create policy "store_order_items_office_authenticated_select_all"
      on public.store_order_items
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_payment_proofs') is not null then
    execute 'alter table public.store_payment_proofs enable row level security';
    execute 'drop policy if exists "store_payment_proofs_office_authenticated_select_all" on public.store_payment_proofs';
    execute $p$
      create policy "store_payment_proofs_office_authenticated_select_all"
      on public.store_payment_proofs
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;

  if to_regclass('public.store_office_order_map') is not null then
    execute 'alter table public.store_office_order_map enable row level security';
    execute 'drop policy if exists "store_office_order_map_office_authenticated_select_all" on public.store_office_order_map';
    execute $p$
      create policy "store_office_order_map_office_authenticated_select_all"
      on public.store_office_order_map
      for select
      using (auth.role() = 'authenticated')
    $p$;
  end if;
end
$$;
