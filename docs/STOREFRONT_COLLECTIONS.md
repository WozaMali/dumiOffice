# Storefront collections (Shop the House cards)

The **Shop** page shows category cards (“Men's Line”, “Car Perfume”, “Cosmetics”, etc.). Office controls each card via the `collections` table.

**Run first:** `docs/SUPABASE_STOREFRONT_COLLECTIONS.sql` in Supabase SQL Editor.  
**Missing diffuser / car-perfumes / cosmetics rows?** Run `docs/SUPABASE_COLLECTIONS_SEED.sql`.

---

## Main app behaviour (`useFeaturedCollections`)

When Supabase is connected, shop card images come **only from Office** (`collections.image` / `hero_image_url`) — no bundled fallback. Diffuser, Car Perfumes, and Cosmetics behave like Men's / Women's / Unisex: Office image when set, dark placeholder when not.

Office saves both `hero_image_url` and `image` on upload/save so the storefront hook can read `remote?.image`.

---

## Why images might not show on the main app

1. **Wrong column** — use `hero_image_url`, not legacy `image_url`.
2. **Wrong `code`** — storefront matches `collections.code` exactly (e.g. `diffuser`, not `diffusers`).
3. **URL format** — value can be either:
   - **Recommended:** relative path under `hero-assets`: `collections/mens-hero.jpg`
   - Legacy: `home-hero/images/your-file.jpg`
   - Full public URL: `https://<project>.supabase.co/storage/v1/object/public/hero-assets/collections/mens-hero.jpg`
4. **Bucket must be public** — `hero-assets` bucket needs public read for anon.
5. **Spaces in filenames** — use `collections/mens-hero.jpg` style names; Office upload saves as `collections/{code}-hero.jpg`.

---

## Office: set images

1. **Content → Storefront collections → Edit → Upload image**  
   Saves to `hero-assets` as `collections/{code}-hero.jpg` (or `.png`), then click **Save collection**.

2. **Or** upload in Supabase Storage (`hero-assets` → `collections/`) and run:

```sql
update public.collections
set hero_image_url = 'collections/mens-hero.jpg', updated_at = now()
where code = 'mens';

update public.collections
set hero_image_url = 'collections/womens-hero.jpg', updated_at = now()
where code = 'womens';

update public.collections
set hero_image_url = 'collections/unisex-hero.jpg', updated_at = now()
where code = 'unisex';

update public.collections
set hero_image_url = 'collections/diffuser-hero.jpg', updated_at = now()
where code = 'diffuser';

update public.collections
set hero_image_url = 'collections/car-perfumes-hero.jpg', updated_at = now()
where code = 'car-perfumes';

update public.collections
set hero_image_url = 'collections/cosmetics-hero.jpg', updated_at = now()
where code = 'cosmetics';
```

---

## Collection codes (exact match)

| Shop card        | `collections.code` |
|------------------|--------------------|
| Men's Line       | `mens`             |
| Women's Line     | `womens`           |
| Unisex Line      | `unisex`           |
| Diffusers        | `diffuser`         |
| Car Perfume      | `car-perfumes`     |
| Cosmetics        | `cosmetics`        |

## Columns per card

| UI element     | Column             |
|----------------|--------------------|
| Title          | `name`             |
| Short text     | `tagline` or `description` |
| Background img | `hero_image_url` and `image` (kept in sync by Office) |

Product counts on shop cards come from `products.collection_code` matching the collection `code` (e.g. assign `car-perfumes` or `cosmetics` on inventory products).

---

## Main app — SQL (read all shop cards)

```sql
SELECT
  id,
  code,
  slug,
  name,
  tagline,
  description,
  hero_image_url,
  is_active,
  published_at,
  updated_at
FROM public.collections
WHERE coalesce(is_active, true) = true
  AND code IN (
    'mens', 'womens', 'unisex', 'diffuser',
    'car-perfumes', 'cosmetics'
  )
ORDER BY
  CASE code
    WHEN 'mens' THEN 1
    WHEN 'womens' THEN 2
    WHEN 'unisex' THEN 3
    WHEN 'diffuser' THEN 4
    WHEN 'car-perfumes' THEN 5
    WHEN 'cosmetics' THEN 6
    ELSE 99
  END;
```

## Main app — resolve image URL (TypeScript)

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function collectionCardImageSrc(
  heroImageUrl: string | null | undefined,
): string {
  if (!heroImageUrl?.trim()) return "";

  const value = heroImageUrl.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const path = value.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/hero-assets/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
```

Use `collectionCardImageSrc(row.hero_image_url)` as the card `<img src>`.

## Main app — product lines (inventory categories)

Office inventory categories map to Content → Fragrance products sections:

| `products.product_category` | Content section        | Suggested `collection_code` |
|----------------------------|------------------------|-----------------------------|
| Perfume + mens/womens/unisex | Mens / Womens / Unisex line | `mens`, `womens`, `unisex` |
| Diffuser                   | Diffuser line          | `diffuser`                  |
| Car Perfume                | Car Perfume line       | `car-perfumes`              |
| Shower Gel                 | Shower Gel line        | `cosmetics`                 |
| Body Lotion                | Body Lotion line       | `cosmetics`                 |
| Body Oil                   | Body Oil line          | `cosmetics`                 |

```sql
-- Example: tag a car perfume product for the shop card count
UPDATE public.products
SET
  product_category = 'Car Perfume',
  collection_code = 'car-perfumes',
  updated_at = now()
WHERE sku = 'YOUR-SKU';

-- Example: shower gel under Cosmetics shop card
UPDATE public.products
SET
  product_category = 'Shower Gel',
  collection_code = 'cosmetics',
  updated_at = now()
WHERE sku = 'YOUR-SKU';
```

## Office workflow

1. Run `SUPABASE_STOREFRONT_COLLECTIONS.sql`.
2. **Content → Storefront collections** — upload image per card (saved to `hero-assets`).
3. **Inventory** — add products with category Car Perfume / Shower Gel / Body Lotion / Body Oil.
4. Set `collection_code` on products in Content editor when publishing to storefront.

Images and copy update on the main app after the next fetch — no storefront deploy needed if it already reads `collections`.
