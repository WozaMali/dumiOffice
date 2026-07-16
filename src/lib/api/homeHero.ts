import { supabase } from "@/lib/supabase";
import type { HomeHeroSlide } from "@/types/database";
import { compressImageForUpload } from "@/lib/utils/compress-image";
import { compressPdfForUpload } from "@/lib/utils/compress-pdf";

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
    background_image_url_mobile?: string;
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
    const compressed = await compressPdfForUpload(file, "document");
    const path = `home-hero/docs/${Date.now()}-${compressed.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, compressed, {
      contentType: "application/pdf",
    });

    if (error || !data) {
      throw error || new Error("Failed to upload hero PDF");
    }

    return data.path;
  },

  async uploadImage(
    file: File,
    variant: "desktop" | "mobile" | "default" = "default",
  ): Promise<string> {
    const bucket = "hero-assets";
    const compressed = await compressImageForUpload(file, "hero");
    const ext = compressed.name.includes(".")
      ? compressed.name.slice(compressed.name.lastIndexOf(".")).toLowerCase()
      : ".webp";
    const prefix =
      variant === "desktop"
        ? "desktop"
        : variant === "mobile"
          ? "mobile"
          : String(Date.now());
    const path = `home-hero/images/${prefix}-${Date.now()}${ext}`;

    const { data, error } = await supabase.storage.from(bucket).upload(path, compressed, {
      upsert: true,
      contentType: compressed.type || undefined,
    });

    if (error || !data) {
      throw error || new Error("Failed to upload hero image");
    }

    return data.path;
  },
};

