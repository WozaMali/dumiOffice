import { describe, expect, it } from "vitest";
import {
  groupHeroSlidesByPage,
  heroSlidePageGroup,
} from "@/lib/utils/home-hero";
import type { HomeHeroSlide } from "@/types/database";

function slide(
  partial: Partial<HomeHeroSlide> & Pick<HomeHeroSlide, "code" | "headline">,
): HomeHeroSlide {
  return {
    id: partial.id ?? partial.code,
    subheadline: "",
    is_active: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("home-hero", () => {
  it("groups slides by page from code", () => {
    expect(heroSlidePageGroup(slide({ code: "home-main", headline: "Main" }))).toBe(
      "home-carousel",
    );
    expect(
      heroSlidePageGroup(slide({ code: "fresh-in-store", headline: "Fresh" })),
    ).toBe("home-sections");
    expect(
      heroSlidePageGroup(slide({ code: "gift-guide-hero", headline: "Gifts" })),
    ).toBe("gift-guide");
    expect(
      heroSlidePageGroup(
        slide({ code: "our-journey-hero", headline: "Journey" }),
      ),
    ).toBe("our-journey");
  });

  it("falls back to sort_order when code is unknown", () => {
    expect(
      heroSlidePageGroup(
        slide({ code: "custom-banner", headline: "Banner", sort_order: 2 }),
      ),
    ).toBe("home-carousel");
    expect(
      heroSlidePageGroup(
        slide({ code: "custom-card", headline: "Card", sort_order: 905 }),
      ),
    ).toBe("home-sections");
  });

  it("groups and sorts slides within each page", () => {
    const grouped = groupHeroSlidesByPage([
      slide({ code: "gift-edit-for-her", headline: "Her", sort_order: 942 }),
      slide({ code: "home-main", headline: "Main", sort_order: 1 }),
      slide({ code: "gift-guide-hero", headline: "Guide", sort_order: 930 }),
    ]);

    expect(grouped["home-carousel"].map((s) => s.code)).toEqual(["home-main"]);
    expect(grouped["gift-guide"].map((s) => s.code)).toEqual([
      "gift-guide-hero",
      "gift-edit-for-her",
    ]);
  });
});
