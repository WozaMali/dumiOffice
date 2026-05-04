# Storefront collections (Shop collection cards)

The **Shop** page (e.g. `http://localhost:8081/shop` or your storefront origin) shows category cards (e.g. “Men's Line”, “Women's Line”, “Unisex Line”, “Diffuser”, “Car Perfumes”). The Office App controls each card’s **title**, **description**, and **image** via the `collections` table.

## How the storefront matches rows

The storefront looks up collection content by **`collections.code`**. For the cards to be editable, the Office App must ensure there is a row per card with one of these **exact** codes:

| Card shown      | `collections.code` |
|-----------------|--------------------|
| Men's Line      | `mens`             |
| Women's Line    | `womens`           |
| Unisex Line     | `unisex`           |
| Diffuser        | `diffuser`         |
| Car Perfumes    | `car-perfumes`    |

## Columns that drive each card

| Card element   | Table         | Column           |
|----------------|---------------|------------------|
| Title          | `collections` | `name`           |
| Short text     | `collections` | `description`    |
| Background img | `collections` | `hero_image_url` |

- **`hero_image_url`**: use a **full public URL** (e.g. Supabase Storage public URL or any CDN). The storefront uses this value as the card image `src` as-is.
- **Product count** (“4 PRODUCTS”, etc.) is computed by the storefront from how many products have that collection; the Office App does not set it.

## Office App: upsert per card

The Office App uses `collectionsApi.upsertByCode()` (see `src/lib/api/collections.ts`). To control a card, upsert a row with the correct `code` and the desired `name`, `description`, and `hero_image_url`:

```ts
// In the codebase this is: collectionsApi.upsertByCode({ code, name, tagline?, description?, hero_image_url? })
async function saveCollectionCard(payload: {
  code: "mens" | "womens" | "unisex" | "diffuser" | "car-perfumes";
  name: string;
  description: string;
  hero_image_url: string | null;
}) {
  const { error } = await supabase
    .from("collections")
    .upsert(payload, { onConflict: "code" });
  if (error) throw error;
}
```

The Office UI for this is **Content → Storefront collections**: edit each card (title, description, image path/URL) and save. The `collections` table is updated with `onConflict: "code"`.

Once the Office App writes these rows, the Shop page will show the updated titles, descriptions, and images for the corresponding cards without any storefront code changes.
