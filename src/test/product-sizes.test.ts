import { describe, expect, it } from "vitest";
import {
  defaultSizeForProduct,
  isDiffuserProduct,
  productSizeOptions,
} from "@/lib/utils/product-sizes";
import type { Product } from "@/types/database";

const base = {
  id: "1",
  sku: "X",
  product_name: "Black Tea",
  product_category: "Perfume" as const,
  price: 299.99,
  stock_on_hand: 0,
  stock_threshold: 5,
  is_active: true,
  created_at: "",
  updated_at: "",
} as Product;

describe("product sizes", () => {
  it("treats diffuser collection as diffuser", () => {
    expect(
      isDiffuserProduct({ ...base, collection_code: "diffuser" }),
    ).toBe(true);
  });

  it("only offers 200ml for diffusers", () => {
    const options = productSizeOptions({
      ...base,
      collection_code: "diffuser",
      price_50ml: 299.99,
      price_200ml: 299.99,
      base_price: 299.99,
    });
    expect(options).toEqual([{ key: "200ml", label: "200ml", price: 299.99 }]);
    expect(defaultSizeForProduct({ ...base, collection_code: "diffuser" })).toBe(
      "200ml",
    );
  });

  it("keeps perfume size cards", () => {
    const options = productSizeOptions({
      ...base,
      collection_code: "womens",
      price_50ml: 219.99,
      price_100ml: 349.99,
    });
    expect(options.map((o) => o.label)).toEqual(["50ml", "100ml"]);
  });
});
