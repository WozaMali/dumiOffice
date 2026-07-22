import type { Order } from "@/types/database";
import {
  createBrandedPdfContext,
  pdfDrawSignature,
  pdfEnsureSpace,
  pdfFooterNote,
  pdfInfoPanel,
  pdfMoney,
  pdfOpenPage,
  pdfTableHeader,
  pdfTableRow,
  pdfTotalsBox,
  type PdfColumn,
} from "@/lib/utils/pdf-document-kit";
import { loadPdfRasterImage } from "@/lib/utils/pdf-letterhead";

type ReceiptItem = {
  index: number;
  fragrance_name: string;
  inspired_by?: string;
  code?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
};

export const generateOrderReceipt = async (order: Order, items: ReceiptItem[]) => {
  if (!order) return;

  const ctx = await createBrandedPdfContext({
    orientation: "landscape",
    tagline: "Fine fragrances and home scenting",
  });
  const signature = await loadPdfRasterImage("/icons/Dumi Signature Black.png", {
    format: "PNG",
    maxWidthPx: 600,
    maxHeightPx: 200,
    alias: "dumi_signature",
    background: "#ffffff",
  });

  const orderDate = order.date || new Date().toISOString().slice(0, 10);
  const generated = new Date().toISOString().slice(0, 10);

  pdfOpenPage(ctx, {
    title: "Order Receipt",
    subtitle: "Customer sales document · Dumi Essence",
    metaLeft: [`Order date: ${orderDate}`, `Generated: ${generated}`],
    metaRight: [
      `Payment: ${order.payment_status}${order.payment_method ? ` · ${order.payment_method}` : ""}`,
      `Channel: ${order.channel || "—"}`,
    ],
  });

  const address =
    (order as { shipping_address?: string }).shipping_address || order.customer_address || "";

  pdfInfoPanel(ctx, {
    title: "Client & order",
    leftLines: [
      order.customer_name,
      order.customer_phone || "",
      order.customer_email || "",
      address,
    ].filter(Boolean),
    rightLines: [
      `Order ID: ${order.id}`,
      order.reference ? `Reference: ${order.reference}` : "",
      `Total: ${pdfMoney(order.grand_total)}`,
    ].filter(Boolean),
  });

  const cols: PdfColumn[] = [
    { label: "#", width: 10 },
    { label: "Fragrance", width: 68 },
    { label: "Inspired by", width: 55 },
    { label: "Code", width: 28, align: "right" },
    { label: "Qty", width: 16, align: "right" },
    { label: "Unit", width: 28, align: "right" },
    { label: "Line total", width: 32, align: "right" },
  ];

  const drawHeader = () => pdfTableHeader(ctx, cols);
  drawHeader();

  items.forEach((item, idx) => {
    pdfEnsureSpace(ctx, 14, drawHeader);
    pdfTableRow(
      ctx,
      cols,
      [
        String(item.index),
        item.fragrance_name,
        item.inspired_by || "—",
        item.code || "—",
        String(item.quantity),
        pdfMoney(item.unit_price),
        pdfMoney(item.line_total),
      ],
      { zebra: idx % 2 === 1 },
    );
    if (item.discount > 0) {
      pdfEnsureSpace(ctx, 8, drawHeader);
      pdfTableRow(ctx, cols, ["", "", "", "", "", "Discount", `-${pdfMoney(item.discount)}`], {
        fontSize: 7,
      });
    }
  });

  ctx.y += 4;
  const totals: { label: string; value: string; bold?: boolean }[] = [
    { label: "Subtotal", value: pdfMoney(order.subtotal) },
    { label: "Shipping", value: pdfMoney(order.shipping_fee) },
  ];
  if (order.discount > 0) {
    totals.push({ label: "Discount", value: `-${pdfMoney(order.discount)}` });
  }
  totals.push({ label: "Total due", value: pdfMoney(order.grand_total), bold: true });
  pdfTotalsBox(ctx, totals);

  pdfDrawSignature(ctx, signature);
  pdfFooterNote(ctx, "Thank you for choosing Dumi Essence for your fragrances.");

  ctx.doc.save(`dumi-essence-receipt-${order.id}.pdf`);
};
