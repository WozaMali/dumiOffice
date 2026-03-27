-- Dumi: Sync storefront store_orders -> Office orders / order_items
-- Run in Supabase SQL Editor after:
-- - Storefront tables exist (docs/SUPABASE_STOREFRONT_AUTH_CHECKOUT.sql)
-- - Office order tables exist (public.orders + public.order_items as used by the Office app)
--
-- This script:
-- - Creates a small mapping table to prevent duplicates
-- - Adds a SECURITY DEFINER function to upsert an Office order from a store_order
-- - Adds a trigger to keep office orders up to date when store_orders are inserted/updated
--
-- Notes:
-- - This expects your Office `public.orders` schema to include the columns used by the app:
--   reference, channel, status, stage, subtotal, shipping_fee, discount, tax, grand_total, currency,
--   payment_status, payment_method, payment_provider, payment_ref, customer_name, customer_email,
--   customer_phone, location, date, created_at, updated_at.
-- - If your Office `public.orders` uses different column names, adjust the INSERT/UPDATE fields.

create extension if not exists pgcrypto;

-- 1) Map storefront order -> office order to stay idempotent
create table if not exists public.store_office_order_map (
  store_order_id uuid primary key references public.store_orders(id) on delete cascade,
  -- Office `orders.id` is `text` in this project, not uuid.
  office_order_id text not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_store_office_order_map_office_order_id
on public.store_office_order_map (office_order_id);

-- 2) Helper: map store order_status -> office status/stage
create or replace function public.office_status_from_store_order_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'processing'))
    when 'delivered' then 'Delivered'
    when 'shipped' then 'Shipped'
    when 'cancelled' then 'Cancelled'
    else 'Processing'
  end;
$$;

create or replace function public.office_stage_from_store_order_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'processing'))
    when 'delivered' then 'Completed'
    when 'cancelled' then 'Completed'
    else 'In Progress'
  end;
$$;

-- 3) Main: Upsert Office order + items from a store_order id
create or replace function public.sync_office_order_from_store_order(p_store_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  so record;
  oi record;
  v_office_order_id text;
  v_reference text;
  v_customer_name text;
  v_office_status text;
  v_office_stage text;
  v_shipping_address text;
  v_product_uuid uuid;
begin
  -- Load store order
  select *
  into so
  from public.store_orders
  where id = p_store_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'store_order_not_found');
  end if;

  -- Stable reference to prevent duplicates (fits office prefix style)
  v_reference := 'WEB-' || replace(so.id::text, '-', '');
  v_reference := substr(v_reference, 1, 20); -- keep references shortish

  v_customer_name := trim(coalesce(so.first_name, '') || ' ' || coalesce(so.last_name, ''));
  if v_customer_name = '' then
    v_customer_name := split_part(coalesce(so.email, ''), '@', 1);
  end if;

  v_office_status := public.office_status_from_store_order_status(so.order_status);
  v_office_stage := public.office_stage_from_store_order_status(so.order_status);

  v_shipping_address := trim(both ' ' from concat_ws(', ',
    nullif(trim(coalesce(so.address_line1, '')), ''),
    nullif(trim(coalesce(so.suburb, '')), ''),
    nullif(trim(coalesce(so.city, '')), ''),
    nullif(trim(coalesce(so.province, '')), ''),
    nullif(trim(coalesce(so.postal_code, '')), ''),
    nullif(trim(coalesce(so.country, '')), '')
  ));

  -- Resolve existing mapping (idempotent)
  select m.office_order_id
  into v_office_order_id
  from public.store_office_order_map m
  where m.store_order_id = so.id;

  -- If the mapping table is empty (fresh deploy) but the office order already exists
  -- (same unique reference), adopt it instead of inserting a duplicate.
  if v_office_order_id is null then
    select o.id
    into v_office_order_id
    from public.orders o
    where o.reference = v_reference
    limit 1;

    if v_office_order_id is not null then
      insert into public.store_office_order_map (store_order_id, office_order_id)
      values (so.id, v_office_order_id)
      on conflict (store_order_id) do update
        set office_order_id = excluded.office_order_id;
    end if;
  end if;

  if v_office_order_id is null then
    -- Create a new office order
    insert into public.orders (
      reference,
      channel,
      source,
      status,
      stage,
      fulfilment_status,
      subtotal,
      shipping_fee,
      discount,
      tax,
      grand_total,
      currency,
      payment_status,
      payment_method,
      payment_provider,
      payment_ref,
      paid_at,
      shipping_method,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      location,
      date
    ) values (
      v_reference,
      'Online Orders',
      'Storefront',
      v_office_status,
      v_office_stage,
      'unfulfilled',
      coalesce(so.subtotal_amount, 0),
      coalesce(so.shipping_amount, 0),
      0,
      0,
      coalesce(so.total_amount, 0),
      'ZAR',
      case when lower(coalesce(so.order_status, 'processing')) = 'delivered' then 'Paid' else 'Pending' end,
      nullif(trim(coalesce(so.payment_method, '')), ''),
      'payfast',
      v_reference,
      null,
      null,
      v_customer_name,
      lower(trim(so.email)),
      nullif(trim(coalesce(so.phone, '')), ''),
      nullif(v_shipping_address, ''),
      coalesce(nullif(trim(so.city), ''), 'Online'),
      coalesce(so.created_at::date, now()::date)
    )
    returning id into v_office_order_id;

    insert into public.store_office_order_map (store_order_id, office_order_id)
    values (so.id, v_office_order_id);
  else
    -- Update the existing office order (keep status/stage in sync)
    update public.orders o
    set
      status = v_office_status,
      stage = v_office_stage,
      source = 'Storefront',
      subtotal = coalesce(so.subtotal_amount, 0),
      shipping_fee = coalesce(so.shipping_amount, 0),
      grand_total = coalesce(so.total_amount, 0),
      payment_method = nullif(trim(coalesce(so.payment_method, '')), ''),
      customer_name = v_customer_name,
      customer_email = lower(trim(so.email)),
      customer_phone = nullif(trim(coalesce(so.phone, '')), ''),
      shipping_address = nullif(v_shipping_address, ''),
      location = coalesce(nullif(trim(so.city), ''), 'Online'),
      updated_at = now()
    where o.id = v_office_order_id;
  end if;

  -- Replace items to avoid drift (simple and reliable)
  delete from public.order_items
  where order_id = v_office_order_id;

  for oi in
    select *
    from public.store_order_items
    where order_id = so.id
    order by id asc
  loop
    -- storefront store_order_items.product_id is text; office order_items.product_id is uuid
    begin
      v_product_uuid := oi.product_id::uuid;
    exception when others then
      v_product_uuid := null;
    end;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      product_category,
      product_type,
      sku,
      image_url,
      quantity,
      unit_price,
      discount,
      tax,
      line_total
      , fulfilment_status
    ) values (
      v_office_order_id,
      v_product_uuid,
      oi.product_name,
      'Perfume',
      null,
      null,
      oi.image_url,
      oi.quantity,
      oi.unit_price,
      0,
      0,
      oi.line_total,
      'unfulfilled'
    );
  end loop;

  return jsonb_build_object('ok', true, 'office_order_id', v_office_order_id, 'reference', v_reference);
end;
$$;

revoke all on function public.sync_office_order_from_store_order(uuid) from public;
grant execute on function public.sync_office_order_from_store_order(uuid) to authenticated;

-- 4) Trigger: run sync automatically on insert/update of store_orders
create or replace function public.trg_sync_office_order_from_store_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only sync when we have an email (identity) and totals
  if new.email is null or length(trim(new.email)) = 0 then
    return new;
  end if;
  perform public.sync_office_order_from_store_order(new.id);
  return new;
end;
$$;

drop trigger if exists store_orders_sync_office on public.store_orders;
create trigger store_orders_sync_office
after insert or update of order_status, subtotal_amount, shipping_amount, total_amount
on public.store_orders
for each row
execute function public.trg_sync_office_order_from_store_orders();

