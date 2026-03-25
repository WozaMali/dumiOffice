import type { Product } from "@/types/database";

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

function getStatus(p: Product): string {
  if (!p.is_active) return "Inactive";
  if (p.stock_on_hand === 0) return "Out of stock";
  if (p.stock_on_hand <= p.stock_threshold) return "Low stock";
  return "In stock";
}

function normalizeLineRaw(raw: string | undefined | null): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function getInventoryGroup(p: Product): { key: string; label: string } {
  // Keep the same idea as `Content.tsx` but use inventory-friendly fields.
  if (p.product_category === "Diffuser") return { key: "diffusers", label: "Diffusers" };
  if (p.product_category === "Car Perfume")
    return { key: "carDiffusers", label: "Car Diffusers" };

  // Prefer the inventory "item" field since your export shows ITEM values like
  // "Men", "Female", and "Unisex".
  const itemNorm = normalizeLineRaw(p.item);
  if (itemNorm.includes("unisex")) return { key: "unisex", label: "Unisex Line" };
  // IMPORTANT: check Women/Female before Men/Male.
  // "women" contains "men" after normalization, so matching "men" first mis-groups women into Men's Line.
  if (itemNorm.includes("female") || itemNorm.includes("women"))
    return { key: "womens", label: "Women's Line" };
  if (itemNorm.includes("male") || itemNorm.includes("men"))
    return { key: "mens", label: "Men's Line" };

  // Fallback to other metadata used by the storefront/content editor.
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

const truncate = (s: string, maxLen: number) =>
  s.length > maxLen ? s.slice(0, Math.max(0, maxLen - 2)) + ".." : s;

export async function generateInventoryPDF(products: Product[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const tableWidth = pageWidth - margin * 2;

  const rowHeight = 6;
  const bottomMargin = pageHeight - 22;

  const logoImg = await loadImage("/DUMI ESSENCE logo.png");
  const generated = new Date().toISOString().slice(0, 10);

  const drawLetterhead = () => {
    // Header background band
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 40, "F");

    // Left: brand + tagline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dumi Essence", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text("Fine fragrances and home scenting", margin, 26);

    // Centered logo
    if (logoImg) {
      const logoHeight = 18;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = 11;
      doc.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);
    }

    // Right: address and contacts
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

    // Gold separator under letterhead
    doc.setDrawColor(200, 170, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, 45, pageWidth - margin, 45);

    // Document title and meta
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Inventory Report", margin, 55);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated: ${generated}`, margin, 61);
    doc.text(`${products.length} products`, pageWidth - margin, 61, { align: "right" });

    return 70;
  };

  // Column model: fixed boundaries so text never overlaps.
  const colModelDesired = [
    { key: "product_name", label: "DE NAME", width: 175, align: "left" as const, maxLen: 20 },
    { key: "brand", label: "BRAND", width: 95, align: "left" as const, maxLen: 12 },
    { key: "item", label: "ITEM", width: 105, align: "left" as const, maxLen: 14 },
    { key: "inspired_by", label: "INSPIRED BY", width: 140, align: "left" as const, maxLen: 16 },
    { key: "designer", label: "DESIGNER", width: 95, align: "left" as const, maxLen: 10 },
    { key: "price", label: "PRICE", width: 75, align: "right" as const, maxLen: 16 },
    { key: "stock_on_hand", label: "STOCK", width: 55, align: "right" as const, maxLen: 8 },
    { key: "status", label: "STATUS", width: 80, align: "right" as const, maxLen: 14 },
  ];

  const scale = tableWidth / colModelDesired.reduce((sum, c) => sum + c.width, 0);
  const colModel = colModelDesired.map((c) => ({ ...c, width: c.width * scale }));
  const colX: Record<string, { x: number; w: number }> = {};
  let accX = margin;
  for (const c of colModel) {
    colX[c.key] = { x: accX, w: c.width };
    accX += c.width;
  }

  const drawTableHeader = () => {
    const headerYTop = contentY;
    const headerHeight = rowHeight + 2;

    doc.setFillColor(20, 20, 20);
    doc.rect(margin, headerYTop - 4, tableWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    // Header text baseline
    const headerTextY = headerYTop + 1;

    for (const c of colModel) {
      const { x, w } = colX[c.key];
      if (c.align === "right") {
        doc.text(c.label, x + w - 2, headerTextY, { align: "right" });
      } else {
        doc.text(c.label, x + 2, headerTextY);
      }
    }

    contentY += rowHeight + 4;

    // Important: revert to the normal table text color for the rows.
    doc.setTextColor(40, 40, 40);
  };

  let tableHeaderRendered = false;
  let shouldRedrawGroupHeader = false;
  const ensureSpace = (needed: number) => {
    if (contentY + needed > bottomMargin) {
      doc.addPage("a4", "l");
      contentY = drawLetterhead();
      // Force the table header to be re-drawn on the new page.
      tableHeaderRendered = false;
      shouldRedrawGroupHeader = true;
    }
  };

  // Group products the way your Content editor does (Men/Women/Unisex/Diffuser...).
  const groups: { key: string; label: string; products: Product[] }[] = [
    { key: "mens", label: "Men's Line", products: [] },
    { key: "womens", label: "Women's Line", products: [] },
    { key: "unisex", label: "Unisex Line", products: [] },
    { key: "diffusers", label: "Diffusers", products: [] },
    { key: "carDiffusers", label: "Car Diffusers", products: [] },
    { key: "other", label: "Other", products: [] },
  ];

  const groupIndexByKey = new Map(groups.map((g, i) => [g.key, i]));
  for (const p of products) {
    const g = getInventoryGroup(p);
    const idx = groupIndexByKey.get(g.key);
    if (idx != null) groups[idx].products.push(p);
  }

  let contentY = drawLetterhead();

  // Table drawing state: each group renders a separate table (with header).
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  for (const group of groups) {
    if (group.products.length === 0) continue;

    // If the heading + table header + at least one row doesn't fit,
    // push the whole group to a fresh page so we don't end up with:
    // group title/header on page 1 but rows only on page 2.
    const minGroupBlockHeight =
      // group title line + padding
      8 +
      // table header bar + padding (matches drawTableHeader increments)
      (rowHeight + 4) +
      // first row height
      rowHeight +
      // safety padding
      10;
    if (contentY + minGroupBlockHeight > bottomMargin) {
      doc.addPage("a4", "l");
      contentY = drawLetterhead();
      shouldRedrawGroupHeader = false;
      tableHeaderRendered = false;
    }

    // Group heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(group.label.toUpperCase(), margin, contentY);
    contentY += 8;

    // Table header for this group
    drawTableHeader();
    tableHeaderRendered = true;
    shouldRedrawGroupHeader = false;

    for (const p of group.products) {
      ensureSpace(rowHeight + 2);

      // If a page break happened mid-group, redraw heading + header before the row.
      if (shouldRedrawGroupHeader) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(group.label.toUpperCase(), margin, contentY);
        contentY += 8;
        drawTableHeader();
        tableHeaderRendered = true;
        shouldRedrawGroupHeader = false;
      }

      if (!tableHeaderRendered) {
        drawTableHeader();
        tableHeaderRendered = true;
      }

      const priceNum = p.price ?? p.base_price ?? 0;
      const status = getStatus(p);

      // Ensure row text is visible (header sets this to white).
      doc.setTextColor(40, 40, 40);

      for (const c of colModel) {
        const { x, w } = colX[c.key];
        let text = "";
        switch (c.key) {
          case "product_name":
            text = truncate(p.product_name ?? "", c.maxLen);
            break;
          case "brand":
            text = truncate(p.brand ?? "", c.maxLen);
            break;
          case "item":
            text = truncate(p.item ?? "", c.maxLen);
            break;
          case "inspired_by":
            text = truncate(p.inspired_by ?? "", c.maxLen);
            break;
          case "designer":
            text = truncate(p.designer ?? "", c.maxLen);
            break;
          case "price":
            text = `R${priceNum.toFixed(2)}`;
            text = truncate(text, c.maxLen);
            break;
          case "stock_on_hand":
            text = truncate(String(p.stock_on_hand ?? 0), c.maxLen);
            break;
          case "status":
            text = truncate(status, c.maxLen);
            break;
          default:
            text = "";
        }

        if (c.align === "right") {
          doc.text(text, x + w - 2, contentY, { align: "right" });
        } else {
          doc.text(text, x + 2, contentY);
        }
      }

      contentY += rowHeight;
    }

    // Space after group
    contentY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
  }

  // If we ended up with no rows (e.g. empty export), show a clear message.
  const totalRows = groups.reduce((sum, g) => sum + g.products.length, 0);
  if (totalRows === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text("No inventory items captured.", margin, contentY + 10);
  }

  const filename = `dumi-essence-inventory-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
