/**
 * Route uploads through the right compressor before Supabase Storage.
 */

import {
  compressImageForUpload,
  type ImageUploadPreset,
} from "@/lib/utils/compress-image";
import {
  compressPdfForUpload,
  isPdfUpload,
  type PdfUploadPreset,
} from "@/lib/utils/compress-pdf";

export type UploadCompressPreset = ImageUploadPreset | PdfUploadPreset;

function pdfPresetFor(preset: UploadCompressPreset): PdfUploadPreset {
  return preset === "attachment" ? "attachment" : "document";
}

function imagePresetFor(preset: UploadCompressPreset): ImageUploadPreset {
  if (
    preset === "hero" ||
    preset === "product" ||
    preset === "collection" ||
    preset === "bundle" ||
    preset === "personalisation" ||
    preset === "popup" ||
    preset === "attachment"
  ) {
    return preset;
  }
  return "product";
}

/** Compress images and PDFs; other file types pass through unchanged. */
export async function compressFileForUpload(
  file: File,
  preset: UploadCompressPreset = "product",
): Promise<File> {
  if (isPdfUpload(file)) {
    return compressPdfForUpload(file, pdfPresetFor(preset));
  }
  return compressImageForUpload(file, imagePresetFor(preset));
}
