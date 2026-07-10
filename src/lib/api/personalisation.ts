import { supabase } from "@/lib/supabase";
import type { PersonalisationFont, PersonalisationSettings } from "@/types/database";
import type { PersonalisationCategoryCode } from "@/lib/utils/personalisation";

export const PERSONALISATION_SETUP_HINT =
  "Run docs/SUPABASE_PERSONALISATION_REPAIR.sql in the Supabase SQL Editor, then refresh this page.";

export function isMissingPersonalisationTablesError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const combined = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();

  if (err?.code === "PGRST205" || err?.code === "42P01") return true;
  if (combined.includes("could not find") && combined.includes("schema cache")) return true;
  if (
    combined.includes("relation") &&
    combined.includes("does not exist") &&
    (combined.includes("personalisation_settings") || combined.includes("personalisation_fonts"))
  ) {
    return true;
  }

  return false;
}

function assertPersonalisationTables(error: unknown): void {
  if (isMissingPersonalisationTablesError(error)) {
    throw new Error(PERSONALISATION_SETUP_HINT);
  }
}

export const personalisationApi = {
  async getSettings(code = "default"): Promise<PersonalisationSettings | null> {
    const { data, error } = await supabase
      .from("personalisation_settings")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      assertPersonalisationTables(error);
      throw error;
    }
    return (data as PersonalisationSettings) ?? null;
  },

  async upsertSettings(input: {
    code?: string;
    fee: number;
    preview_image_url?: string | null;
    preview_image_mens?: string | null;
    preview_image_womens?: string | null;
    preview_image_unisex?: string | null;
    preview_image_diffuser?: string | null;
    label_top_pct?: number;
    label_left_pct?: number;
    label_width_pct?: number;
    label_top_pct_mens?: number | null;
    label_left_pct_mens?: number | null;
    label_width_pct_mens?: number | null;
    label_top_pct_womens?: number | null;
    label_left_pct_womens?: number | null;
    label_width_pct_womens?: number | null;
    label_top_pct_unisex?: number | null;
    label_left_pct_unisex?: number | null;
    label_width_pct_unisex?: number | null;
    label_top_pct_diffuser?: number | null;
    label_left_pct_diffuser?: number | null;
    label_width_pct_diffuser?: number | null;
    placeholder_text: string;
    max_name_length: number;
    is_active?: boolean;
  }): Promise<PersonalisationSettings> {
    const { data, error } = await supabase
      .from("personalisation_settings")
      .upsert(
        {
          code: input.code ?? "default",
          fee: input.fee,
          preview_image_url: input.preview_image_url ?? null,
          preview_image_mens: input.preview_image_mens ?? null,
          preview_image_womens: input.preview_image_womens ?? null,
          preview_image_unisex: input.preview_image_unisex ?? null,
          preview_image_diffuser: input.preview_image_diffuser ?? null,
          label_top_pct: input.label_top_pct ?? input.label_top_pct_mens ?? 42,
          label_left_pct: input.label_left_pct ?? input.label_left_pct_mens ?? 50,
          label_width_pct: input.label_width_pct ?? input.label_width_pct_mens ?? 72,
          label_top_pct_mens: input.label_top_pct_mens ?? null,
          label_left_pct_mens: input.label_left_pct_mens ?? null,
          label_width_pct_mens: input.label_width_pct_mens ?? null,
          label_top_pct_womens: input.label_top_pct_womens ?? null,
          label_left_pct_womens: input.label_left_pct_womens ?? null,
          label_width_pct_womens: input.label_width_pct_womens ?? null,
          label_top_pct_unisex: input.label_top_pct_unisex ?? null,
          label_left_pct_unisex: input.label_left_pct_unisex ?? null,
          label_width_pct_unisex: input.label_width_pct_unisex ?? null,
          label_top_pct_diffuser: input.label_top_pct_diffuser ?? null,
          label_left_pct_diffuser: input.label_left_pct_diffuser ?? null,
          label_width_pct_diffuser: input.label_width_pct_diffuser ?? null,
          placeholder_text: input.placeholder_text,
          max_name_length: input.max_name_length,
          is_active: input.is_active ?? true,
        },
        { onConflict: "code" },
      )
      .select()
      .single();

    if (error) {
      assertPersonalisationTables(error);
      throw error;
    }
    return data as PersonalisationSettings;
  },

  async listFonts(): Promise<PersonalisationFont[]> {
    const { data, error } = await supabase
      .from("personalisation_fonts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      assertPersonalisationTables(error);
      throw error;
    }
    return (data ?? []) as PersonalisationFont[];
  },

  async upsertFont(input: {
    code: string;
    label: string;
    font_family: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<PersonalisationFont> {
    const { data, error } = await supabase
      .from("personalisation_fonts")
      .upsert(input, { onConflict: "code" })
      .select()
      .single();

    if (error) {
      assertPersonalisationTables(error);
      throw error;
    }
    return data as PersonalisationFont;
  },

  async uploadPreviewImage(
    file: File,
    category: PersonalisationCategoryCode,
  ): Promise<string> {
    const bucket = "hero-assets";
    const path = `personalisation/${category}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, file);

    if (error || !data) {
      throw error || new Error("Failed to upload personalisation preview image");
    }

    return data.path;
  },
};
