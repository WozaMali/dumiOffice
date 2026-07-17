/**
 * Client-side image compression before Supabase Storage upload.
 * Encodes to WebP (JPEG fallback) at bounded dimensions to cut storage + egress.
 */

export type ImageUploadPreset =
  | "hero"
  | "product"
  | "collection"
  | "bundle"
  | "personalisation"
  | "popup"
  | "attachment";

export type CompressedImageResult = {
  file: File;
  originalBytes: number;
  outputBytes: number;
  didCompress: boolean;
};

type PresetConfig = {
  maxWidth: number;
  maxHeight: number;
  /** WebP/JPEG quality 0–1 */
  quality: number;
  /** Soft cap; quality is stepped down until under this or min quality */
  maxBytes: number;
};

const PRESETS: Record<ImageUploadPreset, PresetConfig> = {
  hero: { maxWidth: 1920, maxHeight: 1920, quality: 0.78, maxBytes: 450_000 },
  // Fragrance Products main + gallery — tight for storefront cards/PDP
  product: { maxWidth: 1400, maxHeight: 1400, quality: 0.74, maxBytes: 280_000 },
  collection: { maxWidth: 1200, maxHeight: 1200, quality: 0.75, maxBytes: 280_000 },
  bundle: { maxWidth: 1600, maxHeight: 1000, quality: 0.76, maxBytes: 320_000 },
  personalisation: { maxWidth: 1000, maxHeight: 1400, quality: 0.78, maxBytes: 250_000 },
  popup: { maxWidth: 1200, maxHeight: 1200, quality: 0.75, maxBytes: 280_000 },
  attachment: { maxWidth: 1600, maxHeight: 1600, quality: 0.72, maxBytes: 400_000 },
};

const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.06;

function isCompressibleImage(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) return false;
  // Keep animated / vector originals intact
  if (type === "image/gif" || type === "image/svg+xml") return false;
  return true;
}

function supportsWebpEncoding(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image for compression"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function replaceExtension(name: string, ext: string): string {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const safe =
    base
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 80) || "image";
  return `${safe}${ext}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function compressionToastMessage(
  label: string,
  result: Pick<CompressedImageResult, "originalBytes" | "outputBytes" | "didCompress">,
): string {
  if (!result.didCompress || result.outputBytes >= result.originalBytes) {
    return `${label} uploaded (${formatBytes(result.outputBytes)}).`;
  }
  return `${label} uploaded — compressed ${formatBytes(result.originalBytes)} → ${formatBytes(result.outputBytes)}.`;
}

/**
 * Compress an image for Storage upload. Non-images / GIF / SVG are returned unchanged.
 * Prefer WebP; fall back to JPEG when the browser cannot encode WebP.
 */
export async function compressImageForUpload(
  file: File,
  preset: ImageUploadPreset = "product",
): Promise<File> {
  const result = await compressImageForUploadDetailed(file, preset);
  return result.file;
}

/** Same as {@link compressImageForUpload} but includes size stats for UI feedback. */
export async function compressImageForUploadDetailed(
  file: File,
  preset: ImageUploadPreset = "product",
): Promise<CompressedImageResult> {
  const originalBytes = file.size;
  if (!isCompressibleImage(file)) {
    return { file, originalBytes, outputBytes: file.size, didCompress: false };
  }

  const config = PRESETS[preset];
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { file, originalBytes, outputBytes: file.size, didCompress: false };
  }

  const scale = Math.min(
    1,
    config.maxWidth / Math.max(img.naturalWidth || img.width, 1),
    config.maxHeight / Math.max(img.naturalHeight || img.height, 1),
  );
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { file, originalBytes, outputBytes: file.size, didCompress: false };
  }

  // White matte so transparent PNGs don't get a black WebP background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const useWebp = supportsWebpEncoding();
  const mime = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? ".webp" : ".jpg";

  let quality = config.quality;
  let best: Blob | null = null;

  while (quality >= MIN_QUALITY - 0.001) {
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) break;
    best = blob;
    if (blob.size <= config.maxBytes) break;
    quality -= QUALITY_STEP;
  }

  if (!best) {
    return { file, originalBytes, outputBytes: file.size, didCompress: false };
  }

  // Keep original only when it is already smaller (rare for phone photos)
  if (best.size >= file.size * 0.95 && file.size <= config.maxBytes) {
    return { file, originalBytes, outputBytes: file.size, didCompress: false };
  }

  const out = new File([best], replaceExtension(file.name, ext), {
    type: mime,
    lastModified: Date.now(),
  });

  return {
    file: out,
    originalBytes,
    outputBytes: out.size,
    didCompress: true,
  };
}
