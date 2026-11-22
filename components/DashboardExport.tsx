"use client";

import { FileSpreadsheet, Printer } from "lucide-react";
import { downloadXlsx } from "@/components/excel";
import type { Kpis } from "@/lib/domain/kpi";

/** The dashboard's figures and the tables under its charts, as one workbook. */
export function DashboardExport({ k, period }: { k: Kpis; period: string }) {
  const go = () =>
    downloadXlsx(`Production dashboard ${period}`, [
      {
        name: "KPIs",
        headers: ["KPI", "Value"],
        rows: [
          ["Period", period],
          ["Open work orders", k.openOrders],
          ["Delayed orders", k.delayedOrders],
          ["Completed today", k.completedToday],
          ["Completed in period", k.completedInPeriod],
          ["Material required (kg)", k.materialRequiredKg],
          ["Output vs plan %", k.outputVsPlanPct],
          ["Rejection rate %", k.rejectionRatePct],
          ["Machine utilization %", k.utilizationPct],
          ["Overtime hours", k.overtimeHours],
          ["Avg delivery time (days)", k.avgDeliveryDays],
        ],
      },
      { name: "Trend", headers: ["Day", "Planned (due)", "Produced (completed)"], rows: k.trend.map((t) => [t.day, t.planned, t.produced]) },
      { name: "Status", headers: ["Status", "Lines"], rows: k.statusDistribution.map((s) => [s.label, s.count]) },
      { name: "Rejections", headers: ["Reason", "Pieces"], rows: k.rejectionByReason.map((r) => [r.reason, r.qty]) },
      { name: "Utilization", headers: ["Workshop", "Hours", "Utilization %"], rows: k.utilizationByWorkshop.map((u) => [u.workshop, u.hours, u.pct]) },
    ]);
  return (
    <div className="flex gap-2" style={{ alignSelf: "flex-end" }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={go}><FileSpreadsheet size={15} aria-hidden /> Export to Excel</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={15} aria-hidden /> PDF</button>
    </div>
  );
}
