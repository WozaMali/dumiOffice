import { supabase } from "@/lib/supabase";
import type { Collection, CollectionProduct, Product } from "@/types/database";

export const collectionsApi = {
  async list(): Promise<Collection[]> {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("code", { ascending: true });

    if (error) throw error;
    return (data ?? []) as Collection[];
  },

  async upsertByCode(input: {
    code: string;
    slug?: string;
    name: string;
    tagline?: string;
    description?: string;
    hero_image_url?: string;
  }): Promise<Collection> {
    const payload = {
      ...input,
      slug: input.slug ?? input.code,
    };

    const { data, error } = await supabase
      .from("collections")
      .upsert(payload, { onConflict: "code" })
      .select()
      .single();

    if (error) throw error;
    return data as Collection;
  },

  async listCollectionProducts(): Promise<
    (CollectionProduct & { collections: Collection; products: Product })[]
  > {
    const { data, error } = await supabase
      .from("collection_products")
      .select("*, collections(*), products(*)")
      .order("position", { ascending: true });

    if (error) throw error;
    return (data ?? []) as any;
  },

  async addProductToCollection(input: {
    collection_id: string;
    product_id: string;
    position?: number;
  }): Promise<CollectionProduct> {
    const { data, error } = await supabase
      .from("collection_products")
      .insert({
        collection_id: input.collection_id,
        product_id: input.product_id,
        position: input.position ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as CollectionProduct;
  },

  async removeCollectionProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("collection_products")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

