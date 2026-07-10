# Storefront bundle specials (`/specials/:code`)

Pick-and-mix fragrance deals managed in **Office → Content → Bundle specials**.

Examples:
- **mens-trio** — pick any 3 Men's for **R599.99**
- **unisex-trio** — pick any 3 Unisex for **R599.99**
- **womens-trio** — pick any 3 Women's for **R499.99**
- **his-and-hers** — pick 2 Men's + 2 Women's for **R699.99**

---

## Setup (once)

1. Run **`docs/SUPABASE_BUNDLE_SPECIALS.sql`** in Supabase SQL Editor.
2. Run **`docs/SUPABASE_HERO_ASSETS_STORAGE.sql`** so Office can upload bundle images to `hero-assets/bundle-specials/`.

You should see `bundle_count = 4`, `slot_count = 5`.

---

## Tables

| Table | Purpose |
|-------|---------|
| `bundle_specials` | Deal price, headline, hero image, active window |
| `bundle_special_slots` | Tabs + pick rules (which `collection_code`, how many) |

Products are **not** pre-linked. The storefront loads active products where `products.collection_code` matches each slot's `collection_code` (same as `/shop/mens`).

### `hero_image_url` formats

Store in `bundle_specials.hero_image_url` as one of:

| Format | Example |
|--------|---------|
| Relative path (recommended) | `bundle-specials/mens-trio.jpg` |
| With bucket prefix | `hero-assets/bundle-specials/mens-trio.jpg` |
| Full public URL | `https://<project>.supabase.co/storage/v1/object/public/hero-assets/bundle-specials/mens-trio.jpg` |

Office normalizes pasted URLs and legacy `bundles/...` paths to `bundle-specials/...` on save.

```sql
-- Fix legacy Office paths (safe to re-run)
update public.bundle_specials
set
  hero_image_url = replace(
    regexp_replace(hero_image_url, '^hero-assets/', ''),
    'bundles/',
    'bundle-specials/'
  ),
  updated_at = now()
where hero_image_url is not null
  and (
    hero_image_url like 'bundles/%'
    or hero_image_url like 'hero-assets/bundles/%'
    or hero_image_url like 'hero-assets/bundle-specials/%'
  );
```

---

## Storefront page flow (`/specials/:code`)

1. **Load bundle** — `bundle_specials` + nested `bundle_special_slots`
2. **If one slot** — single product grid (like Shop Men's)
3. **If multiple slots** — **tabs** per slot (`tab_label`), e.g. His & Hers → Men's tab + Women's tab
4. **Per tab** — load products: `products` where `collection_code = slot.collection_code` and `is_active = true`
5. **Selection** — shopper picks exactly `pick_count` per slot (track by `slot_code`)
6. **Checkout** — charge `bundle_price` (not sum of individual prices)

### Tab logic (His & Hers example)

| slot_code | tab_label | collection_code | pick_count |
|-----------|-----------|-----------------|------------|
| mens | Men's | mens | 2 |
| womens | Women's | womens | 2 |

Show tabs when `bundle_special_slots.length > 1`.

---

## TypeScript (main app)

```ts
import { storefrontBundleSpecialsApi } from "@/lib/api/storefront/bundleSpecials";
import {
  bundleUsesTabs,
  orderedBundleSlots,
  totalPickCount,
  validateBundleSelections,
} from "@/lib/utils/bundleSpecials";

const bundle = await storefrontBundleSpecialsApi.getByCode("his-and-hers");
const slots = orderedBundleSlots(bundle!);
const showTabs = bundleUsesTabs(bundle!);

const products = await storefrontBundleSpecialsApi.listProductsForSlot(
  slots[0].collection_code,
);

const check = validateBundleSelections(bundle!, {
  mens: [id1, id2],
  womens: [id3, id4],
});
```

Storefront URL: **`/specials/{code}`**

---

## Office workflow

1. Run SQL seed
2. **Content → Bundle specials** — edit prices, copy, hero image, slots
3. Products need **`collection_code`** (`mens`, `womens`, `unisex`) + `is_active` in Inventory/Content

---

## Reference files

| File | Purpose |
|------|---------|
| `docs/SUPABASE_BUNDLE_SPECIALS.sql` | Schema + seed |
| `src/lib/api/storefront/bundleSpecials.ts` | Storefront read API |
| `src/lib/utils/bundleSpecials.ts` | Tabs, validation |
