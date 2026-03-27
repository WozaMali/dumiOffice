-- Reconcile loyalty points after order deletions / historical drift
-- Run in Supabase SQL Editor.
--
-- Use this when customers still show points but related orders are gone.

begin;

-- 1) Remove orphan loyalty entries that reference a deleted/non-existent order.
delete from public.loyalty_point_transactions t
where t.order_id is not null
  and not exists (
    select 1
    from public.orders o
    where o.id::text = t.order_id
  );

-- 1b) Also remove ledger rows with missing customers (safety).
delete from public.loyalty_point_transactions t
where not exists (
  select 1
  from public.customers c
  where c.id = t.customer_id
);

-- 2) Recompute customer loyalty_points from remaining transaction ledger.
update public.customers c
set loyalty_points = coalesce(x.points_total, 0),
    updated_at = now()
from (
  select customer_id, coalesce(sum(points_delta), 0)::int as points_total
  from public.loyalty_point_transactions
  group by customer_id
) x
where c.id = x.customer_id;

-- 3) Ensure customers with no ledger rows are zeroed.
update public.customers c
set loyalty_points = 0,
    updated_at = now()
where not exists (
  select 1
  from public.loyalty_point_transactions t
  where t.customer_id = c.id
)
and coalesce(c.loyalty_points, 0) <> 0;

commit;

-- Optional check:
-- select id, full_name, loyalty_points from public.customers order by loyalty_points desc, full_name;
