import type { AccountingCategory, AccountingTransaction } from "@/types/database";
import ExcelJS from "exceljs";
import {
  createBrandedPdfContext,
  pdfEnsureSpace,
  pdfFooterNote,
  pdfKpiRow,
  pdfMoney,
  pdfOpenPage,
  pdfSectionLabel,
  pdfTableHeader,
  pdfTableRow,
  type PdfColumn,
} from "@/lib/utils/pdf-document-kit";
import { DUMI_LOGO_PATH } from "@/lib/utils/pdf-letterhead";

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

function buildCategoryBreakdown(
  transactions: AccountingTransaction[],
  categories: AccountingCategory[],
) {
  const map = new Map<string, { name: string; income: number; expense: number }>();
  for (const t of transactions) {
    const cat = categories.find((c) => c.id === t.category_id);
    const key = cat?.id || "_uncategorised";
    const name = cat?.name || "Uncategorised";
    const row = map.get(key) ?? { name, income: 0, expense: 0 };
    if (t.type === "income") row.income += Number(t.amount) || 0;
    if (t.type === "expense") row.expense += Math.abs(Number(t.amount) || 0);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.income + b.expense - (a.income + a.expense));
}

export async function exportAccountingPdf(params: {
  transactions: AccountingTransaction[];
  categories: AccountingCategory[];
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const { transactions, categories, dateFrom, dateTo } = params;
  const ctx = await createBrandedPdfContext({
    orientation: "landscape",
    tagline: "House ledger · Accounting & bookkeeping",
  });
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
  const byCategory = buildCategoryBreakdown(transactions, categories);
  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name || "—";

  pdfOpenPage(ctx, {
    title: "Accounting Statement",
    subtitle: "Income, expenses & net position for the selected period",
    metaLeft: [`Period: ${dateFrom} → ${dateTo}`],
    metaRight: [`Generated: ${generated}`, `${transactions.length} ledger lines`],
  });

  pdfKpiRow(ctx, [
    { label: "Income", value: pdfMoney(totals.income) },
    { label: "Expense", value: pdfMoney(totals.expense) },
    { label: "Net", value: pdfMoney(net), emphasize: true },
    { label: "Lines", value: String(transactions.length) },
  ]);

  // P&L by category
  pdfSectionLabel(ctx, "Profit & loss by category");
  const plCols: PdfColumn[] = [
    { label: "Category", width: 90 },
    { label: "Income", width: 45, align: "right" },
    { label: "Expense", width: 45, align: "right" },
    { label: "Net", width: 45, align: "right" },
  ];
  const drawPlHeader = () => pdfTableHeader(ctx, plCols);
  drawPlHeader();
  byCategory.forEach((row, idx) => {
    pdfEnsureSpace(ctx, 10, drawPlHeader);
    pdfTableRow(
      ctx,
      plCols,
      [row.name, pdfMoney(row.income), pdfMoney(row.expense), pdfMoney(row.income - row.expense)],
      { zebra: idx % 2 === 1 },
    );
  });
  if (byCategory.length === 0) {
    pdfTableRow(ctx, plCols, ["No categorised activity in this period", "—", "—", "—"]);
  }

  ctx.y += 6;
  pdfSectionLabel(ctx, "Full ledger");

  const cols: PdfColumn[] = [
    { label: "Date", width: 24 },
    { label: "Type", width: 20 },
    { label: "Category", width: 34 },
    { label: "Description", width: 88 },
    { label: "Reference", width: 28 },
    { label: "Vendor", width: 36 },
    { label: "Amount", width: 26, align: "right" },
  ];
  const drawHeader = () => pdfTableHeader(ctx, cols);
  drawHeader();

  transactions.forEach((t, idx) => {
    pdfEnsureSpace(ctx, 10, drawHeader);
    pdfTableRow(
      ctx,
      cols,
      [
        t.date || "—",
        t.type || "—",
        categoryName(t.category_id),
        t.description || "—",
        t.reference || "—",
        t.vendor || "—",
        pdfMoney(signedAmount(t)),
      ],
      { zebra: idx % 2 === 1 },
    );
  });

  pdfFooterNote(ctx, "Dumi Essence house ledger · Keep with monthly bookkeeping records.");
  ctx.doc.save(`dumi-essence-accounting-${dateFrom}-to-${dateTo}.pdf`);
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
  const byCategory = buildCategoryBreakdown(transactions, categories);

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
  subtitle.value = "Accounting Statement · Bookkeeping export";
  subtitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF111111" } };

  ws.mergeCells("A6:D6");
  ws.getCell("A6").value = `Report Period: ${dateFrom} to ${dateTo}`;
  ws.mergeCells("E6:H6");
  ws.getCell("E6").value = `Generated On: ${new Date().toISOString().slice(0, 10)}`;
  ws.getCell("E6").alignment = { horizontal: "right" };

  const logoBase64 = await loadImageBase64(DUMI_LOGO_PATH);
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
  summaryTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };

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
    if (idx % 2 === 1) {
      ["A", "B"].forEach((c) => {
        ws.getCell(`${c}${currentRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F8F8" },
        };
      });
    }
    currentRow += 1;
  });

  // P&L sheet
  const pl = wb.addWorksheet("P&L by Category");
  pl.columns = [
    { header: "Category", key: "name", width: 28 },
    { header: "Income", key: "income", width: 14 },
    { header: "Expense", key: "expense", width: 14 },
    { header: "Net", key: "net", width: 14 },
  ];
  pl.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  pl.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
  byCategory.forEach((row) => {
    const r = pl.addRow({
      name: row.name,
      income: row.income,
      expense: row.expense,
      net: row.income - row.expense,
    });
    ["income", "expense", "net"].forEach((k) => {
      r.getCell(k).numFmt = '"R"#,##0.00;[Red]-"R"#,##0.00';
    });
  });

  ws.mergeCells("A14:D14");
  const ledgerTitle = ws.getCell("A14");
  ledgerTitle.value = "LEDGER TABLE";
  ledgerTitle.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  ledgerTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };

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
  });

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
