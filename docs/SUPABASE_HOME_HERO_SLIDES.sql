-- Creates home_hero_slides for storefront hero + Office content cards.
-- Run in Supabase SQL Editor (Dashboard → SQL → New query). Safe to re-run.
--
-- Related: client-notes section header seed lives in docs/SUPABASE_HOME_CLIENT_NOTES.sql

create extension if not exists pgcrypto;

create table if not exists public.home_hero_slides (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kicker text null,
  headline text not null,
  subheadline text null,
  body text null,
  primary_cta_label text null,
  primary_cta_href text null,
  secondary_cta_label text null,
  secondary_cta_href text null,
  collection_code text null,
  product_id uuid null,
  background_image_url text null,
  background_video_url text null,
  gallery_image_urls text[] null,
  image_rotation_seconds integer null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_hero_slides
  add column if not exists image_rotation_seconds integer null;

alter table public.home_hero_slides
  add column if not exists background_image_url_mobile text null;

-- Align product_id type with products.id, then add optional FK
do $$
declare
  products_id_type text;
  hero_product_id_type text;
begin
  if to_regclass('public.products') is null then
    return;
  end if;

  select c.udt_name
  into products_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  if products_id_type is null then
    return;
  end if;

  alter table public.home_hero_slides
    drop constraint if exists home_hero_slides_product_id_fkey;

  select c.udt_name
  into hero_product_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'home_hero_slides'
    and c.column_name = 'product_id';

  if hero_product_id_type is null then
    if products_id_type = 'uuid' then
      alter table public.home_hero_slides add column product_id uuid null;
    else
      alter table public.home_hero_slides add column product_id text null;
    end if;
  elsif hero_product_id_type is distinct from products_id_type then
    if products_id_type = 'uuid' then
      alter table public.home_hero_slides
        alter column product_id type uuid
        using case
          when product_id is null or btrim(product_id) = '' then null
          else product_id::uuid
        end;
    else
      alter table public.home_hero_slides
        alter column product_id type text using product_id::text;
    end if;
  end if;

  alter table public.home_hero_slides
    add constraint home_hero_slides_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
end $$;

create index if not exists idx_home_hero_slides_active_sort
  on public.home_hero_slides (is_active, sort_order, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_home_hero_slides_updated_at on public.home_hero_slides;
create trigger set_home_hero_slides_updated_at
before update on public.home_hero_slides
for each row
execute function public.set_updated_at();

alter table public.home_hero_slides enable row level security;

grant select on public.home_hero_slides to anon, authenticated;
grant select, insert, update, delete on public.home_hero_slides to authenticated;

drop policy if exists "home_hero_slides_public_read_active" on public.home_hero_slides;
create policy "home_hero_slides_public_read_active"
on public.home_hero_slides
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "home_hero_slides_office_manage" on public.home_hero_slides;
create policy "home_hero_slides_office_manage"
on public.home_hero_slides
for all
to authenticated
using (true)
with check (true);

-- Main hero (top banner) — edit image/copy in Office Content
insert into public.home_hero_slides (
  code, kicker, headline, subheadline,
  primary_cta_label, primary_cta_href,
  secondary_cta_label, secondary_cta_href,
  is_active, sort_order
)
values (
  'home-main',
  'July Promo',
  'BUY X3 FOR R499.99',
  'Modern fragrance house',
  'Shop Female Fragrances',
  '/shop',
  'Discover Your Signature',
  '/know-your-scent',
  true,
  1
)
on conflict (code) do nothing;

-- New Arrivals content card (not main hero rotation)
insert into public.home_hero_slides (
  code, kicker, headline, subheadline,
  primary_cta_label, primary_cta_href,
  is_active, sort_order
)
values (
  'fresh-in-store',
  'New Arrivals',
  'Fresh In Store',
  'Just landed — the newest additions to the house.',
  'Shop new arrivals',
  '/shop',
  true,
  900
)
on conflict (code) do nothing;

-- Personalisation page + home card
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body,
  primary_cta_label, primary_cta_href,
  is_active, sort_order
)
values (
  'put-your-name-on-it',
  'Personalisation',
  'Put Your Name On It',
  'Make it yours with a name on the label.',
  'Personalise your perfume for an extra R20.',
  'Request personalisation',
  '/personalisation',
  true,
  910
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  body = excluded.body,
  primary_cta_label = excluded.primary_cta_label,
  primary_cta_href = excluded.primary_cta_href,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- After uploading images in Office (hero-assets bucket), set paths like:
-- update public.home_hero_slides
-- set
--   background_image_url = 'home-hero/images/desktop.jpg',
--   background_image_url_mobile = 'home-hero/images/mobile.jpg',
--   updated_at = now()
-- where code = 'put-your-name-on-it';
-- Home carousel desktop: 2880×1228 or 1440×614. Home carousel mobile: 1080×1920 (9:16).
-- Other hero slides/cards: use 2400×1350 or 1920×1080 (16:9). Keep subject in center 60%.

-- Gift Guide page hero
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, is_active, sort_order
)
values (
  'gift-guide-hero',
  'Curated Gifting',
  'The luxury gift guide for fragrance that feels intimate and memorable.',
  'From milestone gifts to thoughtful gestures, each edit is designed to feel elevated in tone, packaging, and emotion from the first glance to the final note.',
  true,
  930
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Gift Edits cards (Office: set background_image_url per card)
insert into public.home_hero_slides (
  code, headline, subheadline, collection_code, primary_cta_label, is_active, sort_order
)
values
  (
    'gift-edit-for-him',
    'For Him',
    'Bold, commanding scents that embody strength and dignity.',
    'mens',
    'Shop Gifts for Him',
    true,
    941
  ),
  (
    'gift-edit-for-her',
    'For Her',
    'Elegant, timeless fragrances that celebrate grace and beauty.',
    'womens',
    'Shop Gifts for Her',
    true,
    942
  ),
  (
    'gift-edit-for-everyone',
    'For Everyone',
    'Balanced, versatile scents perfect for any occasion.',
    'unisex',
    'Shop Gifts for Everyone',
    true,
    943
  )
on conflict (code) do update set
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  collection_code = excluded.collection_code,
  primary_cta_label = excluded.primary_cta_label,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Our Journey page (hero + promise section — set background_image_url in Office)
insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body, is_active, sort_order
)
values (
  'our-journey-hero',
  'The House Story',
  'Our Journey',
  null,
  null,
  true,
  960
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.home_hero_slides (
  code, kicker, headline, subheadline, body, is_active, sort_order
)
values (
  'our-journey-promise',
  'Our Promise',
  'Built for trust and longevity',
  'We are committed to growing Dumi Essence responsibly: improving products, experience, and communication without overstating impact.',
  'This page will continue to evolve with verified milestones so our community can see real progress over time.',
  true,
  961
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  body = excluded.body,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- After uploading in Office (hero-assets bucket):
-- update public.home_hero_slides
-- set background_image_url = 'home-hero/images/our-journey-banner.jpg', updated_at = now()
-- where code = 'our-journey-hero';
--
-- update public.home_hero_slides
-- set background_image_url = 'home-hero/images/our-journey-promise.jpg', updated_at = now()
-- where code = 'our-journey-promise';

notify pgrst, 'reload schema';

select
  (select count(*) from public.home_hero_slides where is_active = true) as active_slide_count;
