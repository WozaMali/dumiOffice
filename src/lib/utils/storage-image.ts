export type StorageBucket = "product_assets" | "hero-assets";

export type ImagePreset =
  | "thumb"
  | "card"
  | "pdp"
  | "hero"
  | "homeCarousel"
  | "popup"
  | "personalisation";

const PRESET_SIZES: Record<
  ImagePreset,
  { width: number; quality: number; height?: number }
> = {
  thumb: { width: 320, quality: 70 },
  card: { width: 480, quality: 75 },
  pdp: { width: 960, quality: 80 },
  hero: { width: 1200, quality: 80 },
  homeCarousel: { width: 1440, height: 614, quality: 80 },
  popup: { width: 800, quality: 75 },
  personalisation: { width: 600, quality: 80 },
};

function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
}

export function imageTransformsEnabled(): boolean {
  const flag = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS as string | undefined;
  return flag !== "false" && flag !== "0";
}

export function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");
}

/** Re-encode object paths in Supabase public URLs (fixes spaces in filenames). */
export function fixSupabasePublicUrl(url: string): string {
  if (!url.startsWith("http")) return url;

  const objectMatch = url.match(
    /^(https?:\/\/[^/]+)(\/storage\/v1\/object\/public\/)([^/]+)\/(.+)$/i,
  );
  if (objectMatch) {
    const [, origin, prefix, bucket, objectPath] = objectMatch;
    const cleanPath = objectPath.split("?")[0];
    return `${origin}${prefix}${bucket}/${encodeStoragePath(decodeURIComponent(cleanPath))}`;
  }

  const renderMatch = url.match(
    /^(https?:\/\/[^/]+)(\/storage\/v1\/render\/image\/public\/)([^/]+)\/(.+?)(\?.*)?$/i,
  );
  if (renderMatch) {
    const [, origin, prefix, bucket, objectPath, query = ""] = renderMatch;
    return `${origin}${prefix}${bucket}/${encodeStoragePath(decodeURIComponent(objectPath))}${query}`;
  }

  return encodeURI(url);
}

export function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const safe =
    base
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 80) || "image";
  return `${safe}${ext.toLowerCase()}`;
}

function normalizeStoragePath(path: string): string {
  return path.replace(/^\/+/, "");
}

export function supabaseStorageImageUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "webp" | "origin";
    transform?: boolean;
  },
): string {
  if (!path) return "";
  if (path.startsWith("http")) return fixSupabasePublicUrl(path);
  if (path.startsWith("/")) return path;

  const base = supabaseUrl();
  const objectPath = encodeStoragePath(normalizeStoragePath(path));
  if (!base || !objectPath) return path;

  const width = options?.width;
  const shouldTransform =
    imageTransformsEnabled() && options?.transform !== false && width != null;

  if (shouldTransform) {
    const params = new URLSearchParams({
      width: String(width),
      quality: String(options?.quality ?? 75),
      format: options?.format ?? "webp",
    });
    if (options?.height) params.set("height", String(options.height));
    return `${base}/storage/v1/render/image/public/${bucket}/${objectPath}?${params}`;
  }

  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function supabaseImageFromPreset(
  bucket: StorageBucket,
  path: string | null | undefined,
  preset: ImagePreset,
): string {
  const size = PRESET_SIZES[preset];
  return supabaseStorageImageUrl(bucket, path, {
    width: size.width,
    height: size.height,
    quality: size.quality,
    format: "webp",
  });
}

export function supabaseStorageImageFallbackUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
): string {
  return supabaseStorageImageUrl(bucket, path, { transform: false });
}

export function productStorageImageUrl(
  path: string | null | undefined,
  preset: ImagePreset = "card",
): string {
  return supabaseImageFromPreset("product_assets", path, preset);
}

export function productStorageImageSrcSet(
  path: string | null | undefined,
  preset: ImagePreset = "card",
): string | undefined {
  if (!path || !imageTransformsEnabled()) return undefined;

  const main = PRESET_SIZES[preset].width;
  const entries = [
    { width: 320, quality: 70 },
    { width: main, quality: PRESET_SIZES[preset].quality },
    { width: Math.round(main * 1.33), quality: PRESET_SIZES[preset].quality },
  ];

  const unique = entries.filter(
    (entry, index, list) => list.findIndex((e) => e.width === entry.width) === index,
  );

  return unique
    .map(
      (entry) =>
        `${supabaseStorageImageUrl("product_assets", path, {
          width: entry.width,
          quality: entry.quality,
          format: "webp",
        })} ${entry.width}w`,
    )
    .join(", ");
}

export function heroStorageImageUrl(
  path: string | null | undefined,
  preset: ImagePreset = "hero",
): string {
  return supabaseImageFromPreset("hero-assets", path, preset);
}

export function personalisationStorageImageUrl(
  path: string | null | undefined,
  preset: ImagePreset = "personalisation",
): string {
  return supabaseImageFromPreset("hero-assets", path, preset);
}

export function collectionStorageImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) {
    return optimizeStoredPublicUrl(fixSupabasePublicUrl(path), "card");
  }
  if (path.startsWith("/")) {
    return supabaseImageFromPreset(
      "product_assets",
      normalizeStoragePath(path),
      "card",
    );
  }
  return supabaseImageFromPreset("hero-assets", path, "card");
}

export function collectionStorageImageFallbackUrl(
  path: string | null | undefined,
): string {
  if (!path) return "";
  if (path.startsWith("http")) {
    return fixSupabasePublicUrl(path);
  }
  if (path.startsWith("/")) {
    return supabaseStorageImageUrl("product_assets", normalizeStoragePath(path), {
      transform: false,
    });
  }
  return supabaseStorageImageUrl("hero-assets", path, { transform: false });
}

/** Full public storage URLs saved in the database (popup, collections). */
export function optimizeStoredPublicUrl(
  url: string | null | undefined,
  preset: ImagePreset = "card",
): string {
  if (!url) return "";
  if (!imageTransformsEnabled()) return url;

  const objectMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (objectMatch) {
    const [, bucket, objectPath] = objectMatch;
    return supabaseImageFromPreset(
      bucket as StorageBucket,
      decodeURIComponent(objectPath),
      preset,
    );
  }

  const renderMatch = url.match(/\/storage\/v1\/render\/image\/public\/([^/]+)\/(.+?)(?:\?|$)/);
  if (renderMatch) {
    const [, bucket, objectPath] = renderMatch;
    return supabaseImageFromPreset(
      bucket as StorageBucket,
      decodeURIComponent(objectPath),
      preset,
    );
  }

  return url;
}

export function storedPublicUrlFallback(url: string | null | undefined): string {
  if (!url) return "";
  const fixed = fixSupabasePublicUrl(url);
  const objectMatch = fixed.match(/\/storage\/v1\/object\/public\/(.+)$/);
  if (objectMatch) return fixed;

  const renderMatch = fixed.match(/\/storage\/v1\/render\/image\/public\/(.+?)(?:\?|$)/);
  if (renderMatch) {
    const base = supabaseUrl();
    return base
      ? `${base}/storage/v1/object/public/${renderMatch[1]}`
      : fixed;
  }

  return fixed;
}

/** Non-transform public URL for storefront collection cards. */
export function collectionHeroPublicUrl(path: string | null | undefined): string {
  return collectionStorageImageFallbackUrl(path);
}
