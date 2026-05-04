-- Reverse Office loyalty points when a storefront order is deleted
-- Run in Supabase SQL Editor.
--
-- Context:
-- - Storefront orders live in: public.store_orders
-- - Office orders live in: public.orders
-- - Mapping lives in: public.store_office_order_map (store_order_id -> office_order_id)
-- - Loyalty ledger lives in: public.loyalty_point_transactions (order_id is the OFFICE order id as text)
--
-- This trigger ensures deleting a storefront order also reverses any loyalty points
-- previously awarded for the mapped office order.

create or replace function public.reverse_loyalty_points_for_store_order_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office_order_id text;
  v_customer_id uuid;
  v_net_points int;
begin
  -- Find the mapped office order id (text)
  select office_order_id
  into v_office_order_id
  from public.store_office_order_map
  where store_order_id = old.id
  limit 1;

  if v_office_order_id is null or v_office_order_id = '' then
    return old;
  end if;

  -- Reverse per customer (net points tied to that office order)
  for v_customer_id, v_net_points in
    select customer_id, coalesce(sum(points_delta), 0)::int
    from public.loyalty_point_transactions
    where order_id = v_office_order_id
    group by customer_id
  loop
    if v_net_points is null or v_net_points = 0 then
      continue;
    end if;

    perform public.loyalty_apply_points(
      v_customer_id,
      -v_net_points,
      'Store order deleted: points reversed',
      v_office_order_id,
      'system',
      'store-delete:' || old.id::text || ':' || v_customer_id::text
    );
  end loop;

  -- Optional: remove mapping row so it doesn't point to a deleted store order
  delete from public.store_office_order_map
  where store_order_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_reverse_points_on_store_order_delete on public.store_orders;
create trigger trg_reverse_points_on_store_order_delete
after delete on public.store_orders
for each row
execute function public.reverse_loyalty_points_for_store_order_delete();

