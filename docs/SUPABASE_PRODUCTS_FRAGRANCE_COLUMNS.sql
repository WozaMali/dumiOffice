-- Add fragrance / Content fields used by Inventory ↔ Fragrance products.
-- Safe to re-run. Fixes: Could not find the 'brand' column of 'products'

alter table public.products
  add column if not exists brand text,
  add column if not exists item text,
  add column if not exists inspired_by text,
  add column if not exists designer text,
  add column if not exists collection_code text,
  add column if not exists code text,
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists base_price numeric(12,2),
  add column if not exists price_30ml numeric(12,2),
  add column if not exists price_50ml numeric(12,2),
  add column if not exists price_100ml numeric(12,2),
  add column if not exists price_200ml numeric(12,2),
  add column if not exists short_description text,
  add column if not exists long_description text,
  add column if not exists default_size text,
  add column if not exists primary_image_path text,
  add column if not exists is_bestseller boolean default false,
  add column if not exists is_new boolean default false,
  add column if not exists reassurance_copy text;

create index if not exists idx_products_collection_code
  on public.products (collection_code);

create index if not exists idx_products_brand
  on public.products (brand);

-- Keep name in sync with product_name for storefront/Content when blank
update public.products
set name = product_name
where (name is null or btrim(name) = '')
  and product_name is not null;

notify pgrst, 'reload schema';
