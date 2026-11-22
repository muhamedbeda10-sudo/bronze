"use client";

// Excel files written in the browser, in the house style: a bronze header
// row, frozen; figures as numbers, codes as text. exceljs loads only when
// a file is actually asked for.

export type Cell = string | number | boolean | null | undefined;

export async function downloadXlsx(fileName: string, sheets: { name: string; headers: string[]; rows: Cell[][] }[]): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lotfy Bronze ERP";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet");
    ws.addRow(s.headers);
    for (const r of s.rows) ws.addRow(r.map((c) => (c === undefined ? null : c)));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8A5A43" } };
    head.alignment = { vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    s.headers.forEach((h, i) => {
      const longest = Math.max(h.length, ...s.rows.slice(0, 500).map((r) => String(r[i] ?? "").length));
      ws.getColumn(i + 1).width = Math.min(60, Math.max(8, longest + 2));
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
