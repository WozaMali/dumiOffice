/**
 * Aggressively compress PDFs before Supabase Storage upload.
 * Rasterizes pages → JPEG → rebuilds with jsPDF for maximum size reduction.
 */

import { jsPDF } from "jspdf";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfUploadPreset = "document" | "attachment";

type PdfPresetConfig = {
  /** Max long-edge pixels per page */
  maxEdge: number;
  /** JPEG quality 0–1 */
  quality: number;
  /** Soft total size target; quality steps down until under or min */
  maxBytes: number;
  /** Convert to grayscale (smaller, fine for receipts) */
  grayscale: boolean;
};

const PRESETS: Record<PdfUploadPreset, PdfPresetConfig> = {
  document: {
    maxEdge: 1100,
    quality: 0.52,
    maxBytes: 600_000,
    grayscale: false,
  },
  attachment: {
    maxEdge: 1000,
    quality: 0.45,
    maxBytes: 400_000,
    grayscale: true,
  },
};

const MIN_QUALITY = 0.28;
const QUALITY_STEP = 0.07;
const MAX_PAGES = 40;

function isPdfFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function safePdfName(name: string): string {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const safe =
    base
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 80) || "document";
  return `${safe}.pdf`;
}

function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): string {
  return canvas.toDataURL("image/jpeg", quality);
}

async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  maxEdge: number,
  grayscale: boolean,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1, maxEdge / Math.max(base.width, base.height, 1));
  const viewport = page.getViewport({ scale: Math.max(scale, 0.15) });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for PDF compression");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  if (grayscale) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(image, 0, 0);
  }

  return canvas;
}

function buildPdfFromCanvases(
  canvases: HTMLCanvasElement[],
  quality: number,
): Blob {
  const first = canvases[0];
  const orient = first.width >= first.height ? "l" : "p";
  const doc = new jsPDF({
    orientation: orient,
    unit: "pt",
    format: [first.width, first.height],
    compress: true,
  });

  canvases.forEach((canvas, index) => {
    if (index > 0) {
      doc.addPage([canvas.width, canvas.height], canvas.width >= canvas.height ? "l" : "p");
    }
    const dataUrl = canvasToJpegDataUrl(canvas, quality);
    doc.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
  });

  return doc.output("blob");
}

/**
 * Compress a PDF for Storage upload. Non-PDFs are returned unchanged.
 * Falls back to the original file if compression fails or is not smaller.
 */
export async function compressPdfForUpload(
  file: File,
  preset: PdfUploadPreset = "document",
): Promise<File> {
  if (!isPdfFile(file)) return file;

  // Already tiny — skip heavy work
  if (file.size <= 80_000) return file;

  const config = PRESETS[preset];
  let pdf: PDFDocumentProxy | null = null;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    pdf = await getDocument({ data, useSystemFonts: true }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    if (pageCount < 1) return file;

    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= pageCount; i += 1) {
      canvases.push(await renderPageToCanvas(pdf, i, config.maxEdge, config.grayscale));
    }

    let quality = config.quality;
    let best: Blob | null = null;

    while (quality >= MIN_QUALITY - 0.001) {
      const blob = buildPdfFromCanvases(canvases, quality);
      best = blob;
      if (blob.size <= config.maxBytes) break;
      quality -= QUALITY_STEP;
    }

    if (!best) return file;

    // Prefer compressed only when meaningfully smaller
    if (best.size >= file.size * 0.92) return file;

    return new File([best], safePdfName(file.name), {
      type: "application/pdf",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    try {
      await pdf?.destroy();
    } catch {
      // ignore
    }
  }
}

export function isPdfUpload(file: File): boolean {
  return isPdfFile(file);
}
