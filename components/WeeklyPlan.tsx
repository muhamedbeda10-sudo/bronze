"use client";

import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { fmtDay } from "@/lib/domain/dates";
import { statusLabel } from "@/lib/domain/status";
import type { WoRow } from "@/lib/server/woQueries";

export function WeeklyPlan({ rows }: { rows: WoRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      exportName="Weekly production plan"
      rowClass={(r) => (r.late ? "late" : "")}
      empty={{ title: "Nothing planned for this week", hint: "Orders whose start date falls in the week, or that are already on the floor, show here." }}
      columns={[
        { key: "startDate", label: "Planned start", render: (r) => fmtDay(r.startDate) || "—", className: "nowrap" },
        { key: "code", label: "WO No", render: (r) => <Link className="code ink" href={`/work-orders/${r.id}`}>{r.code}</Link> },
        { key: "fullName", label: "Full name", className: "wrap" },
        { key: "material", label: "Material" },
        { key: "process", label: "Process" },
        { key: "route", label: "Routing sequence", className: "wrap", value: (r) => r.stages.map((s) => s.name).join(" → "), render: (r) => <span style={{ fontSize: 12 }}>{r.stages.map((s, i) => <span key={i} style={{ fontWeight: i === r.stageIndex ? 700 : 400, color: i === r.stageIndex ? "var(--brand-ink)" : i < (r.stageIndex ?? 0) ? "var(--muted)" : undefined }}>{i > 0 && " → "}{s.name}</span>)}</span> },
        { key: "stage", label: "Current stage", render: (r) => r.stage ?? <span className="muted">Not released</span> },
        { key: "status", label: "Status", value: (r) => statusLabel(r.status), render: (r) => <StatusBadge status={r.status} /> },
        { key: "priority", label: "Priority", render: (r) => <PriorityBadge priority={r.priority} /> },
        { key: "dueDate", label: "Due", render: (r) => fmtDay(r.dueDate) || "—", className: "nowrap" },
        { key: "qty", label: "Qty", num: true },
      ]}
      initialSort={{ key: "startDate", dir: "asc" }}
    />
  );
}
