-- Create home_bestsellers used by Content → Fragrance products → Promotion
-- ("Mark as bestseller"). Safe to re-run.
-- Fixes: Could not find the table 'public.home_bestsellers' in the schema cache

create extension if not exists "pgcrypto";

create table if not exists public.home_bestsellers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  badge_label text default 'Bestseller',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists idx_home_bestsellers_sort
  on public.home_bestsellers (sort_order, created_at);

create index if not exists idx_home_bestsellers_active
  on public.home_bestsellers (is_active);

-- Keep products.is_bestseller available for storefront badges
alter table public.products
  add column if not exists is_bestseller boolean default false;

-- RLS: storefront can read active rows; office auth can write
alter table public.home_bestsellers enable row level security;

drop policy if exists "Public read home_bestsellers" on public.home_bestsellers;
drop policy if exists "Office write home_bestsellers" on public.home_bestsellers;

create policy "Public read home_bestsellers"
  on public.home_bestsellers
  for select
  using (true);

create policy "Office write home_bestsellers"
  on public.home_bestsellers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
