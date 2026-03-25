-- Marketing campaigns table + RLS for Office CRUD
-- Run this in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Draft',
  sent integer not null default 0,
  open_rate numeric(6,2),
  click_rate numeric(6,2),
  campaign_date date,
  revenue_impact numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.marketing_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_campaigns_set_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_set_updated_at
before update on public.marketing_campaigns
for each row
execute function public.marketing_set_updated_at();

alter table public.marketing_campaigns enable row level security;

-- Authenticated users (Office) can read/write everything
drop policy if exists "marketing_campaigns_office_select" on public.marketing_campaigns;
create policy "marketing_campaigns_office_select"
on public.marketing_campaigns
for select
to authenticated
using (true);

drop policy if exists "marketing_campaigns_office_write" on public.marketing_campaigns;
create policy "marketing_campaigns_office_write"
on public.marketing_campaigns
for all
to authenticated
using (true)
with check (true);

