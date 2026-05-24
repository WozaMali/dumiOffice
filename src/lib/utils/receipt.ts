import type { Order } from "@/types/database";
import {
  createPdfDoc,
  drawPdfLetterhead,
  loadPdfLetterheadAssets,
  loadPdfRasterImage,
  addPdfRasterImage,
} from "@/lib/utils/pdf-letterhead";

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

  const doc = await createPdfDoc({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const { logo, socialIcons } = await loadPdfLetterheadAssets();
  const signature = await loadPdfRasterImage("/icons/Dumi Signature Black.png", {
    format: "PNG",
    maxWidthPx: 600,
    maxHeightPx: 200,
    alias: "dumi_signature",
    background: "#ffffff",
  });

  drawPdfLetterhead(doc, logo, { margin, socialIcons });

  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titleY = 58;
  doc.text("Order receipt", pageWidth / 2, titleY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const orderDate = order.date || new Date().toISOString().slice(0, 10);
  const generated = new Date().toISOString().slice(0, 10);
  doc.text(`Order date: ${orderDate}`, margin, titleY + 6);
  doc.text(`Receipt generated: ${generated}`, margin, titleY + 10);

  const orderMetaLines: string[] = [];
  orderMetaLines.push(`Order ID: ${order.id}`);
  if (order.reference) {
    orderMetaLines.push(`Reference: ${order.reference}`);
  }
  orderMetaLines.push(
    `Payment: ${order.payment_status} · ${order.payment_method || "-"}`,
  );
  orderMetaLines.push(`Total: R${order.grand_total.toFixed(2)}`);

  let contentY = 80;
  const clientBoxWidth = pageWidth - margin * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const address =
    (order as { shipping_address?: string }).shipping_address || order.customer_address || "";
  const customerLines = [
    order.customer_name,
    order.customer_phone || "",
    order.customer_email || "",
    address,
  ].filter(Boolean);

  const boxTop = contentY - 8;
  const clientLinesHeight = customerLines.length * 4;
  const metaLinesHeight = orderMetaLines.length * 4;
  const contentRowsHeight = Math.max(clientLinesHeight, metaLinesHeight);
  const clientBoxHeight = 10 + contentRowsHeight;
  doc.setFillColor(15, 15, 15);
  doc.setDrawColor(40, 40, 40);
  doc.rect(margin, boxTop, clientBoxWidth, clientBoxHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Client details", margin + 6, contentY - 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(235, 235, 235);
  let clientLineY = contentY + 4;
  customerLines.forEach((line) => {
    doc.text(line, margin + 6, clientLineY);
    clientLineY += 4;
  });

  const metaX = margin + clientBoxWidth - 6;
  let metaY = contentY + 4;
  orderMetaLines.forEach((line) => {
    doc.text(line, metaX, metaY, { align: "right" });
    metaY += 4;
  });

  contentY = boxTop + clientBoxHeight + 16;

  const colItem = margin + 4;
  const colFragrance = margin + 22;
  const colInspired = margin + 90;
  const colCode = pageWidth - margin - 110;
  const colQty = pageWidth - margin - 70;
  const colPrice = pageWidth - margin - 40;
  const colTotal = pageWidth - margin;

  const headerHeight = 14;
  doc.setFillColor(15, 15, 15);
  doc.setDrawColor(40, 40, 40);
  doc.rect(margin, contentY - headerHeight + 2, pageWidth - margin * 2, headerHeight, "FD");

  const headerTextY = contentY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Item", colItem, headerTextY);
  doc.text("Fragrance", colFragrance, headerTextY);
  doc.text("Inspired by", colInspired, headerTextY);
  doc.text("Code", colCode, headerTextY, { align: "right" });
  doc.text("Qty", colQty, headerTextY, { align: "right" });
  doc.text("Price (excl. VAT)", colPrice, headerTextY, { align: "right" });
  doc.text("Total", colTotal, headerTextY, { align: "right" });

  contentY += headerHeight + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);

  const addPageIfNeeded = () => {
    const bottomMargin = doc.internal.pageSize.getHeight() - 30;
    if (contentY > bottomMargin) {
      doc.addPage();
      contentY = drawPdfLetterhead(doc, logo, { compact: true, margin });
    }
  };

  items.forEach((item) => {
    addPageIfNeeded();
    doc.text(String(item.index), colItem, contentY);
    doc.text(item.fragrance_name, colFragrance, contentY);
    if (item.inspired_by) {
      doc.text(item.inspired_by, colInspired, contentY);
    }
    if (item.code) {
      doc.text(item.code, colCode, contentY, { align: "right" });
    }
    doc.text(String(item.quantity), colQty, contentY, { align: "right" });
    doc.text(`R${item.unit_price.toFixed(2)}`, colPrice, contentY, { align: "right" });
    doc.text(`R${item.line_total.toFixed(2)}`, colTotal, contentY, { align: "right" });
    contentY += 5;
    if (item.discount > 0) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Less discount: R${item.discount.toFixed(2)}`,
        colTotal,
        contentY,
        { align: "right" },
      );
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      contentY += 4;
    }
    contentY += 2;
  });

  addPageIfNeeded();
  contentY += 4;
  const boxWidth = 65;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = contentY;
  const lineHeight = 5;

  doc.setDrawColor(200, 170, 90);
  doc.rect(boxX, boxY, boxWidth, lineHeight * 4 + 6);

  let summaryY = boxY + 6;
  const addSummaryLine = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(label, boxX + 3, summaryY);
    doc.text(value, boxX + boxWidth - 3, summaryY, { align: "right" });
    summaryY += lineHeight;
  };

  addSummaryLine("Subtotal", `R${order.subtotal.toFixed(2)}`);
  addSummaryLine("Shipping", `R${order.shipping_fee.toFixed(2)}`);
  if (order.discount > 0) {
    addSummaryLine("Discount", `-R${order.discount.toFixed(2)}`);
  }
  addSummaryLine("Total", `R${order.grand_total.toFixed(2)}`, true);

  const sigHeight = 18;
  const sigWidth = signature
    ? (signature.width / signature.height) * sigHeight
    : 60;
  const sigX = margin;
  const sigY = pageHeight - (sigHeight + 12);
  if (signature) {
    addPdfRasterImage(doc, signature, sigX, sigY, sigWidth, sigHeight);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("Dumisani · Founder", margin, sigY + sigHeight + 4);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Thank you for choosing Dumi Essence for your fragrances.",
    margin,
    sigY + sigHeight + 9,
  );

  doc.save(`dumi-essence-receipt-${order.id}.pdf`);
};
