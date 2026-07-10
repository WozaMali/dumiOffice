-- Run when personalisation tables exist in Table Editor but Office shows PGRST205.
-- Run ALL statements below, then wait 15 seconds and hard-refresh Office Content.

-- 1) Confirm tables exist in this project (should return 2 rows)
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('personalisation_settings', 'personalisation_fonts');

-- 2) Ensure API roles can access them
grant usage on schema public to anon, authenticated, service_role;
grant select on public.personalisation_settings to anon, authenticated;
grant select, insert, update, delete on public.personalisation_settings to authenticated;
grant select on public.personalisation_fonts to anon, authenticated;
grant select, insert, update, delete on public.personalisation_fonts to authenticated;

-- 3) Bump table metadata (helps PostgREST notice DDL)
comment on table public.personalisation_settings is 'storefront personalisation settings';
comment on table public.personalisation_fonts is 'storefront personalisation fonts';

-- 4) Force PostgREST schema reload
notify pgrst, 'reload tables';
notify pgrst, 'reload schema';
select pg_notification_queue_usage();

-- 5) Confirm row counts (should be settings_count = 1, fonts_count = 3)
select
  (select count(*) from public.personalisation_settings) as settings_count,
  (select count(*) from public.personalisation_fonts where is_active = true) as fonts_count;

-- If Office STILL shows "schema cache" after 15s:
-- Supabase Dashboard → Project Settings → General → Restart project
-- Then hard-refresh Office Content (Ctrl+Shift+R).
