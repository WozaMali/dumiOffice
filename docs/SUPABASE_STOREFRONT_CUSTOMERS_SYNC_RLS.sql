-- Dumi: let signed-in storefront / walk-in shoppers sync into office CRM (`public.customers`)
-- so http://localhost:8080/clients (and production /clients) shows the same name, phone,
-- marketing flags, and default delivery address after they save on /walk-in.
--
-- Prefer (recommended): docs/SUPABASE_CRM_SYNC_FROM_STORE_RPC.sql — SECURITY DEFINER RPC so sync
-- works even when these RLS policies are missing or conflict with office policies.
--
-- Run in Supabase → SQL Editor after `customers` and `addresses` exist.
--
-- Prereq: the app calls `customersApi.syncFromStorefrontWalkIn` with the same email as
-- `auth.users.email` / `auth.jwt()->>'email'` (Google sign-in is fine; match is case-insensitive).
--
-- If RLS is OFF on these tables, the app already syncs — you can skip this file.
--
-- If RLS is ON: add the policies below IN ADDITION TO whatever your office staff uses
-- (e.g. broad SELECT/ALL for authenticated admins). Multiple permissive policies combine with OR.

-- ---------------------------------------------------------------------------
-- customers (storefront self-service: same row as JWT email)
-- ---------------------------------------------------------------------------

drop policy if exists "customers_storefront_select_own_email" on public.customers;
create policy "customers_storefront_select_own_email"
on public.customers
for select
to authenticated
using (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

drop policy if exists "customers_storefront_insert_own_email" on public.customers;
create policy "customers_storefront_insert_own_email"
on public.customers
for insert
to authenticated
with check (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

drop policy if exists "customers_storefront_update_own_email" on public.customers;
create policy "customers_storefront_update_own_email"
on public.customers
for update
to authenticated
using (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
)
with check (
  lower(trim(coalesce(customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  and coalesce(auth.jwt() ->> 'email', '') <> ''
);

-- ---------------------------------------------------------------------------
-- addresses (default delivery row tied to that customer)
-- ---------------------------------------------------------------------------

drop policy if exists "addresses_storefront_select_own_customer" on public.addresses;
create policy "addresses_storefront_select_own_customer"
on public.addresses
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = addresses.customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);

drop policy if exists "addresses_storefront_insert_own_customer" on public.addresses;
create policy "addresses_storefront_insert_own_customer"
on public.addresses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);

drop policy if exists "addresses_storefront_update_own_customer" on public.addresses;
create policy "addresses_storefront_update_own_customer"
on public.addresses
for update
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = addresses.customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
)
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and lower(trim(coalesce(c.customer_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
);
