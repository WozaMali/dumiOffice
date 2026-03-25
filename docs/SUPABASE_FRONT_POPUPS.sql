-- Creates the front_popups table used by the storefront popup.
-- Run this in Supabase SQL editor (or your migration system).

create table if not exists public.front_popups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  is_active boolean not null default false,
  headline text null,
  body text null,
  image_url text null,
  cta_label text null,
  cta_href text null,
  dismiss_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_front_popups_updated_at on public.front_popups;
create trigger set_front_popups_updated_at
before update on public.front_popups
for each row
execute function public.set_updated_at();

-- Row Level Security
alter table public.front_popups enable row level security;

-- Storefront (anon) can read ONLY active popups
drop policy if exists "front_popups_public_read_active" on public.front_popups;
create policy "front_popups_public_read_active"
on public.front_popups
for select
to anon
using (is_active = true);

-- Office (authenticated) can manage popups
drop policy if exists "front_popups_office_manage" on public.front_popups;
create policy "front_popups_office_manage"
on public.front_popups
for all
to authenticated
using (true)
with check (true);

-- Seed the default code used by the app
insert into public.front_popups (code, is_active, dismiss_days)
values ('home-entry', false, 7)
on conflict (code) do nothing;

