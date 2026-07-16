-- Storage buckets for a new Supabase project (Office + storefront).
-- Prefer running root supabase-all-in-one.sql; this file is the buckets-only extract.
-- Bucket IDs must match exactly (case-sensitive).

-- Public: product images
insert into storage.buckets (id, name, public)
values ('product_assets', 'product_assets', true)
on conflict (id) do update set public = excluded.public;

-- Public: heroes, collections, bundles, personalisation, popups, hero PDFs
insert into storage.buckets (id, name, public)
values ('hero-assets', 'hero-assets', true)
on conflict (id) do update set public = excluded.public;

-- Private: proof of payment
insert into storage.buckets (id, name, public)
values ('payment_proofs', 'payment_proofs', false)
on conflict (id) do update set public = excluded.public;

-- Private: accounting / expense attachments
insert into storage.buckets (id, name, public)
values ('accounting-files', 'accounting-files', false)
on conflict (id) do update set public = excluded.public;

-- --- product_assets policies ---
drop policy if exists "Public read product_assets" on storage.objects;
create policy "Public read product_assets"
on storage.objects for select using (bucket_id = 'product_assets');

drop policy if exists "Authenticated insert product_assets" on storage.objects;
create policy "Authenticated insert product_assets"
on storage.objects for insert
with check (bucket_id = 'product_assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update product_assets" on storage.objects;
create policy "Authenticated update product_assets"
on storage.objects for update
using (bucket_id = 'product_assets' and auth.role() = 'authenticated')
with check (bucket_id = 'product_assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete product_assets" on storage.objects;
create policy "Authenticated delete product_assets"
on storage.objects for delete
using (bucket_id = 'product_assets' and auth.role() = 'authenticated');

-- --- hero-assets policies ---
drop policy if exists "Public read hero-assets" on storage.objects;
create policy "Public read hero-assets"
on storage.objects for select using (bucket_id = 'hero-assets');

drop policy if exists "Authenticated insert hero-assets" on storage.objects;
create policy "Authenticated insert hero-assets"
on storage.objects for insert
with check (bucket_id = 'hero-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update hero-assets" on storage.objects;
create policy "Authenticated update hero-assets"
on storage.objects for update
using (bucket_id = 'hero-assets' and auth.role() = 'authenticated')
with check (bucket_id = 'hero-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete hero-assets" on storage.objects;
create policy "Authenticated delete hero-assets"
on storage.objects for delete
using (bucket_id = 'hero-assets' and auth.role() = 'authenticated');

-- --- payment_proofs policies ---
drop policy if exists "Authenticated read payment_proofs" on storage.objects;
create policy "Authenticated read payment_proofs"
on storage.objects for select
using (bucket_id = 'payment_proofs' and auth.role() = 'authenticated');

drop policy if exists "Authenticated insert payment_proofs" on storage.objects;
create policy "Authenticated insert payment_proofs"
on storage.objects for insert
with check (bucket_id = 'payment_proofs' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update payment_proofs" on storage.objects;
create policy "Authenticated update payment_proofs"
on storage.objects for update
using (bucket_id = 'payment_proofs' and auth.role() = 'authenticated')
with check (bucket_id = 'payment_proofs' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete payment_proofs" on storage.objects;
create policy "Authenticated delete payment_proofs"
on storage.objects for delete
using (bucket_id = 'payment_proofs' and auth.role() = 'authenticated');

-- --- accounting-files policies ---
drop policy if exists "Authenticated read accounting-files" on storage.objects;
create policy "Authenticated read accounting-files"
on storage.objects for select
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated insert accounting-files" on storage.objects;
create policy "Authenticated insert accounting-files"
on storage.objects for insert
with check (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update accounting-files" on storage.objects;
create policy "Authenticated update accounting-files"
on storage.objects for update
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated')
with check (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete accounting-files" on storage.objects;
create policy "Authenticated delete accounting-files"
on storage.objects for delete
using (bucket_id = 'accounting-files' and auth.role() = 'authenticated');

notify pgrst, 'reload schema';
