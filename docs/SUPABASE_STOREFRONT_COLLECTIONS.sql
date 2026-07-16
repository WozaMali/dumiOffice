-- Storefront "Shop the House" collection cards (Office Content → Storefront collections)
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Main app: read docs/STOREFRONT_COLLECTIONS.md for query + image URL resolver.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Extend collections table for Office + storefront
-- ---------------------------------------------------------------------------
alter table public.collections
  add column if not exists code text;

alter table public.collections
  add column if not exists tagline text;

alter table public.collections
  add column if not exists hero_image_url text;

-- Storefront useFeaturedCollections reads `image` (mirrors hero_image_url)
alter table public.collections
  add column if not exists image text;

-- Legacy column from older schemas
alter table public.collections
  add column if not exists image_url text;

-- Backfill code + hero image from legacy columns
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

update public.collections
set hero_image_url = image_url
where (hero_image_url is null or btrim(hero_image_url) = '')
  and image_url is not null
  and btrim(image_url) <> '';

-- Normalize legacy diffuser code (Office used "diffusers"; storefront expects "diffuser")
update public.collections
set code = 'diffuser',
    slug = 'diffuser'
where code in ('diffusers', 'diffuser')
   or slug in ('diffusers', 'diffuser');

-- Backfill any remaining null codes from slug (needed for a full unique index)
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

-- Full unique indexes (partial indexes cannot be used with ON CONFLICT (col))
drop index if exists idx_collections_code_unique;
create unique index if not exists idx_collections_code_unique
  on public.collections (code);

create unique index if not exists idx_collections_slug_unique
  on public.collections (slug);

-- ---------------------------------------------------------------------------
-- Product categories (cosmetics lines) — text column, no enum lock
-- ---------------------------------------------------------------------------
-- Office inventory categories: Perfume, Diffuser, Car Perfume, Shower Gel, Body Lotion, Body Oil
-- Assign collection_code on products when linking to shop cards:
--   car-perfumes  → Car Perfume products
--   cosmetics     → Shower Gel / Body Lotion / Body Oil (grouped under one shop card)

-- ---------------------------------------------------------------------------
-- Seed / upsert shop collection cards
-- ---------------------------------------------------------------------------
insert into public.collections (code, slug, name, tagline, description, is_active, published_at)
values
  (
    'mens',
    'mens',
    'Men''s Line',
    'Structured signatures with warmth, woods, and presence.',
    'Structured signatures with warmth, woods, and presence.',
    true,
    now()
  ),
  (
    'womens',
    'womens',
    'Women''s Line',
    'Polished florals and luminous amber compositions.',
    'Polished florals and luminous amber compositions.',
    true,
    now()
  ),
  (
    'unisex',
    'unisex',
    'Unisex Line',
    'Modern, versatile luxury for everyday wear.',
    'Modern, versatile luxury for everyday wear.',
    true,
    now()
  ),
  (
    'diffuser',
    'diffuser',
    'Diffusers Line',
    'Room-fresh sophistication, amplified.',
    'Room-fresh sophistication, amplified.',
    true,
    now()
  ),
  (
    'car-perfumes',
    'car-perfumes',
    'Car Perfume',
    'Compact scent for every drive — fresh, warm, unmistakably Dumi.',
    'Car vent clips and cabin fragrance.',
    true,
    now()
  ),
  (
    'cosmetics',
    'cosmetics',
    'Cosmetics',
    'Body care essentials — lotions, shower gels, and body oils.',
    'Lotions, shower gels, and body oils for everyday ritual.',
    true,
    now()
  )
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- If slug conflicts differ from code (e.g. old diffusers row), align by code
update public.collections c
set
  slug = v.code,
  name = v.name,
  tagline = v.tagline,
  is_active = true
from (values
  ('mens', 'Men''s Line', 'Structured signatures with warmth, woods, and presence.'),
  ('womens', 'Women''s Line', 'Polished florals and luminous amber compositions.'),
  ('unisex', 'Unisex Line', 'Modern, versatile luxury for everyday wear.'),
  ('diffuser', 'Diffusers Line', 'Room-fresh sophistication, amplified.'),
  ('car-perfumes', 'Car Perfume', 'Compact scent for every drive — fresh, warm, unmistakably Dumi.'),
  ('cosmetics', 'Cosmetics', 'Body care essentials — lotions, shower gels, and body oils.')
) as v(code, name, tagline)
where c.code = v.code;

-- ---------------------------------------------------------------------------
-- RLS (storefront public read)
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;

grant select on public.collections to anon, authenticated;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "collections_public_read_active" on public.collections;
create policy "collections_public_read_active"
on public.collections
for select
to anon, authenticated
using (coalesce(is_active, true) = true);

drop policy if exists "collections_office_manage" on public.collections;
create policy "collections_office_manage"
on public.collections
for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';

select code, slug, name, hero_image_url is not null as has_image
from public.collections
where code in ('mens', 'womens', 'unisex', 'diffuser', 'car-perfumes', 'cosmetics')
order by code;

-- ---------------------------------------------------------------------------
-- After uploading to hero-assets bucket (Office Content → Upload image, or
-- Storage → hero-assets → collections/), set paths like:
-- ---------------------------------------------------------------------------
-- update public.collections
-- set hero_image_url = 'collections/mens-hero.jpg', updated_at = now()
-- where code = 'mens';
--
-- update public.collections
-- set hero_image_url = 'collections/womens-hero.jpg', updated_at = now()
-- where code = 'womens';
--
-- update public.collections
-- set hero_image_url = 'collections/unisex-hero.jpg', updated_at = now()
-- where code = 'unisex';
--
-- update public.collections
-- set hero_image_url = 'collections/diffuser-hero.jpg', updated_at = now()
-- where code = 'diffuser';
--
-- update public.collections
-- set hero_image_url = 'collections/car-perfumes-hero.jpg', updated_at = now()
-- where code = 'car-perfumes';
--
-- update public.collections
-- set hero_image_url = 'collections/cosmetics-hero.jpg', updated_at = now()
-- where code = 'cosmetics';
