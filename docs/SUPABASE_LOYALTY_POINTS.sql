-- Dumi Essence: loyalty points (office customers)
-- Rule: R2.00 spent = 1 point → floor(amount_zar / 2) points.
-- Run in Supabase SQL Editor after your core customers/orders schema exists.

-- Balance on customer row (fast display; ledger is source of truth for history)
alter table if exists public.customers
  add column if not exists loyalty_points int not null default 0;

create table if not exists public.loyalty_point_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  points_delta int not null,
  balance_after int not null,
  reason text not null,
  order_id text,
  reference text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_tx_customer_id
  on public.loyalty_point_transactions (customer_id, created_at desc);

-- Idempotency: same reference per customer only once (e.g. earn:order:<uuid>)
create unique index if not exists idx_loyalty_tx_customer_reference
  on public.loyalty_point_transactions (customer_id, reference)
  where reference is not null;

-- Points from spend in ZAR (grand total)
create or replace function public.loyalty_points_for_spend_zar(amount_zar numeric)
returns int
language sql
immutable
strict
as $$
  select greatest(0, floor(amount_zar / 2))::int;
$$;

-- Atomically apply points and append ledger row (idempotent when reference is set)
create or replace function public.loyalty_apply_points(
  p_customer_id uuid,
  p_points_delta int,
  p_reason text,
  p_order_id text default null,
  p_created_by text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_new int;
begin
  if p_points_delta is null or p_points_delta = 0 then
    return;
  end if;

  if p_reference is not null then
    if exists (
      select 1
      from public.loyalty_point_transactions t
      where t.customer_id = p_customer_id
        and t.reference = p_reference
    ) then
      return;
    end if;
  end if;

  select coalesce(c.loyalty_points, 0)
  into v_current
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception 'customer not found';
  end if;

  v_new := v_current + p_points_delta;
  if v_new < 0 then
    raise exception 'loyalty balance cannot be negative';
  end if;

  update public.customers c
  set loyalty_points = v_new,
      updated_at = now()
  where c.id = p_customer_id;

  insert into public.loyalty_point_transactions (
    customer_id,
    points_delta,
    balance_after,
    reason,
    order_id,
    created_by,
    reference
  ) values (
    p_customer_id,
    p_points_delta,
    v_new,
    p_reason,
    p_order_id,
    p_created_by,
    p_reference
  );
end;
$$;

grant execute on function public.loyalty_points_for_spend_zar(numeric) to authenticated;
grant execute on function public.loyalty_apply_points(uuid, int, text, text, text, text) to authenticated;

alter table public.loyalty_point_transactions enable row level security;

drop policy if exists loyalty_tx_select_office on public.loyalty_point_transactions;
create policy loyalty_tx_select_office
on public.loyalty_point_transactions
for select
to authenticated
using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '')
    in ('superadmin', 'admin', 'manager')
);

-- Writes go through loyalty_apply_points (security definer); no direct insert policy for clients.

-- If you already deployed an older rule, re-run only the
-- `create or replace function public.loyalty_points_for_spend_zar` block above.
-- Past ledger rows are unchanged; adjust balances manually if needed.
