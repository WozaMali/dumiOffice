-- Home page "Client Notes" testimonials (storefront Index → Client Notes section)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Requires: docs/SUPABASE_HOME_HERO_SLIDES.sql (home_hero_slides table)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Testimonial cards
-- ---------------------------------------------------------------------------
create table if not exists public.home_client_notes (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  location text not null,
  quote text not null,
  rating numeric(2, 1) not null default 5.0 check (rating >= 0 and rating <= 5),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_client_notes_active_sort
  on public.home_client_notes (is_active, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses set_updated_at if present)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_home_client_notes_updated_at on public.home_client_notes;
create trigger set_home_client_notes_updated_at
before update on public.home_client_notes
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.home_client_notes enable row level security;

grant select on public.home_client_notes to anon, authenticated;
grant select, insert, update, delete on public.home_client_notes to authenticated;

drop policy if exists "home_client_notes_public_read_active" on public.home_client_notes;
create policy "home_client_notes_public_read_active"
on public.home_client_notes
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "home_client_notes_office_manage" on public.home_client_notes;
create policy "home_client_notes_office_manage"
on public.home_client_notes
for all
to authenticated
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Section header copy (home_hero_slides code = client-notes)
-- ---------------------------------------------------------------------------
insert into public.home_hero_slides (
  code, kicker, headline, is_active, sort_order
)
values (
  'client-notes',
  'Client Notes',
  'What people remember after the first wear.',
  true,
  920
)
on conflict (code) do update set
  kicker = excluded.kicker,
  headline = excluded.headline,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed testimonials (matches current storefront hardcoded fallbacks)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.home_client_notes limit 1) then
    insert into public.home_client_notes (client_name, location, quote, rating, sort_order, is_active)
    values
      (
        'Nolwazi M.',
        'Johannesburg',
        'Midnight Amber lasts all day on my skin, and the dry-down is soft, warm, and addictive.',
        5.0,
        1,
        true
      ),
      (
        'Lerato K.',
        'Cape Town',
        'I get compliments every time I wear Velvet Rose - it opens fresh and settles into a rich, elegant perfume trail.',
        5.0,
        2,
        true
      ),
      (
        'Thabo D.',
        'Pretoria',
        'Ubuntu Noir smells premium and masculine without being too heavy; projection is perfect for both office and evenings.',
        5.0,
        3,
        true
      );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  (select count(*) from public.home_client_notes where is_active = true) as testimonial_count;
