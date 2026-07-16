-- Storefront proof-of-payment metadata (files live in Storage bucket: payment_proofs).
-- Safe to re-run. Required by Office Orders PoP UI + storeOrdersWithPop API.

create table if not exists public.store_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.store_orders(id) on delete cascade,
  client_id uuid references public.store_clients(id) on delete set null,
  public_url text,
  storage_path text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_payment_proofs_order_id
  on public.store_payment_proofs (order_id);

create index if not exists idx_store_payment_proofs_client_id
  on public.store_payment_proofs (client_id);

create index if not exists idx_store_payment_proofs_created_at
  on public.store_payment_proofs (created_at desc);

alter table public.store_payment_proofs enable row level security;

-- Shopper: read/write own proofs
drop policy if exists store_payment_proofs_select_own on public.store_payment_proofs;
create policy store_payment_proofs_select_own
on public.store_payment_proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists store_payment_proofs_insert_own on public.store_payment_proofs;
create policy store_payment_proofs_insert_own
on public.store_payment_proofs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_orders o
    join public.store_clients c on c.id = o.client_id
    where o.id = order_id
      and c.auth_user_id = auth.uid()
  )
);

-- Office: read all (service role bypasses RLS; authenticated office staff need this)
drop policy if exists "store_payment_proofs_office_authenticated_select_all" on public.store_payment_proofs;
create policy "store_payment_proofs_office_authenticated_select_all"
on public.store_payment_proofs
for select
using (auth.role() = 'authenticated');
