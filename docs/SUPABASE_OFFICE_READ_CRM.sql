-- Dumi: let office staff (authenticated) read all public.customers + public.addresses
-- so Create order can prefill phone + delivery from CRM rows synced from the storefront.
--
-- Run in Supabase SQL Editor only if:
--   - addressesApi.listByCustomerId / customersApi.getById return empty or errors for valid clients, OR
--   - Create order shows blank phone/address after the client saved profile in the shop.
--
-- RLS on these tables often has only "shopper can touch own row" policies; office users are also
-- authenticated, so they need a separate permissive SELECT (or role-based policies in production).

alter table if exists public.customers enable row level security;
alter table if exists public.addresses enable row level security;

drop policy if exists customers_office_authenticated_select_all on public.customers;
create policy customers_office_authenticated_select_all
on public.customers
for select
to authenticated
using (true);

drop policy if exists addresses_office_authenticated_select_all on public.addresses;
create policy addresses_office_authenticated_select_all
on public.addresses
for select
to authenticated
using (true);

-- Tighten later: replace using (true) with e.g. (auth.jwt() ->> 'app_role') = 'office'
-- after you set custom claims on staff users.
