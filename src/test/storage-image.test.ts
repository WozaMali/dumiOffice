import { describe, expect, it, vi } from "vitest";
import {
  bundleStorageImageUrl,
  collectionStorageImageUrl,
  encodeStoragePath,
  fixSupabasePublicUrl,
  optimizeStoredPublicUrl,
  productStorageImageSrcSet,
  productStorageImageUrl,
  supabaseStorageImageUrl,
} from "@/lib/utils/storage-image";

describe("storage-image", () => {
  it("encodes path segments", () => {
    expect(encodeStoragePath("products/my photo.jpg")).toBe(
      "products/my%20photo.jpg",
    );
  });

  it("builds transformed product URLs", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "true");

    const url = productStorageImageUrl("products/abc.jpg", "card");
    expect(url).toContain("/storage/v1/render/image/public/product_assets/");
    expect(url).toContain("width=480");
    expect(url).toContain("format=webp");
  });

  it("falls back to object URLs when transforms are disabled", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "false");

    const url = supabaseStorageImageUrl("product_assets", "products/abc.jpg", {
      width: 480,
    });
    expect(url).toBe(
      "https://example.supabase.co/storage/v1/object/public/product_assets/products/abc.jpg",
    );
    expect(productStorageImageSrcSet("products/abc.jpg")).toBeUndefined();
  });

  it("optimizes stored public URLs", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "true");

    const original =
      "https://example.supabase.co/storage/v1/object/public/hero-assets/popup.jpg";
    const optimized = optimizeStoredPublicUrl(original, "popup");
    expect(optimized).toContain("/render/image/public/hero-assets/popup.jpg");
    expect(optimized).toContain("width=800");
  });

  it("builds bundle card transform URLs", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "true");

    const url = bundleStorageImageUrl("bundle-specials/mens-trio.png");
    expect(url).toContain("/render/image/public/hero-assets/bundle-specials/mens-trio.png");
    expect(url).toContain("width=1280");
    expect(url).toContain("height=800");
  });

  it("encodes spaces in public storage URLs", () => {
    const raw =
      "https://example.supabase.co/storage/v1/object/public/hero-assets/home-hero/images/file with spaces.png";
    const fixed = fixSupabasePublicUrl(raw);
    expect(fixed).toContain("file%20with%20spaces.png");
  });

  it("routes collection paths from product_assets when leading slash", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "true");

    const url = collectionStorageImageUrl("/products/card.jpg");
    expect(url).toContain("/product_assets/products/card.jpg");
  });
});
