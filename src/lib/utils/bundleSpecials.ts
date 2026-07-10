import type { BundleSpecialSlot, BundleSpecialWithSlots } from "@/types/database";
import { normalizeCollectionHeroForStorage } from "@/lib/utils/product-lines";

export type BundleCollectionCode = "mens" | "womens" | "unisex";

export const BUNDLE_COLLECTION_OPTIONS: {
  code: BundleCollectionCode;
  label: string;
}[] = [
  { code: "mens", label: "Men's" },
  { code: "womens", label: "Women's" },
  { code: "unisex", label: "Unisex" },
];

/** Total fragrances a shopper must pick across all slots */
export function totalPickCount(bundle: BundleSpecialWithSlots): number {
  return (bundle.bundle_special_slots ?? []).reduce(
    (sum, slot) => sum + (slot.pick_count ?? 0),
    0,
  );
}

/** True when bundle has more than one slot → storefront shows tabs (e.g. His & Hers) */
export function bundleUsesTabs(bundle: BundleSpecialWithSlots): boolean {
  return (bundle.bundle_special_slots?.length ?? 0) > 1;
}

/** Slots sorted for tab order */
export function orderedBundleSlots(
  bundle: BundleSpecialWithSlots,
): BundleSpecialSlot[] {
  return [...(bundle.bundle_special_slots ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
}

/** Whether bundle is within optional start/end window */
export function isBundleCurrentlyActive(bundle: BundleSpecialWithSlots): boolean {
  if (!bundle.is_active) return false;
  const now = Date.now();
  if (bundle.starts_at && new Date(bundle.starts_at).getTime() > now) return false;
  if (bundle.ends_at && new Date(bundle.ends_at).getTime() < now) return false;
  return true;
}

/**
 * Validate shopper selections before checkout.
 * selections: slot_code → array of product ids
 */
export function validateBundleSelections(
  bundle: BundleSpecialWithSlots,
  selections: Record<string, string[]>,
): { ok: true } | { ok: false; message: string } {
  for (const slot of orderedBundleSlots(bundle)) {
    const picked = selections[slot.slot_code] ?? [];
    if (picked.length !== slot.pick_count) {
      return {
        ok: false,
        message: `Pick exactly ${slot.pick_count} from ${slot.tab_label} (${picked.length} selected).`,
      };
    }
    const unique = new Set(picked);
    if (unique.size !== picked.length) {
      return {
        ok: false,
        message: `Duplicate picks are not allowed in ${slot.tab_label}.`,
      };
    }
  }
  return { ok: true };
}

/** Storefront route for a bundle */
export function bundleSpecialPath(code: string): string {
  return `/specials/${code}`;
}

/**
 * Normalize bundle hero paths for storage.
 * Accepts bundle-specials/..., hero-assets/bundle-specials/..., full public URLs,
 * and legacy bundles/... (rewritten to bundle-specials/...).
 */
export function normalizeBundleHeroForStorage(
  url: string | undefined | null,
): string | undefined {
  const normalized = normalizeCollectionHeroForStorage(url);
  if (!normalized) return undefined;
  if (normalized.startsWith("bundles/")) {
    return normalized.replace(/^bundles\//, "bundle-specials/");
  }
  return normalized;
}
