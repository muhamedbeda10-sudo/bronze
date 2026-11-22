import type { Metadata } from "next";
import { FilterBar } from "@/components/FilterBar";
import { AuditView } from "@/components/SettingsViews";
import { pageUser } from "@/lib/server/auth";
import { periodOf } from "@/lib/server/period";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Change History" };

const ENTITIES = ["WorkOrder", "Activity", "Inspection", "StockRow", "IssueRequest", "OvertimeRequest", "User", "Setting", "Material", "Product", "Workshop", "Process", "RouteStage", "Machine", "Mold", "Operator", "RejectionReason"];

export default async function History({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser("settings");
  const sp = await searchParams;
  const p = periodOf(sp, 7);
  const entity = ENTITIES.includes(sp.entity ?? "") ? sp.entity : undefined;
  const rows = await prisma.auditLog.findMany({ where: { at: { gte: p.from, lt: addDays(p.to, 1) }, ...(entity ? { entity } : {}) }, orderBy: { at: "desc" }, take: 3000 });
  return (
    <>
      <FilterBar
        defaults={p.defaults}
        filters={[
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "entity", label: "Record type", type: "select", all: "Everything", options: ENTITIES.map((e) => ({ value: e, label: e })) },
        ]}
      />
      <AuditView rows={rows.map((r) => ({ id: r.id, at: r.at.toISOString(), userName: r.userName, action: r.action, entity: r.entity, entityId: r.entityId, summary: r.summary, before: r.before, after: r.after }))} />
    </>
  );
}
