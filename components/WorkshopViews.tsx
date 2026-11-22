"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Save, Trash2, Wrench } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Confirm } from "@/components/Modal";
import { Badge, EmptyState, Field, Notice } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { clockHours, fmtDay } from "@/lib/domain/dates";
import { SHIFT_LABEL, TASK_STATUS_LABEL, TASK_STATUS_TONE, type Shift, type TaskStatus } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";
import { deleteActivity, recordActivity } from "@/app/(app)/workshop/actions";
import type { ActRow } from "@/lib/server/activities";

export interface RecordOptions {
  workshops: { id: number; name: string; supervisor: string | null }[];
  machines: { id: number; name: string; code: string; workshopId: number; status: string; defaultOperatorId: number | null }[];
  operators: { id: number; name: string; workshopId: number | null }[];
  orders: { id: number; code: string; name: string; stage: string | null; workshopId: number | null; priority: number }[];
  reasons: { id: number; code: string; name: string }[];
}

export function RecordForm({ o, todayKey, ownWorkshop, me }: { o: RecordOptions; todayKey: string; ownWorkshop: number | null; me: string }) {
  const { run, pending } = useAction();
  const first = ownWorkshop ?? o.workshops[0]?.id ?? "";
  const blank = () => ({ date: todayKey, workshopId: String(first), machineId: "", shift: "DAY", operatorId: "", supervisor: o.workshops.find((w) => w.id === first)?.supervisor ?? me, priority: "1", workOrderId: "", taskStatus: "COMPLETE", startTime: "08:00", endTime: "", qtyProduced: "0", qtyScrap: "0", rejectionReasonId: "", notes: "" });
  const [v, setV] = useState(blank);
  const set = (k: keyof ReturnType<typeof blank>, x: string) => setV((s) => ({ ...s, [k]: x }));
  const wsId = Number(v.workshopId);
  const machines = o.machines.filter((m) => m.workshopId === wsId);
  const operators = o.operators.filter((x) => !x.workshopId || x.workshopId === wsId);
  // the orders sitting at this workshop's stage first, then the rest
  const orders = useMemo(() => [...o.orders].sort((a, b) => Number(b.workshopId === wsId) - Number(a.workshopId === wsId) || b.priority - a.priority), [o.orders, wsId]);
  const hrs = clockHours(v.startTime, v.endTime);
  const wo = o.orders.find((x) => String(x.id) === v.workOrderId);
  const workshops = ownWorkshop ? o.workshops.filter((w) => w.id === ownWorkshop) : o.workshops;

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => recordActivity(v), { onOk: () => setV((s) => ({ ...blank(), date: s.date, workshopId: s.workshopId, shift: s.shift, supervisor: s.supervisor, startTime: s.endTime || s.startTime })) }); }}>
      <div className="card-head"><h2 className="card-title">1 · Context</h2></div>
      <div className="card-pad grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
        <Field label="Date" required><input type="date" className="input" value={v.date} onChange={(e) => set("date", e.target.value)} required /></Field>
        <Field label="Workshop" required>
          <select className="select" value={v.workshopId} onChange={(e) => { const w = o.workshops.find((x) => String(x.id) === e.target.value); setV((s) => ({ ...s, workshopId: e.target.value, machineId: "", operatorId: "", supervisor: w?.supervisor ?? s.supervisor })); }} required>
            {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Machine">
          <select className="select" value={v.machineId} onChange={(e) => { const m = o.machines.find((x) => String(x.id) === e.target.value); setV((s) => ({ ...s, machineId: e.target.value, operatorId: s.operatorId || (m?.defaultOperatorId ? String(m.defaultOperatorId) : "") })); }}>
            <option value="">No machine (manual work)</option>
            {machines.map((m) => <option key={m.id} value={m.id} disabled={m.status === "Inactive"}>{m.code} — {m.name}{m.status !== "Active" ? ` (${m.status})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Shift" required>
          <div className="seg" role="group" aria-label="Shift" style={{ height: 34, alignItems: "center" }}>
            {(["DAY", "NIGHT"] as const).map((s) => <button key={s} type="button" className={v.shift === s ? "on" : ""} aria-pressed={v.shift === s} onClick={() => set("shift", s)}>{SHIFT_LABEL[s]}</button>)}
          </div>
        </Field>
        <Field label="Operator">
          <select className="select" value={v.operatorId} onChange={(e) => set("operatorId", e.target.value)}>
            <option value="">—</option>
            {operators.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Supervisor"><input className="input" value={v.supervisor ?? ""} onChange={(e) => set("supervisor", e.target.value)} maxLength={100} /></Field>
      </div>
      <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}><h2 className="card-title">2 · Activity</h2></div>
      <div className="card-pad grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
        <Field label="Work Order" className="sm:col-span-2" help={wo ? `Current stage: ${wo.stage ?? "not released"}` : "None = maintenance / setup (keeps utilization right)"}>
          <select className="select" value={v.workOrderId} onChange={(e) => { const w = o.orders.find((x) => String(x.id) === e.target.value); setV((s) => ({ ...s, workOrderId: e.target.value, priority: w ? String(w.priority) : s.priority, qtyProduced: e.target.value ? s.qtyProduced : "0", qtyScrap: e.target.value ? s.qtyScrap : "0" })); }}>
            <option value="">None — Maintenance / Setup</option>
            {orders.map((x) => <option key={x.id} value={x.id}>{x.workshopId === wsId ? "● " : ""}{x.name}{x.stage ? ` · ${x.stage}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="select" value={v.priority} onChange={(e) => set("priority", e.target.value)}><option value="1">1 – Normal</option><option value="2">2 – High</option><option value="3">3 – Urgent</option></select>
        </Field>
        <Field label="Task status" required>
          <select className="select" value={v.taskStatus} onChange={(e) => set("taskStatus", e.target.value)}>
            {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>
      <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}><h2 className="card-title">3 · Times and output</h2></div>
      <div className="card-pad grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        <Field label="Start time" required><input type="time" className="input" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} required /></Field>
        <Field label="End time" required><input type="time" className="input" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} required /></Field>
        <Field label="Duration (hrs)"><input className="input" readOnly value={hrs === null ? "" : fmtNum(hrs, 2)} /></Field>
        <Field label="Qty produced" required><input type="number" min={0} step="any" className="input" value={v.qtyProduced} onChange={(e) => set("qtyProduced", e.target.value)} disabled={!v.workOrderId} /></Field>
        <Field label="Qty scrap" required help="Enter 0 when there is none"><input type="number" min={0} step="any" className="input" value={v.qtyScrap} onChange={(e) => set("qtyScrap", e.target.value)} disabled={!v.workOrderId} /></Field>
        {Number(v.qtyScrap) > 0 && (
          <Field label="Rejection reason" required>
            <select className="select" value={v.rejectionReasonId} onChange={(e) => set("rejectionReasonId", e.target.value)} required>
              <option value="">Choose…</option>
              {o.reasons.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Operator notes" className="col-span-full"><textarea className="textarea" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} placeholder="Problems, downtime causes…" /></Field>
      </div>
      <div className="modal-foot" style={{ borderRadius: "0 0 var(--r-md) var(--r-md)" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}><Save size={16} aria-hidden /> {pending ? "Saving…" : "Record Activity"}</button>
      </div>
    </form>
  );
}

const statusBadge = (r: ActRow) => <Badge tone={TASK_STATUS_TONE[r.taskStatus as TaskStatus]}>{TASK_STATUS_LABEL[r.taskStatus as TaskStatus] ?? r.taskStatus}</Badge>;

export function ActivityCards({ rows }: { rows: ActRow[] }) {
  if (!rows.length) return <div className="card"><EmptyState icon={Wrench} title="Nothing recorded in this period" /></div>;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
      {rows.map((r) => (
        <article key={r.id} className="card card-pad flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div style={{ fontWeight: 700 }}>{r.machine ?? r.workshop}</div>
              <div className="muted" style={{ fontSize: 12 }}>{r.workshop} · {fmtDay(r.date)} · {SHIFT_LABEL[r.shift as Shift]} {r.startTime}–{r.endTime}</div>
            </div>
            {statusBadge(r)}
          </div>
          <div style={{ fontSize: 13 }}>{r.wo ? <><Link className="code ink" href={`/work-orders/${r.woId}`}>{r.wo}</Link>{r.stage && <span className="muted"> · {r.stage}</span>}</> : <span className="muted">Maintenance / setup</span>}</div>
          <div className="stat-line" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div><div className="l">Produced</div><div className="v">{fmtNum(r.qtyProduced, 0)}</div></div>
            <div><div className="l">Scrap</div><div className="v" style={{ color: r.qtyScrap ? "var(--bad-fg)" : undefined }}>{fmtNum(r.qtyScrap, 0)}</div></div>
            <div><div className="l">Hours</div><div className="v">{fmtNum(r.durationHrs, 1)}</div></div>
          </div>
          {(r.operator || r.notes) && <div className="muted" style={{ fontSize: 12 }}>{r.operator && <>Operator <b style={{ color: "var(--foreground)" }}>{r.operator}</b>. </>}{r.notes}</div>}
        </article>
      ))}
    </div>
  );
}

export function ActivityLog({ rows, canDelete }: { rows: ActRow[]; canDelete: boolean }) {
  const { run, pending } = useAction();
  const [del, setDel] = useState<ActRow | null>(null);
  const produced = rows.reduce((s, r) => s + r.qtyProduced, 0);
  const scrap = rows.reduce((s, r) => s + r.qtyScrap, 0);
  const hours = rows.reduce((s, r) => s + r.durationHrs, 0);
  return (
    <>
      {rows.length >= 2000 && <div style={{ marginBottom: 8 }}><Notice tone="warn">Showing the latest 2000 records — narrow the period to see older ones.</Notice></div>}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        exportName="Workshop logs"
        empty={{ title: "No records match the filters" }}
        tools={<span className="badge tone-brand badge-plain">{fmtNum(hours, 1)} h · {fmtNum(produced, 0)} produced · {fmtNum(scrap, 0)} scrap</span>}
        columns={[
          { key: "date", label: "Date", render: (r) => fmtDay(r.date), className: "nowrap" },
          { key: "shift", label: "Shift", value: (r) => SHIFT_LABEL[r.shift as Shift] ?? r.shift },
          { key: "workshop", label: "Workshop" },
          { key: "machine", label: "Machine", render: (r) => r.machine ?? "—" },
          { key: "operator", label: "Operator", render: (r) => r.operator ?? "—" },
          { key: "wo", label: "Work order", render: (r) => (r.wo ? <Link className="code ink" href={`/work-orders/${r.woId}`}>{r.wo}</Link> : <span className="muted">Maint./setup</span>) },
          { key: "stage", label: "Stage", render: (r) => r.stage ?? "—" },
          { key: "taskStatus", label: "Status", value: (r) => TASK_STATUS_LABEL[r.taskStatus as TaskStatus], render: statusBadge },
          { key: "time", label: "Time", value: (r) => `${r.startTime}–${r.endTime}`, className: "nowrap" },
          { key: "durationHrs", label: "Hours", num: true, render: (r) => fmtNum(r.durationHrs, 2) },
          { key: "qtyProduced", label: "Produced", num: true },
          { key: "qtyScrap", label: "Scrap", num: true, render: (r) => (r.qtyScrap ? <b style={{ color: "var(--bad-fg)" }}>{r.qtyScrap}</b> : 0) },
          { key: "reason", label: "Reason", render: (r) => r.reason ?? "—" },
          { key: "notes", label: "Notes", className: "wrap", render: (r) => r.notes ?? "" },
          { key: "supervisor", label: "Supervisor", exportOnly: true },
          { key: "by", label: "Recorded by", exportOnly: true },
          ...(canDelete ? [{ key: "_x", label: "", noExport: true, sortable: false, render: (r: ActRow) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Delete the record" title="Delete" onClick={() => setDel(r)} style={{ color: "var(--bad-fg)" }}><Trash2 size={15} /></button> }] : []),
        ]}
      />
      {del && <Confirm title="Delete this record?" danger busy={pending} confirmLabel="Delete" message={<>The record of {fmtDay(del.date)}, {del.startTime}–{del.endTime}{del.wo ? ` on ${del.wo}` : ""} is removed from the logs and the KPIs. The change history keeps it.</>} onClose={() => setDel(null)} onConfirm={() => run(() => deleteActivity(del.id), { onOk: () => setDel(null) })} />}
    </>
  );
}
