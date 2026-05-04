import { supabase } from "@/lib/supabase";
import type { FrontPopup } from "@/types/database";

export const frontPopupApi = {
  async getByCode(code: string): Promise<FrontPopup | null> {
    const { data, error } = await supabase
      .schema("public")
      .from("front_popups")
      .select("*")
      .eq("code", code)
      .single();

    if (error && (error as any).code !== "PGRST116") throw error;
    return (data as FrontPopup) ?? null;
  },

  async upsertByCode(input: {
    code: string;
    is_active: boolean;
    headline?: string;
    body?: string;
    image_url?: string;
    cta_label?: string;
    cta_href?: string;
    dismiss_days: number;
  }): Promise<FrontPopup> {
    const { data, error } = await supabase
      .schema("public")
      .from("front_popups")
      .upsert(input, { onConflict: "code" })
      .select()
      .single();

    if (error) throw error;
    return data as FrontPopup;
  },

  async uploadImage(file: File): Promise<string> {
    const bucket = "hero-assets";
    const path = `front-popup/images/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, file);

    if (error || !data) {
      throw error || new Error("Failed to upload popup image");
    }

    return data.path;
  },
};

