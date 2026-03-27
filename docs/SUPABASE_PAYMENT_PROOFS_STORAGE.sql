-- Supabase Storage setup for Proof of Payment files (bucket: payment_proofs)
-- Run in Supabase SQL Editor.
--
-- Canonical file path:
--   payment_proofs/clients/<store_client_id>/<filename>
--
-- This enables:
-- - Office app (authenticated users) to read/list/view PoP files
-- - Authenticated users to upload/update/delete PoP files in this bucket

insert into storage.buckets (id, name, public)
values ('payment_proofs', 'payment_proofs', false)
on conflict (id) do nothing;

-- Read/list for Office users
drop policy if exists "Authenticated read payment_proofs" on storage.objects;
create policy "Authenticated read payment_proofs"
on storage.objects
for select
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Upload for authenticated users
drop policy if exists "Authenticated insert payment_proofs" on storage.objects;
create policy "Authenticated insert payment_proofs"
on storage.objects
for insert
with check (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Optional: allow replace/update
drop policy if exists "Authenticated update payment_proofs" on storage.objects;
create policy "Authenticated update payment_proofs"
on storage.objects
for update
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);

-- Optional: allow delete
drop policy if exists "Authenticated delete payment_proofs" on storage.objects;
create policy "Authenticated delete payment_proofs"
on storage.objects
for delete
using (
  bucket_id = 'payment_proofs'
  and auth.role() = 'authenticated'
);
