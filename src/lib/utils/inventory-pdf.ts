import type { Product } from "@/types/database";
import {
  createBrandedPdfContext,
  pdfEnsureSpace,
  pdfFooterNote,
  pdfMoney,
  pdfOpenPage,
  pdfSectionLabel,
  pdfTableHeader,
  pdfTableRow,
  type PdfColumn,
} from "@/lib/utils/pdf-document-kit";

function getStatus(p: Product, inStockNow: number): string {
  if (!p.is_active) return "Inactive";
  if (inStockNow === 0) return "Out of stock";
  if (inStockNow <= p.stock_threshold) return "Low stock";
  return "In stock";
}

function normalizeLineRaw(raw: string | undefined | null): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function getInventoryGroup(p: Product): { key: string; label: string } {
  if (p.product_category === "Diffuser") return { key: "diffusers", label: "Diffusers" };
  if (p.product_category === "Car Perfume") return { key: "carPerfume", label: "Car Perfume" };
  if (p.product_category === "Shower Gel") return { key: "showerGel", label: "Shower Gel" };
  if (p.product_category === "Body Lotion") return { key: "bodyLotion", label: "Body Lotion" };
  if (p.product_category === "Body Oil") return { key: "bodyOil", label: "Body Oil" };

  const itemNorm = normalizeLineRaw(p.item);
  if (itemNorm.includes("unisex")) return { key: "unisex", label: "Unisex Line" };
  if (itemNorm.includes("female") || itemNorm.includes("women"))
    return { key: "womens", label: "Women's Line" };
  if (itemNorm.includes("male") || itemNorm.includes("men"))
    return { key: "mens", label: "Men's Line" };

  const raw =
    p.product_type ||
    p.collection_code ||
    (p.category as string | undefined) ||
    p.product_category;
  const norm = normalizeLineRaw(raw);
  if (norm.startsWith("men")) return { key: "mens", label: "Men's Line" };
  if (norm.startsWith("women")) return { key: "womens", label: "Women's Line" };
  if (norm.includes("unisex")) return { key: "unisex", label: "Unisex Line" };

  return { key: "other", label: "Other" };
}

export async function generateInventoryPDF(
  products: Product[],
  options?: {
    soldToDateByProductId?: Record<string, number>;
  },
): Promise<void> {
  const ctx = await createBrandedPdfContext({
    orientation: "landscape",
    tagline: "Inventory & stock posture",
  });
  const soldToDateByProductId = options?.soldToDateByProductId ?? {};
  const generated = new Date().toISOString().slice(0, 10);

  pdfOpenPage(ctx, {
    title: "Inventory Report",
    subtitle: "Stock on hand by product line",
    metaLeft: [`Generated: ${generated}`],
    metaRight: [`${products.length} products`],
  });

  const cols: PdfColumn[] = [
    { label: "DE name", width: 48 },
    { label: "Brand", width: 28 },
    { label: "Item", width: 24 },
    { label: "Inspired by", width: 36 },
    { label: "Price", width: 22, align: "right" },
    { label: "Stock", width: 18, align: "right" },
    { label: "Sold", width: 18, align: "right" },
    { label: "In stock", width: 20, align: "right" },
    { label: "Status", width: 28, align: "right" },
  ];

  const groups: { key: string; label: string; products: Product[] }[] = [
    { key: "mens", label: "Men's Line", products: [] },
    { key: "womens", label: "Women's Line", products: [] },
    { key: "unisex", label: "Unisex Line", products: [] },
    { key: "diffusers", label: "Diffusers", products: [] },
    { key: "carPerfume", label: "Car Perfume", products: [] },
    { key: "showerGel", label: "Shower Gel", products: [] },
    { key: "bodyLotion", label: "Body Lotion", products: [] },
    { key: "bodyOil", label: "Body Oil", products: [] },
    { key: "other", label: "Other", products: [] },
  ];
  const groupIndexByKey = new Map(groups.map((g, i) => [g.key, i]));
  for (const p of products) {
    const g = getInventoryGroup(p);
    const idx = groupIndexByKey.get(g.key);
    if (idx != null) groups[idx].products.push(p);
  }

  let any = false;
  for (const group of groups) {
    if (group.products.length === 0) continue;
    any = true;

    pdfEnsureSpace(ctx, 28, () => undefined);
    pdfSectionLabel(ctx, group.label);
    const drawHeader = () => pdfTableHeader(ctx, cols);
    drawHeader();

    group.products.forEach((p, idx) => {
      pdfEnsureSpace(ctx, 12, () => {
        pdfSectionLabel(ctx, `${group.label} (cont.)`);
        drawHeader();
      });

      const priceNum = p.price ?? p.base_price ?? 0;
      const stockToDate = Math.max(0, Number(p.stock_on_hand ?? 0));
      const soldToDate = Math.max(0, Number(soldToDateByProductId[p.id] ?? 0));
      const inStockNow = Math.max(0, stockToDate - soldToDate);
      const status = getStatus(p, inStockNow);

      pdfTableRow(
        ctx,
        cols,
        [
          p.product_name ?? "",
          p.brand ?? "",
          p.item ?? "",
          p.inspired_by ?? "",
          pdfMoney(priceNum),
          String(stockToDate),
          String(soldToDate),
          String(inStockNow),
          status,
        ],
        { zebra: idx % 2 === 1 },
      );
    });

    ctx.y += 4;
  }

  if (!any) {
    pdfSectionLabel(ctx, "No inventory items captured");
  }

  pdfFooterNote(ctx, "Dumi Essence inventory posture · For internal operations use.");
  ctx.doc.save(`dumi-essence-inventory-${generated}.pdf`);
}
