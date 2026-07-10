import { supabase } from "@/lib/supabase";
import type { HomeClientNote } from "@/types/database";

export const HOME_CLIENT_NOTES_SETUP_HINT =
  "Run docs/SUPABASE_HOME_CLIENT_NOTES.sql in the Supabase SQL Editor, then refresh this page.";

export function isMissingHomeClientNotesTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const combined = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
  if (err?.code === "PGRST205" || err?.code === "42P01") return true;
  if (combined.includes("could not find") && combined.includes("schema cache")) return true;
  if (combined.includes("home_client_notes")) return true;
  return false;
}

function assertHomeClientNotesTable(error: unknown): void {
  if (isMissingHomeClientNotesTableError(error)) {
    throw new Error(HOME_CLIENT_NOTES_SETUP_HINT);
  }
}

export const homeClientNotesApi = {
  async list(): Promise<HomeClientNote[]> {
    const { data, error } = await supabase
      .from("home_client_notes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      assertHomeClientNotesTable(error);
      throw error;
    }
    return (data ?? []) as HomeClientNote[];
  },

  async upsert(input: {
    id?: string;
    client_name: string;
    location: string;
    quote: string;
    rating?: number;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<HomeClientNote> {
    const payload = {
      client_name: input.client_name.trim(),
      location: input.location.trim(),
      quote: input.quote.trim(),
      rating: input.rating ?? 5,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      ...(input.id ? { id: input.id } : {}),
    };

    const { data, error } = await supabase
      .from("home_client_notes")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      assertHomeClientNotesTable(error);
      throw error;
    }
    return data as HomeClientNote;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("home_client_notes")
      .delete()
      .eq("id", id);

    if (error) {
      assertHomeClientNotesTable(error);
      throw error;
    }
  },
};
