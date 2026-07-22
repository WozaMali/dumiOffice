-- FIX: Checkout validate_discount_coupon could not see Office-created codes
-- because RLS hid discount_coupons from the RPC.
-- Run this once in Supabase SQL Editor (safe to re-run).

create or replace function public.validate_discount_coupon(
  p_code text,
  p_subtotal numeric,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.discount_coupons%rowtype;
  v_code text;
  v_subtotal numeric;
  v_discount numeric;
  v_client_uses int;
begin
  -- Coupons are intentionally not readable by anon via RLS.
  -- This RPC must bypass RLS so checkout can validate private codes.
  perform set_config('row_security', 'off', true);

  v_code := upper(trim(coalesce(p_code, '')));
  v_subtotal := coalesce(p_subtotal, 0);

  if v_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.');
  end if;

  if v_subtotal < 0 then
    return jsonb_build_object('valid', false, 'message', 'Invalid cart subtotal.');
  end if;

  select *
  into v_coupon
  from public.discount_coupons c
  where lower(c.code) = lower(v_code)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Coupon code not found.');
  end if;

  if not v_coupon.is_active then
    return jsonb_build_object('valid', false, 'message', 'This coupon is no longer active.');
  end if;

  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.');
  end if;

  if v_coupon.ends_at is not null and now() > v_coupon.ends_at then
    return jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  end if;

  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  end if;

  if v_subtotal < coalesce(v_coupon.min_subtotal, 0) then
    return jsonb_build_object(
      'valid', false,
      'message', format(
        'Minimum product subtotal of R%s required.',
        to_char(v_coupon.min_subtotal, 'FM999999990.00')
      )
    );
  end if;

  if v_coupon.per_client_limit is not null and p_client_id is not null then
    select count(*)::int
    into v_client_uses
    from public.discount_coupon_redemptions r
    where r.coupon_id = v_coupon.id
      and r.client_id = p_client_id;

    if v_client_uses >= v_coupon.per_client_limit then
      return jsonb_build_object('valid', false, 'message', 'You have already used this coupon.');
    end if;
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := round(v_subtotal * (v_coupon.discount_value / 100.0), 2);
    if v_coupon.max_discount is not null then
      v_discount := least(v_discount, v_coupon.max_discount);
    end if;
  else
    v_discount := v_coupon.discount_value;
  end if;

  v_discount := least(greatest(v_discount, 0), v_subtotal);

  if v_discount <= 0 then
    return jsonb_build_object('valid', false, 'message', 'Coupon does not apply to this cart.');
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'label', v_coupon.label,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'min_subtotal', v_coupon.min_subtotal,
    'max_discount', v_coupon.max_discount,
    'message', null
  );
end;
$$;

revoke all on function public.validate_discount_coupon(text, numeric, uuid) from public;
grant execute on function public.validate_discount_coupon(text, numeric, uuid)
  to anon, authenticated;

do $$
begin
  begin
    alter function public.validate_discount_coupon(text, numeric, uuid) owner to postgres;
  exception
    when insufficient_privilege then
      null;
    when undefined_object then
      null;
  end;
end $$;

-- Quick check (replace YOURCODE with the Office coupon code):
-- select code, is_active, discount_type, discount_value from public.discount_coupons order by created_at desc;
-- select public.validate_discount_coupon('YOURCODE', 500, null);

notify pgrst, 'reload schema';
