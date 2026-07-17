# Storefront product sizes

## Diffusers = 200ml only

When `collection_code` is `diffuser` (or `product_category` / `category` contains “diffuser”):

- Show **only** a **200ml** size option on the PDP
- Do **not** show 50ml, 30ml, or 100ml
- Prefer `products.price_200ml`, then `base_price` / `price`
- Use `default_size = '200ml'`

Office Content → Fragrance products → Pricing enforces this when the fragrance line is Diffuser.

### Suggested storefront helper

```ts
function isDiffuser(product: { collection_code?: string | null; category?: string | null }) {
  const code = (product.collection_code || "").toLowerCase();
  if (code === "diffuser" || code === "diffusers") return true;
  return (product.category || "").toLowerCase().includes("diffuser");
}

function sizeOptions(product: {
  collection_code?: string | null;
  category?: string | null;
  price_30ml?: number | null;
  price_50ml?: number | null;
  price_100ml?: number | null;
  price_200ml?: number | null;
  base_price?: number | null;
  price?: number | null;
}) {
  if (isDiffuser(product)) {
    const price = product.price_200ml ?? product.base_price ?? product.price;
    return price != null ? [{ label: "200ml", price: Number(price) }] : [];
  }
  return [
    product.price_30ml != null && { label: "30ml", price: Number(product.price_30ml) },
    product.price_50ml != null && { label: "50ml", price: Number(product.price_50ml) },
    product.price_100ml != null && { label: "100ml", price: Number(product.price_100ml) },
  ].filter(Boolean);
}
```

### DB migration (once)

Run `docs/SUPABASE_PRODUCTS_DIFFUSER_200ML.sql` — adds `price_200ml` and clears perfume sizes on diffuser rows.
