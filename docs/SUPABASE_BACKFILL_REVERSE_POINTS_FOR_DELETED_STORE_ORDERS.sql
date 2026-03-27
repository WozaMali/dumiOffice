-- One-time backfill: reverse points for storefront orders already deleted
-- Run in Supabase SQL Editor AFTER deploying:
--   docs/SUPABASE_STORE_ORDERS_DELETE_REVERSE_POINTS.sql
--
-- What it does:
-- - Finds mapping rows where store_order_id no longer exists in public.store_orders
-- - Reverses any loyalty points tied to the mapped office_order_id
-- - Deletes the stale mapping row

begin;

do $$
declare
  r record;
  v_customer_id uuid;
  v_net_points int;
begin
  for r in
    select m.store_order_id, m.office_order_id
    from public.store_office_order_map m
    left join public.store_orders so on so.id = m.store_order_id
    where so.id is null
  loop
    -- Reverse per customer (net points tied to that office order id)
    for v_customer_id, v_net_points in
      select customer_id, coalesce(sum(points_delta), 0)::int
      from public.loyalty_point_transactions
      where order_id = r.office_order_id
      group by customer_id
    loop
      if v_net_points is null or v_net_points = 0 then
        continue;
      end if;

      perform public.loyalty_apply_points(
        v_customer_id,
        -v_net_points,
        'Backfill: store order previously deleted, points reversed',
        r.office_order_id,
        'system',
        'store-delete-backfill:' || r.store_order_id::text || ':' || v_customer_id::text
      );
    end loop;

    -- Remove stale mapping
    delete from public.store_office_order_map
    where store_order_id = r.store_order_id;
  end loop;
end;
$$;

commit;

-- Follow-up: recompute balances from ledger (optional but recommended)
-- Run docs/SUPABASE_LOYALTY_RECONCILE_AFTER_ORDER_DELETES.sql

