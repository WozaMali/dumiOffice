-- Dumi Essence: Storefront auth + protected checkout schema
-- Safe for existing office schema: uses separate "store_*" tables.
-- Target: PostgreSQL / Supabase SQL Editor

create extension if not exists pgcrypto;

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
-- Storefront clients linked to Supabase Auth users
-- ------------------------------------------------------------
create table if not exists public.store_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  phone text,
  member_since_year int not null default 2026,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_clients_set_updated_at on public.store_clients;
create trigger store_clients_set_updated_at
before update on public.store_clients
for each row
execute function public.set_updated_at();

-- One client can have many saved addresses.
create table if not exists public.store_client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.store_clients(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'South Africa',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Notification and marketing preferences (1 row per client)
create table if not exists public.store_client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.store_clients(id) on delete cascade,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  marketing_emails boolean not null default true,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  consent_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_client_preferences_set_updated_at on public.store_client_preferences;
create trigger store_client_preferences_set_updated_at
before update on public.store_client_preferences
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Storefront checkout orders (kept separate from office "orders")
-- ------------------------------------------------------------
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.store_clients(id) on delete set null,
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

create index if not exists idx_store_order_items_order_id on public.store_order_items (order_id);

-- Existing deployments: add consent fields if table already exists.
alter table if exists public.store_client_preferences
  add column if not exists terms_accepted_at timestamptz;

alter table if exists public.store_client_preferences
  add column if not exists privacy_accepted_at timestamptz;

alter table if exists public.store_client_preferences
  add column if not exists consent_version text not null default 'v1';

-- ------------------------------------------------------------
-- RLS for client-facing ownership
-- ------------------------------------------------------------
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

-- Checkout inserts should be done by secure server endpoints (service role),
-- or with additional insert policies after anti-abuse rules are defined.
