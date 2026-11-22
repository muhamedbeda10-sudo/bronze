"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/DataTable";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { statusLabel, PRIORITY_LABEL } from "@/lib/domain/status";
import { fmtDay } from "@/lib/domain/dates";
import { fmtNum } from "@/lib/format";
import type { WoRow } from "@/lib/server/woQueries";

const code = (r: WoRow) => <Link href={`/work-orders/${r.id}`} className="code ink" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{r.code}</Link>;
function date(k: keyof WoRow) {
  return function DateCell(r: WoRow) {
    return r[k] ? fmtDay(r[k] as string) : <span className="muted">—</span>;
  };
}

export function WoList({ rows, mode, tools }: { rows: WoRow[]; mode: "open" | "history"; tools?: React.ReactNode }) {
  const open: Column<WoRow>[] = [
    { key: "woDate", label: "WO Date", render: date("woDate"), className: "nowrap" },
    { key: "code", label: "WO No", render: code, value: (r) => r.code },
    { key: "fullName", label: "Full Name", className: "wrap" },
    { key: "material", label: "Material", value: (r) => `${r.materialCode} ${r.material}`, render: (r) => r.material },
    { key: "process", label: "Process" },
    { key: "dims", label: "Dimensions", className: "nowrap" },
    { key: "qty", label: "Qty", num: true },
    { key: "stage", label: "Stage", render: (r) => r.stage ?? <span className="muted">Not released</span> },
    { key: "status", label: "Status", value: (r) => statusLabel(r.status), render: (r) => <StatusBadge status={r.status} /> },
    { key: "priority", label: "Priority", value: (r) => `${r.priority} – ${PRIORITY_LABEL[r.priority]}`, render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "dueDate", label: "Due", render: date("dueDate"), className: "nowrap" },
    { key: "delayDays", label: "Delay (days)", num: true, render: (r) => (r.delayDays ? <b style={{ color: "var(--bad-fg)" }}>{r.delayDays}</b> : <span className="muted">0</span>) },
    { key: "rawReqKg", label: "Raw req. (kg)", num: true, exportOnly: true },
  ];
  const history: Column<WoRow>[] = [
    { key: "code", label: "WO No", render: code, value: (r) => r.code },
    { key: "fullName", label: "Full Name", className: "wrap" },
    { key: "woDate", label: "WO Date", render: date("woDate"), className: "nowrap" },
    { key: "startDate", label: "Start", render: date("startDate"), className: "nowrap" },
    { key: "dueDate", label: "Due", render: date("dueDate"), className: "nowrap" },
    { key: "atpDate", label: "ATP", render: date("atpDate"), className: "nowrap" },
    { key: "deliveryDate", label: "Delivery", render: date("deliveryDate"), className: "nowrap" },
    { key: "completedAt", label: "Completed", render: date("completedAt"), className: "nowrap" },
    { key: "expectedKg", label: "Expected wt (kg)", num: true, render: (r) => fmtNum(r.expectedKg, 2) },
    { key: "actualKg", label: "Actual wt (kg)", num: true, render: (r) => fmtNum(r.actualKg, 2) },
    { key: "qualityStatus", label: "Quality", render: (r) => r.qualityStatus ?? <span className="muted">—</span> },
    { key: "finalStage", label: "Final process" },
    { key: "stage", label: "Current stage", render: (r) => r.stage ?? <span className="muted">—</span> },
    { key: "status", label: "Status", value: (r) => statusLabel(r.status), render: (r) => <StatusBadge status={r.status} /> },
    { key: "ageDays", label: "No. of days", num: true },
    { key: "delayDays", label: "Delay days", num: true, render: (r) => (r.delayDays ? <b style={{ color: "var(--bad-fg)" }}>{r.delayDays}</b> : <span className="muted">0</span>) },
    { key: "material", label: "Material", exportOnly: true },
    { key: "process", label: "Process", exportOnly: true },
    { key: "qty", label: "Qty", num: true, exportOnly: true },
  ];
  return (
    <DataTable
      rows={rows}
      columns={mode === "open" ? open : history}
      rowKey={(r) => r.id}
      exportName={mode === "open" ? "Open work orders" : "Work order history"}
      rowClass={(r) => (r.late ? "late" : "")}
      searchPlaceholder="Search WO no, name, material…"
      empty={{ title: "No work orders here", hint: mode === "open" ? "Create one from Create Work Order." : undefined }}
      tools={tools}
    />
  );
}
