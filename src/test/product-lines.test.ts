import { describe, expect, it } from "vitest";
import {
  groupContentProducts,
  normalizeCollectionHeroForStorage,
} from "@/lib/utils/product-lines";
import type { Product } from "@/types/database";

function product(
  partial: Partial<Product> & Pick<Product, "id" | "product_name" | "product_category">,
): Product {
  return {
    sku: "SKU",
    price: 0,
    stock_on_hand: 0,
    stock_threshold: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...partial,
  } as Product;
}

describe("product-lines", () => {
  it("groups cosmetics and car lines by product_category", () => {
    const grouped = groupContentProducts([
      product({ id: "1", product_name: "Car", product_category: "Car Perfume" }),
      product({ id: "2", product_name: "Gel", product_category: "Shower Gel" }),
      product({ id: "3", product_name: "Oil", product_category: "Body Oil" }),
    ]);

    expect(grouped.carPerfume).toHaveLength(1);
    expect(grouped.showerGel).toHaveLength(1);
    expect(grouped.bodyOil).toHaveLength(1);
  });

  it("normalizes full hero-assets URLs to relative paths", () => {
    expect(
      normalizeCollectionHeroForStorage(
        "https://example.supabase.co/storage/v1/object/public/hero-assets/home-hero/images/a.jpg",
      ),
    ).toBe("home-hero/images/a.jpg");
  });
});
