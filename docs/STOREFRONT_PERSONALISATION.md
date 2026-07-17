# Storefront `/personalisation` — settings, fonts & preview images

Office **Content → Personalisation** uploads blank bottle photos and saves paths in Supabase. The **main app** must read `personalisation_settings` + `personalisation_fonts` and resolve preview images from the **`hero-assets`** bucket.

---

## Upload bottle previews (Office — no manual SQL)

1. Open **Office → Content → Personalisation page**
2. For each category (**Men's**, **Women's**, **Unisex**, **Diffuser**), click **Upload … bottle**
3. Each upload saves to `hero-assets` and writes the path to `personalisation_settings` automatically
4. Confirm each row shows **Saved** (not “Missing — SVG fallback”)
5. Click **Save personalisation settings** only if you also changed fee, label position, or fonts

Paths stored look like:

```
personalisation/mens/1739123456789-bottle.jpg
```

### Manual SQL (optional — only if not using Office uploads)

```sql
update public.personalisation_settings
set
  preview_image_mens = 'personalisation/mens/your-file.jpg',
  preview_image_womens = 'personalisation/womens/your-file.jpg',
  preview_image_unisex = 'personalisation/unisex/your-file.jpg',
  preview_image_diffuser = 'personalisation/diffuser/your-file.jpg',
  updated_at = now()
where code = 'default';
```

Until those paths are set, the main app `/personalisation` page falls back to local SVG bottle mockups.

---

## Quick reference

| What | Where |
|------|--------|
| Settings table | `public.personalisation_settings` (`code = 'default'`) |
| Fonts table | `public.personalisation_fonts` |
| Storage bucket | **`hero-assets`** |
| Stored path format | `personalisation/{category}/{timestamp}-{filename}` |
| Category codes (step 1) | `mens`, `womens`, `unisex`, `diffuser` |

---

## Preview image columns (per category)

After the shopper picks a category on step 1, use **one** of these columns:

| Step-1 category | `personalisation_settings` column |
|-----------------|-----------------------------------|
| Men's | `preview_image_mens` |
| Women's | `preview_image_womens` |
| Unisex | `preview_image_unisex` |
| Diffuser | `preview_image_diffuser` |

**Label position (per category)** — each bottle shape has its own overlay:

| Category | Top % | Left % | Width % |
|----------|-------|--------|---------|
| Men's | `label_top_pct_mens` | `label_left_pct_mens` | `label_width_pct_mens` |
| Women's | `label_top_pct_womens` | `label_left_pct_womens` | `label_width_pct_womens` |
| Unisex | `label_top_pct_unisex` | `label_left_pct_unisex` | `label_width_pct_unisex` |
| Diffuser | `label_top_pct_diffuser` | `label_left_pct_diffuser` | `label_width_pct_diffuser` |

Fallback if a per-category column is null: legacy `label_top_pct`, `label_left_pct`, `label_width_pct`.

### Label name font size (keep text inside the bottle)

As the shopper types a longer name, **shrink the font** so it never extends past the label width box (`label_width_pct_*`).

Office preview uses:

1. Character estimate: `size = clamp(8, max * ideal / length, max)` — perfume `max≈22`, `ideal≈9`; **Diffuser** uses tighter `max≈18`, `ideal≈7` because jars are narrower
2. Then measure-to-fit: reduce `font-size` until `scrollWidth <=` the label box width (`white-space: nowrap`). Character estimate is always applied as a ceiling so Diffuser cannot stay oversized when the width % box is too wide.

Shared helpers (copy or mirror in the main app): `personalisationLabelFontSizePx`, `fitLabelFontSizeToContainer` in `src/lib/utils/personalisation.ts`.

Run `docs/SUPABASE_PERSONALISATION_LABEL_POSITIONS.sql` once to add these columns on existing databases.

**Fallback** if the category column is empty: `preview_image_url` (legacy single image).

Values are **relative storage paths**, not full URLs, e.g.:

```
personalisation/mens/1739123456789-bottle.jpg
```

---

## Image URL (main app)

### Full public URL (original file)

```
{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hero-assets/{path}
```

Example:

```
https://clpanszayisgviyyuvwa.supabase.co/storage/v1/object/public/hero-assets/personalisation/mens/1739123456789-bottle.jpg
```

### Optimized mobile URL (recommended)

```
{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/hero-assets/{path}?width=600&quality=80&format=webp
```

Requires **Supabase Image Transformations** (Pro). Fall back to the object URL if transforms are unavailable.

---

## SQL — read settings + fonts

```sql
SELECT
  code,
  fee,
  preview_image_url,
  preview_image_mens,
  preview_image_womens,
  preview_image_unisex,
  preview_image_diffuser,
  label_top_pct,
  label_left_pct,
  label_width_pct,
  label_top_pct_mens,
  label_left_pct_mens,
  label_width_pct_mens,
  label_top_pct_womens,
  label_left_pct_womens,
  label_width_pct_womens,
  label_top_pct_unisex,
  label_left_pct_unisex,
  label_width_pct_unisex,
  label_top_pct_diffuser,
  label_left_pct_diffuser,
  label_width_pct_diffuser,
  placeholder_text,
  max_name_length,
  is_active
FROM public.personalisation_settings
WHERE code = 'default'
  AND is_active = true
LIMIT 1;

SELECT code, label, font_family, sort_order
FROM public.personalisation_fonts
WHERE is_active = true
ORDER BY sort_order ASC, created_at ASC;
```

---

## TypeScript — copy into main app

### 1. Fetch data

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function loadPersonalisation() {
  const [{ data: settings }, { data: fonts }] = await Promise.all([
    supabase
      .from("personalisation_settings")
      .select("*")
      .eq("code", "default")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("personalisation_fonts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return { settings, fonts: fonts ?? [] };
}
```

### 2. Resolve preview image for selected category

```ts
type Category = "mens" | "womens" | "unisex" | "diffuser";

const BUCKET = "hero-assets";

function getPreviewPath(
  settings: {
    preview_image_mens?: string | null;
    preview_image_womens?: string | null;
    preview_image_unisex?: string | null;
    preview_image_diffuser?: string | null;
    preview_image_url?: string | null;
  },
  category: Category,
): string | null {
  const byCategory: Record<Category, string | null | undefined> = {
    mens: settings.preview_image_mens,
    womens: settings.preview_image_womens,
    unisex: settings.preview_image_unisex,
    diffuser: settings.preview_image_diffuser,
  };
  return byCategory[category] ?? settings.preview_image_url ?? null;
}

function personalisationPreviewUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  // Mobile-optimized WebP (fallback to object URL if this 404s)
  return `${base}/storage/v1/render/image/public/${BUCKET}/${encoded}?width=600&quality=80&format=webp`;
}

// Usage on /personalisation after step-1 category pick:
const previewSrc = personalisationPreviewUrl(
  getPreviewPath(settings, selectedCategory),
);
```

### 3. Live label overlay (per category)

Use **category-specific** position fields after step 1. **Do not** apply `text-transform: uppercase`.

```ts
import { getCategoryLabelPosition } from "@/lib/utils/personalisation";

const labelPos = getCategoryLabelPosition(settings, selectedCategory);
// labelPos.topPct, labelPos.leftPct, labelPos.widthPct
```

```tsx
<img src={previewSrc} alt="Your bottle" className="h-full w-full object-cover" />

<div
  style={{
    position: "absolute",
    top: `${labelPos.topPct}%`,
    left: `${labelPos.leftPct}%`,
    width: `${labelPos.widthPct}%`,
    transform: "translate(-50%, -50%)",
    fontFamily: selectedFont.font_family,
  }}
>
  {customerName || settings.placeholder_text}
</div>
```

---

## Office reference modules (this repo)

If you symlink or copy code from **dumiOffice-main**:

| File | Purpose |
|------|---------|
| `src/lib/api/storefront/personalisation.ts` | Storefront read API |
| `src/lib/utils/personalisation.ts` | Category → path → URL helpers |
| `src/lib/utils/storage-image.ts` | Supabase transform URLs |

```ts
import { storefrontPersonalisationApi } from "@/lib/api/storefront/personalisation";

const settings = await storefrontPersonalisationApi.getSettings();
const fonts = await storefrontPersonalisationApi.listFonts();
const previewUrl = storefrontPersonalisationApi.getPreviewImageUrl(settings, "mens");
const labelPos = storefrontPersonalisationApi.getLabelPosition(settings, "mens");
```

---

## Common mistakes

1. **Wrong bucket** — previews are in `hero-assets`, not `product_assets`.
2. **Wrong field** — use `preview_image_mens` etc., not the hero slide `background_image_url`.
3. **Category code mismatch** — must be exactly `mens` | `womens` | `unisex` | `diffuser` (same as Office upload folders).
4. **Forgetting to upload in Office** — use Content → Personalisation uploads (paths save automatically).
5. **Using path as full URL** — prepend Supabase storage base unless the value already starts with `https://`.

---

## Related

- SQL setup: `docs/SUPABASE_PERSONALISATION_REPAIR.sql`
- Homepage card → `/personalisation`: `docs/STOREFRONT_HERO_AND_BESTSELLERS.md` (slide `put-your-name-on-it`)
