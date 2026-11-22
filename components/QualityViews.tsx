"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw, Undo2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, EmptyState, Field, PriorityBadge, Notice } from "@/components/ui";
import { RouteSteps } from "@/components/RouteSteps";
import { useAction } from "@/components/useAction";
import { fmtInstant } from "@/lib/domain/dates";
import { ACTION_LABEL, type StageAction } from "@/lib/domain/routing";
import { qcDecision } from "@/app/(app)/quality/actions";
import type { WoRow } from "@/lib/server/woQueries";

export type PendingRow = WoRow & { waitingSince: string | null };

export function PendingInspection({ rows, reasons, canDecide }: { rows: PendingRow[]; reasons: { id: number; code: string; name: string }[]; canDecide: boolean }) {
  const [d, setD] = useState<{ row: PendingRow; action: StageAction } | null>(null);
  const [qi, setQi] = useState("");
  const [qr, setQr] = useState("0");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { run, pending } = useAction();

  function open(row: PendingRow, action: StageAction) {
    setQi(String(row.qty));
    setQr(action === "QC_PASS" ? "0" : String(row.qty));
    setReason("");
    setNote("");
    setD({ row, action });
  }

  if (!rows.length) return <div className="card"><EmptyState icon={ClipboardCheck} title="Nothing waiting for inspection" hint="Orders show here when they reach a quality stage on their route." /></div>;
  const isReject = d && d.action !== "QC_PASS";
  const rejected = Number(qr) || 0;

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 480px), 1fr))" }}>
        {rows.map((r) => {
          const prev = r.stageIndex !== null && r.stageIndex > 0 ? r.stages[r.stageIndex - 1]?.name : null;
          return (
            <article key={r.id} className={`card wo-card ${r.priority === 3 ? "urgent" : r.priority === 2 ? "high" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/work-orders/${r.id}`} className="wo-title">{r.fullName}</Link>
                  <div className="meta" style={{ marginTop: 4 }}>
                    <span>Stage <b>{r.stage}</b></span>
                    <span>Qty <b>{r.qty}</b></span>
                    <span>Material <b>{r.material}</b></span>
                    <span>Waiting since <b>{fmtInstant(r.waitingSince)}</b></span>
                  </div>
                </div>
                <PriorityBadge priority={r.priority} />
              </div>
              <RouteSteps stages={r.stages} stageIndex={r.stageIndex} status={r.status} compact={r.stages.length > 6} />
              {canDecide && (
                <div className="flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <button type="button" className="btn btn-ok btn-sm" onClick={() => open(r, "QC_PASS")}><CheckCircle2 size={14} aria-hidden /> Pass Stage</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => open(r, "QC_REJECT_LAST")} title={prev ? `Back to ${prev}` : undefined}><Undo2 size={14} aria-hidden /> Reject to Last</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => open(r, "QC_REJECT_START")} title={`Back to ${r.stages[0]?.name ?? "the first stage"} (re-cast)`}><RotateCcw size={14} aria-hidden /> Reject to Start</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {d && (
        <Modal title={`${ACTION_LABEL[d.action]} — ${d.row.code}`} size="sm" onClose={() => setD(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setD(null)}>Cancel</button>
          <button type="button" className={`btn ${isReject ? "btn-danger" : "btn-primary"}`} disabled={pending || (rejected > 0 && !reason)} onClick={() => run(() => qcDecision(d.row.id, d.row.version, d.action, Number(qi), rejected, reason ? Number(reason) : null, note), { onOk: () => setD(null) })}>{ACTION_LABEL[d.action]}</button>
        </>}>
          <div className="flex flex-col gap-3">
            {d.action === "QC_PASS" && <Notice tone="ok">The order goes on to {d.row.stageIndex !== null && d.row.stages[d.row.stageIndex + 1] ? d.row.stages[d.row.stageIndex + 1]!.name : "completion — and its pieces into FG stock"}.</Notice>}
            {d.action === "QC_REJECT_LAST" && <Notice tone="warn">The order goes back to {d.row.stageIndex ? d.row.stages[d.row.stageIndex - 1]?.name : "the previous stage"} as rework.</Notice>}
            {d.action === "QC_REJECT_START" && <Notice tone="bad">The order goes back to {d.row.stages[0]?.name} — re-cast.</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qty inspected" required><input type="number" min={1} step={1} className="input" value={qi} onChange={(e) => setQi(e.target.value)} /></Field>
              <Field label="Qty rejected" required><input type="number" min={0} step={1} className="input" value={qr} onChange={(e) => setQr(e.target.value)} /></Field>
            </div>
            {(rejected > 0 || isReject) && (
              <Field label="Rejection reason" required={rejected > 0 || !!isReject}>
                <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Choose…</option>
                  {reasons.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Notes"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export interface InspRow { id: number; at: string; wo: string; woId: number; stage: string; result: string; material: string; inspector: string; qtyInspected: number; qtyRejected: number; reason: string | null; notes: string | null }
const RESULT: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = { PASS: { label: "Pass", tone: "ok" }, REJECT_LAST: { label: "Reject to last", tone: "warn" }, REJECT_START: { label: "Reject to start", tone: "bad" } };

export function InspectionHistory({ rows }: { rows: InspRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      exportName="Inspection history"
      empty={{ title: "No inspections in this period" }}
      columns={[
        { key: "at", label: "Date", render: (r) => fmtInstant(r.at), value: (r) => r.at.slice(0, 16).replace("T", " "), className: "nowrap" },
        { key: "wo", label: "WO", render: (r) => <Link className="code ink" href={`/work-orders/${r.woId}`}>{r.wo}</Link> },
        { key: "stage", label: "Stage" },
        { key: "result", label: "Result", value: (r) => RESULT[r.result]?.label ?? r.result, render: (r) => <Badge tone={RESULT[r.result]?.tone}>{RESULT[r.result]?.label ?? r.result}</Badge> },
        { key: "material", label: "Material" },
        { key: "qtyInspected", label: "Inspected", num: true },
        { key: "qtyRejected", label: "Rejected", num: true, render: (r) => (r.qtyRejected ? <b style={{ color: "var(--bad-fg)" }}>{r.qtyRejected}</b> : 0) },
        { key: "reason", label: "Reason", render: (r) => r.reason ?? "—" },
        { key: "inspector", label: "Inspector" },
        { key: "notes", label: "Notes", className: "wrap", render: (r) => r.notes ?? "" },
      ]}
    />
  );
}
