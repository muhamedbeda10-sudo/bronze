"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Field, Notice } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { downloadXlsx } from "@/components/excel";
import { calcWeights, dimensionText, fullName } from "@/lib/domain/weight";
import { fmtNum } from "@/lib/format";
import { createWorkOrderAction, importWorkOrdersAction, updateWorkOrderAction } from "@/app/(app)/work-orders/actions";

export interface WoOptions {
  products: { id: number; name: string; format: string }[];
  materials: { id: number; code: string; name: string; density: number; availableKg: number | null }[];
  processes: { id: number; code: string; name: string; stages: string[] }[];
  molds: { id: number; moldNo: string; productId: number | null; processId: number | null; approxWeightKg: number | null; available: boolean }[];
  allowancePct: number;
  defaultDensity: number;
}

export type LineDraft = Record<"productId" | "materialId" | "processId" | "od" | "innerDia" | "length" | "width" | "height" | "qty" | "moldId" | "priority" | "startDate" | "atpDate" | "dueDate" | "dimensionNotes" | "commentNotes", string>;

export const emptyLine = (): LineDraft => ({ productId: "", materialId: "", processId: "", od: "", innerDia: "", length: "", width: "", height: "", qty: "", moldId: "", priority: "1", startDate: "", atpDate: "", dueDate: "", dimensionNotes: "", commentNotes: "" });

const n = (s: string) => (s.trim() === "" ? null : Number(s));

function useWeights(line: LineDraft, o: WoOptions) {
  return useMemo(() => {
    const product = o.products.find((p) => String(p.id) === line.productId);
    const material = o.materials.find((m) => String(m.id) === line.materialId);
    const mold = o.molds.find((m) => String(m.id) === line.moldId);
    const w = calcWeights({
      format: product?.format ?? "OD_ID_L",
      od: n(line.od), innerDia: n(line.innerDia), length: n(line.length), width: n(line.width), height: n(line.height),
      qty: Number(line.qty) || 0,
      density: material?.density ?? o.defaultDensity,
      allowancePct: o.allowancePct,
      moldPieceKg: mold?.approxWeightKg ?? null,
    });
    return { w, product, material, mold };
  }, [line, o]);
}

/** One order line: what it is, its size, its dates — with the weights worked out as it is typed. */
function LineEditor({ line, set, o, title, woNo, lineNo, lineCount, onRemove, onCopy, lockProcess }: {
  line: LineDraft; set: (k: keyof LineDraft, v: string) => void; o: WoOptions; title: string; woNo: string; lineNo: number; lineCount: number;
  onRemove?: () => void; onCopy?: () => void; lockProcess?: boolean;
}) {
  const { w, product, material } = useWeights(line, o);
  const format = product?.format ?? "OD_ID_L";
  const process = o.processes.find((p) => String(p.id) === line.processId);
  const molds = o.molds.filter((m) => (!line.productId || !m.productId || String(m.productId) === line.productId) && (!line.processId || !m.processId || String(m.processId) === line.processId));
  const short = material && material.availableKg !== null && w.rawReqKg !== null && w.rawReqKg > material.availableKg;
  const name = product && material && line.qty ? fullName({ woNo: woNo || "WO", lineNo, lineCount, product: product.name, material: material.name, dims: dimensionText(format, { od: n(line.od), innerDia: n(line.innerDia), length: n(line.length), width: n(line.width), height: n(line.height) }), qty: Number(line.qty) }) : null;

  return (
    <fieldset className="card" style={{ border: "1px solid var(--border)", margin: 0, padding: 0, minWidth: 0 }}>
      <legend className="sr-only">{title}</legend>
      <div className="card-head">
        <h3 className="card-title" style={{ fontFamily: "var(--font-sans)" }}>{title}</h3>
        <div className="flex gap-1">
          {onCopy && <button type="button" className="btn btn-ghost btn-sm" onClick={onCopy} title="Add a copy of this line"><Copy size={14} aria-hidden /> Duplicate</button>}
          {onRemove && <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} style={{ color: "var(--bad-fg)" }}><Trash2 size={14} aria-hidden /> Remove</button>}
        </div>
      </div>
      <div className="card-pad grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <Field label="Product" required>
          <select className="select" value={line.productId} onChange={(e) => set("productId", e.target.value)} required>
            <option value="">Choose…</option>
            {o.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Material" required>
          <select className="select" value={line.materialId} onChange={(e) => set("materialId", e.target.value)} required>
            <option value="">Choose…</option>
            {o.materials.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
        </Field>
        <Field label="Process Type" required help={process ? `${process.stages.length} stages` : "Decides the route"}>
          <select className="select" value={line.processId} onChange={(e) => set("processId", e.target.value)} required disabled={lockProcess} title={lockProcess ? "Fixed once production has started" : undefined}>
            <option value="">Choose…</option>
            {o.processes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </Field>
        {format === "W_L_H" ? (
          <>
            <Field label="Width (mm)"><input className="input" type="number" min={0} step="any" value={line.width} onChange={(e) => set("width", e.target.value)} /></Field>
            <Field label="Length (mm)"><input className="input" type="number" min={0} step="any" value={line.length} onChange={(e) => set("length", e.target.value)} /></Field>
            <Field label="Height (mm)"><input className="input" type="number" min={0} step="any" value={line.height} onChange={(e) => set("height", e.target.value)} /></Field>
          </>
        ) : (
          <>
            <Field label={format === "IMPELLER" ? "Diameter (mm)" : "OD (mm)"}><input className="input" type="number" min={0} step="any" value={line.od} onChange={(e) => set("od", e.target.value)} /></Field>
            <Field label="ID (mm)"><input className="input" type="number" min={0} step="any" value={line.innerDia} onChange={(e) => set("innerDia", e.target.value)} /></Field>
            <Field label="Length (mm)"><input className="input" type="number" min={0} step="any" value={line.length} onChange={(e) => set("length", e.target.value)} /></Field>
          </>
        )}
        <Field label="Quantity" required><input className="input" type="number" min={1} step={1} value={line.qty} onChange={(e) => set("qty", e.target.value)} required /></Field>
        <Field label="Mold #">
          <select className="select" value={line.moldId} onChange={(e) => set("moldId", e.target.value)}>
            <option value="">None</option>
            {molds.map((m) => <option key={m.id} value={m.id} disabled={!m.available && String(m.id) !== line.moldId}>{m.moldNo}{m.approxWeightKg ? ` · ${m.approxWeightKg} kg` : ""}{!m.available ? " (not available)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="select" value={line.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="1">1 – Normal</option>
            <option value="2">2 – High</option>
            <option value="3">3 – Urgent</option>
          </select>
        </Field>
        <Field label="Start Date"><input className="input" type="date" value={line.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        <Field label="ATP Date" help="Available to promise"><input className="input" type="date" value={line.atpDate} onChange={(e) => set("atpDate", e.target.value)} /></Field>
        <Field label="Due Date" help="Promised to the customer"><input className="input" type="date" value={line.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        <Field label="Dimension Notes" className="col-span-full sm:col-span-2"><input className="input" value={line.dimensionNotes} maxLength={500} onChange={(e) => set("dimensionNotes", e.target.value)} placeholder="Tolerances, drawing no." /></Field>
        <Field label="Comment Notes" className="col-span-full sm:col-span-2"><input className="input" value={line.commentNotes} maxLength={500} onChange={(e) => set("commentNotes", e.target.value)} placeholder="Customer remarks" /></Field>
      </div>
      <div className="card-pad" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)", borderRadius: "0 0 var(--r-md) var(--r-md)" }}>
        <div className="stat-line">
          <div><div className="l">Unit weight</div><div className="v">{fmtNum(w.unitKg, 3)} <span className="muted" style={{ fontSize: 12 }}>kg</span></div></div>
          <div><div className="l">Total weight</div><div className="v">{fmtNum(w.totalKg, 2)} <span className="muted" style={{ fontSize: 12 }}>kg</span></div></div>
          <div><div className="l">Raw req. (+{o.allowancePct}%)</div><div className="v ink">{fmtNum(w.rawReqKg, 2)} <span className="muted" style={{ fontSize: 12 }}>kg</span></div></div>
          <div><div className="l">Mold-based</div><div className="v">{fmtNum(w.moldKg, 2)} <span className="muted" style={{ fontSize: 12 }}>kg</span></div></div>
          <div><div className="l">Raw available</div><div className="v" style={{ color: short ? "var(--bad-fg)" : undefined }}>{fmtNum(material?.availableKg ?? null, 1)} <span className="muted" style={{ fontSize: 12 }}>kg</span></div></div>
        </div>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
          Density {fmtNum(w.densityUsed, 3)} g/cm³{material ? ` (${material.name})` : ""}.{name && <> Full name: <b style={{ color: "var(--foreground)" }}>{name}</b></>}
        </p>
        {short && <div style={{ marginTop: 8 }}><Notice tone="warn">Available raw material ({fmtNum(material!.availableKg, 1)} kg) does not cover this line&apos;s requirement ({fmtNum(w.rawReqKg, 1)} kg) — the order can still be saved; plan it as Waiting Material.</Notice></div>}
        {process && <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Route: {process.stages.join(" → ")}</p>}
      </div>
    </fieldset>
  );
}

export function WoCreateForm({ o, todayKey }: { o: WoOptions; todayKey: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [woNo, setWoNo] = useState("");
  const [woDate, setWoDate] = useState(todayKey);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const fileRef = useRef<HTMLInputElement>(null);

  const setLine = (i: number) => (k: keyof LineDraft, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function save() {
    const ok = await run(() => createWorkOrderAction({ woNo, woDate, lines }), { onOk: () => router.push("/work-orders") });
    if (ok) { setWoNo(""); setLines([emptyLine()]); }
  }

  async function upload(file?: File) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    await run(() => importWorkOrdersAction(fd));
    if (fileRef.current) fileRef.current.value = "";
  }

  const template = () => downloadXlsx("Work orders template", [{ name: "Work orders", headers: ["Work Order No", "WO Date", "Product", "Material", "Process", "OD", "ID", "Length", "Width", "Height", "Quantity", "Mold", "Priority", "Start Date", "ATP Date", "Due Date", "Dimension Notes", "Comment Notes"], rows: [["14444", todayKey, "Bars", "BRZ-08", "PRC-02", 300, 200, 10, null, null, 10, null, 1, todayKey, null, todayKey, null, null]] }]);

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="toolbar">
        <Field label="WO Date" required><input className="input" type="date" value={woDate} onChange={(e) => setWoDate(e.target.value)} required /></Field>
        <Field label="Work Order No" required help={woNo ? `Lines become ${woNo}-1${lines.length > 1 ? ` … ${woNo}-${lines.length}` : ""}` : "Customer or internal number, e.g. 14444"}>
          <input className="input" value={woNo} onChange={(e) => setWoNo(e.target.value.trim())} required maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9\-_/.]*" />
        </Field>
        <div className="grow" />
        <div className="flex gap-2 items-center">
          <button type="button" className="btn btn-ghost btn-sm" onClick={template}><Download size={15} aria-hidden /> Template</button>
          <input ref={fileRef} type="file" accept=".xlsx" id="wo-up" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          <label htmlFor="wo-up" className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }} title="Many orders from an Excel sheet, one row per line"><Upload size={15} aria-hidden /> Upload Excel</label>
        </div>
      </div>
      {lines.map((l, i) => (
        <LineEditor
          key={i}
          line={l}
          set={setLine(i)}
          o={o}
          title={`Line ${i + 1}${woNo ? ` · ${woNo}-${i + 1}` : ""}`}
          woNo={woNo}
          lineNo={i + 1}
          lineCount={lines.length}
          onCopy={lines.length < 50 ? () => setLines((ls) => [...ls.slice(0, i + 1), { ...l }, ...ls.slice(i + 1)]) : undefined}
          onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      <div className="flex flex-wrap gap-2 justify-between">
        <button type="button" className="btn btn-secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])} disabled={lines.length >= 50}><Plus size={16} aria-hidden /> Add Line</button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => { setWoNo(""); setLines([emptyLine()]); }}><X size={16} aria-hidden /> Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}><Save size={16} aria-hidden /> {pending ? "Saving…" : "Save Work Order"}</button>
        </div>
      </div>
    </form>
  );
}

export function WoEditDialog({ id, version, woNo, lineNo, lineCount, initial, o, lockProcess, onClose }: { id: number; version: number; woNo: string; lineNo: number; lineCount: number; initial: LineDraft; o: WoOptions; lockProcess: boolean; onClose: () => void }) {
  const { run, pending } = useAction();
  const [line, setLine] = useState(initial);
  return (
    <Modal title={`Edit ${woNo}-${lineNo}`} onClose={onClose} size="lg" footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => updateWorkOrderAction(id, version, line), { onOk: onClose })}><Save size={16} aria-hidden /> Save</button>
    </>}>
      <LineEditor line={line} set={(k, v) => setLine((l) => ({ ...l, [k]: v }))} o={o} title={`${woNo}-${lineNo}`} woNo={woNo} lineNo={lineNo} lineCount={lineCount} lockProcess={lockProcess} />
    </Modal>
  );
}
