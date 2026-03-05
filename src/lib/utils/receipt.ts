import type { Order } from "@/types/database";

type ReceiptItem = {
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
};

export const generateOrderReceipt = async (order: Order, items: ReceiptItem[]) => {
  if (!order) return;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header background band
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Load logo from public folder
  const img = new Image();
  img.src = "/DUMI ESSENCE logo.png";

  // Load social icons from public folder
  const tiktokImg = new Image();
  tiktokImg.src = "/TikTok.png";
  const instagramImg = new Image();
  instagramImg.src = "/Instagram.png";
  const facebookImg = new Image();
  facebookImg.src = "/Facebook.png";

  img.onload = () => {
    const logoHeight = 18;
    const logoWidth = (img.width / img.height) * logoHeight;
    const logoX = margin;
    const logoY = 11;
    doc.addImage(img, "PNG", logoX, logoY, logoWidth, logoHeight);

    // Brand name next to logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", logoX + logoWidth + 6, logoY + 8);

    // Tagline under brand name
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    const taglineX = logoX + logoWidth + 6;
    const taglineY = logoY + 13;
    doc.text("Fragrance & packaging solutions", taglineX, taglineY);

    // Right column: address and contacts (no company name)
    const infoX = pageWidth - margin;
    let y = 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const addressLines = ["652 Hashe Street", "Dobsonville", "1863"];
    addressLines.forEach((line) => {
      doc.text(line, infoX, y, { align: "right" });
      y += 4;
    });

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Contacts", infoX, y, { align: "right" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text("info@dumiessence.co.za", infoX, y, { align: "right" });
    y += 4;
    doc.text("072 849 5559", infoX, y, { align: "right" });

    const drawBodyAndSave = () => {
      // Separator line under header
      doc.setDrawColor(200, 170, 90);
      doc.setLineWidth(0.6);
      doc.line(margin, 45, pageWidth - margin, 45);

      // Document title and meta
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Online order receipt", margin, 58);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const orderDate = order.date || new Date().toISOString().slice(0, 10);
      const generated = new Date().toISOString().slice(0, 10);
      doc.text(`Order date: ${orderDate}`, margin, 64);
      doc.text(`Receipt generated: ${generated}`, margin, 68);

      const metaX = pageWidth - margin;
      let metaY = 58;
      doc.text(`Order ID: ${order.id}`, metaX, metaY, { align: "right" });
      metaY += 4;
      if (order.reference) {
        doc.text(`Reference: ${order.reference}`, metaX, metaY, { align: "right" });
        metaY += 4;
      }
      doc.text(
        `Payment: ${order.payment_status} · ${order.payment_method || "-"}`,
        metaX,
        metaY,
        { align: "right" },
      );
      metaY += 4;
      doc.text(`Total: R${order.grand_total.toFixed(2)}`, metaX, metaY, { align: "right" });

      // Customer block
      let contentY = 80;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Bill / Ship to", margin, contentY);
      contentY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const customerLines = [
        order.customer_name,
        order.customer_phone || "",
        order.customer_email || "",
        order.customer_address || "",
      ].filter(Boolean);
      customerLines.forEach((line) => {
        doc.text(line, margin, contentY);
        contentY += 4;
      });

      // Items table
      contentY += 6;
      const colProduct = margin;
      const colQty = pageWidth - margin - 45;
      const colPrice = pageWidth - margin - 25;
      const colTotal = pageWidth - margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Item", colProduct, contentY);
      doc.text("Qty", colQty, contentY, { align: "right" });
      doc.text("Price", colPrice, contentY, { align: "right" });
      doc.text("Total", colTotal, contentY, { align: "right" });

      contentY += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, contentY, pageWidth - margin, contentY);
      contentY += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const addPageIfNeeded = () => {
        const bottomMargin = doc.internal.pageSize.getHeight() - 30;
        if (contentY > bottomMargin) {
          doc.addPage();
          contentY = 30;
        }
      };

      items.forEach((item) => {
        addPageIfNeeded();
        const label = item.sku ? `${item.product_name} (${item.sku})` : item.product_name;
        doc.text(label, colProduct, contentY);
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

      // Summary box
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

      doc.save(`dumi-essence-receipt-${order.id}.pdf`);
    };

    const drawSocialIcons = () => {
      const iconSize = 4;
      const gap = 2;
      const iconsY = taglineY + 1;
      let iconX = taglineX;

      if (tiktokImg.complete) {
        doc.addImage(tiktokImg, "PNG", iconX, iconsY, iconSize, iconSize);
      }
      iconX += iconSize + gap;

      if (instagramImg.complete) {
        doc.addImage(instagramImg, "PNG", iconX, iconsY, iconSize, iconSize);
      }
      iconX += iconSize + gap;

      if (facebookImg.complete) {
        doc.addImage(facebookImg, "PNG", iconX, iconsY, iconSize, iconSize);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(220, 220, 220);
      const labelY = iconsY + iconSize - 1;
      const labelX = taglineX + (iconSize + gap) * 3;
      doc.text("Dumi Essence", labelX, labelY);
    };

    const maybeDrawIconsAndFinish = () => {
      drawSocialIcons();
      drawBodyAndSave();
    };

    const icons = [tiktokImg, instagramImg, facebookImg];
    if (icons.every((icon) => icon.complete)) {
      maybeDrawIconsAndFinish();
    } else {
      let loaded = 0;
      const handleLoaded = () => {
        loaded += 1;
        if (loaded === icons.length) {
          maybeDrawIconsAndFinish();
        }
      };

      icons.forEach((icon) => {
        if (icon.complete) {
          loaded += 1;
        } else {
          icon.onload = handleLoaded;
        }
      });

      if (loaded === icons.length) {
        maybeDrawIconsAndFinish();
      }
    }
  };
};

