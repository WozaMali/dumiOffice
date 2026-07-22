-- Dumi Essence: Discount coupons (shared Office + storefront checkout)
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Office creates/manages codes. Storefront validates via RPC only
-- (codes are never listed publicly). Applied coupon is snapshotted
-- onto store_orders at place-order time; redemptions auto-log on insert.
--
-- Order total = product_subtotal - discount_amount + shipping
-- (discount applies to product subtotal only, not shipping).

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
-- discount_coupons
-- ---------------------------------------------------------------------------
create table if not exists public.discount_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  min_subtotal numeric(12, 2) not null default 0 check (min_subtotal >= 0),
  max_discount numeric(12, 2) check (max_discount is null or max_discount > 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  usage_count int not null default 0 check (usage_count >= 0),
  per_client_limit int check (per_client_limit is null or per_client_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_coupons_percent_range check (
    discount_type <> 'percent' or (discount_value >= 1 and discount_value <= 100)
  ),
  constraint discount_coupons_window check (
    starts_at is null or ends_at is null or starts_at <= ends_at
  )
);

-- Case-insensitive unique code (e.g. WELCOME10 / welcome10)
create unique index if not exists idx_discount_coupons_code_lower
  on public.discount_coupons (lower(code));

create index if not exists idx_discount_coupons_is_active
  on public.discount_coupons (is_active);

drop trigger if exists set_discount_coupons_updated_at on public.discount_coupons;
create trigger set_discount_coupons_updated_at
before update on public.discount_coupons
for each row execute function public.set_updated_at();

-- Normalize code to uppercase on write
create or replace function public.discount_coupons_normalize_code()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists discount_coupons_normalize_code on public.discount_coupons;
create trigger discount_coupons_normalize_code
before insert or update of code on public.discount_coupons
for each row execute function public.discount_coupons_normalize_code();

-- ---------------------------------------------------------------------------
-- store_orders coupon columns (snapshot at place-order)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.store_orders') is not null then
    alter table public.store_orders
      add column if not exists coupon_id uuid references public.discount_coupons(id) on delete set null,
      add column if not exists coupon_code text,
      add column if not exists discount_amount numeric(12, 2) not null default 0
        check (discount_amount >= 0);

    create index if not exists idx_store_orders_coupon_id
      on public.store_orders (coupon_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Redemption ledger (auto on store_orders insert when coupon_id set)
-- ---------------------------------------------------------------------------
create table if not exists public.discount_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.discount_coupons(id) on delete cascade,
  store_order_id uuid references public.store_orders(id) on delete set null,
  client_id uuid,
  code_snapshot text not null,
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  subtotal_amount numeric(12, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_discount_coupon_redemptions_coupon
  on public.discount_coupon_redemptions (coupon_id, created_at desc);

create index if not exists idx_discount_coupon_redemptions_client
  on public.discount_coupon_redemptions (client_id, coupon_id)
  where client_id is not null;

create unique index if not exists idx_discount_coupon_redemptions_order
  on public.discount_coupon_redemptions (store_order_id)
  where store_order_id is not null;

-- ---------------------------------------------------------------------------
-- validate_discount_coupon — storefront checkout RPC (codes stay private)
-- ---------------------------------------------------------------------------
create or replace function public.validate_discount_coupon(
  p_code text,
  p_subtotal numeric,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.discount_coupons%rowtype;
  v_code text;
  v_subtotal numeric;
  v_discount numeric;
  v_client_uses int;
begin
  -- Coupons are intentionally not readable by anon via RLS.
  -- This RPC must bypass RLS so checkout can validate private codes.
  perform set_config('row_security', 'off', true);

  v_code := upper(trim(coalesce(p_code, '')));
  v_subtotal := coalesce(p_subtotal, 0);

  if v_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  end if;

  if v_subtotal < 0 then
    return jsonb_build_object('valid', false, 'message', 'Invalid cart subtotal.');
  end if;

  select *
  into v_coupon
  from public.discount_coupons c
  where lower(c.code) = lower(v_code)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Coupon code not found.');
  end if;

  if not v_coupon.is_active then
    return jsonb_build_object('valid', false, 'message', 'This coupon is no longer active.');
  end if;

  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.');
  end if;

  if v_coupon.ends_at is not null and now() > v_coupon.ends_at then
    return jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  end if;

  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  end if;

  if v_subtotal < coalesce(v_coupon.min_subtotal, 0) then
    return jsonb_build_object(
      'valid', false,
      'message', format(
        'Minimum product subtotal of R%s required.',
        to_char(v_coupon.min_subtotal, 'FM999999990.00')
      )
    );
  end if;

  if v_coupon.per_client_limit is not null and p_client_id is not null then
    select count(*)::int
    into v_client_uses
    from public.discount_coupon_redemptions r
    where r.coupon_id = v_coupon.id
      and r.client_id = p_client_id;

    if v_client_uses >= v_coupon.per_client_limit then
      return jsonb_build_object('valid', false, 'message', 'You have already used this coupon.');
    end if;
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := round(v_subtotal * (v_coupon.discount_value / 100.0), 2);
    if v_coupon.max_discount is not null then
      v_discount := least(v_discount, v_coupon.max_discount);
    end if;
  else
    v_discount := v_coupon.discount_value;
  end if;

  v_discount := least(greatest(v_discount, 0), v_subtotal);

  if v_discount <= 0 then
    return jsonb_build_object('valid', false, 'message', 'Coupon does not apply to this cart.');
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'label', v_coupon.label,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'min_subtotal', v_coupon.min_subtotal,
    'max_discount', v_coupon.max_discount,
    'message', null
  );
end;
$$;

revoke all on function public.validate_discount_coupon(text, numeric, uuid) from public;
grant execute on function public.validate_discount_coupon(text, numeric, uuid)
  to anon, authenticated;

-- Ensure the definer role can always read coupon rows under RLS
alter function public.validate_discount_coupon(text, numeric, uuid) owner to postgres;

-- ---------------------------------------------------------------------------
-- Auto-redeem on store_orders insert (when coupon_id present)
-- ---------------------------------------------------------------------------
create or replace function public.trg_discount_coupon_on_store_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(12, 2);
  v_code text;
begin
  perform set_config('row_security', 'off', true);

  if new.coupon_id is null then
    return new;
  end if;

  -- Idempotent: one redemption row per order
  if exists (
    select 1
    from public.discount_coupon_redemptions r
    where r.store_order_id = new.id
  ) then
    return new;
  end if;

  v_amount := coalesce(new.discount_amount, 0);
  v_code := nullif(trim(coalesce(new.coupon_code, '')), '');
  if v_code is null then
    select c.code into v_code
    from public.discount_coupons c
    where c.id = new.coupon_id;
  end if;

  insert into public.discount_coupon_redemptions (
    coupon_id,
    store_order_id,
    client_id,
    code_snapshot,
    discount_amount,
    subtotal_amount
  ) values (
    new.coupon_id,
    new.id,
    new.client_id,
    coalesce(v_code, 'UNKNOWN'),
    v_amount,
    new.subtotal_amount
  );

  update public.discount_coupons
  set usage_count = usage_count + 1,
      updated_at = now()
  where id = new.coupon_id;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.store_orders') is not null then
    drop trigger if exists discount_coupon_on_store_order_insert on public.store_orders;
    create trigger discount_coupon_on_store_order_insert
    after insert on public.store_orders
    for each row
    execute function public.trg_discount_coupon_on_store_order_insert();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS — codes stay private (no public SELECT on coupons)
-- ---------------------------------------------------------------------------
alter table public.discount_coupons enable row level security;
alter table public.discount_coupon_redemptions enable row level security;

-- Office (authenticated) full manage
drop policy if exists discount_coupons_office_all on public.discount_coupons;
create policy discount_coupons_office_all
on public.discount_coupons
for all to authenticated
using (true) with check (true);

-- No anon SELECT/INSERT/UPDATE/DELETE on discount_coupons
-- (storefront uses validate_discount_coupon only)

drop policy if exists discount_coupon_redemptions_office_select on public.discount_coupon_redemptions;
create policy discount_coupon_redemptions_office_select
on public.discount_coupon_redemptions
for select to authenticated
using (true);

-- Writes to redemptions go through the security-definer trigger only

grant select, insert, update, delete on public.discount_coupons to authenticated;
grant select on public.discount_coupon_redemptions to authenticated;

notify pgrst, 'reload schema';

-- Example (optional):
-- insert into public.discount_coupons (
--   code, label, discount_type, discount_value, min_subtotal, is_active, per_client_limit
-- ) values (
--   'WELCOME10', 'Welcome 10%', 'percent', 10, 0, true, 1
-- );
