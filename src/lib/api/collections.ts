import { supabase } from "@/lib/supabase";
import type { Collection, CollectionProduct, Product } from "@/types/database";
import { compressImageForUpload } from "@/lib/utils/compress-image";

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
    const payload: Record<string, unknown> = {
      ...input,
      slug: input.slug ?? input.code,
    };
    // Storefront useFeaturedCollections reads `image` when Supabase is connected
    if (input.hero_image_url !== undefined) {
      payload.image = input.hero_image_url;
    }

    const { data, error } = await supabase
      .from("collections")
      .upsert(payload, { onConflict: "code" })
      .select()
      .single();

    if (error) throw error;
    return data as Collection;
  },

  /** Upload shop card image to hero-assets/collections/{code}-hero.{ext} */
  async uploadHeroImage(file: File, collectionCode: string): Promise<string> {
    const bucket = "hero-assets";
    const compressed = await compressImageForUpload(file, "collection");
    const ext = compressed.name.includes(".")
      ? compressed.name.slice(compressed.name.lastIndexOf(".")).toLowerCase()
      : ".webp";
    const path = `collections/${collectionCode}-hero${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, compressed, {
        upsert: true,
        contentType: compressed.type || undefined,
      });

    if (error || !data) {
      throw error || new Error("Failed to upload collection image");
    }

    return data.path;
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

