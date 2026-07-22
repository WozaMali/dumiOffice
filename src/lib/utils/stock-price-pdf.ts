import type { PriceTier, Product, ProductTierPrice } from "@/types/database";
import {
  createBrandedPdfContext,
  pdfEnsureSpace,
  pdfFooterNote,
  pdfInfoPanel,
  pdfMoney,
  pdfOpenPage,
  pdfSectionLabel,
  pdfTableHeader,
  pdfTableRow,
  type PdfColumn,
} from "@/lib/utils/pdf-document-kit";

function productLabel(p: Product): string {
  return (p.name || p.product_name || p.sku || "Product").trim();
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
  const fallback = p.base_price ?? p.price;
  return fallback != null && Number.isFinite(Number(fallback)) ? Number(fallback) : null;
}

function tierPriceForSize(
  row: ProductTierPrice | undefined,
  size: 30 | 50 | 100 | 200,
): number | null {
  if (!row) return null;
  const raw =
    size === 30
      ? row.price_30ml
      : size === 50
        ? row.price_50ml
        : size === 100
          ? row.price_100ml
          : row.price_200ml;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw);
  if (row.unit_price != null && Number.isFinite(Number(row.unit_price))) {
    return Number(row.unit_price);
  }
  return null;
}

function discountedRetail(retail: number | null, discountPercent: number): number | null {
  if (retail == null) return null;
  return Math.round(retail * (1 - discountPercent / 100) * 100) / 100;
}

function moneyOrDash(n: number | null): string {
  return n == null ? "-" : pdfMoney(n);
}

export async function generateStockPriceListPdf(options: {
  products: Product[];
  tier: PriceTier;
  tierPrices: ProductTierPrice[];
  resellerName?: string | null;
}): Promise<void> {
  const { products, tier, tierPrices, resellerName } = options;
  const priceByProductId = new Map(tierPrices.map((r) => [r.product_id, r]));
  const active = products
    .filter((p) => p.is_active !== false)
    .slice()
    .sort((a, b) => productLabel(a).localeCompare(productLabel(b)));

  const ctx = await createBrandedPdfContext({
    orientation: "landscape",
    tagline: "Trade & reseller pricing",
  });

  const generated = new Date().toISOString().slice(0, 10);
  pdfOpenPage(ctx, {
    title: "Stock Price List",
    subtitle: `${tier.name} · ${tier.code}`,
    metaLeft: [
      `Generated: ${generated}`,
      resellerName ? `Prepared for: ${resellerName}` : "Internal trade price book",
    ],
    metaRight: [
      `${active.length} products`,
      `Default discount: ${Number(tier.default_discount_percent || 0)}%`,
    ],
  });

  pdfInfoPanel(ctx, {
    title: "Pricing notes",
    fill: "light",
    leftLines: [
      "Stock / reseller prices override retail when set per size.",
      "Blank cells fall back to retail x (1 - default discount).",
      "Retail shown for reference only - trade invoicing uses the stock column.",
    ],
  });

  // Landscape content width ≈ 269mm at 14mm margins — columns must sum to this.
  const contentW = ctx.pageWidth - ctx.margin * 2;
  const cols: PdfColumn[] = [
    { label: "Product", width: contentW * 0.22 },
    { label: "SKU", width: contentW * 0.14 },
    { label: "Category", width: contentW * 0.12 },
    { label: "Retail 50", width: contentW * 0.11, align: "right" },
    { label: "30ml", width: contentW * 0.1025, align: "right" },
    { label: "50ml", width: contentW * 0.1025, align: "right" },
    { label: "100ml", width: contentW * 0.1025, align: "right" },
    { label: "200ml", width: contentW * 0.1025, align: "right" },
  ];

  pdfSectionLabel(ctx, `${tier.name} · stock prices`);
  pdfTableHeader(ctx, cols);

  active.forEach((p, i) => {
    pdfEnsureSpace(ctx, 10, () => pdfTableHeader(ctx, cols));
    const row = priceByProductId.get(p.id);
    const discount = Number(tier.default_discount_percent || 0);

    const stock = (size: 30 | 50 | 100 | 200) => {
      const explicit = tierPriceForSize(row, size);
      if (explicit != null) return explicit;
      return discountedRetail(retailForSize(p, size), discount);
    };

    pdfTableRow(
      ctx,
      cols,
      [
        productLabel(p),
        p.sku || "-",
        p.product_category || p.category || "-",
        moneyOrDash(retailForSize(p, 50)),
        moneyOrDash(stock(30)),
        moneyOrDash(stock(50)),
        moneyOrDash(stock(100)),
        moneyOrDash(stock(200)),
      ],
      { zebra: i % 2 === 1 },
    );
  });

  pdfFooterNote(
    ctx,
    "Confidential - Dumi Essence trade pricing. Not for public retail display.",
  );

  const safeTier = tier.code.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  ctx.doc.save(`dumi-stock-prices-${safeTier}-${generated}.pdf`);
}
