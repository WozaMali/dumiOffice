import type { Order } from "@/types/database";

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

  const { jsPDF } = await import("jspdf");
  // Use landscape so the receipt matches the office layout
  const doc = new jsPDF({ orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header background band
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Load logo from public folder
  const img = new Image();
  img.src = "/DUMI ESSENCE logo.png";

  // Load social icons from public/icons folder
  const tiktokImg = new Image();
  tiktokImg.src = "/icons/TikTok.png";
  const instagramImg = new Image();
  instagramImg.src = "/icons/Instagram.png";
  const facebookImg = new Image();
  facebookImg.src = "/icons/Facebook.png";
  const whatsappImg = new Image();
  whatsappImg.src = "/icons/Whatsapp.png";
  const signatureImg = new Image();
  signatureImg.src = "/icons/Dumi Signature Black.png";

  img.onload = () => {
    const logoHeight = 18;
    const logoWidth = (img.width / img.height) * logoHeight;
    // Center the logo horizontally in the header band
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = 11;
    doc.addImage(img, "PNG", logoX, logoY, logoWidth, logoHeight);

    // Brand name on the left side
    const brandX = margin;
    const brandY = logoY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", brandX, brandY);

    // Tagline under brand name
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    const taglineX = brandX;
    const taglineY = logoY + 13;
    doc.text("Fine fragrances and home scenting", taglineX, taglineY);

    // Right column: address and contacts (no company name)
    const infoX = pageWidth - margin;
    let y = 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const addressLines = ["652 Hashe Street", "Dobsonville, Soweto", "1863"];
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

      // Document title (centered) and meta
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

      // Client block with subtle card
      let contentY = 80;
      const clientBoxWidth = pageWidth - margin * 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const address =
        (order as any).shipping_address || order.customer_address || "";
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
      // Black card for client details
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

      // Order meta on the right side inside the same card
      const metaX = margin + clientBoxWidth - 6;
      let metaY = contentY + 4;
      orderMetaLines.forEach((line) => {
        doc.text(line, metaX, metaY, { align: "right" });
        metaY += 4;
      });

      // Move below client card with extra breathing room
      contentY = boxTop + clientBoxHeight + 16;

      // Items table
      const colItem = margin + 4;
      const colFragrance = margin + 22;
      const colInspired = margin + 90;
      const colCode = pageWidth - margin - 110;
      const colQty = pageWidth - margin - 70;
      const colPrice = pageWidth - margin - 40;
      const colTotal = pageWidth - margin;

      // Header band for items (black card)
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
          contentY = 30;
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

      // Signature graphic + founder line + thank you note near bottom of final page
      const sigHeight = 18;
      const sigWidth =
        signatureImg.width && signatureImg.height
          ? (signatureImg.width / signatureImg.height) * sigHeight
          : 60;
      // Align roughly with the left margin, matching the thank-you text
      const sigX = margin;
      // Keep the signature block close to the bottom edge
      const sigY = pageHeight - (sigHeight + 12);
      if (signatureImg.complete) {
        doc.addImage(signatureImg, "PNG", sigX, sigY, sigWidth, sigHeight);
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

    const drawSocialIcons = () => {
      const iconSize = 4;
      const gap = 2;
      const iconsY = taglineY + 1;
      let iconX = taglineX;

      if (tiktokImg.complete) {
        doc.addImage(tiktokImg, "PNG", iconX, iconsY, iconSize, iconSize);
      }
      iconX += iconSize + gap;

      if (whatsappImg.complete) {
        doc.addImage(whatsappImg, "PNG", iconX, iconsY, iconSize, iconSize);
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
      // Add a little extra breathing room between icons and label
      const labelX = taglineX + (iconSize + gap) * 4 + 2;
      doc.text("Dumi Essence", labelX, labelY);
    };

    const maybeDrawIconsAndFinish = () => {
      drawSocialIcons();
      drawBodyAndSave();
    };

    const icons = [tiktokImg, whatsappImg, instagramImg, facebookImg, signatureImg];
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

