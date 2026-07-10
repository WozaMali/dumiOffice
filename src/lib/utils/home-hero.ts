import type { HomeHeroSlide } from "@/types/database";

export type HeroPageGroupId =
  | "home-carousel"
  | "home-sections"
  | "gift-guide"
  | "our-journey"
  | "other";

export type HeroPageGroup = {
  id: HeroPageGroupId;
  label: string;
  description: string;
};

export const HERO_PAGE_GROUPS: HeroPageGroup[] = [
  {
    id: "home-carousel",
    label: "Home — Hero carousel",
    description: "Top banner slides that rotate on the storefront home page.",
  },
  {
    id: "home-sections",
    label: "Home — Content cards",
    description: "Section headers and editorial cards on the home page.",
  },
  {
    id: "gift-guide",
    label: "Gift Guide",
    description: "Hero, sections, and cards for the gift guide page.",
  },
  {
    id: "our-journey",
    label: "Our Journey",
    description: "Hero and promise section for the our journey page.",
  },
  {
    id: "other",
    label: "Other",
    description: "Custom slides not tied to a known page group.",
  },
];

const HOME_SECTION_CODES = new Set([
  "fresh-in-store",
  "put-your-name-on-it",
  "client-notes",
]);

export function heroSlidePageGroup(slide: HomeHeroSlide): HeroPageGroupId {
  const code = (slide.code || "").trim().toLowerCase();

  if (code === "home-main" || code.startsWith("home-hero-")) {
    return "home-carousel";
  }
  if (code.startsWith("gift-")) {
    return "gift-guide";
  }
  if (code.startsWith("our-journey")) {
    return "our-journey";
  }
  if (HOME_SECTION_CODES.has(code)) {
    return "home-sections";
  }

  if (slide.sort_order < 900) return "home-carousel";
  if (slide.sort_order < 930) return "home-sections";
  if (slide.sort_order < 960) return "gift-guide";
  if (slide.sort_order < 980) return "our-journey";

  return "other";
}

export function groupHeroSlidesByPage(
  slides: HomeHeroSlide[],
): Record<HeroPageGroupId, HomeHeroSlide[]> {
  const grouped = Object.fromEntries(
    HERO_PAGE_GROUPS.map((group) => [group.id, [] as HomeHeroSlide[]]),
  ) as Record<HeroPageGroupId, HomeHeroSlide[]>;

  for (const slide of slides) {
    grouped[heroSlidePageGroup(slide)].push(slide);
  }

  for (const group of HERO_PAGE_GROUPS) {
    grouped[group.id].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.headline.localeCompare(b.headline),
    );
  }

  return grouped;
}

export function heroSlideCardImagePath(slide: HomeHeroSlide): string | null {
  return (
    slide.background_image_url?.trim() ||
    slide.gallery_image_urls?.find((url) => url?.trim()) ||
    null
  );
}
