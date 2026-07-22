-- Dumi Essence: DE order packaging / extra lines
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Fixes: Could not find the table 'public.scent_proforma_extra_lines' in the schema cache
-- Used by Oils / DE Orders for bottles, print fees, ethanol, pumps, caps.

create extension if not exists "uuid-ossp";

create table if not exists public.scent_proforma_extra_lines (
  id uuid primary key default uuid_generate_v4(),
  proforma_id uuid not null references public.scent_proformas(id) on delete cascade,
  kind text not null
    check (kind in ('bottle', 'print_fee', 'ethanol', 'pump', 'cap')),
  name text not null,
  spec text,
  qty numeric(12, 3) not null default 0
    check (qty >= 0),
  line_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_scent_proforma_extra_lines_proforma
  on public.scent_proforma_extra_lines (proforma_id);

create index if not exists idx_scent_proforma_extra_lines_kind
  on public.scent_proforma_extra_lines (kind);

alter table public.scent_proforma_extra_lines enable row level security;

drop policy if exists "Allow all on scent_proforma_extra_lines"
  on public.scent_proforma_extra_lines;
create policy "Allow all on scent_proforma_extra_lines"
  on public.scent_proforma_extra_lines
  for all
  to authenticated
  using (true)
  with check (true);

-- Keep older open policies consistent if present on sibling tables
drop policy if exists scent_proforma_extra_lines_office_all
  on public.scent_proforma_extra_lines;
create policy scent_proforma_extra_lines_office_all
  on public.scent_proforma_extra_lines
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.scent_proforma_extra_lines to authenticated;

notify pgrst, 'reload schema';
