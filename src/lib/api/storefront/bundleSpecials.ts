/**
 * Storefront bundle specials — read bundles, slots, and product filter rules.
 * @see docs/STOREFRONT_BUNDLE_SPECIALS.md
 */
import { supabase } from "@/lib/supabase";
import { productsApi } from "@/lib/api/products";
import type { BundleSpecialWithSlots, Product } from "@/types/database";
import {
  bundleSpecialPath,
  isBundleCurrentlyActive,
  orderedBundleSlots,
  totalPickCount,
  validateBundleSelections,
} from "@/lib/utils/bundleSpecials";

export {
  bundleSpecialPath,
  isBundleCurrentlyActive,
  orderedBundleSlots,
  totalPickCount,
  validateBundleSelections,
};
export type { BundleSpecialWithSlots };

export const storefrontBundleSpecialsApi = {
  async listActive(): Promise<BundleSpecialWithSlots[]> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .select("*, bundle_special_slots(*)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return ((data ?? []) as BundleSpecialWithSlots[])
      .map((row) => ({
        ...row,
        bundle_special_slots: orderedBundleSlots(row),
      }))
      .filter(isBundleCurrentlyActive);
  },

  async getByCode(code: string): Promise<BundleSpecialWithSlots | null> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .select("*, bundle_special_slots(*)")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const bundle = {
      ...(data as BundleSpecialWithSlots),
      bundle_special_slots: orderedBundleSlots(data as BundleSpecialWithSlots),
    };
    return isBundleCurrentlyActive(bundle) ? bundle : null;
  },

  /** Products eligible for one slot tab (same filter as /shop/mens etc.) */
  async listProductsForSlot(collectionCode: string): Promise<Product[]> {
    return productsApi.getByCollectionCode(collectionCode);
  },
};
