import type { Product, ProductCategory } from "@/types/database";

export const PRODUCT_CATEGORY_OPTIONS: ProductCategory[] = [
  "Perfume",
  "Diffuser",
  "Car Perfume",
  "Shower Gel",
  "Body Lotion",
  "Body Oil",
];

export type ContentProductGroupKey =
  | "mens"
  | "womens"
  | "unisex"
  | "diffusers"
  | "carPerfume"
  | "showerGel"
  | "bodyLotion"
  | "bodyOil"
  | "other";

export const CONTENT_PRODUCT_SECTIONS: {
  id: string;
  label: string;
  key: ContentProductGroupKey;
}[] = [
  { id: "mens", label: "Mens line", key: "mens" },
  { id: "womens", label: "Womens line", key: "womens" },
  { id: "unisex", label: "Unisex line", key: "unisex" },
  { id: "diffusers", label: "Diffuser line", key: "diffusers" },
  { id: "carPerfume", label: "Car Perfume line", key: "carPerfume" },
  { id: "showerGel", label: "Shower Gel line", key: "showerGel" },
  { id: "bodyLotion", label: "Body Lotion line", key: "bodyLotion" },
  { id: "bodyOil", label: "Body Oil line", key: "bodyOil" },
  { id: "other", label: "Other products", key: "other" },
];

export type StorefrontCollectionPreset = {
  code: string;
  name: string;
  tagline: string;
};

export const STOREFRONT_COLLECTION_PRESETS: StorefrontCollectionPreset[] = [
  {
    code: "mens",
    name: "Men's Line",
    tagline: "Structured signatures with warmth, woods, and presence.",
  },
  {
    code: "womens",
    name: "Women's Line",
    tagline: "Polished florals and luminous amber compositions.",
  },
  {
    code: "unisex",
    name: "Unisex Line",
    tagline: "Modern, versatile luxury for everyday wear.",
  },
  {
    code: "diffuser",
    name: "Diffuser",
    tagline: "Elevated spaces",
  },
  {
    code: "car-perfumes",
    name: "Car Perfumes",
    tagline: "Refined drive",
  },
  {
    code: "cosmetics",
    name: "Cosmetics",
    tagline: "Beauty essentials",
  },
];

function normalizeLineRaw(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export function groupContentProducts(
  products: Product[],
): Record<ContentProductGroupKey, Product[]> {
  const groups = Object.fromEntries(
    CONTENT_PRODUCT_SECTIONS.map((section) => [section.key, [] as Product[]]),
  ) as Record<ContentProductGroupKey, Product[]>;

  products.forEach((p) => {
    switch (p.product_category) {
      case "Diffuser":
        groups.diffusers.push(p);
        return;
      case "Car Perfume":
        groups.carPerfume.push(p);
        return;
      case "Shower Gel":
        groups.showerGel.push(p);
        return;
      case "Body Lotion":
        groups.bodyLotion.push(p);
        return;
      case "Body Oil":
        groups.bodyOil.push(p);
        return;
      default:
        break;
    }

    const raw =
      (p.collection_code ??
        (p.category as string | undefined) ??
        (p.product_category as string | undefined) ??
        "") || "";
    const norm = normalizeLineRaw(raw);

    if (norm.startsWith("men")) {
      groups.mens.push(p);
    } else if (norm.startsWith("women")) {
      groups.womens.push(p);
    } else if (norm.includes("unisex")) {
      groups.unisex.push(p);
    } else {
      groups.other.push(p);
    }
  });

  return groups;
}

export function defaultCollectionCodeForCategory(
  category: ProductCategory,
): string | undefined {
  switch (category) {
    case "Diffuser":
      return "diffuser";
    case "Car Perfume":
      return "car-perfumes";
    case "Shower Gel":
    case "Body Lotion":
    case "Body Oil":
      return "cosmetics";
    default:
      return undefined;
  }
}

/** Store relative hero-assets path when possible; keeps full URLs as-is. */
export function normalizeCollectionHeroForStorage(url: string | undefined | null): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  const objectMatch = trimmed.match(/\/storage\/v1\/object\/public\/hero-assets\/(.+)$/i);
  if (objectMatch) return decodeURIComponent(objectMatch[1]);

  const renderMatch = trimmed.match(/\/storage\/v1\/render\/image\/public\/hero-assets\/(.+?)(?:\?|$)/i);
  if (renderMatch) return decodeURIComponent(renderMatch[1]);

  return trimmed.replace(/^hero-assets\//i, "");
}
