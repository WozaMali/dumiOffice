# Storefront hero slides & home bestsellers

The Office **Content** page (`/content`) controls the storefront homepage hero carousel and the home bestseller strip via Supabase. The main app should read these tables directly — no hardcoded copy.

---

## Put Your Name On It (personalisation card)

This card is a **hero slide** row in `home_hero_slides`, not a separate table.

### How the storefront matches the row

| Card element (UI) | Table column | Default value (Office preset) |
|-------------------|--------------|-------------------------------|
| Small label (“PERSONALISATION”) | `kicker` | `Personalisation` |
| Title on card / overlay | `headline` | `Put Your Name On It` |
| Description under title | `subheadline` | `Make it yours with a name on the label.` |
| Hero background image | `background_image_url` | Set in Office Content editor |
| Mobile hero background | `background_image_url_mobile` | Portrait 1080×1920 (9:16) for phones |
| Gallery images | `gallery_image_urls` | Optional array |
| CTA button label | `primary_cta_label` | `Request personalisation` |
| CTA link | `primary_cta_href` | `/account` |
| Active badge | `is_active` | `true` |
| Display order | `sort_order` | `910` |
| Stable lookup key | `code` | **`put-your-name-on-it`** |

Office seeds this row automatically on first visit to Content if it does not exist (`src/pages/Content.tsx` → `HERO_PRESETS`).

### SQL — read this card (main app)

```sql
SELECT
  id,
  code,
  kicker,
  headline,
  subheadline,
  body,
  primary_cta_label,
  primary_cta_href,
  secondary_cta_label,
  secondary_cta_href,
  background_image_url,
  background_image_url_mobile,
  background_video_url,
  gallery_image_urls,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM public.home_hero_slides
WHERE code = 'put-your-name-on-it'
  AND is_active = true
LIMIT 1;
```

### SQL — seed / upsert (Supabase SQL editor)

```sql
INSERT INTO public.home_hero_slides (
  code,
  kicker,
  headline,
  subheadline,
  primary_cta_label,
  primary_cta_href,
  is_active,
  sort_order
)
VALUES (
  'put-your-name-on-it',
  'Personalisation',
  'Put Your Name On It',
  'Make it yours with a name on the label.',
  'Request personalisation',
  '/personalisation',
  true,
  910
)
ON CONFLICT (code) DO UPDATE SET
  kicker = EXCLUDED.kicker,
  headline = EXCLUDED.headline,
  subheadline = EXCLUDED.subheadline,
  primary_cta_label = EXCLUDED.primary_cta_label,
  primary_cta_href = EXCLUDED.primary_cta_href,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
```

### Image URL resolution

If `background_image_url` is a storage path (not `https://...`), resolve it as:

```
{VITE_SUPABASE_URL}/storage/v1/object/public/hero-assets/{background_image_url}
```

If it is already a full URL, use it as-is.

**Live bottle previews on `/personalisation`** (per category) come from a different table — see **`docs/STOREFRONT_PERSONALISATION.md`** (`personalisation_settings` + `hero-assets/personalisation/{category}/...`).

### Main app example (TypeScript)

```ts
const { data: slide } = await supabase
  .from("home_hero_slides")
  .select("*")
  .eq("code", "put-your-name-on-it")
  .eq("is_active", true)
  .maybeSingle();

const imageUrl = slide?.background_image_url?.startsWith("http")
  ? slide.background_image_url
  : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/hero-assets/${slide?.background_image_url}`;
```

---

## Fresh In Store (new arrivals card)

Same table and pattern as above.

| Card element | Column | Default |
|--------------|--------|---------|
| Small label | `kicker` | `New Arrivals` |
| Title | `headline` | `Fresh In Store` |
| Description | `subheadline` | `Just landed — the newest additions to the house.` |
| CTA label | `primary_cta_label` | `Shop new arrivals` |
| CTA link | `primary_cta_href` | `/shop/mens` |
| Lookup key | `code` | **`fresh-in-store`** |
| Sort | `sort_order` | `900` |

```sql
SELECT *
FROM public.home_hero_slides
WHERE code = 'fresh-in-store'
  AND is_active = true
LIMIT 1;
```

```sql
INSERT INTO public.home_hero_slides (
  code, kicker, headline, subheadline,
  primary_cta_label, primary_cta_href,
  is_active, sort_order
)
VALUES (
  'fresh-in-store',
  'New Arrivals',
  'Fresh In Store',
  'Just landed — the newest additions to the house.',
  'Shop new arrivals',
  '/shop/mens',
  true,
  900
)
ON CONFLICT (code) DO UPDATE SET
  kicker = EXCLUDED.kicker,
  headline = EXCLUDED.headline,
  subheadline = EXCLUDED.subheadline,
  primary_cta_label = EXCLUDED.primary_cta_label,
  primary_cta_href = EXCLUDED.primary_cta_href,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
```

---

## All hero slides (homepage carousel)

**Table:** `home_hero_slides`

Office loads all slides ordered by `sort_order`. The main app should show **every active slide** in that order (not only the first).

### Logic

1. `WHERE is_active = true`
2. `ORDER BY sort_order ASC, created_at ASC`
3. Map fields to UI (kicker, headline, subheadline, CTAs, images)
4. Resolve `background_image_url` from `hero-assets` bucket when needed

### Desktop carousel image sizes (home carousel only)

Applies only to **Home — Hero carousel** slides (`home-main`, `home-hero-*`, or `sort_order` &lt; 900). Content cards, gift guide, and other hero rows use standard 16:9 assets (2400×1350 or 1920×1080).

The home hero carousel renders at **1440 × 614** px.

| Field | Size | Aspect | Notes |
|-------|------|--------|-------|
| `background_image_url` | **2880 × 1228** px (recommended) or **1440 × 614** px (minimum) | ~2.35:1 | Desktop / tablet landscape carousel crop |
| `background_image_url_mobile` | **1080 × 1920** px | 9:16 | Full-screen portrait hero on phones |

Keep the main subject in the center 60% — edges get cropped on different screen sizes.

### SQL

```sql
SELECT *
FROM public.home_hero_slides
WHERE is_active = true
ORDER BY sort_order ASC, created_at ASC;
```

### Office API reference

- List: `src/lib/api/homeHero.ts` → `homeHeroApi.list()`
- Upsert: `upsertByCode({ code, ... })` on conflict `code`
- Types: `src/types/database.ts` → `HomeHeroSlide`

### Inferred schema

```sql
CREATE TABLE IF NOT EXISTS public.home_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kicker text,
  headline text NOT NULL,
  subheadline text,
  body text,
  primary_cta_label text,
  primary_cta_href text,
  secondary_cta_label text,
  secondary_cta_href text,
  collection_code text,
  product_id uuid REFERENCES public.products(id),
  background_image_url text,
  background_video_url text,
  gallery_image_urls text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Home bestsellers

**Table:** `home_bestsellers` (join to `products`)

Curated slots for the home page bestseller strip. Separate from `products.is_bestseller` (badge on product cards).

### Logic

1. Read active slots from `home_bestsellers`
2. Join `products` on `product_id`
3. Only show products where `products.is_active = true`
4. Sort by `sort_order ASC, created_at ASC`

When Office marks a product “Mark as bestseller” in Content, it upserts a `home_bestsellers` row; unmarking deletes it (`src/pages/Content.tsx`).

### SQL

```sql
SELECT
  hb.id AS bestseller_id,
  hb.badge_label,
  hb.sort_order,
  hb.is_active,
  p.*
FROM public.home_bestsellers hb
INNER JOIN public.products p ON p.id = hb.product_id
WHERE hb.is_active = true
  AND p.is_active = true
ORDER BY hb.sort_order ASC, hb.created_at ASC;
```

### Inferred schema

```sql
CREATE TABLE IF NOT EXISTS public.home_bestsellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  badge_label text DEFAULT 'Bestseller',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Office API reference

- `src/lib/api/homeBestsellers.ts` → `homeBestsellersApi.list()` / `upsert()` / `delete()`
- Types: `src/types/database.ts` → `HomeBestseller`

---

## RLS (storefront public read)

`home_hero_slides` and `home_bestsellers` should allow **anon SELECT** for the storefront. See `docs/SUPABASE_SECURITY_LOCKDOWN_BASELINE.sql`.

---

## Storage buckets

| Bucket | Used for |
|--------|----------|
| `hero-assets` | Hero slide images (`home-hero/images/...`) |
| `product_assets` | Product primary images (bestseller product cards) |

---

## Quick reference — hero slide codes

| `code` | Card |
|--------|------|
| `fresh-in-store` | Fresh In Store / New Arrivals |
| `put-your-name-on-it` | Put Your Name On It / Personalisation |
| *(any other `code`)* | Custom slides added in Office Content |

The main app should treat **`code` as the stable identifier** — same pattern as `collections.code` in `docs/STOREFRONT_COLLECTIONS.md`.
