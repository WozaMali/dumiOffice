import { supabase } from "@/lib/supabase";
import type { HomeHeroSlide } from "@/types/database";

export const homeHeroApi = {
  async list(): Promise<HomeHeroSlide[]> {
    const { data, error } = await supabase
      .from("home_hero_slides")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as HomeHeroSlide[];
  },

  async upsertByCode(input: {
    code: string;
    kicker?: string;
    headline: string;
    subheadline?: string;
    body?: string;
    primary_cta_label?: string;
    primary_cta_href?: string;
    secondary_cta_label?: string;
    secondary_cta_href?: string;
    collection_code?: string;
    product_id?: string;
    background_image_url?: string;
    background_video_url?: string;
    gallery_image_urls?: string[];
    is_active?: boolean;
    sort_order?: number;
  }): Promise<HomeHeroSlide> {
    const payload = {
      ...input,
    };

    const { data, error } = await supabase
      .from("home_hero_slides")
      .upsert(payload, { onConflict: "code" })
      .select()
      .single();

    if (error) throw error;
    return data as HomeHeroSlide;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("home_hero_slides")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async uploadPdf(file: File): Promise<string> {
    const bucket = "hero-assets";
    const path = `home-hero/docs/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, file);

    if (error || !data) {
      throw error || new Error("Failed to upload hero PDF");
    }

    return data.path;
  },

  async uploadImage(file: File): Promise<string> {
    const bucket = "hero-assets";
    const path = `home-hero/images/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, file);

    if (error || !data) {
      throw error || new Error("Failed to upload hero image");
    }

    return data.path;
  },
};

