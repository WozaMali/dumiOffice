-- Office read access for storefront order + PoP tables
-- Run in Supabase SQL Editor as a privileged user.
--
-- Why:
-- Office UI reads these storefront tables to show synced line items and proof-of-payment links.
-- Without explicit SELECT policies for authenticated office sessions, queries can return empty rows.

-- store_orders
alter table if exists public.store_orders enable row level security;
drop policy if exists "store_orders_office_authenticated_select_all" on public.store_orders;
create policy "store_orders_office_authenticated_select_all"
on public.store_orders
for select
using (auth.role() = 'authenticated');

-- store_order_items
alter table if exists public.store_order_items enable row level security;
drop policy if exists "store_order_items_office_authenticated_select_all" on public.store_order_items;
create policy "store_order_items_office_authenticated_select_all"
on public.store_order_items
for select
using (auth.role() = 'authenticated');

-- store_payment_proofs
alter table if exists public.store_payment_proofs enable row level security;
drop policy if exists "store_payment_proofs_office_authenticated_select_all" on public.store_payment_proofs;
create policy "store_payment_proofs_office_authenticated_select_all"
on public.store_payment_proofs
for select
using (auth.role() = 'authenticated');

-- Optional: mapping table read (if RLS is enabled there too)
alter table if exists public.store_office_order_map enable row level security;
drop policy if exists "store_office_order_map_office_authenticated_select_all" on public.store_office_order_map;
create policy "store_office_order_map_office_authenticated_select_all"
on public.store_office_order_map
for select
using (auth.role() = 'authenticated');
