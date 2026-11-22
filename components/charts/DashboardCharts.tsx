"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Kpis } from "@/lib/domain/kpi";
import { fmtDay } from "@/lib/domain/dates";

// Thin marks, a recessive grid, one axis; a legend only where there are two
// series; every chart has a hover tooltip. Colours are the validated
// --viz-* tokens, so dark mode takes its own steps.
const AXIS = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: { stroke: "var(--border-strong)" } };
const GRID = <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="0" vertical={false} />;
const TIP = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", fontSize: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--foreground)", fontWeight: 700 },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--surface-3)", opacity: 0.6 },
};

function Panel({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="card" style={{ minWidth: 0 }}>
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
      </div>
      <div className="card-pad" style={{ height: 280 }}>
        {empty ? <div className="grid place-items-center muted h-full" style={{ fontSize: 13 }}>No data in this period.</div> : children}
      </div>
    </section>
  );
}

export function DashboardCharts({ k }: { k: Kpis }) {
  const trend = k.trend.map((t) => ({ ...t, label: fmtDay(t.day).slice(0, 6) }));
  const hasTrend = trend.some((t) => t.planned || t.produced);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Daily production trend" sub="Pieces due vs completed" empty={!hasTrend}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
            {GRID}
            <XAxis dataKey="label" {...AXIS} minTickGap={18} />
            <YAxis {...AXIS} allowDecimals={false} />
            <Tooltip {...TIP} cursor={{ stroke: "var(--border-strong)" }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "var(--foreground)" }}>{v}</span>} />
            <Line type="linear" dataKey="planned" name="Planned (due)" stroke="var(--viz-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
            <Line type="linear" dataKey="produced" name="Produced (completed)" stroke="var(--viz-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Status distribution" sub="Work order lines" empty={!k.statusDistribution.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={k.statusDistribution} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...AXIS} width={150} />
            <Tooltip {...TIP} />
            <Bar dataKey="count" name="Lines" fill="var(--viz-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Rejections by reason" sub="Scrap logged + QC rejects (pcs)" empty={!k.rejectionByReason.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={k.rejectionByReason} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis type="category" dataKey="reason" {...AXIS} width={130} />
            <Tooltip {...TIP} />
            <Bar dataKey="qty" name="Pieces" fill="var(--viz-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Utilization by workshop" sub="Order hours ÷ available machine hours" empty={!k.utilizationByWorkshop.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={k.utilizationByWorkshop} margin={{ top: 6, right: 12, left: -12, bottom: 0 }} barCategoryGap="28%">
            {GRID}
            <XAxis dataKey="workshop" {...AXIS} interval={0} tick={{ fontSize: 10, fill: "var(--muted)" }} />
            <YAxis {...AXIS} unit="%" />
            <Tooltip {...TIP} formatter={(v) => [`${v}%`, "Utilization"]} />
            <Bar dataKey="pct" name="Utilization" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
