-- Dumi: sync public.store_clients → public.customers (+ default public.addresses)
-- Run in Supabase SQL Editor (fixes Office /clients not updating when RLS blocks direct writes).
--
-- Why: browser sync used customersApi + RLS policies on customers/addresses. If policies are
-- missing, wrong, or conflict with office policies, updates never apply. This RPC runs as
-- SECURITY DEFINER and only allows: auth.uid() = store_clients.auth_user_id and store email
-- matches auth.users email.

create or replace function public.sync_crm_from_store_client(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text;
  sc record;
  sa record;
  v_cid uuid;
  v_aid uuid;
  v_name text;
  v_marketing boolean;
  v_sms boolean;
  v_email_pref boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select u.email into v_auth_email from auth.users u where u.id = v_uid;
  if v_auth_email is null or length(trim(v_auth_email)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_auth_email');
  end if;

  select * into sc
  from public.store_clients
  where id = p_client_id and auth_user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'store_client_not_found');
  end if;

  if lower(trim(sc.email)) <> lower(trim(v_auth_email)) then
    return jsonb_build_object('ok', false, 'error', 'store_email_must_match_login');
  end if;

  v_name := coalesce(nullif(trim(sc.full_name), ''), split_part(lower(trim(sc.email)), '@', 1));

  v_marketing := coalesce(
    (select p.marketing_emails from public.store_client_preferences p where p.client_id = p_client_id),
    true
  );
  v_sms := coalesce(
    (select p.sms_notifications from public.store_client_preferences p where p.client_id = p_client_id),
    false
  );
  v_email_pref := coalesce(
    (select p.email_notifications from public.store_client_preferences p where p.client_id = p_client_id),
    true
  );

  select * into sa
  from public.store_client_addresses
  where client_id = p_client_id and is_default = true
  order by created_at desc nulls last
  limit 1;

  select c.id into v_cid
  from public.customers c
  where c.customer_email is not null
    and lower(trim(c.customer_email)) = lower(trim(sc.email))
  limit 1;

  if v_cid is null then
    insert into public.customers (
      customer_name,
      customer_email,
      customer_phone,
      marketing_consent,
      sms_consent,
      email_consent,
      client_channel,
      customer_type,
      lifetime_value,
      total_orders
    ) values (
      v_name,
      lower(trim(sc.email)),
      nullif(trim(sc.phone), ''),
      v_marketing,
      v_sms,
      v_email_pref,
      'Online',
      'retail',
      0,
      0
    )
    returning id into v_cid;
  else
    update public.customers c
    set
      customer_name = v_name,
      customer_email = lower(trim(sc.email)),
      customer_phone = nullif(trim(sc.phone), ''),
      marketing_consent = v_marketing,
      sms_consent = v_sms,
      email_consent = v_email_pref,
      client_channel = 'Online',
      updated_at = now()
    where c.id = v_cid;
  end if;

  if sa.id is not null
     and length(trim(coalesce(sa.line1, ''))) > 0
     and length(trim(coalesce(sa.city, ''))) > 0
     and length(trim(coalesce(sa.postal_code, ''))) > 0 then

    select a.id into v_aid
    from public.addresses a
    where a.customer_id = v_cid and a.is_default = true
    limit 1;

    if v_aid is null then
      insert into public.addresses (
        customer_id,
        address_type,
        address_line,
        suburb,
        city,
        province,
        postal_code,
        country,
        is_default
      ) values (
        v_cid,
        'delivery',
        trim(sa.line1),
        coalesce(nullif(trim(sa.suburb), ''), ''),
        trim(sa.city),
        coalesce(nullif(trim(sa.province), ''), ''),
        trim(sa.postal_code),
        coalesce(nullif(trim(sa.country), ''), 'South Africa'),
        true
      );
    else
      update public.addresses a
      set
        address_type = 'delivery',
        address_line = trim(sa.line1),
        suburb = coalesce(nullif(trim(sa.suburb), ''), ''),
        city = trim(sa.city),
        province = coalesce(nullif(trim(sa.province), ''), ''),
        postal_code = trim(sa.postal_code),
        country = coalesce(nullif(trim(sa.country), ''), 'South Africa'),
        is_default = true,
        updated_at = now()
      where a.id = v_aid;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'customer_id', v_cid);
end;
$$;

revoke all on function public.sync_crm_from_store_client(uuid) from public;
grant execute on function public.sync_crm_from_store_client(uuid) to authenticated;
