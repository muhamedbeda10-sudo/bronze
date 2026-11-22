"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Printer, Search, SearchX } from "lucide-react";
import { downloadXlsx, type Cell } from "@/components/excel";
import { EmptyState } from "@/components/ui";

export interface Column<T> {
  key: string;
  label: string;
  /** right-aligned figures */
  num?: boolean;
  /** what the cell shows; defaults to value() */
  render?: (row: T) => ReactNode;
  /** the cell's plain value: sorting, searching and Excel */
  value?: (row: T) => Cell;
  className?: string;
  /** in the Excel file only */
  exportOnly?: boolean;
  /** never in the Excel file (action buttons) */
  noExport?: boolean;
  sortable?: boolean;
}

/**
 * The box every list sits in: sticky header, click a head to sort, one
 * search over every column, Excel of exactly what is shown, Print / PDF,
 * and rows that turn into cards on a phone.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  exportName,
  searchable = true,
  searchPlaceholder = "Search…",
  empty,
  rowClass,
  tools,
  footer,
  initialSort,
  free = false,
  print = true,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  exportName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  empty?: { title: string; hint?: string; action?: ReactNode };
  rowClass?: (row: T) => string;
  tools?: ReactNode;
  footer?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** grow with the page instead of scrolling in its own frame */
  free?: boolean;
  print?: boolean;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [busy, setBusy] = useState(false);

  const shown = columns.filter((c) => !c.exportOnly);
  const valueOf = (c: Column<T>, r: T): Cell => (c.value ? c.value(r) : (r as Record<string, Cell>)[c.key]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle
      ? rows.filter((r) => columns.some((c) => !c.noExport && String(valueOf(c, r) ?? "").toLowerCase().includes(needle)))
      : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const x = valueOf(col, a);
          const y = valueOf(col, b);
          if (x === y) return 0;
          if (x === null || x === undefined || x === "") return 1;
          if (y === null || y === undefined || y === "") return -1;
          if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
          return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  async function exportExcel() {
    setBusy(true);
    try {
      const cols = columns.filter((c) => !c.noExport);
      await downloadXlsx(exportName ?? "export", [{ name: exportName ?? "Sheet", headers: cols.map((c) => c.label), rows: visible.map((r) => cols.map((c) => valueOf(c, r))) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {(searchable || exportName || tools) && (
        <div className="no-print flex flex-wrap items-center gap-2" style={{ marginBottom: 10 }}>
          {searchable && (
            <label className="relative" style={{ flex: "1 1 220px", maxWidth: 360 }}>
              <span className="sr-only">Search the list</span>
              <Search size={15} aria-hidden className="absolute muted" style={{ insetInlineStart: 10, top: 9 }} />
              <input type="search" className="input" style={{ paddingInlineStart: 32 }} placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2" style={{ marginInlineStart: "auto" }}>
            {tools}
            {exportName && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={exportExcel} disabled={busy || !visible.length} title="Excel of the rows shown">
                <FileSpreadsheet size={15} aria-hidden /> Export
              </button>
            )}
            {print && exportName && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print, or save as PDF">
                <Printer size={15} aria-hidden /> PDF
              </button>
            )}
          </div>
        </div>
      )}
      <div className={`table-frame ${free ? "free" : ""}`}>
        {visible.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title="Nothing matches the search" hint={`No row holds "${q}".`} action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setQ("")}>Clear search</button>} />
          ) : (
            <EmptyState icon={SearchX} title={empty?.title ?? "Nothing here yet"} hint={empty?.hint} action={empty?.action} />
          )
        ) : (
          <table className="dt cards">
            <thead>
              <tr>
                {shown.map((c) => {
                  const on = sort?.key === c.key;
                  const sortable = c.sortable !== false && !c.noExport;
                  return (
                    <th key={c.key} className={c.num ? "num" : ""} aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined} scope="col">
                      {sortable ? (
                        <button type="button" className="sort" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          {on ? (sort!.dir === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : <ArrowUpDown size={11} aria-hidden style={{ opacity: 0.4 }} />}
                        </button>
                      ) : (
                        <span>{c.label}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={rowKey(r)} className={rowClass?.(r) ?? ""}>
                  {shown.map((c) => (
                    <td key={c.key} data-label={c.label} className={`${c.num ? "num" : ""} ${c.noExport ? "actions" : ""} ${c.className ?? ""}`}>
                      {c.render ? c.render(r) : (valueOf(c, r) as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && <tfoot>{footer}</tfoot>}
          </table>
        )}
      </div>
      <div className="table-foot no-print">
        <span>{visible.length === rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : `${visible.length} of ${rows.length} rows`}</span>
      </div>
    </div>
  );
}
