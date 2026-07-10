import { supabase } from "@/lib/supabase";
import type {
  BundleSpecial,
  BundleSpecialSlot,
  BundleSpecialWithSlots,
} from "@/types/database";
import { normalizeBundleHeroForStorage } from "@/lib/utils/bundleSpecials";

export const BUNDLE_SPECIALS_SETUP_HINT =
  "Run docs/SUPABASE_BUNDLE_SPECIALS.sql in the Supabase SQL Editor, then refresh this page.";

export const BUNDLE_STORAGE_SETUP_HINT =
  "Run docs/SUPABASE_HERO_ASSETS_STORAGE.sql in Supabase SQL Editor so Office can upload bundle images to hero-assets/bundle-specials/.";

function isMissingBundleTables(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const combined = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
  if (err?.code === "PGRST205" || err?.code === "42P01") return true;
  if (combined.includes("could not find") && combined.includes("schema cache")) return true;
  if (
    combined.includes("relation") &&
    combined.includes("does not exist") &&
    (combined.includes("bundle_specials") || combined.includes("bundle_special_slots"))
  ) {
    return true;
  }
  return false;
}

function assertBundleTables(error: unknown): void {
  if (isMissingBundleTables(error)) {
    throw new Error(BUNDLE_SPECIALS_SETUP_HINT);
  }
}

export type BundleSpecialSlotInput = {
  id?: string;
  slot_code: string;
  tab_label: string;
  collection_code: string;
  pick_count: number;
  sort_order?: number;
};

export const bundleSpecialsApi = {
  async list(): Promise<BundleSpecial[]> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      assertBundleTables(error);
      throw error;
    }
    return (data ?? []) as BundleSpecial[];
  },

  async listWithSlots(): Promise<BundleSpecialWithSlots[]> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .select("*, bundle_special_slots(*)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      assertBundleTables(error);
      throw error;
    }

    return ((data ?? []) as BundleSpecialWithSlots[]).map((row) => ({
      ...row,
      bundle_special_slots: [...(row.bundle_special_slots ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    }));
  },

  async getByCode(code: string): Promise<BundleSpecialWithSlots | null> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .select("*, bundle_special_slots(*)")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      assertBundleTables(error);
      throw error;
    }
    if (!data) return null;

    const row = data as BundleSpecialWithSlots;
    return {
      ...row,
      bundle_special_slots: [...(row.bundle_special_slots ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    };
  },

  async upsertBundle(input: {
    code: string;
    name: string;
    headline?: string | null;
    subheadline?: string | null;
    description?: string | null;
    hero_image_url?: string | null;
    bundle_price: number;
    compare_at_price?: number | null;
    is_active?: boolean;
    sort_order?: number;
    starts_at?: string | null;
    ends_at?: string | null;
  }): Promise<BundleSpecial> {
    const { data, error } = await supabase
      .from("bundle_specials")
      .upsert(
        {
          code: input.code,
          name: input.name,
          headline: input.headline ?? null,
          subheadline: input.subheadline ?? null,
          description: input.description ?? null,
          hero_image_url: normalizeBundleHeroForStorage(input.hero_image_url) ?? null,
          bundle_price: input.bundle_price,
          compare_at_price: input.compare_at_price ?? null,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0,
          starts_at: input.starts_at ?? null,
          ends_at: input.ends_at ?? null,
        },
        { onConflict: "code" },
      )
      .select()
      .single();

    if (error) {
      assertBundleTables(error);
      throw error;
    }
    return data as BundleSpecial;
  },

  async replaceSlots(
    bundleSpecialId: string,
    slots: BundleSpecialSlotInput[],
  ): Promise<BundleSpecialSlot[]> {
    const { error: deleteError } = await supabase
      .from("bundle_special_slots")
      .delete()
      .eq("bundle_special_id", bundleSpecialId);

    if (deleteError) {
      assertBundleTables(deleteError);
      throw deleteError;
    }

    if (slots.length === 0) return [];

    const { data, error } = await supabase
      .from("bundle_special_slots")
      .insert(
        slots.map((slot, index) => ({
          bundle_special_id: bundleSpecialId,
          slot_code: slot.slot_code,
          tab_label: slot.tab_label,
          collection_code: slot.collection_code,
          pick_count: slot.pick_count,
          sort_order: slot.sort_order ?? index,
        })),
      )
      .select();

    if (error) {
      assertBundleTables(error);
      throw error;
    }
    return (data ?? []) as BundleSpecialSlot[];
  },

  async uploadHeroImage(file: File, code: string): Promise<string> {
    const bucket = "hero-assets";
    const safeCode = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "bundle";
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ".jpg";
    const path = `bundle-specials/${safeCode}${ext}`;
    const contentType =
      file.type ||
      (ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg");

    const upload = (upsert: boolean) =>
      supabase.storage.from(bucket).upload(path, file, {
        upsert,
        contentType,
      });

    let { data, error } = await upload(true);

    if (error) {
      const message = (error.message || "").toLowerCase();
      if (message.includes("already exists") || message.includes("duplicate")) {
        await supabase.storage.from(bucket).remove([path]);
        ({ data, error } = await upload(false));
      }
    }

    if (error || !data) {
      const detail = error?.message || "Failed to upload bundle hero image";
      const hint = /policy|permission|row-level security|jwt|not authorized/i.test(
        detail,
      )
        ? ` ${BUNDLE_STORAGE_SETUP_HINT}`
        : "";
      throw new Error(`${detail}.${hint}`);
    }

    const { error: verifyError } = await supabase.storage.from(bucket).download(path);
    if (verifyError) {
      throw new Error(
        `Upload completed but the file could not be read back (${verifyError.message}). ${BUNDLE_STORAGE_SETUP_HINT}`,
      );
    }

    return data.path;
  },

  async saveHeroImagePath(
    bundle: BundleSpecial,
    hero_image_url: string,
  ): Promise<BundleSpecial> {
    return this.upsertBundle({
      code: bundle.code,
      name: bundle.name,
      headline: bundle.headline ?? null,
      subheadline: bundle.subheadline ?? null,
      description: bundle.description ?? null,
      hero_image_url,
      bundle_price: Number(bundle.bundle_price) || 0,
      compare_at_price: bundle.compare_at_price ?? null,
      is_active: bundle.is_active,
      sort_order: bundle.sort_order ?? 0,
      starts_at: bundle.starts_at ?? null,
      ends_at: bundle.ends_at ?? null,
    });
  },
};

export { isMissingBundleTables };

export function isBundleSetupRequired(error: unknown): boolean {
  if (isMissingBundleTables(error)) return true;
  return (error as Error | null)?.message === BUNDLE_SPECIALS_SETUP_HINT;
}
