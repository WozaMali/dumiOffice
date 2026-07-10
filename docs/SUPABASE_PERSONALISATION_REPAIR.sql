-- Personalisation — run this ONE file in Supabase → SQL Editor → Run
-- Safe to re-run. Creates tables, repairs missing columns, seeds data, reloads API schema.
--
-- After success you should see one row below with settings_count = 1, fonts_count >= 3.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.personalisation_settings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fee numeric(10, 2) not null default 20,
  preview_image_url text,
  preview_image_mens text,
  preview_image_womens text,
  preview_image_unisex text,
  preview_image_diffuser text,
  label_top_pct numeric(5, 2) not null default 42,
  label_left_pct numeric(5, 2) not null default 50,
  label_width_pct numeric(5, 2) not null default 72,
  placeholder_text text not null default 'Your Name',
  max_name_length integer not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personalisation_fonts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  font_family text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair columns on partial / older installs
alter table public.personalisation_settings
  add column if not exists fee numeric(10, 2) not null default 20,
  add column if not exists preview_image_url text,
  add column if not exists preview_image_mens text,
  add column if not exists preview_image_womens text,
  add column if not exists preview_image_unisex text,
  add column if not exists preview_image_diffuser text,
  add column if not exists label_top_pct numeric(5, 2) not null default 42,
  add column if not exists label_left_pct numeric(5, 2) not null default 50,
  add column if not exists label_width_pct numeric(5, 2) not null default 72,
  add column if not exists label_top_pct_mens numeric(5, 2),
  add column if not exists label_left_pct_mens numeric(5, 2),
  add column if not exists label_width_pct_mens numeric(5, 2),
  add column if not exists label_top_pct_womens numeric(5, 2),
  add column if not exists label_left_pct_womens numeric(5, 2),
  add column if not exists label_width_pct_womens numeric(5, 2),
  add column if not exists label_top_pct_unisex numeric(5, 2),
  add column if not exists label_left_pct_unisex numeric(5, 2),
  add column if not exists label_width_pct_unisex numeric(5, 2),
  add column if not exists label_top_pct_diffuser numeric(5, 2),
  add column if not exists label_left_pct_diffuser numeric(5, 2),
  add column if not exists label_width_pct_diffuser numeric(5, 2),
  add column if not exists placeholder_text text not null default 'Your Name',
  add column if not exists max_name_length integer not null default 20,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.personalisation_fonts
  add column if not exists label text,
  add column if not exists font_family text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- updated_at triggers
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

drop trigger if exists set_personalisation_settings_updated_at on public.personalisation_settings;
create trigger set_personalisation_settings_updated_at
before update on public.personalisation_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_personalisation_fonts_updated_at on public.personalisation_fonts;
create trigger set_personalisation_fonts_updated_at
before update on public.personalisation_fonts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants (Office authenticated write, storefront anon read active rows)
-- ---------------------------------------------------------------------------
alter table public.personalisation_settings enable row level security;
alter table public.personalisation_fonts enable row level security;

grant select on public.personalisation_settings to anon, authenticated;
grant select, insert, update, delete on public.personalisation_settings to authenticated;
grant select on public.personalisation_fonts to anon, authenticated;
grant select, insert, update, delete on public.personalisation_fonts to authenticated;

drop policy if exists "personalisation_settings_public_read" on public.personalisation_settings;
create policy "personalisation_settings_public_read"
on public.personalisation_settings
for select to anon, authenticated
using (is_active = true);

drop policy if exists "personalisation_fonts_public_read" on public.personalisation_fonts;
create policy "personalisation_fonts_public_read"
on public.personalisation_fonts
for select to anon, authenticated
using (is_active = true);

drop policy if exists "personalisation_settings_office_manage" on public.personalisation_settings;
create policy "personalisation_settings_office_manage"
on public.personalisation_settings
for all to authenticated
using (true) with check (true);

drop policy if exists "personalisation_fonts_office_manage" on public.personalisation_fonts;
create policy "personalisation_fonts_office_manage"
on public.personalisation_fonts
for all to authenticated
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into public.personalisation_settings (
  code,
  fee,
  preview_image_url,
  label_top_pct,
  label_left_pct,
  label_width_pct,
  placeholder_text,
  max_name_length,
  is_active
)
values (
  'default',
  20,
  null,
  42,
  50,
  72,
  'Your Name',
  20,
  true
)
on conflict (code) do nothing;

insert into public.personalisation_fonts (code, label, font_family, sort_order, is_active)
values
  ('hiragenda', 'Hiragenda', '"Hiragenda", sans-serif', 0, true),
  ('ocean-trace', 'Ocean Trace-Personal', '"Ocean Trace-Personal", cursive', 1, true),
  ('chillax', 'Chillax Family', '"Chillax", "Chillax Family", sans-serif', 2, true)
on conflict (code) do update set
  label = excluded.label,
  font_family = excluded.font_family,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

update public.personalisation_fonts
set is_active = false, updated_at = now()
where code in ('classic-serif', 'modern-sans', 'elegant-script', 'bold-caps');

-- Tell PostgREST / Supabase API to pick up the new tables
notify pgrst, 'reload tables';
notify pgrst, 'reload schema';
select pg_notification_queue_usage();

-- Verification (should show settings_count = 1, fonts_count >= 3)
select
  (select count(*) from public.personalisation_settings) as settings_count,
  (select count(*) from public.personalisation_fonts where is_active = true) as fonts_count;
