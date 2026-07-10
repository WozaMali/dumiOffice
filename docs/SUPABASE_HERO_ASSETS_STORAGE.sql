-- hero-assets bucket for Office uploads (hero slides, collections, bundles, personalisation).
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Fixes Office upload 400s for paths like bundles/mens-trio.png when policies were missing.

insert into storage.buckets (id, name, public)
values ('hero-assets', 'hero-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read (storefront + Office previews)
drop policy if exists "Public read hero-assets" on storage.objects;
create policy "Public read hero-assets"
on storage.objects
for select
using (bucket_id = 'hero-assets');

-- Authenticated Office uploads
drop policy if exists "Authenticated insert hero-assets" on storage.objects;
create policy "Authenticated insert hero-assets"
on storage.objects
for insert
with check (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated update hero-assets" on storage.objects;
create policy "Authenticated update hero-assets"
on storage.objects
for update
using (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated delete hero-assets" on storage.objects;
create policy "Authenticated delete hero-assets"
on storage.objects
for delete
using (
  bucket_id = 'hero-assets'
  and auth.role() = 'authenticated'
);

notify pgrst, 'reload schema';
