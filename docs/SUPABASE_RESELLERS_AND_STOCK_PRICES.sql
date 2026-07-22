-- Dumi Essence: Resellers + stock price tiers
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Retail keeps product retail prices.
-- Stock tier = reseller / trade stock prices (editable per product).
-- Key Account = preferred trade pricing.

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

-- ---------------------------------------------------------------------------
-- Price tiers
-- ---------------------------------------------------------------------------
create table if not exists public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  -- Optional fallback: when a product has no tier row, use retail * (1 - discount/100)
  default_discount_percent numeric(5, 2) not null default 0
    check (default_discount_percent >= 0 and default_discount_percent < 100),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_price_tiers_updated_at on public.price_tiers;
create trigger set_price_tiers_updated_at
before update on public.price_tiers
for each row execute function public.set_updated_at();

insert into public.price_tiers (code, name, description, default_discount_percent, sort_order)
values
  ('retail', 'Retail', 'Consumer / storefront pricing', 0, 0),
  ('stock', 'Stock / Reseller', 'Trade stock price for approved resellers', 25, 1),
  ('key_account', 'Key Account', 'Preferred reseller pricing', 35, 2)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  default_discount_percent = excluded.default_discount_percent,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Product tier prices (stock price book)
-- ---------------------------------------------------------------------------
create table if not exists public.product_tier_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  tier_id uuid not null references public.price_tiers(id) on delete cascade,
  price_30ml numeric(12, 2) check (price_30ml is null or price_30ml >= 0),
  price_50ml numeric(12, 2) check (price_50ml is null or price_50ml >= 0),
  price_100ml numeric(12, 2) check (price_100ml is null or price_100ml >= 0),
  price_200ml numeric(12, 2) check (price_200ml is null or price_200ml >= 0),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, tier_id)
);

create index if not exists idx_product_tier_prices_tier
  on public.product_tier_prices (tier_id);

drop trigger if exists set_product_tier_prices_updated_at on public.product_tier_prices;
create trigger set_product_tier_prices_updated_at
before update on public.product_tier_prices
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Link customers to a price tier
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.customers') is not null then
    alter table public.customers
      add column if not exists price_tier_id uuid references public.price_tiers(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reseller accounts (onboarding)
-- ---------------------------------------------------------------------------
create table if not exists public.reseller_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  vat_number text,
  address_line text,
  city text,
  province text,
  postal_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended')),
  price_tier_id uuid references public.price_tiers(id) on delete set null,
  payment_terms text default 'COD',
  credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0),
  moq_units int check (moq_units is null or moq_units > 0),
  notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reseller_accounts_status
  on public.reseller_accounts (status, created_at desc);

drop trigger if exists set_reseller_accounts_updated_at on public.reseller_accounts;
create trigger set_reseller_accounts_updated_at
before update on public.reseller_accounts
for each row execute function public.set_updated_at();

-- Default new resellers onto Stock tier when approved without an explicit tier
create or replace function public.reseller_accounts_default_tier()
returns trigger
language plpgsql
as $$
declare
  v_stock uuid;
begin
  if new.price_tier_id is null then
    select id into v_stock from public.price_tiers where code = 'stock' limit 1;
    new.price_tier_id := v_stock;
  end if;
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists reseller_accounts_default_tier on public.reseller_accounts;
create trigger reseller_accounts_default_tier
before insert or update on public.reseller_accounts
for each row execute function public.reseller_accounts_default_tier();

-- ---------------------------------------------------------------------------
-- Resolve a product price for a tier (RPC for Office / future checkout)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_tier_price(
  p_product_id uuid,
  p_tier_code text,
  p_size_ml int default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tier public.price_tiers%rowtype;
  v_row public.product_tier_prices%rowtype;
  v_product public.products%rowtype;
  v_retail numeric;
  v_price numeric;
begin
  perform set_config('row_security', 'off', true);

  select * into v_tier
  from public.price_tiers t
  where lower(t.code) = lower(trim(p_tier_code))
  limit 1;
  if not found then
    return null;
  end if;

  select * into v_product
  from public.products p
  where p.id = p_product_id
  limit 1;
  if not found then
    return null;
  end if;

  if p_size_ml = 30 then v_retail := v_product.price_30ml;
  elsif p_size_ml = 50 then v_retail := v_product.price_50ml;
  elsif p_size_ml = 100 then v_retail := v_product.price_100ml;
  elsif p_size_ml = 200 then v_retail := v_product.price_200ml;
  else v_retail := null;
  end if;
  v_retail := coalesce(v_retail, v_product.base_price, v_product.price, 0);

  if v_tier.code = 'retail' then
    return v_retail;
  end if;

  select * into v_row
  from public.product_tier_prices r
  where r.product_id = p_product_id and r.tier_id = v_tier.id
  limit 1;

  if found then
    if p_size_ml = 30 then v_price := v_row.price_30ml;
    elsif p_size_ml = 50 then v_price := v_row.price_50ml;
    elsif p_size_ml = 100 then v_price := v_row.price_100ml;
    elsif p_size_ml = 200 then v_price := v_row.price_200ml;
    else v_price := null;
    end if;
    v_price := coalesce(v_price, v_row.unit_price);
    if v_price is not null then
      return v_price;
    end if;
  end if;

  return round(v_retail * (1 - coalesce(v_tier.default_discount_percent, 0) / 100.0), 2);
end;
$$;

grant execute on function public.resolve_tier_price(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.price_tiers enable row level security;
alter table public.product_tier_prices enable row level security;
alter table public.reseller_accounts enable row level security;

drop policy if exists price_tiers_office_all on public.price_tiers;
create policy price_tiers_office_all on public.price_tiers
for all to authenticated using (true) with check (true);

drop policy if exists product_tier_prices_office_all on public.product_tier_prices;
create policy product_tier_prices_office_all on public.product_tier_prices
for all to authenticated using (true) with check (true);

drop policy if exists reseller_accounts_office_all on public.reseller_accounts;
create policy reseller_accounts_office_all on public.reseller_accounts
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.price_tiers to authenticated;
grant select, insert, update, delete on public.product_tier_prices to authenticated;
grant select, insert, update, delete on public.reseller_accounts to authenticated;

-- Seed helpful accounting category for wholesale/reseller income (optional)
do $$
begin
  if to_regclass('public.accounting_categories') is not null then
    insert into public.accounting_categories (name, kind)
    select 'Reseller / Wholesale sales', 'income'
    where not exists (
      select 1 from public.accounting_categories c
      where lower(c.name) = 'reseller / wholesale sales'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
