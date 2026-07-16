# Supabase Storage Buckets (new project)

Use these **exact** bucket IDs — the Office app hard-codes them. Names are case-sensitive.

After creating a new Supabase project:

1. Apply schema: run root `supabase-all-in-one.sql` in **SQL Editor** (or create buckets below first, then run SQL).
2. Confirm all four buckets exist under **Storage**.
3. Point the app at the new project (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
4. Enable **Image Transformations** on the project if you want CDN resize/WebP on display (optional; uploads are already compressed client-side).

---

## Buckets to create

| Bucket ID (exact name) | Public? | Used for | Typical object paths |
|------------------------|---------|----------|----------------------|
| `product_assets` | **Yes** | Product primary + gallery images | `products/{ts}-{name}.webp`, `products/gallery/...` |
| `hero-assets` | **Yes** | Home hero, collections, bundles, personalisation, front popup | `home-hero/images/...`, `collections/{code}-hero.webp`, `bundle-specials/{code}.webp`, `personalisation/{category}/...`, `front-popup/images/...`, `home-hero/docs/...` (PDFs) |
| `payment_proofs` | **No** | Proof-of-payment files (Office signed URLs) | `clients/<store_client_id>/<filename>` |
| `accounting-files` | **No** | Expense / accounting attachments | `transactions/<transaction_id>/{ts}-{name}` |

### Create in Dashboard (manual)

**Storage → New bucket** for each row:

| Name | Public bucket | File size limit (suggested) | Allowed MIME (suggested) |
|------|---------------|-----------------------------|--------------------------|
| `product_assets` | On | 5 MB | `image/*` |
| `hero-assets` | On | 10 MB | `image/*`, `application/pdf`, `video/*` (if you upload hero video) |
| `payment_proofs` | Off | 10 MB | `image/*`, `application/pdf` |
| `accounting-files` | Off | 10 MB | `image/*`, `application/pdf` |

Policies are created by `supabase-all-in-one.sql` (storage section). If you create buckets only in the UI, still run that SQL so policies exist.

### Or create via SQL only

The all-in-one script inserts:

- `product_assets` (public)
- `hero-assets` (public)
- `payment_proofs` (private)
- `accounting-files` (private)

plus read/write policies (public read on public buckets; authenticated CRUD on all four).

---

## Path conventions (do not rename folders casually)

Storefront and Office resolve paths relative to these prefixes:

```
product_assets/
  products/
  products/gallery/

hero-assets/
  home-hero/images/
  home-hero/docs/
  collections/
  bundle-specials/
  personalisation/{mens|womens|unisex|diffuser}/
  front-popup/images/

payment_proofs/
  clients/<store_client_id>/

accounting-files/
  transactions/<transaction_id>/
```

---

## Migrating files from an old project

1. In the old project: Storage → each bucket → download objects (or use Supabase CLI / a sync script).
2. Upload into the **same bucket ID + same object path** on the new project so DB URLs/paths keep working.
3. If DB rows store full public URLs (`https://<old-ref>.supabase.co/storage/...`), either:
   - rewrite those rows to the new project URL, or
   - prefer storing **relative paths** only (Office already does this for most hero/product uploads; popups sometimes store full URLs).

---

## App env vars

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
# Optional: set to false to disable CDN image transforms on display
# VITE_SUPABASE_IMAGE_TRANSFORMS=false
```

---

## Image size / egress notes

- **Upload:** Office compresses images to WebP (JPEG fallback) before upload — smaller objects in Storage.
- **Download/egress:** Prefer `OptimizedImage` / transform URLs (`/storage/v1/render/image/...`) so clients pull resized WebP, not the full object, when transforms are enabled.
