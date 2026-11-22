import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TabLinks } from "@/components/TabLinks";
import { MasterView } from "@/components/MasterView";
import { Badge, PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { listMaster } from "@/lib/server/master";
import { loadRefMaps, refOptions } from "@/lib/server/refs";
import { can } from "@/lib/domain/access";
import { isMasterTab, MASTER_TABS, TAB_LABEL } from "@/lib/domain/master";
import { STATUS_LABEL, STATUS_TONE, WO_STATUSES } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Master Data" };

export default async function MasterTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!isMasterTab(tab)) notFound();
  const user = await pageUser("masterData");
  const items = MASTER_TABS.map((t, i) => ({ key: t, href: `/master/${t}`, label: `${i + 1}. ${TAB_LABEL[t]}` }));

  if (tab === "statuses") {
    return (
      <>
        <TabLinks items={items} active={tab} label="Master data" />
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>The statuses a work order moves through. They are fixed: the planning, quality and dashboard logic depend on them.</p>
        <div className="card" style={{ maxWidth: 560 }}>
          <table className="dt">
            <thead><tr><th>#</th><th>Status</th><th>Set by</th></tr></thead>
            <tbody>
              {WO_STATUSES.map((s, i) => (
                <tr key={s}>
                  <td className="num" style={{ width: 40 }}>{i + 1}</td>
                  <td><Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge></td>
                  <td className="muted">{SET_BY[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const [rows, options, maps] = await Promise.all([listMaster(tab), refOptions(), loadRefMaps()]);
  const refLabels = Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, Object.fromEntries([...m!.byId].map(([id, code]) => [String(id), code]))]));
  return (
    <>
      <PrintHead title={TAB_LABEL[tab]} />
      <TabLinks items={items} active={tab} label="Master data" />
      <MasterView
        tab={tab}
        rows={JSON.parse(JSON.stringify(rows))}
        options={options}
        refLabels={refLabels}
        canEdit={can(user.access, "masterData", "E")}
        canDelete={can(user.access, "masterData", "F")}
      />
    </>
  );
}

const SET_BY: Record<string, string> = {
  PLANNED: "Saving a work order",
  WAITING_MATERIAL: "Planning — waiting material",
  WAITING_TECH_OFFICE: "Planning — waiting technical office",
  IN_PRODUCTION: "Start Stage / Next Stage",
  UNDER_INSPECTION: "Reaching a QC stage",
  REWORK: "Rework, or a QC rejection",
  ON_HOLD: "Planning — put on hold",
  COMPLETED: "Finishing the last stage",
  CANCELLED: "Cancelling the order",
};
