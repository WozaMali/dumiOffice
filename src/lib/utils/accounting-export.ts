import type { AccountingCategory, AccountingTransaction } from "@/types/database";
import ExcelJS from "exceljs";

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

const money = (amount: number) =>
  `R${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const signedAmount = (t: AccountingTransaction) =>
  t.type === "expense" ? -Math.abs(Number(t.amount) || 0) : Math.abs(Number(t.amount) || 0);

const loadImageBase64 = async (src: string): Promise<string | null> => {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });
    return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  } catch {
    return null;
  }
};

export async function exportAccountingPdf(params: {
  transactions: AccountingTransaction[];
  categories: AccountingCategory[];
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const { transactions, categories, dateFrom, dateTo } = params;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const bottom = pageHeight - 14;
  const logoImg = await loadImage("/DUMI ESSENCE logo.png");
  const generated = new Date().toISOString().slice(0, 10);

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += Number(t.amount) || 0;
      if (t.type === "expense") acc.expense += Math.abs(Number(t.amount) || 0);
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;

  let y = 0;
  const drawLetterhead = () => {
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Dumi Essence", margin, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Accounting & Ledger Report", margin, 24);

    if (logoImg) {
      const logoH = 16;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      doc.addImage(logoImg, "PNG", (pageWidth - logoW) / 2, 10, logoW, logoH);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("652 Hashe Street, Dobsonville, Soweto", pageWidth - margin, 14, { align: "right" });
    doc.text("info@dumiessence.co.za", pageWidth - margin, 18, { align: "right" });
    doc.text("072 849 5559", pageWidth - margin, 22, { align: "right" });

    doc.setDrawColor(200, 170, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, 42, pageWidth - margin, 42);

    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Detailed Accounting Statement", margin, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Period: ${dateFrom} to ${dateTo}`, margin, 58);
    doc.text(`Generated: ${generated}`, pageWidth - margin, 58, { align: "right" });
    y = 66;
  };

  const metric = (label: string, value: string, x: number, w: number) => {
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(x, y, w, 15, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(35, 35, 35);
    doc.text(value, x + 3, y + 11);
  };

  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name || "—";

  const drawHeader = () => {
    const cols = [
      { label: "DATE", w: 27, align: "left" as const },
      { label: "TYPE", w: 20, align: "left" as const },
      { label: "CATEGORY", w: 32, align: "left" as const },
      { label: "DESCRIPTION", w: 98, align: "left" as const },
      { label: "REFERENCE", w: 28, align: "left" as const },
      { label: "VENDOR", w: 36, align: "left" as const },
      { label: "AMOUNT", w: 26, align: "right" as const },
    ];
    let x = margin;
    doc.setFillColor(20, 20, 20);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    cols.forEach((c) => {
      doc.text(c.label, c.align === "right" ? x + c.w - 2 : x + 2, y + 5.5, {
        align: c.align === "right" ? "right" : "left",
      });
      x += c.w;
    });
    y += 10;
  };

  drawLetterhead();
  const gap = 3;
  const mw = (pageWidth - margin * 2 - gap * 3) / 4;
  metric("Income", money(totals.income), margin, mw);
  metric("Expense", money(totals.expense), margin + (mw + gap), mw);
  metric("Net", money(net), margin + (mw + gap) * 2, mw);
  metric("Transactions", String(transactions.length), margin + (mw + gap) * 3, mw);
  y += 19;
  drawHeader();

  transactions.forEach((t, idx) => {
    if (y + 7 > bottom) {
      doc.addPage("a4", "l");
      drawLetterhead();
      y += 2;
      drawHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4.8, pageWidth - margin * 2, 7, "F");
    }
    const amount = signedAmount(t);
    let x = margin;
    const values = [
      t.date || "—",
      t.type || "—",
      categoryName(t.category_id),
      t.description || "—",
      t.reference || "—",
      t.vendor || "—",
      money(amount),
    ];
    const widths = [27, 20, 32, 98, 28, 36, 26];

    doc.setTextColor(45, 45, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    values.forEach((v, i) => {
      const right = i === values.length - 1;
      const text = String(v).slice(0, i === 3 ? 72 : 24);
      doc.text(text, right ? x + widths[i] - 2 : x + 2, y, { align: right ? "right" : "left" });
      x += widths[i];
    });
    y += 7;
  });

  const file = `dumi-essence-accounting-${dateFrom}-to-${dateTo}.pdf`;
  doc.save(file);
}

export async function exportAccountingExcel(params: {
  transactions: AccountingTransaction[];
  categories: AccountingCategory[];
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const { transactions, categories, dateFrom, dateTo } = params;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Accounting Report", {
    views: [{ state: "frozen", ySplit: 15 }],
    properties: { defaultRowHeight: 20 },
  });

  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name || "";
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += Number(t.amount) || 0;
      if (t.type === "expense") acc.expense += Math.abs(Number(t.amount) || 0);
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;

  ws.columns = [
    { key: "date", width: 14 },
    { key: "type", width: 12 },
    { key: "category", width: 20 },
    { key: "description", width: 44 },
    { key: "reference", width: 18 },
    { key: "vendor", width: 24 },
    { key: "campaign", width: 16 },
    { key: "amount", width: 14 },
  ];

  ws.mergeCells("A1:H4");
  const head = ws.getCell("A1");
  head.value = "DUMI ESSENCE";
  head.font = { name: "Calibri", size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle", horizontal: "left" };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };

  ws.mergeCells("A5:H5");
  const subtitle = ws.getCell("A5");
  subtitle.value = "Detailed Accounting Statement";
  subtitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF111111" } };
  subtitle.alignment = { vertical: "middle", horizontal: "left" };

  ws.mergeCells("A6:D6");
  ws.getCell("A6").value = `Report Period: ${dateFrom} to ${dateTo}`;
  ws.getCell("A6").font = { name: "Calibri", size: 11 };
  ws.mergeCells("E6:H6");
  ws.getCell("E6").value = `Generated On: ${new Date().toISOString().slice(0, 10)}`;
  ws.getCell("E6").font = { name: "Calibri", size: 11 };
  ws.getCell("E6").alignment = { horizontal: "right" };

  const logoBase64 = await loadImageBase64("/DUMI ESSENCE logo.png");
  if (logoBase64) {
    const logoId = wb.addImage({ base64: logoBase64, extension: "png" });
    ws.addImage(logoId, {
      tl: { col: 5.8, row: 0.3 },
      ext: { width: 220, height: 70 },
      editAs: "oneCell",
    });
  }

  ws.mergeCells("A8:C8");
  const summaryTitle = ws.getCell("A8");
  summaryTitle.value = "SUMMARY";
  summaryTitle.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  summaryTitle.alignment = { horizontal: "left", vertical: "middle" };
  summaryTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
  ws.getRow(8).height = 22;

  const summaryRows = [
    ["Income", totals.income],
    ["Expense", totals.expense],
    ["Net", net],
    ["Transactions", transactions.length],
  ] as const;
  let currentRow = 9;
  summaryRows.forEach(([label, value], idx) => {
    ws.getCell(`A${currentRow}`).value = label;
    ws.getCell(`B${currentRow}`).value = value;
    ws.getCell(`B${currentRow}`).numFmt =
      label === "Transactions" ? "#,##0" : '"R"#,##0.00;[Red]-"R"#,##0.00';
    ["A", "B"].forEach((c) => {
      const cell = ws.getCell(`${c}${currentRow}`);
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
      }
    });
    currentRow += 1;
  });

  ws.mergeCells("A14:D14");
  const ledgerTitle = ws.getCell("A14");
  ledgerTitle.value = "LEDGER TABLE";
  ledgerTitle.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  ledgerTitle.alignment = { horizontal: "left", vertical: "middle" };
  ledgerTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
  ws.getRow(14).height = 22;

  const headerRow = ws.getRow(15);
  headerRow.values = [
    "Date",
    "Type",
    "Category",
    "Description",
    "Reference",
    "Vendor",
    "Campaign",
    "Amount",
  ];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;

  transactions.forEach((t) => {
    const row = ws.addRow([
      t.date || "",
      t.type || "",
      categoryName(t.category_id),
      t.description || "",
      t.reference || "",
      t.vendor || "",
      t.campaign || "",
      signedAmount(t),
    ]);
    row.getCell(8).numFmt = '"R"#,##0.00;[Red]-"R"#,##0.00';
    row.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
    row.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  for (let r = 15; r <= ws.rowCount; r += 1) {
    for (let c = 1; c <= 8; c += 1) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFD0D0D0" } },
        left: { style: "thin", color: { argb: "FFD0D0D0" } },
        bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
        right: { style: "thin", color: { argb: "FFD0D0D0" } },
      };
      if (r > 15 && r % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F9F9" } };
      }
    }
  }

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 30;
  ws.getRow(4).height = 30;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dumi-essence-accounting-${dateFrom}-to-${dateTo}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
