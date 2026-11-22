"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Factory, Hourglass, Pause } from "lucide-react";
import { Badge, EmptyState, PriorityBadge } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { recordPieces } from "@/app/(app)/planning/tracker/actions";
import { fmtDay } from "@/lib/domain/dates";
import { waitTone } from "@/lib/domain/flow";
import type { FloorLot } from "@/lib/server/flowQueries";

type Lot = FloorLot & { canRecord: boolean };
type Reason = { id: number; code: string; name: string };

/** The workshops as tabs, then the lots waiting at the chosen one — each with its own "done now" line. */
export function WorkshopFloor({ lots, workshops, selected, total, reasons }: { lots: Lot[]; workshops: { id: number; name: string; lots: number; pcs: number }[]; selected: number | "all"; total: { lots: number; pcs: number }; reasons: Reason[] }) {
  const here = selected === "all" ? null : workshops.find((w) => w.id === selected);
  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="seg" role="tablist" aria-label="Workshop">
          <Link href="/workshop/floor?ws=all" className={selected === "all" ? "on" : ""} role="tab" aria-selected={selected === "all"}>All <span className="muted">{total.pcs}</span></Link>
          {workshops.map((w) => (
            <Link key={w.id} href={`/workshop/floor?ws=${w.id}`} className={selected === w.id ? "on" : ""} role="tab" aria-selected={selected === w.id}>
              {w.name} {w.pcs > 0 && <span className="muted">{w.pcs}</span>}
            </Link>
          ))}
        </div>
      </div>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="card-head">
          <h2 className="card-title">{here ? here.name : "All workshops"}</h2>
          <span className="badge tone-brand badge-plain">{lots.reduce((a, l) => a + l.waiting, 0)} pcs waiting · {lots.length} lot{lots.length === 1 ? "" : "s"}</span>
        </div>
        {!lots.length ? (
          <EmptyState icon={Factory} title="Nothing is waiting here" hint="Pieces show here when the stage before hands them over." />
        ) : (
          lots.map((l) => <LotRow key={`${l.id}-${l.seq}`} lot={l} reasons={reasons} />)
        )}
      </section>
    </>
  );
}

function LotRow({ lot: l, reasons }: { lot: Lot; reasons: Reason[] }) {
  const [done, setDone] = useState("");
  const [scrap, setScrap] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const d = Number(done) || 0;
  const s = Number(scrap) || 0;
  const over = d + s > l.waiting;
  const tone = waitTone(l.waited);
  const save = (good: number, sc: number) => run(() => recordPieces({ woId: l.id, seq: l.seq, mode: "add", good, scrap: sc, reasonId: reason ? Number(reason) : null, source: "floor" }), { onOk: () => { setDone(""); setScrap(""); setReason(""); } });
  return (
    <div className={`lot ${l.priority === 3 ? "urgent" : l.priority === 2 ? "high" : ""}`}>
      <div style={{ minWidth: 0 }}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/work-orders/${l.id}`} className="code ink" style={{ fontWeight: 600 }}>{l.code}</Link>
          {l.priority > 1 && <PriorityBadge priority={l.priority} />}
          {l.paused && <Badge tone="warn"><Pause size={12} aria-hidden /> Paused</Badge>}
          {l.qc && <Badge tone="info">Quality</Badge>}
        </div>
        <div style={{ fontSize: 13, margin: "2px 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.fullName}>{l.fullName}</div>
        <div className="lot-flow">
          {l.from ? <span>{l.from}</span> : <span>Release</span>}
          <ArrowRight size={13} aria-hidden />
          <b>{l.stage}</b>
          <ArrowRight size={13} aria-hidden />
          <span>{l.next ?? "FG stock"}</span>
        </div>
        <div className="meta" style={{ marginTop: 4 }}>
          <span>Stage {l.stageIndex + 1} of {l.stageCount}</span>
          <span>Done here <b>{l.good}</b> of {l.arrived}</span>
          {l.scrap > 0 && <span style={{ color: "var(--bad-fg)" }}>Scrap {l.scrap}</span>}
          <span>Due <b style={{ color: l.late ? "var(--bad-fg)" : undefined }}>{fmtDay(l.dueDate) || "—"}</b></span>
        </div>
      </div>
      <div style={{ textAlign: "end" }}>
        <div className="lot-qty">{l.waiting}</div>
        <div className="muted" style={{ fontSize: 12 }}>of {l.qty} pcs waiting</div>
        {l.waited !== null && (
          <div style={{ marginTop: 4 }}>
            <Badge tone={tone === "neutral" ? "neutral" : tone} title={l.since ? `Since ${fmtDay(l.since)}` : undefined}><Hourglass size={11} aria-hidden /> {l.waited === 0 ? "today" : `${l.waited} d`}</Badge>
          </div>
        )}
      </div>
      {l.qc && !l.canRecord ? (
        <div className="lot-form"><Link href="/quality" className="btn btn-secondary btn-sm">Inspection in Quality</Link></div>
      ) : l.canRecord ? (
        <form className="lot-form" onSubmit={(e) => { e.preventDefault(); if (!over && (d > 0 || s > 0) && !(s > 0 && !reason)) save(d, s); }}>
          <label className="flex flex-col gap-1" style={{ fontSize: 12 }}>
            {l.qc ? "Passed now" : "Done now"}
            <input type="number" min={0} max={l.waiting} step={1} className="input num-in" value={done} onChange={(e) => setDone(e.target.value)} placeholder="0" aria-label={`${l.code} pieces done now`} />
          </label>
          <label className="flex flex-col gap-1" style={{ fontSize: 12 }}>
            {l.qc ? "Rejected" : "Scrap"}
            <input type="number" min={0} step={1} className="input num-in" value={scrap} onChange={(e) => setScrap(e.target.value)} placeholder="0" aria-label={`${l.code} scrap`} />
          </label>
          {s > 0 && (
            <label className="flex flex-col gap-1" style={{ fontSize: 12 }}>
              Reason
              <select className="select" value={reason} onChange={(e) => setReason(e.target.value)} required>
                <option value="">Choose…</option>
                {reasons.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || over || (d <= 0 && s <= 0) || (s > 0 && !reason)} title={over ? `Only ${l.waiting} waiting` : undefined}>Save</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => save(l.waiting, 0)} title={`All ${l.waiting} done at ${l.stage}`}>All {l.waiting} done</button>
        </form>
      ) : null}
    </div>
  );
}
