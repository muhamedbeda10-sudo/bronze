"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ClipboardCheck, MoreHorizontal, Pause, Play, Printer, RotateCcw, SkipForward } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Badge, Field } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { fmtDay, fmtInstant } from "@/lib/domain/dates";
import { ACTION_LABEL, type StageAction } from "@/lib/domain/routing";
import { SHIFT_LABEL, TASK_STATUS_LABEL, TASK_STATUS_TONE, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, type Shift, type TaskStatus } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";
import { stageAction } from "@/app/(app)/planning/actions";

export interface StageLine { name: string; workshop: string | null; qc: boolean; stdMin: number; plannedHrs: number; actualHrs: number; produced: number; scrap: number; state: "done" | "now" | "todo" }
export interface RecordData {
  id: number;
  version: number;
  status: string;
  stageIndex: number | null;
  stageState: string | null;
  stages: StageLine[];
  actions: StageAction[];
  canPlan: boolean;
  canInspect: boolean;
  activities: { id: number; date: string; shift: string; workshop: string; machine: string | null; operator: string | null; stage: string | null; status: string; hours: number; produced: number; scrap: number; reason: string | null; notes: string | null }[];
  inspections: { id: number; at: string; stage: string; result: string; inspected: number; rejected: number; reason: string | null; inspector: string; notes: string | null }[];
  issues: { id: number; reqNo: string; date: string; material: string; kg: number; status: string }[];
  fg: { id: number; qty: number; reserved: number; at: string }[];
}

const ICON: Partial<Record<StageAction, ReactNode>> = { START: <Play size={14} aria-hidden />, NEXT: <SkipForward size={14} aria-hidden />, PREV: <ChevronLeft size={14} aria-hidden />, REWORK: <RotateCcw size={14} aria-hidden />, RESUME: <Play size={14} aria-hidden />, HOLD: <Pause size={14} aria-hidden /> };
const RESULT: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = { PASS: { label: "Pass", tone: "ok" }, REJECT_LAST: { label: "Reject to last", tone: "warn" }, REJECT_START: { label: "Reject to start", tone: "bad" } };

/** The record's button row and its status bar — the stages as chevrons, the current one in bronze. */
export function RecordHeader({ d }: { d: RecordData }) {
  const { run, pending } = useAction();
  const [ask, setAsk] = useState<StageAction | null>(null);
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  // on a narrow screen the status bar scrolls: bring the current stage into view
  useEffect(() => {
    const el = bar.current;
    const now = el?.querySelector<HTMLElement>(".now");
    if (el && now) el.scrollLeft = now.offsetLeft - el.clientWidth / 2 + now.clientWidth / 2;
  }, [d.stageIndex, d.status]);
  const primary = d.actions.filter((a) => ["START", "NEXT", "RESUME"].includes(a));
  const secondary = d.actions.filter((a) => ["PREV", "REWORK"].includes(a));
  const rest = d.actions.filter((a) => ["HOLD", "WAIT_MATERIAL", "WAIT_TECH_OFFICE"].includes(a));
  const act = (a: StageAction) => (a === "REWORK" || a === "HOLD" ? (setNote(""), setAsk(a)) : run(() => stageAction(d.id, d.version, a, null)));

  return (
    <div className="flex flex-wrap items-center gap-2 no-print" style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
      {d.canPlan && primary.map((a) => <button key={a} type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(a)}>{ICON[a]}{ACTION_LABEL[a]}</button>)}
      {d.canPlan && secondary.map((a) => <button key={a} type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => act(a)}>{ICON[a]}{ACTION_LABEL[a]}</button>)}
      {d.status === "UNDER_INSPECTION" && d.canInspect && <Link href="/quality" className="btn btn-primary btn-sm"><ClipboardCheck size={14} aria-hidden /> Inspect</Link>}
      {d.canPlan && rest.length > 0 && (
        <div style={{ position: "relative" }}>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={more} onClick={() => setMore((v) => !v)}><MoreHorizontal size={15} aria-hidden /> More</button>
          {more && <div className="dropdown" style={{ top: 32, insetInlineStart: 0 }} onMouseLeave={() => setMore(false)}>{rest.map((a) => <button key={a} type="button" className="dropdown-item" onClick={() => { setMore(false); act(a); }}>{ICON[a] ?? <Pause size={14} aria-hidden />}{ACTION_LABEL[a]}</button>)}</div>}
        </div>
      )}
      <div ref={bar} className="statusbar" style={{ marginInlineStart: "auto", maxWidth: "100%" }} aria-label="Route">
        {d.stages.map((s, i) => (
          <span key={i} className={s.state === "now" ? "now" : s.state === "done" ? "done" : ""} aria-current={s.state === "now" ? "step" : undefined} title={s.workshop ?? undefined}>
            {s.state === "done" && <Check size={12} aria-hidden />}{s.name}
          </span>
        ))}
        <span className={d.status === "COMPLETED" ? "now" : ""}>Done</span>
      </div>
      {ask && (
        <Modal title={ACTION_LABEL[ask]} size="sm" onClose={() => setAsk(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setAsk(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !note.trim()} onClick={() => run(() => stageAction(d.id, d.version, ask, note), { onOk: () => setAsk(null) })}>{ACTION_LABEL[ask]}</button>
        </>}>
          <Field label="Reason" required help="Saved in the order's history."><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </Modal>
      )}
    </div>
  );
}

/** The record's notebook: its route with planned vs actual times, the floor's work, quality and material. */
export function RecordNotebook({ d }: { d: RecordData }) {
  const [tab, setTab] = useState<"route" | "floor" | "quality" | "material">("route");
  const tabs = [
    { k: "route" as const, l: "Route & times" },
    { k: "floor" as const, l: "Shop floor", n: d.activities.length },
    { k: "quality" as const, l: "Quality", n: d.inspections.length },
    { k: "material" as const, l: "Material & stock", n: d.issues.length + d.fg.length },
  ];
  const tot = d.stages.reduce((s, x) => ({ p: s.p + x.plannedHrs, a: s.a + x.actualHrs, g: s.g + x.produced, b: s.b + x.scrap }), { p: 0, a: 0, g: 0, b: 0 });
  return (
    <div className="notebook">
      <div className="tab-strip no-scrollbar" role="tablist" aria-label="Order details">
        {tabs.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={`tab ${tab === t.k ? "tab-active" : ""}`} onClick={() => setTab(t.k)}>{t.l}{!!t.n && <span className="tab-count">{t.n}</span>}</button>)}
      </div>
      <div className="notebook-body">
        {tab === "route" && (
          <div className="table-frame free">
            <table className="dt cards">
              <thead><tr><th>#</th><th>Stage</th><th>Workshop</th><th className="num">Std min/pc</th><th className="num">Planned h</th><th className="num">Actual h</th><th className="num">Produced</th><th className="num">Scrap</th><th>State</th></tr></thead>
              <tbody>
                {d.stages.map((s, i) => (
                  <tr key={i}>
                    <td data-label="#" className="num" style={{ width: 30 }}>{i + 1}</td>
                    <td data-label="Stage"><b>{s.name}</b>{s.qc && <Badge plain tone="brand">QC</Badge>}</td>
                    <td data-label="Workshop">{s.workshop ?? "—"}</td>
                    <td data-label="Std min/pc" className="num">{fmtNum(s.stdMin, 1)}</td>
                    <td data-label="Planned h" className="num">{s.qc ? "—" : fmtNum(s.plannedHrs, 2)}</td>
                    <td data-label="Actual h" className="num" style={{ color: !s.qc && s.actualHrs > s.plannedHrs * 1.2 && s.plannedHrs > 0 ? "var(--bad-fg)" : undefined }}>{fmtNum(s.actualHrs, 2)}</td>
                    <td data-label="Produced" className="num">{fmtNum(s.produced, 0)}</td>
                    <td data-label="Scrap" className="num">{s.scrap ? <b style={{ color: "var(--bad-fg)" }}>{s.scrap}</b> : 0}</td>
                    <td data-label="State">{s.state === "done" ? <Badge tone="ok">Done</Badge> : s.state === "now" ? <Badge tone="brand">{d.stageState === "IN_PROGRESS" ? "In progress" : "Current"}</Badge> : <span className="muted">Ahead</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td /><td>Total</td><td /><td /><td className="num">{fmtNum(tot.p, 2)}</td><td className="num">{fmtNum(tot.a, 2)}</td><td className="num">{fmtNum(tot.g, 0)}</td><td className="num">{fmtNum(tot.b, 0)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
        {tab === "floor" && (d.activities.length ? (
          <div className="table-frame free">
            <table className="dt cards">
              <thead><tr><th>Date</th><th>Shift</th><th>Stage</th><th>Workshop</th><th>Machine</th><th>Operator</th><th>Status</th><th className="num">Hours</th><th className="num">Produced</th><th className="num">Scrap</th><th>Notes</th></tr></thead>
              <tbody>
                {d.activities.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Date" className="nowrap">{fmtDay(a.date)}</td>
                    <td data-label="Shift">{SHIFT_LABEL[a.shift as Shift] ?? a.shift}</td>
                    <td data-label="Stage">{a.stage ?? "—"}</td>
                    <td data-label="Workshop">{a.workshop}</td>
                    <td data-label="Machine">{a.machine ?? "—"}</td>
                    <td data-label="Operator">{a.operator ?? "—"}</td>
                    <td data-label="Status"><Badge tone={TASK_STATUS_TONE[a.status as TaskStatus]}>{TASK_STATUS_LABEL[a.status as TaskStatus] ?? a.status}</Badge></td>
                    <td data-label="Hours" className="num">{fmtNum(a.hours, 2)}</td>
                    <td data-label="Produced" className="num">{fmtNum(a.produced, 0)}</td>
                    <td data-label="Scrap" className="num">{a.scrap ? <b style={{ color: "var(--bad-fg)" }} title={a.reason ?? undefined}>{a.scrap}</b> : 0}</td>
                    <td data-label="Notes" className="wrap">{a.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>Nothing logged against this order yet.</p>)}
        {tab === "quality" && (d.inspections.length ? (
          <div className="table-frame free">
            <table className="dt cards">
              <thead><tr><th>When</th><th>Stage</th><th>Result</th><th className="num">Inspected</th><th className="num">Rejected</th><th>Reason</th><th>Inspector</th><th>Notes</th></tr></thead>
              <tbody>
                {d.inspections.map((x) => (
                  <tr key={x.id}>
                    <td data-label="When" className="nowrap">{fmtInstant(x.at)}</td>
                    <td data-label="Stage">{x.stage}</td>
                    <td data-label="Result"><Badge tone={RESULT[x.result]?.tone}>{RESULT[x.result]?.label ?? x.result}</Badge></td>
                    <td data-label="Inspected" className="num">{x.inspected}</td>
                    <td data-label="Rejected" className="num">{x.rejected}</td>
                    <td data-label="Reason">{x.reason ?? "—"}</td>
                    <td data-label="Inspector">{x.inspector}</td>
                    <td data-label="Notes" className="wrap">{x.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>No inspection yet.</p>)}
        {tab === "material" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="section-title">Issue requests</h3>
              {d.issues.length ? (
                <div className="table-frame free"><table className="dt"><thead><tr><th>Request</th><th>Date</th><th>Material</th><th className="num">kg</th><th>Status</th></tr></thead><tbody>
                  {d.issues.map((x) => <tr key={x.id}><td><Link className="link" href="/inventory/issues">{x.reqNo}</Link></td><td>{fmtDay(x.date)}</td><td>{x.material}</td><td className="num">{fmtNum(x.kg, 1)}</td><td><Badge tone={REQUEST_STATUS_TONE[x.status]}>{REQUEST_STATUS_LABEL[x.status] ?? x.status}</Badge></td></tr>)}
                </tbody></table></div>
              ) : <p className="muted" style={{ margin: 0 }}>No metal requested against this order.</p>}
            </div>
            <div>
              <h3 className="section-title">Finished goods</h3>
              {d.fg.length ? (
                <div className="table-frame free"><table className="dt"><thead><tr><th>Received</th><th className="num">Qty</th><th className="num">Reserved</th></tr></thead><tbody>
                  {d.fg.map((x) => <tr key={x.id}><td>{fmtInstant(x.at)}</td><td className="num">{x.qty}</td><td className="num">{x.reserved}</td></tr>)}
                </tbody></table></div>
              ) : <p className="muted" style={{ margin: 0 }}>Goes into FG stock when the last stage is done.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintTravelerButton({ id }: { id: number }) {
  return <a href={`/print/traveler?ids=${id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><Printer size={14} aria-hidden /> Traveler</a>;
}
