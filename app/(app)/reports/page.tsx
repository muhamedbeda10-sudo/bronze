import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { FilterBar } from "@/components/FilterBar";
import { ReportTable } from "@/components/ReportTable";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { periodOf } from "@/lib/server/period";
import { buildReport, REPORTS, type ReportKey } from "@/lib/server/reports";
import { fmtDay } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Reporting" };

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("reports");
  const sp = await searchParams;
  const def = REPORTS.find((r) => r.key === sp.report) ?? REPORTS[0];
  const p = periodOf(sp, 30);
  const report = await buildReport(def.key as ReportKey, p.from, p.to, p.today);
  const keep = (k: string) => `/reports?report=${k}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`;
  const period = `${fmtDay(p.from)} – ${fmtDay(p.to)}`;
  return (
    <>
      <PrintHead title={def.label} sub={period} />
      <TabLinks items={REPORTS.map((r) => ({ key: r.key, href: keep(r.key), label: r.label }))} active={def.key} label="Reports" />
      <FilterBar defaults={p.defaults} filters={[{ key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }]} end={<p className="muted" style={{ margin: 0, fontSize: 13, alignSelf: "center" }}>{def.question}</p>} />
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {report.summary.map((s) => (
          <div key={s.label} className="kpi"><div className="kpi-label">{s.label}</div><div className="kpi-value" style={{ fontSize: 22 }}>{s.value}</div></div>
        ))}
      </div>
      <ReportTable cols={report.cols} rows={report.rows} name={`${def.label} ${period}`} />
    </>
  );
}
