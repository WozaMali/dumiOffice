/**
 * Storefront /personalisation — read settings, fonts, and preview image URLs.
 * Copy this module (and lib/utils/personalisation.ts + lib/utils/storage-image.ts)
 * into the main app, or follow docs/STOREFRONT_PERSONALISATION.md.
 */
import { supabase } from "@/lib/supabase";
import type { PersonalisationFont, PersonalisationSettings } from "@/types/database";
import {
  getCategoryPreviewImageUrl,
  getCategoryLabelPosition,
  PERSONALISATION_CATEGORIES,
  PERSONALISATION_PREVIEW_BUCKET,
  resolvePersonalisationPreviewImageUrl,
  type PersonalisationCategoryCode,
} from "@/lib/utils/personalisation";

export {
  getCategoryPreviewImageUrl,
  getCategoryLabelPosition,
  PERSONALISATION_CATEGORIES,
  PERSONALISATION_PREVIEW_BUCKET,
  resolvePersonalisationPreviewImageUrl,
};
export type { PersonalisationCategoryCode };

export const storefrontPersonalisationApi = {
  async getSettings(code = "default"): Promise<PersonalisationSettings | null> {
    const { data, error } = await supabase
      .from("personalisation_settings")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return (data as PersonalisationSettings) ?? null;
  },

  async listFonts(): Promise<PersonalisationFont[]> {
    const { data, error } = await supabase
      .from("personalisation_fonts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as PersonalisationFont[];
  },

  /** Bottle preview for the selected category — use as <img src={...} /> */
  getPreviewImageUrl(
    settings: PersonalisationSettings | null | undefined,
    category: PersonalisationCategoryCode,
  ): string {
    return getCategoryPreviewImageUrl(settings, category);
  },

  /** Label overlay position for the selected category (top/left/width %). */
  getLabelPosition(
    settings: PersonalisationSettings | null | undefined,
    category: PersonalisationCategoryCode,
  ) {
    return getCategoryLabelPosition(settings, category);
  },
};
