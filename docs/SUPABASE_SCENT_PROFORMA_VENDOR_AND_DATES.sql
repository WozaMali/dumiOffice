-- Link DE pro-formas to vendors and support date controls.
-- Run once in Supabase SQL editor.

alter table public.scent_proformas
  add column if not exists vendor_id uuid null references public.vendors(id) on delete set null,
  add column if not exists proforma_date date null,
  add column if not exists invoice_date date null;

create index if not exists idx_scent_proformas_vendor_id on public.scent_proformas(vendor_id);
create index if not exists idx_scent_proformas_proforma_date on public.scent_proformas(proforma_date);
create index if not exists idx_scent_proformas_invoice_date on public.scent_proformas(invoice_date);

