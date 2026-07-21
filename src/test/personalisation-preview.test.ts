import { describe, expect, it, vi } from "vitest";
import {
  getCategoryPreviewImage,
  getCategoryPreviewImageUrl,
  getCategoryLabelPosition,
  personalisationLabelColorForCategory,
  personalisationLabelFontSizePx,
  PERSONALISATION_LABEL_FONT_MAX_PX,
  PERSONALISATION_LABEL_FONT_MIN_PX,
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

describe("personalisationLabelFontSizePx", () => {
  it("keeps short names at max size", () => {
    expect(personalisationLabelFontSizePx("Ava")).toBe(PERSONALISATION_LABEL_FONT_MAX_PX);
    expect(personalisationLabelFontSizePx("Your Name")).toBe(PERSONALISATION_LABEL_FONT_MAX_PX);
  });

  it("shrinks as character count grows", () => {
    const short = personalisationLabelFontSizePx("Alex");
    const medium = personalisationLabelFontSizePx("Alexandria X");
    const long = personalisationLabelFontSizePx("Alexandria-Marie X");
    expect(medium).toBeLessThan(short);
    expect(long).toBeLessThan(medium);
  });

  it("never goes below the minimum", () => {
    const huge = "A".repeat(80);
    expect(personalisationLabelFontSizePx(huge)).toBe(PERSONALISATION_LABEL_FONT_MIN_PX);
  });

  it("uses a tighter scale for diffuser", () => {
    const perfume = personalisationLabelFontSizePx("Alexandria", {
      maxPx: 22,
      idealCharsAtMax: 9,
    });
    const diffuser = personalisationLabelFontSizePx("Alexandria", {
      maxPx: 18,
      idealCharsAtMax: 7,
    });
    expect(diffuser).toBeLessThan(perfume);
  });
});

describe("personalisationLabelColorForCategory", () => {
  it("uses white on dark bottle labels (men, diffuser)", () => {
    expect(personalisationLabelColorForCategory("mens")).toBe("#ffffff");
    expect(personalisationLabelColorForCategory("diffuser")).toBe("#ffffff");
  });

  it("uses dark grey on light bottle labels (women, unisex)", () => {
    expect(personalisationLabelColorForCategory("womens")).toBe("#3f3f46");
    expect(personalisationLabelColorForCategory("unisex")).toBe("#3f3f46");
  });
});
