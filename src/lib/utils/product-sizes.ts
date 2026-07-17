import type { Product } from "@/types/database";

export type ProductSizeOption = {
  key: string;
  label: string;
  price: number;
};

function normalizeLine(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Diffuser line — sold as 200ml only (never 50ml / 30ml / 100ml). */
export function isDiffuserProduct(
  product: Pick<Product, "collection_code" | "category" | "product_category"> | {
    collectionCode?: string;
    category?: string;
    product_category?: string;
  },
): boolean {
  const collection =
    "collection_code" in product
      ? product.collection_code
      : (product as { collectionCode?: string }).collectionCode;
  const category =
    ("category" in product ? product.category : undefined) ??
    ("product_category" in product ? product.product_category : undefined);

  const line = normalizeLine(collection);
  if (line === "diffuser" || line === "diffusers") return true;

  const cat = String(category ?? "").toLowerCase();
  return cat.includes("diffuser");
}

export function defaultSizeForProduct(
  product: Pick<
    Product,
    "collection_code" | "category" | "product_category" | "default_size"
  >,
): string {
  if (isDiffuserProduct(product)) return "200ml";
  return product.default_size?.trim() || "50ml";
}

/**
 * Size cards for PDP. Diffusers: only 200ml.
 * Perfume lines: 30 / 50 / 100 when priced.
 */
export function productSizeOptions(
  product: Pick<
    Product,
    | "collection_code"
    | "category"
    | "product_category"
    | "price_30ml"
    | "price_50ml"
    | "price_100ml"
    | "price_200ml"
    | "base_price"
    | "price"
    | "default_size"
  >,
): ProductSizeOption[] {
  if (isDiffuserProduct(product)) {
    const price =
      product.price_200ml ??
      product.base_price ??
      product.price ??
      product.price_50ml ??
      null;
    if (price == null || !Number.isFinite(Number(price))) return [];
    return [{ key: "200ml", label: "200ml", price: Number(price) }];
  }

  return [
    product.price_30ml != null && {
      key: "30ml",
      label: "30ml",
      price: Number(product.price_30ml),
    },
    product.price_50ml != null && {
      key: "50ml",
      label: "50ml",
      price: Number(product.price_50ml),
    },
    product.price_100ml != null && {
      key: "100ml",
      label: "100ml",
      price: Number(product.price_100ml),
    },
  ].filter(Boolean) as ProductSizeOption[];
}

export function displayPriceForProduct(
  product: Pick<
    Product,
    | "collection_code"
    | "category"
    | "product_category"
    | "price_30ml"
    | "price_50ml"
    | "price_100ml"
    | "price_200ml"
    | "base_price"
    | "price"
  >,
): number {
  const sizes = productSizeOptions(product);
  if (sizes.length) return sizes[0].price;
  return Number(product.base_price ?? product.price ?? 0) || 0;
}
