import { supabase } from "@/lib/supabase";
import type { Product, ProductImage, ProductNote } from "@/types/database";
import {
  compressImageForUploadDetailed,
  type CompressedImageResult,
} from "@/lib/utils/compress-image";

const PRODUCT_ASSETS_BUCKET = "product_assets";

async function uploadCompressedProductImage(
  file: File,
  folder: "products" | "products/gallery",
): Promise<{ path: string; compression: CompressedImageResult }> {
  const compression = await compressImageForUploadDetailed(file, "product");
  const path = `${folder}/${Date.now()}-${compression.file.name}`;
  const { data, error } = await supabase.storage
    .from(PRODUCT_ASSETS_BUCKET)
    .upload(path, compression.file, {
      contentType: compression.file.type || "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
  if (error || !data) {
    throw error || new Error("Failed to upload product image");
  }
  return { path: data.path, compression };
}

export const productContentApi = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("collection_code", { ascending: true })
      .order("product_name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const query = supabase
      .from("products")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    const { data, error } = await query;
    if (error) throw error;
    return data as Product;
  },

  /** Fragrance Products — main bottle image (compressed WebP/JPEG). */
  async uploadPrimaryImage(file: File): Promise<{
    path: string;
    compression: CompressedImageResult;
  }> {
    return uploadCompressedProductImage(file, "products");
  },

  /** Fragrance Products — gallery image (compressed), then row in product_images. */
  async uploadGalleryImage(input: {
    product_id: string;
    file: File;
    sort_order?: number;
  }): Promise<{ image: ProductImage; compression: CompressedImageResult }> {
    const { path, compression } = await uploadCompressedProductImage(
      input.file,
      "products/gallery",
    );
    const image = await this.addImage({
      product_id: input.product_id,
      kind: "gallery",
      path,
      sort_order: input.sort_order ?? 0,
    });
    return { image, compression };
  },

  // Product images (gallery)
  async listImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProductImage[];
  },

  async addImage(input: {
    product_id: string;
    kind?: string;
    path: string;
    sort_order?: number;
  }): Promise<ProductImage> {
    const { data, error } = await supabase
      .from("product_images")
      .insert({
        product_id: input.product_id,
        kind: input.kind ?? "gallery",
        path: input.path,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as ProductImage;
  },

  async deleteImage(id: string): Promise<void> {
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // Product notes (top / middle / base)
  async listNotes(productId: string): Promise<ProductNote[]> {
    const { data, error } = await supabase
      .from("product_notes")
      .select("*")
      .eq("product_id", productId)
      .order("level", { ascending: true })
      .order("position", { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProductNote[];
  },

  async upsertNote(input: {
    id?: string;
    product_id: string;
    level: "top" | "middle" | "base";
    note: string;
    position?: number;
  }): Promise<ProductNote> {
    const payload = {
      ...input,
    };

    const { data, error } = await supabase
      .from("product_notes")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return data as ProductNote;
  },

  async deleteNote(id: string): Promise<void> {
    const { error } = await supabase
      .from("product_notes")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async deleteProduct(productId: string): Promise<void> {
    // If product_images/product_notes don't exist yet in a given DB,
    // ignore "relation does not exist" errors so deletion still works.
    const ignoreIfMissingRelation = (err: any) => {
      const msg = String(err?.message || "").toLowerCase();
      return msg.includes("does not exist") || msg.includes("relation");
    };

    // Remove home bestsellers pointing at this product
    {
      const { error } = await supabase
        .from("home_bestsellers")
        .delete()
        .eq("product_id", productId);
      if (error) {
        // If table doesn't exist yet, let the error surface for visibility.
        throw error;
      }
    }

    try {
      const { error } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId);
      if (error) throw error;
    } catch (err: any) {
      if (!ignoreIfMissingRelation(err)) throw err;
    }

    try {
      const { error } = await supabase
        .from("product_notes")
        .delete()
        .eq("product_id", productId);
      if (error) throw error;
    } catch (err: any) {
      if (!ignoreIfMissingRelation(err)) throw err;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);
    if (error) throw error;
  },
};
