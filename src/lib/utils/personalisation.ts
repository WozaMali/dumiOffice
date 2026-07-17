import type { PersonalisationSettings } from "@/types/database";
import { personalisationStorageImageUrl } from "@/lib/utils/storage-image";

export type PersonalisationCategoryCode = "mens" | "womens" | "unisex" | "diffuser";

/** Storage bucket for blank-bottle previews uploaded from Office Content. */
export const PERSONALISATION_PREVIEW_BUCKET = "hero-assets" as const;

/** Relative path prefix inside hero-assets, e.g. personalisation/mens/1734-bottle.jpg */
export const PERSONALISATION_PREVIEW_PATH_PREFIX = "personalisation" as const;

export const PERSONALISATION_CATEGORIES: {
  code: PersonalisationCategoryCode;
  label: string;
}[] = [
  { code: "mens", label: "Men's" },
  { code: "womens", label: "Women's" },
  { code: "unisex", label: "Unisex" },
  { code: "diffuser", label: "Diffuser" },
];

export interface PersonalisationLabelPosition {
  topPct: number;
  leftPct: number;
  widthPct: number;
}

export interface PersonalisationLabelPositionForm {
  top: string;
  left: string;
  width: string;
}

const DEFAULT_LABEL_POSITION: PersonalisationLabelPosition = {
  topPct: 42,
  leftPct: 50,
  widthPct: 72,
};

const defaultLabelPositionForm = (): PersonalisationLabelPositionForm => ({
  top: String(DEFAULT_LABEL_POSITION.topPct),
  left: String(DEFAULT_LABEL_POSITION.leftPct),
  width: String(DEFAULT_LABEL_POSITION.widthPct),
});

const legacyLabelPosition = (
  settings: PersonalisationSettings | null | undefined,
): PersonalisationLabelPosition => ({
  topPct: settings?.label_top_pct ?? DEFAULT_LABEL_POSITION.topPct,
  leftPct: settings?.label_left_pct ?? DEFAULT_LABEL_POSITION.leftPct,
  widthPct: settings?.label_width_pct ?? DEFAULT_LABEL_POSITION.widthPct,
});

const categoryLabelFields = (
  category: PersonalisationCategoryCode,
): {
  top: keyof PersonalisationSettings;
  left: keyof PersonalisationSettings;
  width: keyof PersonalisationSettings;
} => {
  switch (category) {
    case "mens":
      return {
        top: "label_top_pct_mens",
        left: "label_left_pct_mens",
        width: "label_width_pct_mens",
      };
    case "womens":
      return {
        top: "label_top_pct_womens",
        left: "label_left_pct_womens",
        width: "label_width_pct_womens",
      };
    case "unisex":
      return {
        top: "label_top_pct_unisex",
        left: "label_left_pct_unisex",
        width: "label_width_pct_unisex",
      };
    case "diffuser":
      return {
        top: "label_top_pct_diffuser",
        left: "label_left_pct_diffuser",
        width: "label_width_pct_diffuser",
      };
  }
};

const categoryPreviewField = (
  settings: PersonalisationSettings,
  category: PersonalisationCategoryCode,
): string | null | undefined => {
  switch (category) {
    case "mens":
      return settings.preview_image_mens;
    case "womens":
      return settings.preview_image_womens;
    case "unisex":
      return settings.preview_image_unisex;
    case "diffuser":
      return settings.preview_image_diffuser;
    default:
      return null;
  }
};

export function getCategoryLabelPosition(
  settings: PersonalisationSettings | null | undefined,
  category: PersonalisationCategoryCode,
): PersonalisationLabelPosition {
  if (!settings) return { ...DEFAULT_LABEL_POSITION };

  const fallback = legacyLabelPosition(settings);
  const fields = categoryLabelFields(category);
  const top = settings[fields.top] as number | null | undefined;
  const left = settings[fields.left] as number | null | undefined;
  const width = settings[fields.width] as number | null | undefined;

  return {
    topPct: top ?? fallback.topPct,
    leftPct: left ?? fallback.leftPct,
    widthPct: width ?? fallback.widthPct,
  };
}

export function categoryLabelPositionsFromSettings(
  settings: PersonalisationSettings | null | undefined,
): Record<PersonalisationCategoryCode, PersonalisationLabelPositionForm> {
  return PERSONALISATION_CATEGORIES.reduce(
    (acc, cat) => {
      const pos = getCategoryLabelPosition(settings, cat.code);
      acc[cat.code] = {
        top: String(pos.topPct),
        left: String(pos.leftPct),
        width: String(pos.widthPct),
      };
      return acc;
    },
    {} as Record<PersonalisationCategoryCode, PersonalisationLabelPositionForm>,
  );
}

export function emptyCategoryLabelPositions(): Record<
  PersonalisationCategoryCode,
  PersonalisationLabelPositionForm
> {
  return {
    mens: defaultLabelPositionForm(),
    womens: defaultLabelPositionForm(),
    unisex: defaultLabelPositionForm(),
    diffuser: defaultLabelPositionForm(),
  };
}

export function parseCategoryLabelPosition(
  form: PersonalisationLabelPositionForm,
  fallback: PersonalisationLabelPosition = DEFAULT_LABEL_POSITION,
): PersonalisationLabelPosition {
  return {
    topPct: Number(form.top || String(fallback.topPct)) || fallback.topPct,
    leftPct: Number(form.left || String(fallback.leftPct)) || fallback.leftPct,
    widthPct: Number(form.width || String(fallback.widthPct)) || fallback.widthPct,
  };
}

export function getCategoryPreviewImage(
  settings: PersonalisationSettings | null | undefined,
  category: PersonalisationCategoryCode,
): string | null {
  if (!settings) return null;
  const specific = categoryPreviewField(settings, category);
  if (specific) return specific;
  return settings.preview_image_url ?? null;
}

export function categoryPreviewImagesFromSettings(
  settings: PersonalisationSettings | null | undefined,
): Record<PersonalisationCategoryCode, string> {
  return {
    mens: settings?.preview_image_mens ?? "",
    womens: settings?.preview_image_womens ?? "",
    unisex: settings?.preview_image_unisex ?? "",
    diffuser: settings?.preview_image_diffuser ?? "",
  };
}

/** Storefront-optimized preview URL for a stored personalisation image path. */
export function resolvePersonalisationPreviewImageUrl(
  path: string | null | undefined,
): string {
  return personalisationStorageImageUrl(path, "personalisation");
}

/**
 * Full image URL for the live preview on /personalisation after the shopper
 * picks a step-1 category (mens | womens | unisex | diffuser).
 */
export function getCategoryPreviewImageUrl(
  settings: PersonalisationSettings | null | undefined,
  category: PersonalisationCategoryCode,
): string {
  const path = getCategoryPreviewImage(settings, category);
  return resolvePersonalisationPreviewImageUrl(path);
}

/** Default max font size (px) for short names on the bottle label preview. */
export const PERSONALISATION_LABEL_FONT_MAX_PX = 22;
/** Floor so long names stay readable but still fit the bottle. */
export const PERSONALISATION_LABEL_FONT_MIN_PX = 8;
/** Characters that still look good at max size (script fonts are wide). */
export const PERSONALISATION_LABEL_IDEAL_CHARS = 9;

/**
 * Estimate label font size from character count so longer names shrink
 * instead of spilling past the bottle. Prefer {@link fitLabelFontSizeToContainer}
 * when a DOM node is available for exact fit.
 */
export function personalisationLabelFontSizePx(
  text: string,
  options?: {
    maxPx?: number;
    minPx?: number;
    idealCharsAtMax?: number;
  },
): number {
  const maxPx = options?.maxPx ?? PERSONALISATION_LABEL_FONT_MAX_PX;
  const minPx = options?.minPx ?? PERSONALISATION_LABEL_FONT_MIN_PX;
  const idealCharsAtMax = options?.idealCharsAtMax ?? PERSONALISATION_LABEL_IDEAL_CHARS;
  const cleaned = text.trim() || " ";
  const len = Array.from(cleaned).length;
  if (len <= idealCharsAtMax) return maxPx;
  const scaled = (maxPx * idealCharsAtMax) / len;
  return Math.max(minPx, Math.min(maxPx, Math.round(scaled * 10) / 10));
}

/**
 * Shrink `textEl` font-size until its width fits `containerEl`.
 * Always caps with {@link personalisationLabelFontSizePx} first so long names
 * shrink even when the label box is overly wide (common on Diffuser).
 * Returns the final size in px. Mutates `textEl.style.fontSize`.
 */
export function fitLabelFontSizeToContainer(
  textEl: HTMLElement,
  containerEl: HTMLElement,
  options?: {
    maxPx?: number;
    minPx?: number;
    step?: number;
    idealCharsAtMax?: number;
  },
): number {
  const maxPx = options?.maxPx ?? PERSONALISATION_LABEL_FONT_MAX_PX;
  const minPx = options?.minPx ?? PERSONALISATION_LABEL_FONT_MIN_PX;
  const step = options?.step ?? 0.5;
  const text = textEl.textContent || "";
  // Character ceiling always applies (Diffuser jars are often narrower than the % box).
  const charCap = personalisationLabelFontSizePx(text, {
    maxPx,
    minPx,
    idealCharsAtMax: options?.idealCharsAtMax,
  });
  const width = containerEl.clientWidth;
  if (width <= 0) return charCap;

  let size = charCap;
  textEl.style.whiteSpace = "nowrap";
  textEl.style.display = "inline-block";
  textEl.style.maxWidth = "100%";
  textEl.style.fontSize = `${size}px`;

  while (size > minPx && textEl.scrollWidth > width) {
    size = Math.round((size - step) * 10) / 10;
    textEl.style.fontSize = `${size}px`;
  }
  return Math.max(minPx, size);
}

/** Per-category defaults — Diffuser vessels are narrower than perfume bottles. */
export function personalisationLabelFontOptionsForCategory(
  category: PersonalisationCategoryCode,
): { maxPx: number; minPx: number; idealCharsAtMax: number } {
  if (category === "diffuser") {
    return {
      maxPx: 18,
      minPx: PERSONALISATION_LABEL_FONT_MIN_PX,
      idealCharsAtMax: 7,
    };
  }
  return {
    maxPx: PERSONALISATION_LABEL_FONT_MAX_PX,
    minPx: PERSONALISATION_LABEL_FONT_MIN_PX,
    idealCharsAtMax: PERSONALISATION_LABEL_IDEAL_CHARS,
  };
}
