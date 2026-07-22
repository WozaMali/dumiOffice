import type { jsPDF } from "jspdf";
import type { jsPDFOptions } from "jspdf";

export const DUMI_LOGO_PATH = "/Dumi Essence.png";

const LOGO_Y = 11;
const LOGO_HEIGHT_MM = 18;
const PDF_RASTER_SCALE = 3;

export type PdfRasterImage = {
  data: string;
  format: "JPEG" | "PNG";
  width: number;
  height: number;
  alias: string;
};

export type PdfSocialIcons = {
  tiktok: PdfRasterImage | null;
  whatsapp: PdfRasterImage | null;
  instagram: PdfRasterImage | null;
  facebook: PdfRasterImage | null;
};

const loadImageElement = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

export async function createPdfDoc(options: jsPDFOptions = {}): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({
    compress: true,
    putOnlyUsedFonts: true,
    precision: 2,
    ...options,
  });
}

type RasterizeOptions = {
  maxWidthPx?: number;
  maxHeightPx?: number;
  quality?: number;
  format?: "JPEG" | "PNG";
  alias?: string;
  background?: string;
};

export function rasterizeImageForPdf(
  img: HTMLImageElement,
  options: RasterizeOptions = {},
): PdfRasterImage | null {
  const format = options.format ?? "JPEG";
  const quality = options.quality ?? 0.92;
  const maxW = options.maxWidthPx ?? 800;
  const maxH = options.maxHeightPx ?? 400;

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const scale = Math.min(1, maxW / w, maxH / h);
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.drawImage(img, 0, 0, w, h);

  const data =
    format === "PNG"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", quality);
  const alias = options.alias ?? `pdf_img_${format}_${w}x${h}`;

  return { data, format, width: w, height: h, alias };
}

export async function loadPdfRasterImage(
  src: string,
  options: RasterizeOptions = {},
): Promise<PdfRasterImage | null> {
  const img = await loadImageElement(src);
  if (!img) return null;
  return rasterizeImageForPdf(img, options);
}

export const loadPdfLogo = (src: string = DUMI_LOGO_PATH): Promise<PdfRasterImage | null> =>
  loadPdfRasterImage(src, {
    format: "PNG",
    maxWidthPx: 1200,
    maxHeightPx: Math.round(LOGO_HEIGHT_MM * PDF_RASTER_SCALE * 12),
    alias: "dumi_essence_logo",
    background: "#141414",
  });

export async function loadPdfSocialIcons(): Promise<PdfSocialIcons> {
  const iconOpts = {
    format: "PNG" as const,
    maxWidthPx: 48,
    maxHeightPx: 48,
  };
  const [tiktok, whatsapp, instagram, facebook] = await Promise.all([
    loadPdfRasterImage("/icons/TikTok.png", { ...iconOpts, alias: "icon_tiktok" }),
    loadPdfRasterImage("/icons/Whatsapp.png", { ...iconOpts, alias: "icon_whatsapp" }),
    loadPdfRasterImage("/icons/Instagram.png", { ...iconOpts, alias: "icon_instagram" }),
    loadPdfRasterImage("/icons/Facebook.png", { ...iconOpts, alias: "icon_facebook" }),
  ]);
  return { tiktok, whatsapp, instagram, facebook };
}

export async function loadPdfLetterheadAssets(logoPath: string = DUMI_LOGO_PATH) {
  const [logo, socialIcons] = await Promise.all([
    loadPdfLogo(logoPath),
    loadPdfSocialIcons(),
  ]);
  return { logo, socialIcons };
}

export function addPdfRasterImage(
  doc: jsPDF,
  image: PdfRasterImage,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.addImage(image.data, image.format, x, y, w, h, image.alias, "SLOW");
}

const drawSocialIconRow = (
  doc: jsPDF,
  margin: number,
  taglineY: number,
  icons: PdfSocialIcons,
) => {
  const iconSize = 4;
  const gap = 2;
  const iconsY = taglineY + 5;
  let iconX = margin;

  const placeIcon = (icon: PdfRasterImage | null) => {
    if (!icon) return;
    addPdfRasterImage(doc, icon, iconX, iconsY, iconSize, iconSize);
    iconX += iconSize + gap;
  };

  placeIcon(icons.tiktok);
  placeIcon(icons.whatsapp);
  placeIcon(icons.instagram);
  placeIcon(icons.facebook);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 220, 220);
  doc.text("Dumi Essence", iconX + 2, iconsY + iconSize - 1.2);
};

const drawContactBlock = (doc: jsPDF, pageWidth: number, margin: number) => {
  const infoX = pageWidth - margin;
  let yInfo = 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  ["652 Hashe Street", "Dobsonville, Soweto", "1863"].forEach((line) => {
    doc.text(line, infoX, yInfo, { align: "right" });
    yInfo += 4;
  });
  yInfo += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Contacts", infoX, yInfo, { align: "right" });
  yInfo += 4;
  doc.setFont("helvetica", "normal");
  doc.text("info@dumiessence.co.za", infoX, yInfo, { align: "right" });
  yInfo += 4;
  doc.text("072 849 5559", infoX, yInfo, { align: "right" });
};

export type DrawPdfLetterheadOptions = {
  margin?: number;
  tagline?: string;
  /** Page 2+: band, logo, and gold rule only. */
  compact?: boolean;
  socialIcons?: PdfSocialIcons;
};

/** Standard Dumi Essence letterhead (matches order receipt layout). */
export function drawPdfLetterhead(
  doc: jsPDF,
  logo: PdfRasterImage | null,
  options: DrawPdfLetterheadOptions = {},
): number {
  const margin = options.margin ?? 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const compact = options.compact ?? false;
  const tagline = options.tagline ?? "Fine fragrances and home scenting";

  doc.setFillColor(20, 20, 20);
  const bandH = compact ? 28 : 40;
  doc.rect(0, 0, pageWidth, bandH, "F");

  if (logo) {
    const logoH = compact ? 12 : LOGO_HEIGHT_MM;
    const logoY = compact ? 8 : LOGO_Y;
    const logoWidth = (logo.width / logo.height) * logoH;
    addPdfRasterImage(
      doc,
      logo,
      (pageWidth - logoWidth) / 2,
      logoY,
      logoWidth,
      logoH,
    );
  }

  if (!compact) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", margin, LOGO_Y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    const taglineY = LOGO_Y + 13;
    doc.text(tagline, margin, taglineY);

    if (options.socialIcons) {
      drawSocialIconRow(doc, margin, taglineY, options.socialIcons);
    }

    drawContactBlock(doc, pageWidth, margin);
  }

  doc.setDrawColor(200, 170, 90);
  doc.setLineWidth(0.6);
  const ruleY = compact ? 32 : 45;
  doc.line(margin, ruleY, pageWidth - margin, ruleY);

  return compact ? 36 : 70;
}
