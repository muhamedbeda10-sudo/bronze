import "server-only";
import ExcelJS from "exceljs";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export type SheetRow = { rowNo: number; cells: Record<string, unknown> };

/** A cell's plain value: formulas give their result, rich text its text, dates their day. */
function plain(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return plain((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if ("error" in v) return null;
  }
  return v;
}

/**
 * The first sheet of an uploaded .xlsx: its first row names the columns,
 * every other non-empty row is one record keyed by those names (lower-cased).
 */
export async function readSheet(file: File): Promise<{ ok: true; rows: SheetRow[]; headers: string[] } | { ok: false; error: string }> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return { ok: false, error: "Choose an Excel file (.xlsx) first." };
  if (file.size > MAX_BYTES) return { ok: false, error: "The file is larger than 5 MB." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Only .xlsx files can be uploaded — save the sheet as Excel Workbook first." };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  } catch {
    return { ok: false, error: "The file could not be read as an Excel workbook." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: "The workbook has no sheet." };
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { headers[col] = String(plain(c.value) ?? "").trim(); });
  if (!headers.some(Boolean)) return { ok: false, error: "The first row must hold the column names." };
  const rows: SheetRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: Record<string, unknown> = {};
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = plain(row.getCell(col).value);
      if (v !== null && v !== "") any = true;
      cells[h.toLowerCase()] = v;
    });
    if (any) rows.push({ rowNo: r, cells });
    if (rows.length > MAX_ROWS) return { ok: false, error: `The sheet has more than ${MAX_ROWS} rows — split it.` };
  }
  return { ok: true, rows, headers: headers.filter(Boolean) };
}
