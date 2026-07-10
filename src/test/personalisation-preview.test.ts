import { describe, expect, it, vi } from "vitest";
import {
  getCategoryPreviewImage,
  getCategoryPreviewImageUrl,
  getCategoryLabelPosition,
} from "@/lib/utils/personalisation";
import type { PersonalisationSettings } from "@/types/database";

const settings = {
  preview_image_mens: "personalisation/mens/bottle.jpg",
  preview_image_womens: null,
  preview_image_unisex: null,
  preview_image_diffuser: null,
  preview_image_url: "personalisation/legacy.jpg",
  label_top_pct: 42,
  label_left_pct: 50,
  label_width_pct: 72,
  label_top_pct_mens: 78,
  label_left_pct_mens: 50,
  label_width_pct_mens: 72,
  label_top_pct_womens: 65,
  label_left_pct_womens: 48,
  label_width_pct_womens: 68,
} as PersonalisationSettings;

describe("personalisation preview images", () => {
  it("picks the category-specific path", () => {
    expect(getCategoryPreviewImage(settings, "mens")).toBe(
      "personalisation/mens/bottle.jpg",
    );
  });

  it("falls back to preview_image_url", () => {
    expect(getCategoryPreviewImage(settings, "womens")).toBe(
      "personalisation/legacy.jpg",
    );
  });

  it("builds hero-assets transform URL for storefront", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_IMAGE_TRANSFORMS", "true");

    const url = getCategoryPreviewImageUrl(settings, "mens");
    expect(url).toContain("/hero-assets/personalisation/mens/bottle.jpg");
    expect(url).toContain("width=600");
  });

  it("uses per-category label position with legacy fallback", () => {
    expect(getCategoryLabelPosition(settings, "mens")).toEqual({
      topPct: 78,
      leftPct: 50,
      widthPct: 72,
    });
    expect(getCategoryLabelPosition(settings, "womens")).toEqual({
      topPct: 65,
      leftPct: 48,
      widthPct: 68,
    });
    expect(getCategoryLabelPosition(settings, "unisex")).toEqual({
      topPct: 42,
      leftPct: 50,
      widthPct: 72,
    });
  });
});
