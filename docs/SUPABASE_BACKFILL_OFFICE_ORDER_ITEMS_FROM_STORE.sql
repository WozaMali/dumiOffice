-- Backfill Office `order_items` from Storefront `store_order_items`
-- so Office Inventory can calculate stock-out using Orders data.
--
-- Assumptions:
-- - Office orders live in `orders`
-- - Storefront orders live in `store_orders`
-- - Storefront items live in `store_order_items`
-- - Mapping (best) is in `store_office_order_map(office_order_id, store_order_id)`
-- - Some orders can be inferred via reference/payment_ref `WEB-<32hex>` (optional)
--
-- Safe to run multiple times: uses NOT EXISTS to avoid duplicates.

begin;

-- 1) Optional helper: extract store UUID from "WEB-<hex>" references
create or replace function public.office_extract_store_uuid(web_ref text)
returns uuid
language plpgsql
immutable
as $$
declare
  hex text;
begin
  if web_ref is null then
    return null;
  end if;
  if web_ref !~* '^WEB-[a-f0-9]{32}$' then
    return null;
  end if;
  hex := lower(substring(web_ref from 5));
  return (substr(hex,1,8) || '-' || substr(hex,9,4) || '-' || substr(hex,13,4) || '-' || substr(hex,17,4) || '-' || substr(hex,21,12))::uuid;
end;
$$;

-- 2) Build a mapping set using the explicit map table, plus inferred WEB refs (if present)
with inferred as (
  select
    o.id as office_order_id,
    coalesce(
      m.store_order_id::text,
      public.office_extract_store_uuid(o.reference)::text,
      public.office_extract_store_uuid(o.payment_ref)::text
    ) as store_order_id
  from public.orders o
  left join public.store_office_order_map m
    on m.office_order_id = o.id
),
mapped as (
  select office_order_id, store_order_id
  from inferred
  where store_order_id is not null and length(store_order_id) > 0
),
src_items as (
  select
    m.office_order_id,
    soi.product_id::text as product_id_text,
    soi.product_name,
    soi.quantity::int as quantity,
    soi.unit_price::numeric as unit_price,
    soi.line_total::numeric as line_total
  from mapped m
  join public.store_order_items soi
    on soi.order_id::text = m.store_order_id
)
insert into public.order_items (
  order_id,
  product_id,
  product_name,
  product_category,
  product_type,
  sku,
  quantity,
  unit_price,
  discount,
  tax,
  line_total,
  created_at
)
select
  s.office_order_id,
  case
    when s.product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then s.product_id_text::uuid
    else null
  end as product_id,
  s.product_name,
  'Perfume'::text as product_category,
  null::text as product_type,
  -- Your rule: Orders SKU = Inventory DE Name.
  -- Persist it so Office can compute stock-out reliably from `order_items`.
  s.product_name as sku,
  s.quantity,
  s.unit_price,
  0::numeric as discount,
  0::numeric as tax,
  s.line_total,
  now() as created_at
from src_items s
where not exists (
  select 1
  from public.order_items oi
  where oi.order_id = s.office_order_id
    and oi.product_name = s.product_name
    and oi.quantity = s.quantity
    and coalesce(oi.unit_price, 0) = coalesce(s.unit_price, 0)
);

commit;

