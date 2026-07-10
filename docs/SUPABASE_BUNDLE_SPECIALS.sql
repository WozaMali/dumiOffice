-- Pick-and-mix fragrance bundle specials (storefront /specials/:code)
-- Run once in Supabase SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Parent bundle (price, copy, hero image)
-- ---------------------------------------------------------------------------
create table if not exists public.bundle_specials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  headline text,
  subheadline text,
  description text,
  hero_image_url text,
  bundle_price numeric(10, 2) not null,
  compare_at_price numeric(10, 2),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Selection slots (tabs on storefront — e.g. Men's ×3, or His & Hers Men's ×2 + Women's ×2)
-- collection_code filters products.collection_code for the pick grid
-- ---------------------------------------------------------------------------
create table if not exists public.bundle_special_slots (
  id uuid primary key default gen_random_uuid(),
  bundle_special_id uuid not null references public.bundle_specials(id) on delete cascade,
  slot_code text not null,
  tab_label text not null,
  collection_code text not null,
  pick_count integer not null default 1 check (pick_count > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bundle_special_id, slot_code)
);

create index if not exists idx_bundle_special_slots_bundle
  on public.bundle_special_slots(bundle_special_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_bundle_specials_updated_at on public.bundle_specials;
create trigger set_bundle_specials_updated_at
before update on public.bundle_specials
for each row execute function public.set_updated_at();

drop trigger if exists set_bundle_special_slots_updated_at on public.bundle_special_slots;
create trigger set_bundle_special_slots_updated_at
before update on public.bundle_special_slots
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bundle_specials enable row level security;
alter table public.bundle_special_slots enable row level security;

grant select on public.bundle_specials to anon, authenticated;
grant select, insert, update, delete on public.bundle_specials to authenticated;
grant select on public.bundle_special_slots to anon, authenticated;
grant select, insert, update, delete on public.bundle_special_slots to authenticated;

drop policy if exists "bundle_specials_public_read" on public.bundle_specials;
create policy "bundle_specials_public_read"
on public.bundle_specials
for select to anon, authenticated
using (is_active = true);

drop policy if exists "bundle_specials_office_manage" on public.bundle_specials;
create policy "bundle_specials_office_manage"
on public.bundle_specials
for all to authenticated
using (true) with check (true);

drop policy if exists "bundle_special_slots_public_read" on public.bundle_special_slots;
create policy "bundle_special_slots_public_read"
on public.bundle_special_slots
for select to anon, authenticated
using (
  exists (
    select 1 from public.bundle_specials b
    where b.id = bundle_special_id and b.is_active = true
  )
);

drop policy if exists "bundle_special_slots_office_manage" on public.bundle_special_slots;
create policy "bundle_special_slots_office_manage"
on public.bundle_special_slots
for all to authenticated
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed the four launch bundles
-- ---------------------------------------------------------------------------
insert into public.bundle_specials (
  code, name, headline, subheadline, bundle_price, compare_at_price, is_active, sort_order
)
values
  (
    'mens-trio',
    'Men''s Trio',
    'Pick any 3 Men''s fragrances',
    'Curate your own trio from the Men''s line.',
    599.99,
    750.00,
    true,
    0
  ),
  (
    'unisex-trio',
    'Unisex Trio',
    'Pick any 3 Unisex fragrances',
    'Mix and match from the Unisex collection.',
    599.99,
    750.00,
    true,
    1
  ),
  (
    'womens-trio',
    'Women''s Trio',
    'Pick any 3 Women''s fragrances',
    'Build your trio from the Women''s line.',
    499.99,
    650.00,
    true,
    2
  ),
  (
    'his-and-hers',
    'His & Hers',
    '2 Men''s + 2 Women''s',
    'The perfect pair — two from each line.',
    699.99,
    900.00,
    true,
    3
  )
on conflict (code) do update set
  name = excluded.name,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  bundle_price = excluded.bundle_price,
  compare_at_price = excluded.compare_at_price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Slots (delete + re-insert per bundle on seed for idempotency)
delete from public.bundle_special_slots
where bundle_special_id in (
  select id from public.bundle_specials
  where code in ('mens-trio', 'unisex-trio', 'womens-trio', 'his-and-hers')
);

insert into public.bundle_special_slots (
  bundle_special_id, slot_code, tab_label, collection_code, pick_count, sort_order
)
select b.id, s.slot_code, s.tab_label, s.collection_code, s.pick_count, s.sort_order
from public.bundle_specials b
join (
  values
    ('mens-trio', 'mens', 'Men''s', 'mens', 3, 0),
    ('unisex-trio', 'unisex', 'Unisex', 'unisex', 3, 0),
    ('womens-trio', 'womens', 'Women''s', 'womens', 3, 0),
    ('his-and-hers', 'mens', 'Men''s', 'mens', 2, 0),
    ('his-and-hers', 'womens', 'Women''s', 'womens', 2, 1)
) as s(bundle_code, slot_code, tab_label, collection_code, pick_count, sort_order)
  on b.code = s.bundle_code;

-- Normalize legacy bundle hero paths (Office used bundles/ before bundle-specials/)
update public.bundle_specials
set
  hero_image_url = replace(
    regexp_replace(hero_image_url, '^hero-assets/', ''),
    'bundles/',
    'bundle-specials/'
  ),
  updated_at = now()
where hero_image_url is not null
  and (
    hero_image_url like 'bundles/%'
    or hero_image_url like 'hero-assets/bundles/%'
    or hero_image_url like 'hero-assets/bundle-specials/%'
  );

notify pgrst, 'reload schema';

select
  (select count(*) from public.bundle_specials where is_active = true) as bundle_count,
  (select count(*) from public.bundle_special_slots) as slot_count;
