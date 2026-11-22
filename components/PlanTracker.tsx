"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Table2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Badge, EmptyState, Field, Meter, Notice, PriorityBadge, StatusBadge } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { recordPieces } from "@/app/(app)/planning/tracker/actions";
import { fmtDay } from "@/lib/domain/dates";
import type { TrackerGroup, TrackerRow } from "@/lib/server/flowQueries";

export type TrackerStage = TrackerGroup["stages"][number] & { canRecord: boolean };
export type TrackerView = Omit<TrackerGroup, "stages"> & { stages: TrackerStage[] };
type Reason = { id: number; code: string; name: string };

type Show = "all" | "late" | "floor" | "planned";

/**
 * One table per route: a row per open order, a column per stage. A cell is
 * what the stage has finished out of what reached it; whoever runs the stage
 * types its new total there — the pieces move on to the next column by
 * themselves.
 */
export function PlanTracker({ groups, reasons }: { groups: TrackerView[]; reasons: Reason[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [cell, setCell] = useState<{ row: TrackerRow; stage: TrackerStage; i: number } | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          rows: g.rows.filter((r) => {
            if (needle && !`${r.code} ${r.fullName} ${r.product} ${r.material}`.toLowerCase().includes(needle)) return false;
            if (show === "late") return r.late;
            if (show === "floor") return r.released;
            if (show === "planned") return !r.released;
            return true;
          }),
        }))
        .filter((g) => g.rows.length),
    [groups, needle, show],
  );
  const count = groups.reduce((a, g) => a + g.rows.length, 0);
  const late = groups.reduce((a, g) => a + g.rows.filter((r) => r.late).length, 0);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label className="field grow" style={{ minWidth: 220 }}>
          <span className="sr-only">Search</span>
          <div style={{ position: "relative" }}>
            <Search size={15} aria-hidden style={{ position: "absolute", insetInlineStart: 9, top: 9, color: "var(--muted)" }} />
            <input className="input" style={{ paddingInlineStart: 30 }} placeholder="Search order, product, material…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </label>
        <div className="seg" role="group" aria-label="Show">
          {([["all", `All ${count}`], ["floor", "On the floor"], ["planned", "Not released"], ["late", `Late ${late}`]] as [Show, string][]).map(([k, label]) => (
            <button key={k} type="button" className={show === k ? "on" : ""} aria-pressed={show === k} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
      </div>

      {!shown.length ? (
        <div className="card"><EmptyState icon={Table2} title={count ? "No order matches" : "No open order"} hint={count ? "Clear the search or pick another filter." : "Open orders show here, one table per route."} /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((g) => (
            <section key={g.key} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="card-head">
                <h2 className="card-title">{g.route}</h2>
                <span className="badge tone-brand badge-plain">{g.rows.length} order{g.rows.length === 1 ? "" : "s"}</span>
              </div>
              <div className="table-frame free" style={{ border: 0, borderRadius: 0 }}>
                <table className="dt tracker">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th className="num">Qty</th>
                      <th>Due</th>
                      {g.stages.map((s) => (
                        <th key={s.seq} className="num" title={s.workshop ?? undefined}>
                          {s.name}
                          {s.qc && <span className="muted"> · QC</span>}
                        </th>
                      ))}
                      <th className="num">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className={r.late ? "late" : ""}>
                        <td style={{ minWidth: 220 }}>
                          <div className="flex items-center gap-2">
                            <Link href={`/work-orders/${r.id}`} className="code ink">{r.code}</Link>
                            {!r.released ? <Badge tone="neutral">Not released</Badge> : r.status !== "IN_PRODUCTION" && <StatusBadge status={r.status} />}
                            {r.priority > 1 && <PriorityBadge priority={r.priority} />}
                          </div>
                          <div className="muted" style={{ fontSize: 12, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.fullName}>{r.product} · {r.material}</div>
                        </td>
                        <td className="num">{r.qty}</td>
                        <td className="nowrap" style={{ color: r.late ? "var(--bad-fg)" : undefined, fontWeight: r.late ? 600 : undefined }}>{fmtDay(r.dueDate) || "—"}</td>
                        {r.cells.map((c, i) => {
                          const st = g.stages[i]!;
                          const open = st.canRecord && r.released && !r.paused && (c.waiting > 0 || c.good > 0);
                          const body = (
                            <>
                              <span className={`tc-good ${c.good >= r.qty && c.waiting === 0 ? "done" : ""}`}>{c.good}</span>
                              <span className="tc-of">/{c.arrived}</span>
                              {c.waiting > 0 && r.released && <span className="tc-wait" title={`${c.waiting} waiting at ${st.name}`}>{c.waiting} waiting</span>}
                              {c.scrap > 0 && <span className="tc-scrap" title="scrapped">−{c.scrap}</span>}
                            </>
                          );
                          return (
                            <td key={c.seq} className="num tc">
                              {open ? (
                                <button type="button" className="tc-btn" onClick={() => setCell({ row: r, stage: st, i })} title={`Record ${st.name} for ${r.code}`}>{body}</button>
                              ) : (
                                <span className="tc-btn ro">{body}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="num" style={{ minWidth: 120 }}>
                          <div className="flex items-center justify-end gap-2">
                            <b>{r.finished}</b>
                            <span className="muted">/ {r.qty}</span>
                          </div>
                          <Meter pct={r.progressPct} label={`${r.code} finished`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      {cell && <RecordCell row={cell.row} stage={cell.stage} i={cell.i} reasons={reasons} onClose={() => setCell(null)} />}
    </>
  );
}

function RecordCell({ row, stage, i, reasons, onClose }: { row: TrackerRow; stage: TrackerStage; i: number; reasons: Reason[]; onClose: () => void }) {
  const c = row.cells[i]!;
  const next = row.cells[i + 1];
  const [total, setTotal] = useState(String(c.good));
  const [scrap, setScrap] = useState("0");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const t = Number(total);
  const sc = Number(scrap) || 0;
  const max = c.arrived - c.scrap - sc;
  const usedNext = next ? next.good + next.scrap : 0;
  const bad = !Number.isInteger(t) || t < 0 ? "Enter a whole number." : t > max ? `At most ${max} — only ${c.arrived} reached ${stage.name}.` : t < usedNext ? `${usedNext} already moved on — the total cannot go below that.` : null;
  return (
    <Modal
      title={`${stage.name} — ${row.code}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !!bad || (sc > 0 && !reason) || (t === c.good && sc === 0)}
            onClick={() => run(() => recordPieces({ woId: row.id, seq: c.seq, mode: "total", good: t, scrap: sc, reasonId: reason ? Number(reason) : null, note, source: "tracker" }), { onOk: onClose })}
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="meta">
          <span>Reached <b>{c.arrived}</b></span>
          <span>Finished <b>{c.good}</b></span>
          {c.scrap > 0 && <span>Scrap <b>{c.scrap}</b></span>}
          <span>Waiting <b>{c.waiting}</b></span>
        </div>
        {stage.qc && <Notice tone="info">A quality stage: the finished total is the pieces that passed; scrap is what was rejected.</Notice>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={stage.qc ? "Passed — total" : "Finished — total"} required help={t !== c.good && !bad ? `${t > c.good ? "+" : ""}${t - c.good} today` : undefined}>
            <input type="number" min={0} step={1} className="input" value={total} onChange={(e) => setTotal(e.target.value)} autoFocus />
          </Field>
          <Field label="Scrap now">
            <input type="number" min={0} step={1} className="input" value={scrap} onChange={(e) => setScrap(e.target.value)} />
          </Field>
        </div>
        {bad && <Notice tone="warn">{bad}</Notice>}
        {sc > 0 && (
          <Field label="Rejection reason" required>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              {reasons.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      </div>
    </Modal>
  );
}
