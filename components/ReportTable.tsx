"use client";

import { DataTable } from "@/components/DataTable";
import { fmtNum } from "@/lib/format";
import type { Cell, ReportCol } from "@/lib/server/reports";

/** A report's rows; the columns are plain data, so a server page can hand them over. */
export function ReportTable({ cols, rows, name }: { cols: ReportCol[]; rows: Record<string, Cell>[]; name: string }) {
  return (
    <DataTable
      rows={rows.map((r, i) => ({ ...r, __i: i }))}
      rowKey={(r) => r.__i as number}
      exportName={name}
      empty={{ title: "Nothing in this period", hint: "Widen the dates above." }}
      columns={cols.map((c) => ({
        key: c.key,
        label: c.pct ? `${c.label} %` : c.label,
        num: c.num,
        className: c.key === "name" ? "wrap" : undefined,
        render: (r: Record<string, Cell>) => {
          const v = r[c.key];
          if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
          if (typeof v === "number") return c.pct ? `${fmtNum(v, 1)}%` : fmtNum(v, c.dp ?? 0);
          if (v === "No") return <b style={{ color: "var(--bad-fg)" }}>No</b>;
          return v;
        },
      }))}
    />
  );
}
