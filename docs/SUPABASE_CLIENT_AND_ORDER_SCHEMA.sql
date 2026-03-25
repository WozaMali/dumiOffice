-- Dumi Essence: Client and order data schema
-- Target: PostgreSQL / Supabase (all objects in schema `public`)
-- Run this in Supabase SQL Editor.
-- App-facing reference (My Account ↔ tables): docs/client_data_schema.sql
--
-- Scope note: the Office app route /clients reads `public.customers` + `public.addresses`.
-- This script defines `public.clients` / `public.orders` (checkout-oriented shape) and
-- `public.store_*` storefront tables. Walk-in CRM sync uses `customers`, not `clients`.
-- docs/SUPABASE_STOREFRONT_CUSTOMERS_SYNC_RLS.sql — RLS for that sync.
--
-- If `public.orders` already exists for Office (reference, grand_total, channel, stage, …),
-- `create table if not exists` is skipped but the early compatibility DO block still adds
-- columns such as client_id / email when those names exist on any `orders` table — review
-- before running on a live Office database; use only the store_* section if that fits better.

create extension if not exists pgcrypto;

-- Keep updated_at in sync.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Global compatibility repair (run before any indexes/policies)
-- ------------------------------------------------------------
-- Existing databases may already contain tables with legacy names
-- (e.g. store_client_id). Ensure client_id exists early so later
-- statements do not fail with 42703.
do $$
begin
  -- Office-side tables
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='clients') then
    alter table public.clients add column if not exists auth_user_id uuid;
    alter table public.clients add column if not exists full_name text;
    alter table public.clients add column if not exists email text;
    alter table public.clients add column if not exists phone text;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='client_addresses') then
    alter table public.client_addresses add column if not exists client_id uuid;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='client_preferences') then
    alter table public.client_preferences add column if not exists client_id uuid;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='orders') then
    alter table public.orders add column if not exists client_id uuid;
    alter table public.orders add column if not exists email text;
    alter table public.orders add column if not exists phone text;
    alter table public.orders add column if not exists first_name text;
    alter table public.orders add column if not exists last_name text;
    alter table public.orders add column if not exists address_line1 text;
    alter table public.orders add column if not exists city text;
    alter table public.orders add column if not exists postal_code text;
    alter table public.orders add column if not exists country text;
  end if;

  -- Storefront tables
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='store_clients') then
    alter table public.store_clients add column if not exists auth_user_id uuid;
    alter table public.store_clients add column if not exists full_name text;
    alter table public.store_clients add column if not exists email text;
    alter table public.store_clients add column if not exists phone text;
    alter table public.store_clients add column if not exists member_since_year int;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_clients' and column_name='name'
    ) then
      execute 'update public.store_clients set full_name = coalesce(full_name, name)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_clients' and column_name='phone_number'
    ) then
      execute 'update public.store_clients set phone = coalesce(phone, phone_number)';
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='store_client_addresses') then
    alter table public.store_client_addresses add column if not exists client_id uuid;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_addresses' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_addresses set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='store_client_preferences') then
    alter table public.store_client_preferences add column if not exists client_id uuid;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_preferences' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_preferences set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='store_orders') then
    alter table public.store_orders add column if not exists client_id uuid;
    alter table public.store_orders add column if not exists email text;
    alter table public.store_orders add column if not exists phone text;
    alter table public.store_orders add column if not exists first_name text;
    alter table public.store_orders add column if not exists last_name text;
    alter table public.store_orders add column if not exists address_line1 text;
    alter table public.store_orders add column if not exists suburb text;
    alter table public.store_orders add column if not exists province text;
    alter table public.store_orders add column if not exists city text;
    alter table public.store_orders add column if not exists postal_code text;
    alter table public.store_orders add column if not exists country text;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_orders' and column_name='store_client_id'
    ) then
      execute 'update public.store_orders set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;
end
$$;

-- Client profile linked to Supabase auth user (optional for guest-first flow).
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  member_since_year int not null default 2026,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

-- One client can have many saved addresses.
create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_addresses_client_id
on public.client_addresses (client_id);

create unique index if not exists idx_client_addresses_one_default
on public.client_addresses (client_id)
where is_default = true;

drop trigger if exists client_addresses_set_updated_at on public.client_addresses;
create trigger client_addresses_set_updated_at
before update on public.client_addresses
for each row
execute function public.set_updated_at();

-- Notification and marketing preferences (1 row per client).
create table if not exists public.client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  marketing_emails boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists client_preferences_set_updated_at on public.client_preferences;
create trigger client_preferences_set_updated_at
before update on public.client_preferences
for each row
execute function public.set_updated_at();

-- Orders. Keep direct contact/shipping details for historical records.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  email text not null,
  phone text,
  first_name text not null,
  last_name text not null,
  address_line1 text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  payment_method text not null check (payment_method in ('card', 'paypal', 'bank')),
  order_status text not null default 'processing' check (order_status in ('processing', 'shipped', 'delivered', 'cancelled')),
  subtotal_amount numeric(12,2) not null check (subtotal_amount >= 0),
  shipping_amount numeric(12,2) not null check (shipping_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_client_id on public.orders (client_id);
create index if not exists idx_orders_email on public.orders (email);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create table if not exists public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  size_ml int not null check (size_ml > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);

-- ------------------------------------------------------------
-- Optional: Row Level Security for client-facing access
-- ------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.client_addresses enable row level security;
alter table public.client_preferences enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Clients can view and update only their own profile.
drop policy if exists clients_select_own on public.clients;
create policy clients_select_own
on public.clients
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own
on public.clients
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own
on public.clients
for insert
to authenticated
with check (auth.uid() = auth_user_id);

-- Addresses and preferences scoped by linked client row.
drop policy if exists client_addresses_crud_own on public.client_addresses;
create policy client_addresses_crud_own
on public.client_addresses
for all
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists client_preferences_crud_own on public.client_preferences;
create policy client_preferences_crud_own
on public.client_preferences
for all
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

-- Order items are readable for orders owned by current user.
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

-- Keep inserts for checkout open to service role.
-- In client apps, create orders through secure server endpoints where possible.

-- ============================================================
-- STOREFRONT TABLES (public.store_*)
-- ============================================================
-- Run this block to create or repair storefront schema used by
-- the web/mobile client.

create table if not exists public.store_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  member_since_year int not null default extract(year from now())::int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_clients_set_updated_at on public.store_clients;
create trigger store_clients_set_updated_at
before update on public.store_clients
for each row
execute function public.set_updated_at();

create table if not exists public.store_client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.store_clients(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  suburb text,
  province text,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pre-index compatibility repair (must run before indexes/policies).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_client_addresses'
  ) then
    alter table public.store_client_addresses add column if not exists client_id uuid;
    alter table public.store_client_addresses add column if not exists is_default boolean;
    alter table public.store_client_addresses add column if not exists country text;
    alter table public.store_client_addresses alter column is_default set default false;
    alter table public.store_client_addresses alter column country set default 'South Africa';

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_addresses' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_addresses set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_client_preferences'
  ) then
    alter table public.store_client_preferences add column if not exists client_id uuid;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_preferences' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_preferences set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_orders'
  ) then
    alter table public.store_orders add column if not exists client_id uuid;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_orders' and column_name='store_client_id'
    ) then
      execute 'update public.store_orders set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;
end
$$;

create index if not exists idx_store_client_addresses_client_id
on public.store_client_addresses (client_id);

create unique index if not exists idx_store_client_addresses_one_default
on public.store_client_addresses (client_id)
where is_default = true;

drop trigger if exists store_client_addresses_set_updated_at on public.store_client_addresses;
create trigger store_client_addresses_set_updated_at
before update on public.store_client_addresses
for each row
execute function public.set_updated_at();

create table if not exists public.store_client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.store_clients(id) on delete cascade,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  marketing_emails boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_client_preferences_set_updated_at on public.store_client_preferences;
create trigger store_client_preferences_set_updated_at
before update on public.store_client_preferences
for each row
execute function public.set_updated_at();

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.store_clients(id) on delete set null,
  email text not null,
  phone text,
  first_name text not null,
  last_name text not null,
  address_line1 text not null,
  suburb text,
  province text,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  payment_method text not null check (payment_method in ('card', 'paypal', 'bank')),
  order_status text not null default 'processing' check (order_status in ('processing', 'shipped', 'delivered', 'cancelled')),
  subtotal_amount numeric(12,2) not null check (subtotal_amount >= 0),
  shipping_amount numeric(12,2) not null check (shipping_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_orders_client_id on public.store_orders (client_id);
create index if not exists idx_store_orders_email on public.store_orders (email);
create index if not exists idx_store_orders_created_at on public.store_orders (created_at desc);

drop trigger if exists store_orders_set_updated_at on public.store_orders;
create trigger store_orders_set_updated_at
before update on public.store_orders
for each row
execute function public.set_updated_at();

create table if not exists public.store_order_items (
  id bigserial primary key,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  size_ml int not null check (size_ml > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Compatibility repair for existing storefront tables
-- ------------------------------------------------------------
-- If tables were created earlier with different column names,
-- this block adds missing columns and backfills from common
-- legacy names so the rest of this script can run safely.
do $$
begin
  -- store_clients
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_clients'
  ) then
    alter table public.store_clients add column if not exists auth_user_id uuid;
    alter table public.store_clients add column if not exists full_name text;
    alter table public.store_clients add column if not exists email text;
    alter table public.store_clients add column if not exists phone text;
    alter table public.store_clients add column if not exists member_since_year int;
    alter table public.store_clients alter column member_since_year set default extract(year from now())::int;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_clients' and column_name='name'
    ) then
      execute 'update public.store_clients set full_name = coalesce(full_name, name)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_clients' and column_name='phone_number'
    ) then
      execute 'update public.store_clients set phone = coalesce(phone, phone_number)';
    end if;
  end if;

  -- store_client_addresses
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_client_addresses'
  ) then
    alter table public.store_client_addresses add column if not exists client_id uuid;
    alter table public.store_client_addresses add column if not exists label text;
    alter table public.store_client_addresses add column if not exists line1 text;
    alter table public.store_client_addresses add column if not exists suburb text;
    alter table public.store_client_addresses add column if not exists province text;
    alter table public.store_client_addresses add column if not exists city text;
    alter table public.store_client_addresses add column if not exists postal_code text;
    alter table public.store_client_addresses add column if not exists country text;
    alter table public.store_client_addresses add column if not exists is_default boolean;
    alter table public.store_client_addresses alter column label set default 'Home';
    alter table public.store_client_addresses alter column country set default 'South Africa';
    alter table public.store_client_addresses alter column is_default set default false;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_addresses' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_addresses set client_id = coalesce(client_id, store_client_id)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_addresses' and column_name='postalCode'
    ) then
      execute 'update public.store_client_addresses set postal_code = coalesce(postal_code, "postalCode")';
    end if;
  end if;

  -- store_client_preferences
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_client_preferences'
  ) then
    alter table public.store_client_preferences add column if not exists client_id uuid;
    alter table public.store_client_preferences add column if not exists email_notifications boolean;
    alter table public.store_client_preferences add column if not exists sms_notifications boolean;
    alter table public.store_client_preferences add column if not exists marketing_emails boolean;
    alter table public.store_client_preferences alter column email_notifications set default true;
    alter table public.store_client_preferences alter column sms_notifications set default false;
    alter table public.store_client_preferences alter column marketing_emails set default true;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_client_preferences' and column_name='store_client_id'
    ) then
      execute 'update public.store_client_preferences set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;

  -- store_orders
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'store_orders'
  ) then
    alter table public.store_orders add column if not exists client_id uuid;
    alter table public.store_orders add column if not exists suburb text;
    alter table public.store_orders add column if not exists province text;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_orders' and column_name='store_client_id'
    ) then
      execute 'update public.store_orders set client_id = coalesce(client_id, store_client_id)';
    end if;
  end if;
end
$$;

create index if not exists idx_store_order_items_order_id on public.store_order_items (order_id);

-- RLS for storefront tables
alter table public.store_clients enable row level security;
alter table public.store_client_addresses enable row level security;
alter table public.store_client_preferences enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

drop policy if exists store_clients_select_own on public.store_clients;
create policy store_clients_select_own
on public.store_clients
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists store_clients_update_own on public.store_clients;
create policy store_clients_update_own
on public.store_clients
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists store_clients_insert_own on public.store_clients;
create policy store_clients_insert_own
on public.store_clients
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists store_client_addresses_crud_own on public.store_client_addresses;
create policy store_client_addresses_crud_own
on public.store_client_addresses
for all
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_client_preferences_crud_own on public.store_client_preferences;
create policy store_client_preferences_crud_own
on public.store_client_preferences
for all
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_orders_select_own on public.store_orders;
create policy store_orders_select_own
on public.store_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_orders_insert_own on public.store_orders;
create policy store_orders_insert_own
on public.store_orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_order_items_select_own on public.store_order_items;
create policy store_order_items_select_own
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_order_items_insert_own on public.store_order_items;
create policy store_order_items_insert_own
on public.store_order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

-- Loyalty overview: docs/STOREFRONT_LOYALTY_AND_SQL.md — SQL: docs/SUPABASE_LOYALTY_POINTS.sql
