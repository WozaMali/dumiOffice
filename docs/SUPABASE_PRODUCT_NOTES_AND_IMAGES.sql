-- Create product_notes + product_images used by Content → Fragrance products
-- (Notes / Imagery tabs). Safe to re-run.
-- Fixes: Could not find the table 'public.product_notes' in the schema cache

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- product_notes (top / middle / base fragrance notes)
-- ---------------------------------------------------------------------------
create table if not exists public.product_notes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  level text not null check (level in ('top', 'middle', 'base')),
  note text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_notes_product_id
  on public.product_notes (product_id);

create index if not exists idx_product_notes_level_position
  on public.product_notes (product_id, level, position);

-- ---------------------------------------------------------------------------
-- product_images (gallery / extra imagery)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null default 'gallery',
  path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product_id
  on public.product_images (product_id);

create index if not exists idx_product_images_sort
  on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS (office authenticated write; public/anon read for storefront)
-- ---------------------------------------------------------------------------
alter table public.product_notes enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "Office read product_notes" on public.product_notes;
drop policy if exists "Office write product_notes" on public.product_notes;
create policy "Office read product_notes"
  on public.product_notes
  for select
  using (true);
create policy "Office write product_notes"
  on public.product_notes
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Office read product_images" on public.product_images;
drop policy if exists "Office write product_images" on public.product_images;
create policy "Office read product_images"
  on public.product_images
  for select
  using (true);
create policy "Office write product_images"
  on public.product_images
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
