-- Office "Create order" prefill: read live storefront profile + default address by CRM customer id.
-- Use when public.addresses is empty or staff RLS cannot read it, but store_clients / store_client_addresses exist.
--
-- Run in Supabase SQL Editor. The app calls: rpc('office_prefill_from_store', { p_customer_id }).

create or replace function public.office_prefill_from_store(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  sc record;
  sa record;
begin
  if p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_customer_id');
  end if;

  select lower(trim(customer_email)) into v_email
  from public.customers
  where id = p_customer_id;

  if v_email is null or length(v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_customer_email');
  end if;

  select * into sc
  from public.store_clients
  where lower(trim(email)) = v_email
  order by updated_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'source', 'none');
  end if;

  return jsonb_build_object(
    'ok', true,
    'source', 'store',
    'full_name', sc.full_name,
    'phone', sc.phone,
    'line1', (
      select a.line1 from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'suburb', (
      select a.suburb from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'city', (
      select a.city from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'province', (
      select a.province from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'postal_code', (
      select a.postal_code from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    ),
    'country', (
      select a.country from public.store_client_addresses a
      where a.client_id = sc.id and a.is_default = true
      order by a.updated_at desc nulls last limit 1
    )
  );
end;
$$;

revoke all on function public.office_prefill_from_store(uuid) from public;
grant execute on function public.office_prefill_from_store(uuid) to authenticated;
