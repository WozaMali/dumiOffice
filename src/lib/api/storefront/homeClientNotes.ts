/**
 * Storefront home page Client Notes testimonials.
 * @see docs/STOREFRONT_CLIENT_NOTES.md
 */
import { supabase } from "@/lib/supabase";
import { homeHeroApi } from "@/lib/api/homeHero";
import type { HomeClientNote, HomeHeroSlide } from "@/types/database";

export const CLIENT_NOTES_SECTION_CODE = "client-notes";

export const storefrontClientNotesApi = {
  async listActiveTestimonials(): Promise<HomeClientNote[]> {
    const { data, error } = await supabase
      .from("home_client_notes")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as HomeClientNote[];
  },

  async getSectionHeader(): Promise<HomeHeroSlide | null> {
    return homeHeroApi.list().then((slides) => {
      const slide = slides.find(
        (s) => s.code === CLIENT_NOTES_SECTION_CODE && s.is_active,
      );
      return slide ?? null;
    });
  },
};
