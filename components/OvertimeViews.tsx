"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, Field } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { clockHours, fmtDay, fmtInstant } from "@/lib/domain/dates";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";
import { decideOvertime, requestOvertime } from "@/app/(app)/overtime/actions";
import type { OtRow } from "@/lib/server/overtime";

const base: Column<OtRow>[] = [
  { key: "date", label: "Date", render: (r) => fmtDay(r.date), className: "nowrap" },
  { key: "operator", label: "Operator" },
  { key: "workshop", label: "Workshop" },
  { key: "time", label: "Time", value: (r) => `${r.fromTime}–${r.toTime}`, className: "nowrap" },
  { key: "hours", label: "Hours", num: true, render: (r) => fmtNum(r.hours, 2) },
  { key: "reason", label: "Reason", className: "wrap" },
  { key: "requestedBy", label: "Requested by" },
];

export function OvertimeDecisions({ rows, canDecide, myId }: { rows: OtRow[]; canDecide: boolean; myId: number }) {
  const { run, pending } = useAction();
  const [reject, setReject] = useState<OtRow | null>(null);
  const [note, setNote] = useState("");
  const cols: Column<OtRow>[] = [...base];
  if (canDecide) cols.push({
    key: "_d", label: "Decision", noExport: true, sortable: false,
    render: (r) => r.requestedById === myId
      ? <span className="muted" style={{ fontSize: 12 }}>Your own request</span>
      : <div className="inline-flex gap-1">
          <button type="button" className="btn btn-ok btn-sm" disabled={pending} onClick={() => run(() => decideOvertime(r.id, true, ""))}><Check size={14} aria-hidden /> Approve</button>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => { setNote(""); setReject(r); }}><X size={14} aria-hidden /> Reject</button>
        </div>,
  });
  return (
    <>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} exportName="Pending overtime" empty={{ title: "No overtime waiting for a decision" }} />
      {reject && (
        <Modal title={`Reject overtime — ${reject.operator}`} size="sm" onClose={() => setReject(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setReject(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={pending || !note.trim()} onClick={() => run(() => decideOvertime(reject.id, false, note), { onOk: () => setReject(null) })}>Reject</button>
        </>}>
          <Field label="Reason" required><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </Modal>
      )}
    </>
  );
}

export function OvertimeHistory({ rows }: { rows: OtRow[] }) {
  const total = rows.filter((r) => r.status === "APPROVED").reduce((s, r) => s + r.hours, 0);
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      exportName="Overtime history"
      empty={{ title: "No decided overtime in this period" }}
      tools={<span className="badge tone-brand badge-plain">Approved: {fmtNum(total, 2)} h</span>}
      columns={[
        ...base,
        { key: "status", label: "Status", value: (r) => REQUEST_STATUS_LABEL[r.status] ?? r.status, render: (r) => <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge> },
        { key: "processedBy", label: "Processed by", render: (r) => <>{r.processedBy}<div className="muted" style={{ fontSize: 11 }}>{fmtInstant(r.processedAt)}</div></>, value: (r) => r.processedBy },
        { key: "decisionNote", label: "Note", className: "wrap" },
      ]}
    />
  );
}

export function OvertimeRequestButton({ operators, workshops, todayKey, ownWorkshop }: { operators: { id: number; name: string; workshopId: number | null }[]; workshops: { id: number; name: string }[]; todayKey: string; ownWorkshop: number | null }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const [v, setV] = useState({ date: todayKey, workshopId: ownWorkshop ? String(ownWorkshop) : "", operatorId: "", fromTime: "16:00", toTime: "18:00", reason: "" });
  const set = (k: keyof typeof v, x: string) => setV((s) => ({ ...s, [k]: x }));
  const hours = clockHours(v.fromTime, v.toTime);
  const ops = operators.filter((o) => !v.workshopId || o.workshopId === Number(v.workshopId));
  const ws = ownWorkshop ? workshops.filter((w) => w.id === ownWorkshop) : workshops;
  return (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} aria-hidden /> New Request</button>
      {open && (
        <Modal title="New overtime request" onClose={() => setOpen(false)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" form="ot-form" className="btn btn-primary" disabled={pending}>Send for approval</button>
        </>}>
          <form id="ot-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => requestOvertime(v), { onOk: () => { setOpen(false); setV((s) => ({ ...s, operatorId: "", reason: "" })); } }); }}>
            <Field label="Date" required><input type="date" className="input" value={v.date} onChange={(e) => set("date", e.target.value)} required /></Field>
            <Field label="Workshop" required>
              <select className="select" value={v.workshopId} onChange={(e) => { set("workshopId", e.target.value); set("operatorId", ""); }} required>
                <option value="">Choose…</option>
                {ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Operator" required>
              <select className="select" value={v.operatorId} onChange={(e) => set("operatorId", e.target.value)} required>
                <option value="">Choose…</option>
                {ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" required><input type="time" className="input" value={v.fromTime} onChange={(e) => set("fromTime", e.target.value)} required /></Field>
              <Field label="To" required><input type="time" className="input" value={v.toTime} onChange={(e) => set("toTime", e.target.value)} required /></Field>
            </div>
            <Field label="Hours"><input className="input" readOnly value={hours === null ? "" : fmtNum(hours, 2)} /></Field>
            <Field label="Reason" required className="sm:col-span-2"><textarea className="textarea" value={v.reason} onChange={(e) => set("reason", e.target.value)} maxLength={500} required /></Field>
          </form>
        </Modal>
      )}
    </>
  );
}
