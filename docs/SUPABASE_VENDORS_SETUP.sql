-- Vendors master table for DE Orders and Expenses

create extension if not exists "pgcrypto";

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  vat_number text null,
  company_registration text null,
  address text null,
  street_address text null,
  suburb text null,
  city text null,
  province text null,
  country text null,
  postal_code text null,
  contact_name text null,
  contact_phone text null,
  email text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible updates when table already existed before these fields were added.
alter table public.vendors add column if not exists vat_number text null;
alter table public.vendors add column if not exists company_registration text null;
alter table public.vendors add column if not exists address text null;
alter table public.vendors add column if not exists street_address text null;
alter table public.vendors add column if not exists suburb text null;
alter table public.vendors add column if not exists city text null;
alter table public.vendors add column if not exists province text null;
alter table public.vendors add column if not exists country text null;
alter table public.vendors add column if not exists postal_code text null;

create or replace function public.set_updated_at_vendors()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at_vendors();

alter table public.vendors enable row level security;

drop policy if exists vendors_select_authenticated on public.vendors;
create policy vendors_select_authenticated
on public.vendors
for select
to authenticated
using (true);

drop policy if exists vendors_insert_authenticated on public.vendors;
create policy vendors_insert_authenticated
on public.vendors
for insert
to authenticated
with check (true);

drop policy if exists vendors_update_authenticated on public.vendors;
create policy vendors_update_authenticated
on public.vendors
for update
to authenticated
using (true)
with check (true);

drop policy if exists vendors_delete_authenticated on public.vendors;
create policy vendors_delete_authenticated
on public.vendors
for delete
to authenticated
using (true);

