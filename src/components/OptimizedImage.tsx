import { useEffect, useState } from "react";
import type { ImagePreset, StorageBucket } from "@/lib/utils/storage-image";
import {
  optimizeStoredPublicUrl,
  storedPublicUrlFallback,
  supabaseImageFromPreset,
  supabaseStorageImageFallbackUrl,
} from "@/lib/utils/storage-image";

type OptimizedImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  /** Relative storage path */
  path?: string | null;
  bucket?: StorageBucket;
  /** Full URL (e.g. popup / collection rows) */
  src?: string | null;
  preset?: ImagePreset;
};

export default function OptimizedImage({
  path,
  bucket,
  src: srcProp,
  preset = "card",
  onError,
  ...imgProps
}: OptimizedImageProps) {
  const optimized =
    srcProp != null && srcProp !== ""
      ? optimizeStoredPublicUrl(srcProp, preset)
      : bucket && path
        ? supabaseImageFromPreset(bucket, path, preset)
        : "";

  const fallback =
    srcProp != null && srcProp !== ""
      ? storedPublicUrlFallback(srcProp)
      : bucket && path
        ? supabaseStorageImageFallbackUrl(bucket, path)
        : optimized;

  const [src, setSrc] = useState(optimized);

  useEffect(() => {
    setSrc(optimized);
  }, [optimized]);

  if (!optimized) return null;

  return (
    <img
      {...imgProps}
      src={src || optimized}
      onError={(event) => {
        if (src !== fallback && fallback) {
          setSrc(fallback);
        }
        onError?.(event);
      }}
    />
  );
}
