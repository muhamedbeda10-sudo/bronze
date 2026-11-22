"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useAction } from "@/components/useAction";
import { addDays, dayKey, daysBetween, fmtDay, parseDay, todayKey } from "@/lib/domain/dates";
import { rescheduleOrder } from "@/app/(app)/work-orders/actions";
import type { WoRow } from "@/lib/server/woQueries";

const LABEL_W = 280;
const SCALES = { week: 34, month: 14 } as const;

type Drag = { id: number; mode: "move" | "end"; x0: number; delta: number };

/**
 * Each order from its start to its due date, its progress through the
 * route filled in, late bars in red, today's line in bronze. With edit
 * access a bar is dragged to move both dates, or stretched by its end.
 */
export function WoGantt({ rows, canEdit }: { rows: WoRow[]; canEdit: boolean }) {
  const [scale, setScale] = useState<keyof typeof SCALES>("week");
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const { run } = useAction();
  const W = SCALES[scale];
  const t = parseDay(todayKey())!;

  const bars = useMemo(() => rows.map((r) => {
    const s = parseDay(r.startDate) ?? parseDay(r.woDate)!;
    const e = parseDay(r.dueDate) ?? addDays(s, 7);
    const done = r.status === "COMPLETED" ? 1 : r.stageIndex === null ? 0 : r.stageIndex / Math.max(1, r.stages.length);
    return { r, s, e: e < s ? s : e, done };
  }).sort((a, b) => a.s.getTime() - b.s.getTime()), [rows]);

  const from = useMemo(() => {
    const min = bars.reduce((m, b) => (b.s < m ? b.s : m), addDays(t, -7));
    return addDays(min, -2);
  }, [bars, t]);
  const to = useMemo(() => {
    const max = bars.reduce((m, b) => (b.e > m ? b.e : m), addDays(t, 28));
    return addDays(max, 4);
  }, [bars, t]);
  const days = Math.min(400, daysBetween(from, to) + 1);
  const x = (d: Date) => daysBetween(from, d) * W;

  function down(e: React.PointerEvent, id: number, mode: Drag["mode"]) {
    if (!canEdit) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const d = { id, mode, x0: e.clientX, delta: 0 };
    dragRef.current = d;
    setDrag(d);
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x0) / W);
    if (delta !== d.delta) { dragRef.current = { ...d, delta }; setDrag(dragRef.current); }
  }
  function up() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.delta === 0) return;
    const b = bars.find((x) => x.r.id === d.id);
    if (!b) return;
    const s = d.mode === "move" ? addDays(b.s, d.delta) : b.s;
    const e = addDays(b.e, d.delta);
    run(() => rescheduleOrder(b.r.id, b.r.version, dayKey(s), dayKey(e)));
  }

  const months: { label: string; start: number; n: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const label = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(d);
    if (!months.length || months[months.length - 1]!.label !== label) months.push({ label, start: i, n: 1 });
    else months[months.length - 1]!.n++;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 no-print" style={{ marginBottom: 8 }}>
        <div className="seg" role="group" aria-label="Scale">
          {(Object.keys(SCALES) as (keyof typeof SCALES)[]).map((k) => <button key={k} type="button" className={scale === k ? "on" : ""} aria-pressed={scale === k} onClick={() => setScale(k)}>{k === "week" ? "Days" : "Months"}</button>)}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>Bar = planned start → due date · fill = route progress · red = late{canEdit ? " · drag a bar to move it, its end to change the due date" : ""}</span>
      </div>
      <div className="gantt" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="gantt-grid" style={{ gridTemplateColumns: `${LABEL_W}px ${days * W}px` }}>
          <div className="g-head g-label" style={{ zIndex: 4, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "flex-end" }}>Work order</div>
          <div className="g-head" style={{ position: "sticky", top: 0 }}>
            <div style={{ position: "relative", height: 22, borderBottom: "1px solid var(--border)" }}>
              {months.map((m) => <span key={m.label} style={{ position: "absolute", insetInlineStart: m.start * W, width: m.n * W, paddingInlineStart: 6, fontSize: 11, fontWeight: 600, borderInlineStart: "1px solid var(--border)", whiteSpace: "nowrap", overflow: "hidden", lineHeight: "22px" }}>{m.label}</span>)}
            </div>
            <div style={{ position: "relative", height: 22 }}>
              {Array.from({ length: days }, (_, i) => {
                const d = addDays(from, i);
                const show = scale === "week" || d.getUTCDate() === 1 || d.getUTCDay() === 1;
                return show ? <span key={i} style={{ position: "absolute", insetInlineStart: i * W, width: scale === "week" ? W : W * 7, textAlign: scale === "week" ? "center" : "start", fontSize: 10, color: dayKey(d) === dayKey(t) ? "var(--brand-ink)" : "var(--muted)", fontWeight: dayKey(d) === dayKey(t) ? 700 : 400, lineHeight: "22px" }}>{d.getUTCDate()}</span> : null;
              })}
            </div>
          </div>
          {bars.map(({ r, s, e, done }) => {
            const d = drag?.id === r.id ? drag : null;
            const s2 = d?.mode === "move" ? addDays(s, d.delta) : s;
            const e2 = d ? addDays(e, d.delta) : e;
            const late = r.late || (r.status !== "COMPLETED" && e2 < t);
            const editable = canEdit && r.status !== "COMPLETED" && r.status !== "CANCELLED";
            return (
              <div key={r.id} className="contents">
                <div className="g-label g-row" style={{ display: "flex", alignItems: "center", gap: 6 }} title={r.fullName}>
                  <Link href={`/work-orders/${r.id}`} className="link">{r.code}</Link>
                  <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.product} · {r.material}</span>
                </div>
                <div className="g-row">
                  {scale === "week" && Array.from({ length: days }, (_, i) => { const dd = addDays(from, i); return dd.getUTCDay() === 5 ? <span key={i} className="g-weekend" style={{ insetInlineStart: i * W, width: W }} /> : null; })}
                  <span className="g-today" style={{ insetInlineStart: x(t) + W / 2 }} />
                  <div
                    className={`g-bar ${late ? "late" : ""} ${editable ? "movable" : ""} ${d ? "moving" : ""}`}
                    style={{ insetInlineStart: x(s2), width: Math.max(W, (daysBetween(s2, e2) + 1) * W) }}
                    onPointerDown={editable ? (ev) => down(ev, r.id, "move") : undefined}
                    title={`${r.fullName}\n${fmtDay(s2)} → ${fmtDay(e2)}\n${r.stage ?? "Not released"}`}
                    role="img"
                    aria-label={`${r.code}: ${fmtDay(s2)} to ${fmtDay(e2)}, ${Math.round(done * 100)}% of the route${late ? ", late" : ""}`}
                  >
                    <span className="g-prog" style={{ width: `${done * 100}%` }} />
                    <span className="g-txt">{r.code} · {r.stage ?? "Not released"}</span>
                    {editable && <span onPointerDown={(ev) => { ev.stopPropagation(); down(ev, r.id, "end"); }} style={{ position: "absolute", insetInlineEnd: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize" }} aria-hidden />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!bars.length && <p className="muted" style={{ textAlign: "center", padding: 30 }}>No work order matches.</p>}
      </div>
    </div>
  );
}
