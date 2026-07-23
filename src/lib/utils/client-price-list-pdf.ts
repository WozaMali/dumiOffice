import type { Product } from "@/types/database";
import {
  createBrandedPdfContext,
  PDF,
  pdfEnsureSpace,
  pdfFooterNote,
  pdfMoney,
  pdfOpenPage,
  pdfSectionLabel,
  pdfSetColor,
  pdfTableHeader,
  pdfTableRow,
  type PdfColumn,
  type PdfDocContext,
} from "@/lib/utils/pdf-document-kit";
import {
  addPdfRasterImage,
  type PdfRasterImage,
} from "@/lib/utils/pdf-letterhead";
import {
  CONTENT_PRODUCT_SECTIONS,
  STOREFRONT_COLLECTION_PRESETS,
  groupContentProducts,
  type ContentProductGroupKey,
} from "@/lib/utils/product-lines";

const PRICE_HERO_PATH = "/price.png";
const HERO_BAND_MM = 88;
const HERO_TARGET_WIDTH_PX = 1754;

const CONTACT = {
  email: "info@dumiessence.co.za",
  phone: "072 849 5559",
  whatsapp: "072 849 5559",
  website: "www.dumiessence.co.za",
};

export type ClientPriceListOptions = {
  preparedFor?: string | null;
};

const SECTION_TAGLINES: Record<ContentProductGroupKey, string> = {
  mens:
    STOREFRONT_COLLECTION_PRESETS.find((p) => p.code === "mens")?.tagline ??
    "Structured signatures with warmth, woods, and presence.",
  womens:
    STOREFRONT_COLLECTION_PRESETS.find((p) => p.code === "womens")?.tagline ??
    "Polished florals and luminous amber compositions.",
  unisex:
    STOREFRONT_COLLECTION_PRESETS.find((p) => p.code === "unisex")?.tagline ??
    "Modern, versatile luxury for everyday wear.",
  diffusers:
    STOREFRONT_COLLECTION_PRESETS.find((p) => p.code === "diffuser")?.tagline ??
    "Elevated spaces.",
  carPerfume:
    STOREFRONT_COLLECTION_PRESETS.find((p) => p.code === "car-perfumes")?.tagline ??
    "Refined drive.",
  showerGel: "Body care essentials.",
  bodyLotion: "Body care essentials.",
  bodyOil: "Body care essentials.",
  other: "Additional house offerings.",
};

function activeSorted(products: Product[]): Product[] {
  return products
    .filter((p) => p.is_active !== false)
    .slice()
    .sort((a, b) =>
      (a.product_name || a.name || "").localeCompare(b.product_name || b.name || ""),
    );
}

function retailForSize(p: Product, size: 30 | 50 | 100 | 200): number | null {
  const raw =
    size === 30
      ? p.price_30ml
      : size === 50
        ? p.price_50ml
        : size === 100
          ? p.price_100ml
          : p.price_200ml;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw);

  // Fall back to single retail price for the product's usual size
  const fallback = p.price ?? p.base_price;
  if (fallback == null || !Number.isFinite(Number(fallback))) return null;

  const usual =
    p.product_category === "Diffuser"
      ? 200
      : 50;
  return size === usual ? Number(fallback) : null;
}

function moneyOrDash(n: number | null): string {
  return n == null ? "—" : pdfMoney(n);
}

function productTypeLabel(_p: Product): string {
  return "Extrait De Parfum";
}

function productFlags(p: Product): string {
  const flags: string[] = [];
  if (p.is_new) flags.push("New");
  if (p.is_bestseller) flags.push("Bestseller");
  return flags.join(" · ");
}

function deNameWithFlags(p: Product): string {
  const name = (p.product_name || p.name || "").trim();
  const flags = productFlags(p);
  return flags ? `${name}  [${flags}]` : name;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

async function loadHeroCoverImage(
  pageWidthMm: number,
  bandHeightMm: number,
): Promise<PdfRasterImage | null> {
  const img = await loadImageElement(PRICE_HERO_PATH);
  if (!img) return null;

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return null;

  const bandAspect = pageWidthMm / bandHeightMm;
  const srcAspect = srcW / srcH;

  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;

  if (srcAspect > bandAspect) {
    sh = srcH;
    sw = srcH * bandAspect;
    sx = (srcW - sw) / 2;
    sy = 0;
  } else {
    sw = srcW;
    sh = srcW / bandAspect;
    sx = 0;
    sy = (srcH - sh) / 2;
  }

  const outW = HERO_TARGET_WIDTH_PX;
  const outH = Math.max(1, Math.round(outW / bandAspect));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return null;

  ctx2d.fillStyle = "#8a8a8a";
  ctx2d.fillRect(0, 0, outW, outH);
  ctx2d.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  return {
    data: canvas.toDataURL("image/jpeg", 0.92),
    format: "JPEG",
    width: outW,
    height: outH,
    alias: "dumi_price_list_hero",
  };
}

function drawHeroHeader(ctx: PdfDocContext, hero: PdfRasterImage) {
  const { doc, pageWidth } = ctx;
  const bandH = HERO_BAND_MM;
  addPdfRasterImage(doc, hero, 0, 0, pageWidth, bandH);
  pdfSetColor(doc, PDF.ink.gold, "fill");
  doc.rect(0, bandH - 0.7, pageWidth, 0.7, "F");
  ctx.y = bandH + 6;
}

function drawTitleBlock(
  ctx: PdfDocContext,
  options: {
    productCount: number;
    generated: string;
    preparedFor?: string | null;
  },
) {
  const { doc, margin, pageWidth } = ctx;
  const { productCount, generated, preparedFor } = options;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  pdfSetColor(doc, PDF.ink.charcoal);
  doc.text("Client Price List", margin, ctx.y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  pdfSetColor(doc, PDF.ink.muted);
  doc.text("Dumi Essence · Extrait de Parfum & home scenting", margin, ctx.y + 5.5);

  if (preparedFor?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    pdfSetColor(doc, PDF.ink.charcoal);
    doc.text(`Prepared for: ${preparedFor.trim()}`, margin, ctx.y + 11);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  pdfSetColor(doc, PDF.ink.muted);
  doc.text(`Prices valid as of ${generated}`, pageWidth - margin, ctx.y, { align: "right" });
  doc.text(`${productCount} products · ZAR`, pageWidth - margin, ctx.y + 4.5, {
    align: "right",
  });

  const leftBottom = preparedFor?.trim() ? ctx.y + 14 : ctx.y + 9;
  pdfSetColor(doc, PDF.ink.gold, "draw");
  doc.setLineWidth(0.4);
  doc.line(margin, leftBottom, pageWidth - margin, leftBottom);
  ctx.y = leftBottom + 5;
}

function drawContactStrip(ctx: PdfDocContext) {
  const { doc, margin, pageWidth } = ctx;
  const h = 14;
  pdfEnsureSpace(ctx, h + 4);

  pdfSetColor(doc, PDF.ink.panel, "fill");
  doc.roundedRect(margin, ctx.y, pageWidth - margin * 2, h, 1.5, 1.5, "F");
  pdfSetColor(doc, PDF.ink.gold, "fill");
  doc.rect(margin, ctx.y, 1.2, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  pdfSetColor(doc, PDF.ink.gold);
  doc.text("ORDER", margin + 4, ctx.y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  pdfSetColor(doc, PDF.ink.white);
  doc.text(
    `${CONTACT.website}  ·  WhatsApp ${CONTACT.whatsapp}  ·  ${CONTACT.email}`,
    margin + 4,
    ctx.y + 10,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  pdfSetColor(doc, PDF.ink.gold);
  doc.text("Order online or WhatsApp", pageWidth - margin - 4, ctx.y + 8, {
    align: "right",
  });

  ctx.y += h + 6;
}

function drawSectionIntro(ctx: PdfDocContext, label: string, tagline: string) {
  pdfSectionLabel(ctx, label);
  docMutedLine(ctx, tagline);
  ctx.y += 1;
}

function docMutedLine(ctx: PdfDocContext, text: string) {
  const { doc, margin } = ctx;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  pdfSetColor(doc, PDF.ink.muted);
  doc.text(text, margin, ctx.y);
  ctx.y += 4;
}

function buildColumns(contentW: number): PdfColumn[] {
  return [
    { label: "DE name", width: contentW * 0.145 },
    { label: "Brand", width: contentW * 0.085 },
    { label: "SKU", width: contentW * 0.085 },
    { label: "Inspired by", width: contentW * 0.135 },
    { label: "Designer", width: contentW * 0.1 },
    { label: "Type", width: contentW * 0.14 },
    { label: "30ml", width: contentW * 0.0775, align: "right" },
    { label: "50ml", width: contentW * 0.0775, align: "right" },
    { label: "100ml", width: contentW * 0.0775, align: "right" },
    { label: "200ml", width: contentW * 0.0775, align: "right" },
  ];
}

function rowValues(p: Product): string[] {
  return [
    deNameWithFlags(p),
    p.brand || "—",
    p.sku || "—",
    p.inspired_by || "—",
    p.designer || "—",
    productTypeLabel(p),
    moneyOrDash(retailForSize(p, 30)),
    moneyOrDash(retailForSize(p, 50)),
    moneyOrDash(retailForSize(p, 100)),
    moneyOrDash(retailForSize(p, 200)),
  ];
}

function addPageNumbers(ctx: PdfDocContext) {
  const { doc, pageWidth, pageHeight, margin } = ctx;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    pdfSetColor(doc, PDF.ink.soft);
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, pageHeight - 6, {
      align: "right",
    });
  }
}

export async function generateClientPriceListPdf(
  products: Product[],
  options: ClientPriceListOptions = {},
): Promise<void> {
  const active = activeSorted(products);
  const generated = new Date().toISOString().slice(0, 10);
  const preparedFor = options.preparedFor?.trim() || null;

  const ctx = await createBrandedPdfContext({
    orientation: "landscape",
    tagline: "Client price list",
  });

  const hero = await loadHeroCoverImage(ctx.pageWidth, HERO_BAND_MM);

  if (hero) {
    drawHeroHeader(ctx, hero);
    drawTitleBlock(ctx, {
      productCount: active.length,
      generated,
      preparedFor,
    });
  } else {
    pdfOpenPage(ctx, {
      title: "Client Price List",
      subtitle: "Dumi Essence · Extrait de Parfum & home scenting",
      metaLeft: [
        `Prices valid as of ${generated}`,
        preparedFor ? `Prepared for: ${preparedFor}` : "",
      ].filter(Boolean),
      metaRight: [`${active.length} products · ZAR`],
    });
  }

  drawContactStrip(ctx);

  const cols = buildColumns(ctx.pageWidth - ctx.margin * 2);
  const grouped = groupContentProducts(active);

  let any = false;
  for (const section of CONTENT_PRODUCT_SECTIONS) {
    const sectionProducts = grouped[section.key];
    if (!sectionProducts.length) continue;
    any = true;

    const tagline = SECTION_TAGLINES[section.key];
    pdfEnsureSpace(ctx, 32, () => undefined);
    drawSectionIntro(ctx, section.label, tagline);
    const drawHeader = () => pdfTableHeader(ctx, cols);
    drawHeader();

    sectionProducts.forEach((p, idx) => {
      pdfEnsureSpace(ctx, 12, () => {
        drawSectionIntro(ctx, `${section.label} (cont.)`, tagline);
        drawHeader();
      });
      pdfTableRow(ctx, cols, rowValues(p), { zebra: idx % 2 === 1 });
    });

    ctx.y += 4;
  }

  if (!any) {
    pdfSectionLabel(ctx, "No active products to list");
  }

  pdfFooterNote(
    ctx,
    "Dumi Essence client price list · Prices in ZAR · Valid as dated · Subject to change without notice · Order via www.dumiessence.co.za or WhatsApp.",
  );
  addPageNumbers(ctx);

  const safeClient = (preparedFor || "general")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  ctx.doc.save(`dumi-essence-price-list-${safeClient}-${generated}.pdf`);
}

/** Excel twin of the client price list. */
export async function generateClientPriceListExcel(
  products: Product[],
  options: ClientPriceListOptions = {},
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const active = activeSorted(products);
  const generated = new Date().toISOString().slice(0, 10);
  const preparedFor = options.preparedFor?.trim() || null;
  const grouped = groupContentProducts(active);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Dumi Essence";
  wb.created = new Date();

  const ws = wb.addWorksheet("Price List", {
    views: [{ state: "frozen", ySplit: 8 }],
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = [
    { key: "line", width: 18 },
    { key: "name", width: 22 },
    { key: "brand", width: 14 },
    { key: "sku", width: 14 },
    { key: "inspired", width: 22 },
    { key: "designer", width: 16 },
    { key: "type", width: 16 },
    { key: "flags", width: 14 },
    { key: "p30", width: 12 },
    { key: "p50", width: 12 },
    { key: "p100", width: 12 },
    { key: "p200", width: 12 },
  ];

  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FF1C1C1C" },
  };
  const goldFont = { name: "Calibri", size: 11, bold: true, color: { argb: "FFC8AA5A" } };

  ws.mergeCells("A1:L1");
  const title = ws.getCell("A1");
  title.value = "DUMI ESSENCE · CLIENT PRICE LIST";
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = headerFill;
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:L2");
  ws.getCell("A2").value = preparedFor
    ? `Prepared for: ${preparedFor}`
    : "General client price list";
  ws.getCell("A2").font = { name: "Calibri", size: 11, bold: true };

  ws.mergeCells("A3:L3");
  ws.getCell("A3").value =
    `Prices valid as of ${generated}  ·  ${active.length} products  ·  ZAR  ·  ${CONTACT.website}  ·  WhatsApp ${CONTACT.whatsapp}`;
  ws.getCell("A3").font = { name: "Calibri", size: 10, color: { argb: "FF6E6E6E" } };

  ws.mergeCells("A4:L4");
  ws.getCell("A4").value = `Order online at ${CONTACT.website} or WhatsApp ${CONTACT.whatsapp}  ·  ${CONTACT.email}`;
  ws.getCell("A4").font = { name: "Calibri", size: 10, color: { argb: "FF6E6E6E" } };

  ws.addRow([]);

  const headerRow = ws.addRow([
    "Line",
    "DE name",
    "Brand",
    "SKU",
    "Inspired by",
    "Designer",
    "Type",
    "Flags",
    "30ml",
    "50ml",
    "100ml",
    "200ml",
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = headerFill;
    cell.alignment = { vertical: "middle" };
  });

  for (const section of CONTENT_PRODUCT_SECTIONS) {
    const sectionProducts = grouped[section.key];
    if (!sectionProducts.length) continue;

    const intro = ws.addRow([section.label, SECTION_TAGLINES[section.key]]);
    ws.mergeCells(`B${intro.number}:L${intro.number}`);
    intro.getCell(1).font = goldFont;
    intro.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8F7F4" },
    };
    intro.getCell(2).font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: "FF6E6E6E" },
    };
    intro.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8F7F4" },
    };

    for (const p of sectionProducts) {
      const row = ws.addRow([
        section.label,
        p.product_name || p.name || "",
        p.brand || "",
        p.sku || "",
        p.inspired_by || "",
        p.designer || "",
        productTypeLabel(p),
        productFlags(p),
        retailForSize(p, 30),
        retailForSize(p, 50),
        retailForSize(p, 100),
        retailForSize(p, 200),
      ]);
      for (const col of [9, 10, 11, 12]) {
        const cell = row.getCell(col);
        if (cell.value != null) {
          cell.numFmt = '"R"#,##0.00';
        }
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeClient = (preparedFor || "general")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  a.href = url;
  a.download = `dumi-essence-price-list-${safeClient}-${generated}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
