"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Pause, Play, RotateCcw, SearchX, SkipForward } from "lucide-react";
import { RouteSteps } from "@/components/RouteSteps";
import { Modal } from "@/components/Modal";
import { EmptyState, Field, PriorityBadge, StatusBadge, Badge } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { fmtDay } from "@/lib/domain/dates";
import { ACTION_LABEL, type StageAction } from "@/lib/domain/routing";
import { stageAction } from "@/app/(app)/planning/actions";
import type { WoRow } from "@/lib/server/woQueries";

export type ExecRow = WoRow & { actions: StageAction[] };

const PRIMARY: StageAction[] = ["START", "NEXT", "PREV", "REWORK"];
const ICONS: Partial<Record<StageAction, React.ReactNode>> = {
  START: <Play size={14} aria-hidden />, NEXT: <SkipForward size={14} aria-hidden />, PREV: <ChevronLeft size={14} aria-hidden />, REWORK: <RotateCcw size={14} aria-hidden />, RESUME: <Play size={14} aria-hidden />, HOLD: <Pause size={14} aria-hidden />,
};
const NEEDS_NOTE: StageAction[] = ["REWORK", "HOLD"];

export function ExecutionBoard({ rows, workshops, canAct }: { rows: ExecRow[]; workshops: { id: number; name: string }[]; canAct: boolean }) {
  const [ws, setWs] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [state, setState] = useState<"open" | "all" | "done">("open");
  const [ask, setAsk] = useState<{ row: ExecRow; action: StageAction } | null>(null);
  const [note, setNote] = useState("");
  const { run, pending } = useAction();

  const stages = useMemo(() => [...new Set(rows.map((r) => r.stage).filter(Boolean) as string[])].sort(), [rows]);
  const shown = rows.filter((r) =>
    (!ws || String(r.workshopId) === ws) &&
    (!stage || r.stage === stage) &&
    (!q || r.code.toLowerCase().includes(q.toLowerCase()) || r.fullName.toLowerCase().includes(q.toLowerCase())) &&
    (state === "all" || (state === "done" ? r.status === "COMPLETED" : r.status !== "COMPLETED")),
  );

  function act(row: ExecRow, action: StageAction) {
    if (NEEDS_NOTE.includes(action)) { setNote(""); setAsk({ row, action }); return; }
    run(() => stageAction(row.id, row.version, action, null));
  }

  return (
    <>
      <div className="toolbar no-print" style={{ marginBottom: 16 }}>
        <Field label="Workshop"><select className="select" value={ws} onChange={(e) => setWs(e.target.value)}><option value="">All workshops</option>{workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="WO no"><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 14444" /></Field>
        <Field label="Stage"><select className="select" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{stages.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="field"><span className="field-label">Status</span>
          <div className="seg" role="group" aria-label="Status">
            {([["all", "All"], ["open", "Not Complete"], ["done", "Complete"]] as const).map(([k, l]) => <button key={k} type="button" className={state === k ? "on" : ""} aria-pressed={state === k} onClick={() => setState(k)}>{l}</button>)}
          </div>
        </div>
        <div className="grow" />
        <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>{shown.length} order{shown.length === 1 ? "" : "s"}</span>
      </div>
      {!shown.length ? (
        <div className="card"><EmptyState icon={SearchX} title="No order matches" hint="Change the filters above." /></div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 520px), 1fr))" }}>
          {shown.map((r) => (
            <article key={r.id} className={`card wo-card ${r.priority === 3 ? "urgent" : r.priority === 2 ? "high" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/work-orders/${r.id}`} className="wo-title" style={{ display: "block" }}>{r.fullName}</Link>
                  <div className="meta" style={{ marginTop: 4 }}>
                    <span>Process <b>{r.process}</b></span>
                    <span>Stage <b>{r.stage ?? "Not released"}</b>{r.stageState === "IN_PROGRESS" && <Badge plain tone="info">started</Badge>}</span>
                    {r.workshop && <span>Workshop <b>{r.workshop}</b></span>}
                    <span>Due <b style={{ color: r.late ? "var(--bad-fg)" : undefined }}>{fmtDay(r.dueDate) || "—"}{r.late ? ` (+${r.delayDays}d)` : ""}</b></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1"><StatusBadge status={r.status} /><PriorityBadge priority={r.priority} /></div>
              </div>
              <RouteSteps stages={r.stages} stageIndex={r.stageIndex} status={r.status} compact={r.stages.length > 6} />
              {canAct && r.actions.length > 0 && (
                <div className="flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  {r.actions.filter((a) => PRIMARY.includes(a) || a === "RESUME").map((a) => (
                    <button key={a} type="button" disabled={pending} className={`btn btn-sm ${a === "NEXT" || a === "START" || a === "RESUME" ? "btn-primary" : a === "REWORK" ? "btn-danger" : "btn-secondary"}`} onClick={() => act(r, a)}>
                      {ICONS[a]} {ACTION_LABEL[a]}
                    </button>
                  ))}
                  <select className="select input-sm" style={{ width: "auto", marginInlineStart: "auto", height: 28, fontSize: 12 }} value="" aria-label="More actions" onChange={(e) => e.target.value && act(r, e.target.value as StageAction)} disabled={pending}>
                    <option value="">More…</option>
                    {r.actions.filter((a) => !PRIMARY.includes(a) && a !== "RESUME" && a !== "CANCEL").map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                  </select>
                </div>
              )}
              {r.status === "UNDER_INSPECTION" && <p className="muted" style={{ margin: 0, fontSize: 12 }}>Waiting for Quality Control to pass or reject it.</p>}
            </article>
          ))}
        </div>
      )}
      {ask && (
        <Modal title={`${ACTION_LABEL[ask.action]} — ${ask.row.code}`} size="sm" onClose={() => setAsk(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setAsk(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !note.trim()} onClick={() => run(() => stageAction(ask.row.id, ask.row.version, ask.action, note), { onOk: () => setAsk(null) })}>{ACTION_LABEL[ask.action]}</button>
        </>}>
          <Field label="Reason" required help="Saved in the order's stage history."><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </Modal>
      )}
    </>
  );
}
