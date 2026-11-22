import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, PriorityBadge, StatusBadge } from "@/components/ui";
import { RouteSteps } from "@/components/RouteSteps";
import { WoDetailActions } from "@/components/WoDetailActions";
import { pageUser } from "@/lib/server/auth";
import { getOrder, toRow } from "@/lib/server/woQueries";
import { woOptions } from "@/lib/server/woOptions";
import { can } from "@/lib/domain/access";
import { dayKey, fmtDay, fmtInstant } from "@/lib/domain/dates";
import { ACTION_LABEL, type StageAction } from "@/lib/domain/routing";
import { isOpen, statusLabel, SHIFT_LABEL, TASK_STATUS_LABEL, TASK_STATUS_TONE, type Shift, type TaskStatus } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Work Order" };

const RESULT: Record<string, { label: string; tone: "ok" | "bad" | "warn" }> = {
  PASS: { label: "Pass", tone: "ok" },
  REJECT_LAST: { label: "Reject to last", tone: "warn" },
  REJECT_START: { label: "Reject to start", tone: "bad" },
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("workOrders");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const wo = await getOrder(id);
  if (!wo) notFound();
  const r = toRow(wo);
  const open = isOpen(wo.status);
  const canEdit = open && can(user.access, "workOrders", "E");
  const canCancel = open && can(user.access, "workOrders", "F");
  const o = canEdit ? await woOptions() : null;
  const s = (v: number | null) => (v === null ? "" : String(v));
  const initial = {
    productId: String(wo.productId), materialId: String(wo.materialId), processId: String(wo.processId),
    od: s(wo.od), innerDia: s(wo.innerDia), length: s(wo.length), width: s(wo.width), height: s(wo.height),
    qty: String(wo.qty), moldId: s(wo.moldId), priority: String(wo.priority),
    startDate: dayKey(wo.startDate), atpDate: dayKey(wo.atpDate), dueDate: dayKey(wo.dueDate),
    dimensionNotes: wo.dimensionNotes ?? "", commentNotes: wo.commentNotes ?? "",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Link href="/work-orders" className="btn btn-ghost btn-sm"><ArrowLeft size={15} aria-hidden /> Open Work Orders</Link>
        <div style={{ marginInlineStart: "auto" }} className="flex gap-2">
          <WoDetailActions id={wo.id} version={wo.version} woNo={wo.woNo} lineNo={wo.lineNo} lineCount={wo.lineCount} initial={initial} o={o} lockProcess={wo.stageIndex !== null} canEdit={canEdit} canCancel={canCancel} />
        </div>
      </div>

      <section className="card card-pad flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>WORK ORDER {r.code} · LINE {wo.lineNo}/{wo.lineCount}</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 26, wordBreak: "break-word" }}>{wo.fullName}</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            {r.late && <Badge tone="bad">{r.delayDays} days late</Badge>}
          </div>
        </div>
        <RouteSteps stages={r.stages} stageIndex={wo.stageIndex} status={wo.status} />
        <div className="stat-line">
          <div><div className="l">Product</div><div className="v" style={{ fontSize: 15 }}>{wo.product.name}</div></div>
          <div><div className="l">Material</div><div className="v" style={{ fontSize: 15 }}>{wo.material.code} · {wo.material.name}</div></div>
          <div><div className="l">Process</div><div className="v" style={{ fontSize: 15 }}>{wo.process.name}</div></div>
          <div><div className="l">Dimensions</div><div className="v" style={{ fontSize: 15 }}>{r.dims || "—"}</div></div>
          <div><div className="l">Quantity</div><div className="v">{wo.qty}</div></div>
          <div><div className="l">Unit weight</div><div className="v">{fmtNum(wo.unitWeightKg, 3)} kg</div></div>
          <div><div className="l">Total weight</div><div className="v">{fmtNum(wo.totalWeightKg, 2)} kg</div></div>
          <div><div className="l">Raw material req.</div><div className="v ink">{fmtNum(wo.rawReqKg, 2)} kg</div></div>
          <div><div className="l">Mold</div><div className="v" style={{ fontSize: 15 }}>{wo.mold?.moldNo ?? "—"}{wo.moldWeightKg ? ` · ${fmtNum(wo.moldWeightKg, 1)} kg` : ""}</div></div>
          <div><div className="l">Density used</div><div className="v">{fmtNum(wo.densityUsed, 3)}</div></div>
          <div><div className="l">WO date</div><div className="v" style={{ fontSize: 15 }}>{fmtDay(wo.woDate)}</div></div>
          <div><div className="l">Start · ATP</div><div className="v" style={{ fontSize: 15 }}>{fmtDay(wo.startDate) || "—"} · {fmtDay(wo.atpDate) || "—"}</div></div>
          <div><div className="l">Due date</div><div className="v" style={{ fontSize: 15 }}>{fmtDay(wo.dueDate) || "—"}</div></div>
          <div><div className="l">Completed</div><div className="v" style={{ fontSize: 15 }}>{wo.completedAt ? fmtInstant(wo.completedAt) : "—"}</div></div>
        </div>
        {(wo.dimensionNotes || wo.commentNotes) && (
          <div className="meta">
            {wo.dimensionNotes && <span>Dimension notes: <b>{wo.dimensionNotes}</b></span>}
            {wo.commentNotes && <span>Comments: <b>{wo.commentNotes}</b></span>}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Stage history" pad={false}>
          {wo.moves.length ? (
            <div className="table-frame free" style={{ border: 0, boxShadow: "none" }}>
              <table className="dt">
                <thead><tr><th>When</th><th>Action</th><th>From → to</th><th>By</th></tr></thead>
                <tbody>
                  {wo.moves.map((m) => (
                    <tr key={m.id}>
                      <td className="nowrap">{fmtInstant(m.at)}</td>
                      <td>{m.action === "COMPLETE" ? "Completed" : ACTION_LABEL[m.action as StageAction] ?? m.action}{m.note && <div className="muted" style={{ fontSize: 12 }}>{m.note}</div>}</td>
                      <td>{m.fromStage ?? statusLabel(m.fromStatus)} → {m.toStage ?? statusLabel(m.toStatus)}</td>
                      <td>{m.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted card-pad" style={{ margin: 0 }}>Not released to the floor yet.</p>}
        </Card>
        <Card title="Inspections" pad={false}>
          {wo.inspections.length ? (
            <div className="table-frame free" style={{ border: 0, boxShadow: "none" }}>
              <table className="dt">
                <thead><tr><th>When</th><th>Stage</th><th>Result</th><th className="num">Inspected</th><th className="num">Rejected</th><th>Reason</th><th>Inspector</th></tr></thead>
                <tbody>
                  {wo.inspections.map((x) => (
                    <tr key={x.id}>
                      <td className="nowrap">{fmtInstant(x.at)}</td>
                      <td>{x.stageName}</td>
                      <td><Badge tone={RESULT[x.result]?.tone}>{RESULT[x.result]?.label ?? x.result}</Badge></td>
                      <td className="num">{x.qtyInspected}</td>
                      <td className="num">{x.qtyRejected}</td>
                      <td>{x.rejectionReason?.name ?? "—"}</td>
                      <td>{x.inspectorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted card-pad" style={{ margin: 0 }}>No inspection yet.</p>}
        </Card>
      </div>

      <Card title="Workshop activity" pad={false}>
        {wo.activities.length ? (
          <div className="table-frame free" style={{ border: 0, boxShadow: "none" }}>
            <table className="dt">
              <thead><tr><th>Date</th><th>Shift</th><th>Workshop</th><th>Stage</th><th>Machine</th><th>Operator</th><th>Status</th><th className="num">Hours</th><th className="num">Produced</th><th className="num">Scrap</th></tr></thead>
              <tbody>
                {wo.activities.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtDay(a.date)}</td>
                    <td>{SHIFT_LABEL[a.shift as Shift] ?? a.shift}</td>
                    <td>{a.workshop.name}</td>
                    <td>{a.stageName ?? "—"}</td>
                    <td>{a.machine?.name ?? "—"}</td>
                    <td>{a.operator?.name ?? "—"}</td>
                    <td><Badge tone={TASK_STATUS_TONE[a.taskStatus as TaskStatus]}>{TASK_STATUS_LABEL[a.taskStatus as TaskStatus] ?? a.taskStatus}</Badge></td>
                    <td className="num">{fmtNum(a.durationHrs, 2)}</td>
                    <td className="num">{fmtNum(a.qtyProduced, 0)}</td>
                    <td className="num">{a.qtyScrap ? <b style={{ color: "var(--bad-fg)" }}>{fmtNum(a.qtyScrap, 0)}</b> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted card-pad" style={{ margin: 0 }}>Nothing logged against this order yet.</p>}
      </Card>
    </div>
  );
}
