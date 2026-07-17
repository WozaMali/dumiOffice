-- Diffusers sell as 200ml only (no 50ml on PDP).
-- Safe to re-run.

alter table public.products
  add column if not exists price_200ml numeric(12,2);

-- Diffuser products: default size 200ml; clear perfume-size prices
update public.products
set
  default_size = '200ml',
  price_200ml = coalesce(
    price_200ml,
    base_price,
    price_50ml,
    price_100ml,
    price_30ml,
    price
  ),
  price_30ml = null,
  price_50ml = null,
  price_100ml = null,
  updated_at = now()
where
  lower(coalesce(collection_code, '')) in ('diffuser', 'diffusers')
  or lower(coalesce(category, '')) like '%diffuser%'
  or lower(coalesce(product_category, '')) like '%diffuser%';

notify pgrst, 'reload schema';
