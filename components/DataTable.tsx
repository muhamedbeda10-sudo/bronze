"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, FileSpreadsheet, Printer, Search, SearchX, X } from "lucide-react";
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
  /** summed on a group row */
  sum?: boolean;
}

const PAGE = 80;

/**
 * The box every list sits in: sticky header, click a head to sort, one
 * search, Excel of exactly what is shown, Print / PDF, rows that turn into
 * cards on a phone — and, where asked, row selection with bulk actions,
 * groups that fold, clickable rows and paging of 80.
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
  selectable = false,
  bulkActions,
  groupBy,
  rowHref,
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
  free?: boolean;
  print?: boolean;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  groupBy?: { label: string; key: (row: T) => string } | null;
  rowHref?: (row: T) => string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string | number>>(new Set());
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const shown = columns.filter((c) => !c.exportOnly);
  const valueOf = (c: Column<T>, r: T): Cell => (c.value ? c.value(r) : (r as Record<string, Cell>)[c.key]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => columns.some((c) => !c.noExport && String(valueOf(c, r) ?? "").toLowerCase().includes(needle))) : rows;
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

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map<string, T[]>();
    for (const r of visible) { const k = groupBy.key(r); m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [visible, groupBy]);

  const selectedRows = rows.filter((r) => sel.has(rowKey(r)));
  const clear = () => setSel(new Set());
  const toggle = (k: string | number) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allOn = visible.length > 0 && visible.every((r) => sel.has(rowKey(r)));

  function toggleSort(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  async function exportExcel(only?: T[]) {
    setBusy(true);
    try {
      const cols = columns.filter((c) => !c.noExport);
      await downloadXlsx(exportName ?? "export", [{ name: exportName ?? "Sheet", headers: cols.map((c) => c.label), rows: (only ?? visible).map((r) => cols.map((c) => valueOf(c, r))) }]);
    } finally {
      setBusy(false);
    }
  }

  const colCount = shown.length + (selectable ? 1 : 0);
  const renderRow = (r: T) => {
    const k = rowKey(r);
    const href = rowHref?.(r);
    return (
      <tr
        key={k}
        className={`${rowClass?.(r) ?? ""} ${sel.has(k) ? "selected" : ""} ${href ? "clickable" : ""}`}
        onClick={href ? (e) => { if ((e.target as HTMLElement).closest("a,button,input,select,label")) return; router.push(href); } : undefined}
      >
        {selectable && <td className="sel"><input type="checkbox" className="cb" checked={sel.has(k)} onChange={() => toggle(k)} aria-label="Select row" /></td>}
        {shown.map((c) => (
          <td key={c.key} data-label={c.label} className={`${c.num ? "num" : ""} ${c.noExport ? "actions" : ""} ${c.className ?? ""}`}>
            {c.render ? c.render(r) : (valueOf(c, r) as ReactNode)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div>
      {(searchable || exportName || tools) && (
        <div className="no-print flex flex-wrap items-center gap-2" style={{ marginBottom: 10 }}>
          {searchable && (
            <label className="relative" style={{ flex: "1 1 220px", maxWidth: 360 }}>
              <span className="sr-only">Search the list</span>
              <Search size={15} aria-hidden className="absolute muted" style={{ insetInlineStart: 10, top: 8 }} />
              <input type="search" className="input" style={{ paddingInlineStart: 32 }} placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2" style={{ marginInlineStart: "auto" }}>
            {tools}
            {exportName && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportExcel()} disabled={busy || !visible.length} title="Excel of the rows shown">
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
      {selectable && selectedRows.length > 0 && (
        <div className="bulkbar no-print" role="region" aria-label="Selected rows">
          <span>{selectedRows.length} selected</span>
          <div className="flex flex-wrap gap-2" style={{ marginInlineStart: 8 }}>
            {bulkActions?.(selectedRows, clear)}
            {exportName && <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportExcel(selectedRows)}><FileSpreadsheet size={14} aria-hidden /> Export selected</button>}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginInlineStart: "auto" }} onClick={clear}><X size={14} aria-hidden /> Clear</button>
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
                {selectable && <th className="sel"><input type="checkbox" className="cb" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(visible.map(rowKey)))} aria-label="Select all rows" /></th>}
                {shown.map((c) => {
                  const on = sort?.key === c.key;
                  const sortable = c.sortable !== false && !c.noExport;
                  return (
                    <th key={c.key} className={c.num ? "num" : ""} aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined} scope="col">
                      {sortable ? (
                        <button type="button" className="sort" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          {on ? (sort!.dir === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : <ArrowUpDown size={11} aria-hidden style={{ opacity: 0.35 }} />}
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
              {groups
                ? groups.map(([g, rs]) => {
                    const isFolded = folded.has(g);
                    return (
                      <Fragment key={`g-${g}`}>
                        <tr className="group-row" onClick={() => setFolded((f) => { const n = new Set(f); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                          {selectable && <td className="sel" />}
                          {shown.map((c, i) => (
                            <td key={c.key} className={c.num ? "num" : ""}>
                              {i === 0 ? (
                                <span className="inline-flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
                                  {isFolded ? <ChevronRight size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                                  {g} <span className="muted" style={{ fontWeight: 400 }}>({rs.length})</span>
                                </span>
                              ) : c.sum ? (
                                rs.reduce((s, r) => s + (Number(valueOf(c, r)) || 0), 0).toLocaleString("en-US", { maximumFractionDigits: 1 })
                              ) : null}
                            </td>
                          ))}
                        </tr>
                        {!isFolded && rs.map(renderRow)}
                      </Fragment>
                    );
                  })
                : visible.slice(0, limit).map(renderRow)}
              {!groups && visible.length > limit && (
                <tr><td colSpan={colCount} style={{ textAlign: "center" }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, visible.length - limit)} more of {visible.length - limit}</button></td></tr>
              )}
            </tbody>
            {footer && <tfoot>{footer}</tfoot>}
          </table>
        )}
      </div>
      <div className="table-foot no-print">
        <span>{visible.length === rows.length ? `${rows.length} record${rows.length === 1 ? "" : "s"}` : `${visible.length} of ${rows.length} records`}</span>
      </div>
    </div>
  );
}
