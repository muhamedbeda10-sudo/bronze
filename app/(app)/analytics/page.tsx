import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardList, Clock, Gauge, Package, Percent, Timer, Truck } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { DashboardCharts } from "@/components/charts/LazyCharts";
import { DashboardExport } from "@/components/DashboardExport";
import { Kpi, PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { loadKpis } from "@/lib/server/dashboard";
import { idParam, periodOf } from "@/lib/server/period";
import { loadLists } from "@/lib/server/refs";
import { fmtDay } from "@/lib/domain/dates";
import { fmtNum, fmtPct } from "@/lib/format";

export const metadata: Metadata = { title: "Production Analytics" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("dashboard");
  const sp = await searchParams;
  const p = periodOf(sp, 30);
  const workshopId = idParam(sp.workshop);
  const processId = idParam(sp.process);
  const [k, lists] = await Promise.all([loadKpis({ ...p, workshopId, processId }), loadLists()]);
  const period = `${fmtDay(p.from)} – ${fmtDay(p.to)}`;

  return (
    <div className="flex flex-col gap-4">
      <PrintHead title="Production Dashboard" sub={period} />
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "workshop", label: "Workshop", type: "select", all: "All workshops", options: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })) },
          { key: "process", label: "Process", type: "select", all: "All processes", options: lists.processes.map((x) => ({ value: String(x.id), label: x.name })) },
        ]}
        end={<DashboardExport k={k} period={period} />}
      />

      <div>
        <h2 className="section-title">Overview <span className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>· now</span></h2>
        <div className="kpi-grid">
          <Kpi label="Open work orders" value={k.openOrders} icon={ClipboardList} sub={<Link href="/work-orders" className="ink">{k.activeOrders} on the floor</Link>} />
          <Kpi label="Delayed orders" value={k.delayedOrders} icon={AlertTriangle} tone={k.delayedOrders ? "bad" : "ok"} sub="Open and past the due date" />
          <Kpi label="Completed today" value={k.completedToday} icon={CheckCircle2} tone="ok" />
          <Kpi label="Material required" value={fmtNum(k.materialRequiredKg, 0)} unit="kg" icon={Package} sub="Raw req. (+allowance) of open orders" />
        </div>
      </div>

      <div>
        <h2 className="section-title">Production <span className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>· {period}</span></h2>
        <div className="kpi-grid">
          <Kpi label="Output vs plan" value={fmtPct(k.outputVsPlanPct)} icon={Gauge} tone={k.outputVsPlanPct === null ? undefined : k.outputVsPlanPct >= 90 ? "ok" : k.outputVsPlanPct >= 70 ? "warn" : "bad"} sub="Pieces completed ÷ pieces due" />
          <Kpi label="Rejection rate" value={fmtPct(k.rejectionRatePct)} icon={Percent} tone={k.rejectionRatePct === null ? undefined : k.rejectionRatePct <= 3 ? "ok" : k.rejectionRatePct <= 8 ? "warn" : "bad"} sub={`${fmtNum(k.scrapQty, 0)} rejected · ${fmtNum(k.producedQty, 0)} produced`} />
          <Kpi label="Machine utilization" value={fmtPct(k.utilizationPct)} icon={Timer} tone="info" sub="Order hours ÷ available hours" />
          <Kpi label="Overtime hours" value={fmtNum(k.overtimeHours, 1)} unit="h" icon={Clock} sub="Approved" />
          <Kpi label="Completed orders" value={k.completedInPeriod} icon={CalendarCheck} />
          <Kpi label="Avg delivery time" value={fmtNum(k.avgDeliveryDays, 1)} unit="days" icon={Truck} sub="WO date → completion" />
        </div>
      </div>

      <DashboardCharts k={k} />
    </div>
  );
}
