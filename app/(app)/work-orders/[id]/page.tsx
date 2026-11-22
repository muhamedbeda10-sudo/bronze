import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui";
import { CpanelActions, Crumb } from "@/components/Cpanel";
import { WoDetailActions } from "@/components/WoDetailActions";
import { PrintTravelerButton, RecordHeader, RecordNotebook, type RecordData } from "@/components/WoRecord";
import { Chatter, type ChatItem } from "@/components/Chatter";
import { pageUser } from "@/lib/server/auth";
import { getOrder, toRow } from "@/lib/server/woQueries";
import { woOptions } from "@/lib/server/woOptions";
import { prisma } from "@/lib/db";
import { can, parseAccess } from "@/lib/domain/access";
import { dayKey, fmtDay, fmtInstant } from "@/lib/domain/dates";
import { ACTION_LABEL, availableActions, type StageAction } from "@/lib/domain/routing";
import { isOpen, statusLabel, PRIORITY_LABEL, type WoStatus } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Work Order" };

const RESULT: Record<string, string> = { PASS: "passed", REJECT_LAST: "rejected to the last stage", REJECT_START: "rejected to the start" };

function F({ l, v }: { l: string; v: React.ReactNode }) {
  return <div className="fg-row"><span>{l}</span><span>{v || <span className="muted">—</span>}</span></div>;
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("workOrders");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const wo = await getOrder(id);
  if (!wo) notFound();
  const r = toRow(wo);
  const open = isOpen(wo.status);
  const canEdit = open && can(user.access, "workOrders", "E");
  const [o, issues, fg, comments, files, audits, people] = await Promise.all([
    canEdit ? woOptions() : null,
    prisma.issueRequest.findMany({ where: { workOrderId: id }, include: { material: true }, orderBy: { date: "desc" } }),
    prisma.stockRow.findMany({ where: { workOrderId: id, kind: "FG" } }),
    prisma.comment.findMany({ where: { entity: "WorkOrder", entityId: id } }),
    prisma.attachment.findMany({ where: { entity: "WorkOrder", entityId: id }, select: { id: true, fileName: true, size: true, uploadedBy: true, uploadedById: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { entity: "WorkOrder", entityId: String(id), action: { in: ["create", "update"] } } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, access: true }, orderBy: { name: "asc" } }),
  ]);

  const s = (v: number | null) => (v === null ? "" : String(v));
  const initial = {
    productId: String(wo.productId), materialId: String(wo.materialId), processId: String(wo.processId),
    od: s(wo.od), innerDia: s(wo.innerDia), length: s(wo.length), width: s(wo.width), height: s(wo.height),
    qty: String(wo.qty), moldId: s(wo.moldId), priority: String(wo.priority),
    startDate: dayKey(wo.startDate), atpDate: dayKey(wo.atpDate), dueDate: dayKey(wo.dueDate),
    dimensionNotes: wo.dimensionNotes ?? "", commentNotes: wo.commentNotes ?? "",
  };

  const data: RecordData = {
    id: wo.id,
    version: wo.version,
    status: wo.status,
    stageIndex: wo.stageIndex,
    stageState: wo.stageState,
    canPlan: can(user.access, "planning", "F"),
    canInspect: can(user.access, "quality", "F"),
    actions: availableActions({ status: wo.status as WoStatus, stageIndex: wo.stageIndex, stageState: wo.stageState as "WAITING" | "IN_PROGRESS" | null, heldFrom: wo.heldFrom as WoStatus | null }, wo.stages.map((x) => ({ name: x.name, qcRequired: x.qcRequired }))).filter((a) => a !== "CANCEL"),
    stages: wo.stages.map((st, i) => {
      const acts = wo.activities.filter((a) => a.stageName === st.name);
      return {
        name: st.name,
        workshop: st.workshop?.name ?? null,
        qc: st.qcRequired,
        stdMin: st.stdTimeMin,
        plannedHrs: Math.round(((wo.qty * st.stdTimeMin) / 60) * 100) / 100,
        actualHrs: acts.reduce((t, a) => t + a.durationHrs, 0),
        produced: acts.reduce((t, a) => t + a.qtyProduced, 0),
        scrap: acts.reduce((t, a) => t + a.qtyScrap, 0) + wo.inspections.filter((x) => x.stageName === st.name).reduce((t, x) => t + x.qtyRejected, 0),
        state: wo.status === "COMPLETED" || (wo.stageIndex !== null && i < wo.stageIndex) ? "done" : wo.stageIndex === i ? "now" : "todo",
      };
    }),
    activities: wo.activities.map((a) => ({ id: a.id, date: dayKey(a.date), shift: a.shift, workshop: a.workshop.name, machine: a.machine?.name ?? null, operator: a.operator?.name ?? null, stage: a.stageName, status: a.taskStatus, hours: a.durationHrs, produced: a.qtyProduced, scrap: a.qtyScrap, reason: a.rejectionReason?.name ?? null, notes: a.notes })),
    inspections: wo.inspections.map((x) => ({ id: x.id, at: x.at.toISOString(), stage: x.stageName, result: x.result, inspected: x.qtyInspected, rejected: x.qtyRejected, reason: x.rejectionReason?.name ?? null, inspector: x.inspectorName, notes: x.notes })),
    issues: issues.map((x) => ({ id: x.id, reqNo: x.reqNo, date: dayKey(x.date), material: x.material.name, kg: x.qtyKg, status: x.status })),
    fg: fg.map((x) => ({ id: x.id, qty: x.totalQty, reserved: x.reservedQty, at: x.createdAt.toISOString() })),
  };

  const chat: ChatItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, id: `c${c.id}`, at: c.createdAt.toISOString(), who: c.userName, body: c.body })),
    ...files.map((f) => ({ kind: "file" as const, id: `f${f.id}`, at: f.createdAt.toISOString(), who: f.uploadedBy, fileId: f.id, fileName: f.fileName, size: f.size, mine: f.uploadedById === user.id })),
    ...wo.moves.map((m) => ({ kind: "log" as const, id: `m${m.id}`, at: m.at.toISOString(), who: m.userName, text: `${m.action === "COMPLETE" ? "Completed" : ACTION_LABEL[m.action as StageAction] ?? m.action}: ${m.fromStage ?? statusLabel(m.fromStatus)} → ${m.toStage ?? statusLabel(m.toStatus)}${m.note ? ` — “${m.note}”` : ""}` })),
    ...wo.inspections.map((x) => ({ kind: "log" as const, id: `i${x.id}`, at: x.at.toISOString(), who: x.inspectorName, text: `Inspection at ${x.stageName}: ${RESULT[x.result] ?? x.result} (${x.qtyInspected} inspected, ${x.qtyRejected} rejected${x.rejectionReason ? ` — ${x.rejectionReason.name}` : ""})` })),
    ...audits.map((a) => ({ kind: "log" as const, id: `a${a.id}`, at: a.at.toISOString(), who: a.userName, text: a.summary })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <>
      <Crumb parent={{ href: "/work-orders", label: "Work Orders" }} title={r.code} />
      <CpanelActions>
        <PrintTravelerButton id={wo.id} />
        <WoDetailActions id={wo.id} version={wo.version} woNo={wo.woNo} lineNo={wo.lineNo} lineCount={wo.lineCount} initial={initial} o={o} lockProcess={wo.stageIndex !== null} canEdit={canEdit} canCancel={open && can(user.access, "workOrders", "F")} />
      </CpanelActions>
      <div className="record">
        <article className="sheet">
          <RecordHeader d={data} />
          <div className="sheet-head">
            <div className="muted" style={{ fontSize: 12 }}>Work order · line {wo.lineNo} of {wo.lineCount}</div>
            <h2 className="sheet-title">{wo.fullName}</h2>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
              <StatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
              {r.late && <Badge tone="bad">{r.delayDays} days late</Badge>}
              {wo.qualityStatus && <Badge tone={wo.qualityStatus === "Passed" ? "ok" : "warn"}>QC {wo.qualityStatus.toLowerCase()}</Badge>}
            </div>
          </div>
          <div className="fieldgrid">
            <div>
              <F l="Product" v={wo.product.name} />
              <F l="Material" v={`${wo.material.code} · ${wo.material.name}`} />
              <F l="Process" v={`${wo.process.code} · ${wo.process.name}`} />
              <F l="Dimensions" v={r.dims} />
              <F l="Quantity" v={`${wo.qty} pcs`} />
              <F l="Mold" v={wo.mold?.moldNo} />
              <F l="Priority" v={`${wo.priority} – ${PRIORITY_LABEL[wo.priority]}`} />
            </div>
            <div>
              <F l="WO date" v={fmtDay(wo.woDate)} />
              <F l="Planned start" v={fmtDay(wo.startDate)} />
              <F l="ATP date" v={fmtDay(wo.atpDate)} />
              <F l="Due date" v={<span style={{ color: r.late ? "var(--bad-fg)" : undefined }}>{fmtDay(wo.dueDate)}</span>} />
              <F l="Started" v={wo.startedAt ? fmtInstant(wo.startedAt) : ""} />
              <F l="Completed" v={wo.completedAt ? fmtInstant(wo.completedAt) : ""} />
              <F l="Age" v={`${r.ageDays} days`} />
            </div>
            <div>
              <F l="Density used" v={`${fmtNum(wo.densityUsed, 3)} g/cm³`} />
              <F l="Unit weight" v={wo.unitWeightKg !== null ? `${fmtNum(wo.unitWeightKg, 3)} kg` : ""} />
              <F l="Total weight" v={wo.totalWeightKg !== null ? `${fmtNum(wo.totalWeightKg, 2)} kg` : ""} />
              <F l="Raw material req." v={wo.rawReqKg !== null ? <b className="ink">{fmtNum(wo.rawReqKg, 2)} kg</b> : ""} />
              <F l="Mold-based weight" v={wo.moldWeightKg !== null ? `${fmtNum(wo.moldWeightKg, 2)} kg` : ""} />
              <F l="Dimension notes" v={wo.dimensionNotes} />
              <F l="Comments" v={wo.commentNotes} />
            </div>
          </div>
          <RecordNotebook d={data} />
        </article>
        <Chatter
          entity="WorkOrder"
          entityId={wo.id}
          items={chat}
          people={people.filter((p) => p.id !== user.id && can(parseAccess(p.access), "workOrders", "V")).map((p) => ({ id: p.id, name: p.name }))}
          canAttach={can(user.access, "workOrders", "E")}
          canDeleteAny={can(user.access, "workOrders", "F")}
        />
      </div>
    </>
  );
}
