import type { Metadata } from "next";
import { Meter, PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { prisma } from "@/lib/db";
import { workshopLoad } from "@/lib/domain/capacity";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Capacity" };

/** The work still ahead of each workshop, against what its machines can do in a day. */
export default async function Capacity() {
  await pageUser("planning");
  const [orders, machines, workshops, settings] = await Promise.all([
    prisma.workOrder.findMany({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } }, select: { qty: true, stageIndex: true, stages: { select: { seq: true, workshopId: true, stdTimeMin: true, qcRequired: true } } } }),
    prisma.machine.findMany({ where: { status: "Active" }, select: { workshopId: true } }),
    prisma.workshop.findMany({ orderBy: { code: "asc" } }),
    getSettings(),
  ]);
  const rows = workshopLoad(orders, machines, workshops, settings.machineHoursPerDay);
  return (
    <>
      <PrintHead title="Capacity" />
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Load = standard minutes per piece (Routing Master) × quantity, for every stage an open order still has to pass, from the stage it is at.
        Capacity = active machines × {settings.machineHoursPerDay} h a day (Settings). Days of work = load ÷ daily capacity.
      </p>
      <div className="table-frame free">
        <table className="dt cards">
          <thead><tr><th>Workshop</th><th className="num">Orders waiting</th><th className="num">Load (h)</th><th className="num">Active machines</th><th className="num">Capacity (h/day)</th><th className="num">Days of work</th><th style={{ width: 200 }}>Next 5 days used</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.workshopId}>
                <td data-label="Workshop"><b>{r.name}</b></td>
                <td data-label="Orders waiting" className="num">{r.orders}</td>
                <td data-label="Load (h)" className="num">{fmtNum(r.loadHours, 1)}</td>
                <td data-label="Active machines" className="num">{r.machines}</td>
                <td data-label="Capacity (h/day)" className="num">{fmtNum(r.capacityPerDay, 0)}</td>
                <td data-label="Days of work" className="num" style={{ color: r.days !== null && r.days > 5 ? "var(--bad-fg)" : undefined, fontWeight: 700 }}>{r.days === null ? (r.loadHours > 0 ? "No machine" : "—") : fmtNum(r.days, 1)}</td>
                <td data-label="Next 5 days used"><div className="flex items-center gap-2"><div style={{ flex: 1 }}><Meter pct={r.weekPct} label={`${r.name} load`} /></div><span className="tabular" style={{ fontSize: 12, minWidth: 44, textAlign: "end" }}>{r.weekPct === null ? "—" : `${fmtNum(r.weekPct, 0)}%`}</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
