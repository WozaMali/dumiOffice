-- Office Clients table: merge public.customers with live storefront (store_clients + store_client_addresses)
-- when CRM rows are stale or address only exists on the shop.
--
-- Run in Supabase SQL Editor. App calls: rpc('office_client_list_display').

create or replace function public.office_client_list_display()
returns table (
  customer_id uuid,
  display_name text,
  display_phone text,
  address_summary text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as customer_id,
    coalesce(
      nullif(trim(sc.full_name), ''),
      nullif(trim(c.customer_name), ''),
      ''
    )::text as display_name,
    coalesce(
      nullif(trim(sc.phone), ''),
      nullif(trim(c.customer_phone), '')
    )::text as display_phone,
    coalesce(
      case
        when trim(coalesce(a.line1, '')) <> '' then
          trim(both ' ' from concat_ws(', ',
            nullif(trim(a.line1), ''),
            nullif(trim(a.suburb), ''),
            nullif(trim(a.city), ''),
            nullif(trim(a.province), ''),
            nullif(trim(a.postal_code), '')
          ))
        when trim(coalesce(ad.address_line, '')) <> '' then
          trim(both ' ' from concat_ws(', ',
            nullif(trim(ad.address_line), ''),
            nullif(trim(ad.suburb), ''),
            nullif(trim(ad.city), ''),
            nullif(trim(ad.province), ''),
            nullif(trim(ad.postal_code), '')
          ))
        else ''
      end,
      ''
    )::text as address_summary
  from public.customers c
  left join public.store_clients sc
    on lower(trim(sc.email)) = lower(trim(c.customer_email))
  left join lateral (
    select *
    from public.store_client_addresses a2
    where a2.client_id = sc.id and a2.is_default = true
    order by a2.updated_at desc nulls last
    limit 1
  ) a on true
  left join lateral (
    select *
    from public.addresses ad2
    where ad2.customer_id = c.id and ad2.is_default = true
    limit 1
  ) ad on true
$$;

revoke all on function public.office_client_list_display() from public;
grant execute on function public.office_client_list_display() to authenticated;
