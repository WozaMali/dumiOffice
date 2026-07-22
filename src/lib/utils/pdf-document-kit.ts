import type { jsPDF } from "jspdf";
import {
  addPdfRasterImage,
  drawPdfLetterhead,
  loadPdfLetterheadAssets,
  type PdfRasterImage,
  type PdfSocialIcons,
} from "@/lib/utils/pdf-letterhead";

/** Shared Dumi Essence print system — ink, type, tables, totals. */
export const PDF = {
  ink: {
    charcoal: [28, 28, 28] as const,
    muted: [110, 110, 110] as const,
    soft: [160, 160, 160] as const,
    line: [220, 220, 220] as const,
    zebra: [248, 247, 244] as const,
    panel: [18, 18, 18] as const,
    gold: [200, 170, 90] as const,
    white: [255, 255, 255] as const,
    success: [46, 125, 50] as const,
    danger: [160, 40, 40] as const,
  },
  margin: 14,
  bottomReserve: 18,
};

export const pdfMoney = (amount: number) =>
  `R${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export type PdfDocContext = {
  doc: jsPDF;
  logo: PdfRasterImage | null;
  socialIcons: PdfSocialIcons;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  y: number;
  tagline?: string;
};

export async function createBrandedPdfContext(options?: {
  orientation?: "portrait" | "landscape";
  margin?: number;
  tagline?: string;
}): Promise<PdfDocContext> {
  const { createPdfDoc } = await import("@/lib/utils/pdf-letterhead");
  const doc = await createPdfDoc({
    orientation: options?.orientation ?? "landscape",
  });
  const { logo, socialIcons } = await loadPdfLetterheadAssets();
  const margin = options?.margin ?? PDF.margin;
  return {
    doc,
    logo,
    socialIcons,
    margin,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    y: 0,
    tagline: options?.tagline,
  };
}

export function pdfSetColor(
  doc: jsPDF,
  rgb: readonly [number, number, number],
  mode: "text" | "draw" | "fill" = "text",
) {
  if (mode === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else if (mode === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

/** Draw letterhead and optional document title block. Returns content Y. */
export function pdfOpenPage(
  ctx: PdfDocContext,
  options?: {
    compact?: boolean;
    title?: string;
    subtitle?: string;
    metaLeft?: string[];
    metaRight?: string[];
  },
): number {
  const { doc, logo, socialIcons, margin, pageWidth } = ctx;
  const compact = options?.compact ?? false;

  let y = drawPdfLetterhead(doc, logo, {
    margin,
    compact,
    tagline: ctx.tagline ?? "Fine fragrances and home scenting",
    socialIcons: compact ? undefined : socialIcons,
  });

  if (compact || !options?.title) {
    ctx.y = y;
    return y;
  }

  // Title rule band
  pdfSetColor(doc, PDF.ink.gold, "draw");
  doc.setLineWidth(0.4);
  doc.line(margin, y - 8, pageWidth - margin, y - 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  pdfSetColor(doc, PDF.ink.charcoal);
  doc.text(options.title, margin, y - 1);

  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    pdfSetColor(doc, PDF.ink.muted);
    doc.text(options.subtitle, margin, y + 5);
    y += 6;
  }

  const left = options.metaLeft ?? [];
  const right = options.metaRight ?? [];
  if (left.length || right.length) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    pdfSetColor(doc, PDF.ink.muted);
    left.forEach((line, i) => doc.text(line, margin, y + i * 4));
    right.forEach((line, i) =>
      doc.text(line, pageWidth - margin, y + i * 4, { align: "right" }),
    );
    y += Math.max(left.length, right.length) * 4 + 4;
  } else {
    y += 10;
  }

  ctx.y = y;
  return y;
}

export function pdfEnsureSpace(ctx: PdfDocContext, needed: number, onNewPage?: () => void) {
  const bottom = ctx.pageHeight - PDF.bottomReserve;
  if (ctx.y + needed <= bottom) return;
  ctx.doc.addPage();
  pdfOpenPage(ctx, { compact: true });
  onNewPage?.();
}

export function pdfInfoPanel(
  ctx: PdfDocContext,
  options: {
    title: string;
    leftLines: string[];
    rightLines?: string[];
    fill?: "dark" | "light";
  },
) {
  const { doc, margin, pageWidth } = ctx;
  const left = options.leftLines.filter(Boolean);
  const right = (options.rightLines ?? []).filter(Boolean);
  const rows = Math.max(left.length, right.length, 1);
  const h = 12 + rows * 4.2;
  const dark = options.fill !== "light";

  if (dark) {
    pdfSetColor(doc, PDF.ink.panel, "fill");
    pdfSetColor(doc, PDF.ink.panel, "draw");
  } else {
    pdfSetColor(doc, PDF.ink.zebra, "fill");
    pdfSetColor(doc, PDF.ink.line, "draw");
  }
  doc.roundedRect(margin, ctx.y, pageWidth - margin * 2, h, 2, 2, "FD");

  // Gold accent bar
  pdfSetColor(doc, PDF.ink.gold, "fill");
  doc.rect(margin, ctx.y, 1.2, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  pdfSetColor(doc, dark ? PDF.ink.gold : PDF.ink.muted);
  doc.text(options.title.toUpperCase(), margin + 5, ctx.y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  pdfSetColor(doc, dark ? [235, 235, 235] : PDF.ink.charcoal);
  left.forEach((line, i) => doc.text(line, margin + 5, ctx.y + 10 + i * 4.2));
  right.forEach((line, i) =>
    doc.text(line, pageWidth - margin - 5, ctx.y + 10 + i * 4.2, { align: "right" }),
  );

  ctx.y += h + 6;
}

export function pdfKpiRow(
  ctx: PdfDocContext,
  items: { label: string; value: string; emphasize?: boolean }[],
) {
  const { doc, margin, pageWidth } = ctx;
  const gap = 3;
  const n = Math.max(items.length, 1);
  const w = (pageWidth - margin * 2 - gap * (n - 1)) / n;
  const h = 16;

  items.forEach((item, i) => {
    const x = margin + i * (w + gap);
    pdfSetColor(doc, PDF.ink.zebra, "fill");
    pdfSetColor(doc, PDF.ink.line, "draw");
    doc.roundedRect(x, ctx.y, w, h, 1.5, 1.5, "FD");
    if (item.emphasize) {
      pdfSetColor(doc, PDF.ink.gold, "draw");
      doc.setLineWidth(0.6);
      doc.roundedRect(x, ctx.y, w, h, 1.5, 1.5, "D");
      doc.setLineWidth(0.2);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    pdfSetColor(doc, PDF.ink.muted);
    doc.text(item.label.toUpperCase(), x + 3, ctx.y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    pdfSetColor(doc, PDF.ink.charcoal);
    doc.text(item.value, x + 3, ctx.y + 12);
  });

  ctx.y += h + 8;
}

export type PdfColumn = {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

export function pdfTableHeader(ctx: PdfDocContext, cols: PdfColumn[]) {
  const { doc, margin } = ctx;
  const h = 9;
  const tableW = cols.reduce((s, c) => s + c.width, 0);
  const top = ctx.y;

  pdfSetColor(doc, PDF.ink.panel, "fill");
  doc.rect(margin, top, tableW, h, "F");
  pdfSetColor(doc, PDF.ink.gold, "fill");
  doc.rect(margin, top + h - 0.6, tableW, 0.6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  pdfSetColor(doc, PDF.ink.white);
  let x = margin;
  cols.forEach((c) => {
    const align = c.align ?? "left";
    const tx = align === "right" ? x + c.width - 2.5 : align === "center" ? x + c.width / 2 : x + 2.5;
    doc.text(c.label.toUpperCase(), tx, top + 5.8, { align });
    x += c.width;
  });
  // Leave clear gap so first row glyphs never collide with the header bar
  ctx.y = top + h + 1;
}

export function pdfTableRow(
  ctx: PdfDocContext,
  cols: PdfColumn[],
  values: string[],
  options?: { zebra?: boolean; bold?: boolean; fontSize?: number },
) {
  const { doc, margin } = ctx;
  const h = 7.5;
  const tableW = cols.reduce((s, c) => s + c.width, 0);
  const top = ctx.y;
  const baseline = top + 5;

  if (options?.zebra) {
    pdfSetColor(doc, PDF.ink.zebra, "fill");
    doc.rect(margin, top, tableW, h, "F");
  }
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setFontSize(options?.fontSize ?? 8);
  pdfSetColor(doc, PDF.ink.charcoal);
  let x = margin;
  values.forEach((v, i) => {
    const c = cols[i];
    if (!c) return;
    const align = c.align ?? "left";
    const tx = align === "right" ? x + c.width - 2.5 : align === "center" ? x + c.width / 2 : x + 2.5;
    // ~1.85mm per char at 8pt keeps cells from bleeding into the next column
    const maxChars = Math.max(4, Math.floor(c.width / 1.85));
    const text = String(v ?? "").slice(0, maxChars);
    doc.text(text, tx, baseline, { align });
    x += c.width;
  });
  ctx.y = top + h;
}

export function pdfSectionLabel(ctx: PdfDocContext, label: string) {
  const { doc, margin } = ctx;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  pdfSetColor(doc, PDF.ink.charcoal);
  doc.text(label, margin, ctx.y);
  pdfSetColor(doc, PDF.ink.gold, "draw");
  doc.setLineWidth(0.4);
  doc.line(margin, ctx.y + 1.2, margin + 28, ctx.y + 1.2);
  // Keep heading tight against the column header below
  ctx.y += 4;
}

export function pdfTotalsBox(
  ctx: PdfDocContext,
  lines: { label: string; value: string; bold?: boolean }[],
) {
  const { doc, margin, pageWidth } = ctx;
  const boxW = 72;
  const boxX = pageWidth - margin - boxW;
  const boxH = 8 + lines.length * 5.5;
  pdfEnsureSpace(ctx, boxH + 4);

  pdfSetColor(doc, PDF.ink.zebra, "fill");
  pdfSetColor(doc, PDF.ink.gold, "draw");
  doc.setLineWidth(0.7);
  doc.roundedRect(boxX, ctx.y, boxW, boxH, 2, 2, "FD");
  doc.setLineWidth(0.2);

  let ly = ctx.y + 6;
  lines.forEach((line) => {
    doc.setFont("helvetica", line.bold ? "bold" : "normal");
    doc.setFontSize(line.bold ? 10 : 8);
    pdfSetColor(doc, PDF.ink.charcoal);
    doc.text(line.label, boxX + 4, ly);
    doc.text(line.value, boxX + boxW - 4, ly, { align: "right" });
    ly += 5.5;
  });
  ctx.y += boxH + 6;
}

export function pdfFooterNote(ctx: PdfDocContext, note: string) {
  const { doc, margin, pageHeight } = ctx;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  pdfSetColor(doc, PDF.ink.muted);
  doc.text(note, margin, pageHeight - 10);
}

export function pdfDrawSignature(
  ctx: PdfDocContext,
  signature: PdfRasterImage | null,
  caption = "Dumisani · Founder",
) {
  const { doc, margin, pageHeight } = ctx;
  const sigHeight = 16;
  const sigY = pageHeight - (sigHeight + 14);
  if (signature) {
    const sigWidth = (signature.width / signature.height) * sigHeight;
    addPdfRasterImage(doc, signature, margin, sigY, sigWidth, sigHeight);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  pdfSetColor(doc, PDF.ink.muted);
  doc.text(caption, margin, sigY + sigHeight + 4);
}
