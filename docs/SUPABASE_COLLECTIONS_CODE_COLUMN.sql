-- Add storefront/Office columns on public.collections (fixes save error).
-- Safe to re-run.
-- Fixes: Could not find the 'code' column of 'collections' in the schema cache

alter table public.collections
  add column if not exists code text,
  add column if not exists tagline text,
  add column if not exists hero_image_url text,
  add column if not exists image text,
  add column if not exists image_url text,
  add column if not exists description text,
  add column if not exists is_active boolean default true,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Backfill code from slug when blank
update public.collections
set code = slug
where (code is null or btrim(code) = '')
  and slug is not null
  and btrim(slug) <> '';

-- Normalize diffuser naming
update public.collections
set code = 'diffuser',
    slug = 'diffuser'
where lower(coalesce(code, '')) in ('diffusers', 'diffuser')
   or lower(coalesce(slug, '')) in ('diffusers', 'diffuser');

-- Mirror hero path into storefront `image` column
update public.collections
set image = coalesce(nullif(btrim(image), ''), hero_image_url, image_url)
where image is null or btrim(image) = '';

update public.collections
set hero_image_url = coalesce(nullif(btrim(hero_image_url), ''), image, image_url)
where hero_image_url is null or btrim(hero_image_url) = '';

-- Unique code required for Office upsert onConflict: code
-- Drop any duplicate null/blank codes first by assigning temporary codes
update public.collections
set code = 'collection-' || substr(replace(id::text, '-', ''), 1, 12)
where code is null or btrim(code) = '';

drop index if exists idx_collections_code_unique;
create unique index if not exists idx_collections_code_unique
  on public.collections (code);

create unique index if not exists idx_collections_slug_unique
  on public.collections (slug);

-- Seed / upsert the shop cards Office expects (mens, womens, unisex, diffuser, …)
insert into public.collections (code, slug, name, tagline, description, is_active, published_at)
values
  ('mens', 'mens', 'Men''s Line', 'Structured signatures with warmth, woods, and presence.', 'Structured signatures with warmth, woods, and presence.', true, now()),
  ('womens', 'womens', 'Women''s Line', 'Soft florals, luminous fruits, and elegant trails.', 'Soft florals, luminous fruits, and elegant trails.', true, now()),
  ('unisex', 'unisex', 'Unisex Line', 'Shared signatures — balanced, modern, and versatile.', 'Shared signatures — balanced, modern, and versatile.', true, now()),
  ('diffuser', 'diffuser', 'Diffusers', 'Home scents that linger with calm and clarity.', 'Home scents that linger with calm and clarity.', true, now()),
  ('car-perfumes', 'car-perfumes', 'Car Perfumes', 'Compact scents for the drive.', 'Compact scents for the drive.', true, now()),
  ('cosmetics', 'cosmetics', 'Body & Bath', 'Gels, lotions, and oils that carry the house signature.', 'Gels, lotions, and oils that carry the house signature.', true, now())
on conflict (code) do update set
  slug = excluded.slug,
  name = coalesce(nullif(btrim(collections.name), ''), excluded.name),
  tagline = coalesce(nullif(btrim(collections.tagline), ''), excluded.tagline),
  description = coalesce(nullif(btrim(collections.description), ''), excluded.description),
  is_active = true,
  updated_at = now();

notify pgrst, 'reload schema';
