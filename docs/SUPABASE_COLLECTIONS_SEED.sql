-- Seed missing collection rows for Office / storefront carousel.
-- Run in Supabase if diffuser, car-perfumes, or cosmetics are missing.
-- Requires: unique index on collections.code (see SUPABASE_STOREFRONT_COLLECTIONS.sql).

alter table public.collections
  add column if not exists code text;

alter table public.collections
  add column if not exists tagline text;

alter table public.collections
  add column if not exists hero_image_url text;

-- Main app useFeaturedCollections reads `image` when Supabase is connected
alter table public.collections
  add column if not exists image text;

-- Ensure no null codes before unique index (re-run safe)
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

-- Full unique index required for ON CONFLICT (code)
drop index if exists idx_collections_code_unique;
create unique index idx_collections_code_unique
  on public.collections (code);

insert into public.collections (code, slug, name, tagline, description, is_active)
values
  (
    'diffuser',
    'diffuser',
    'Diffuser',
    'Elevated spaces',
    'Interior fragrance designed for elevated spaces.',
    true
  ),
  (
    'car-perfumes',
    'car-perfumes',
    'Car Perfumes',
    'Refined drive',
    'Travel scent experiences for a refined drive.',
    true
  ),
  (
    'cosmetics',
    'cosmetics',
    'Cosmetics',
    'Beauty essentials',
    'Beauty and body essentials curated with the Dumi touch.',
    true
  )
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Keep `image` in sync with hero_image_url for storefront hooks
update public.collections
set image = hero_image_url
where hero_image_url is not null
  and btrim(hero_image_url) <> ''
  and (image is null or btrim(image) = '' or image = hero_image_url);

notify pgrst, 'reload schema';

select code, name, hero_image_url, image
from public.collections
where code in ('diffuser', 'car-perfumes', 'cosmetics')
order by code;

-- Set images after upload to hero-assets (Office Content → Upload, or Storage):
-- update public.collections
-- set hero_image_url = 'collections/diffuser-hero.jpg',
--     image = 'collections/diffuser-hero.jpg',
--     updated_at = now()
-- where code = 'diffuser';
--
-- update public.collections
-- set hero_image_url = 'collections/car-perfumes-hero.jpg',
--     image = 'collections/car-perfumes-hero.jpg',
--     updated_at = now()
-- where code = 'car-perfumes';
--
-- update public.collections
-- set hero_image_url = 'collections/cosmetics-hero.jpg',
--     image = 'collections/cosmetics-hero.jpg',
--     updated_at = now()
-- where code = 'cosmetics';
