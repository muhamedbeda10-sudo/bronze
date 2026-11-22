"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Download, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, Field, Notice } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { downloadXlsx } from "@/components/excel";
import { fmtDay, fmtInstant } from "@/lib/domain/dates";
import { STOCK_FIELDS, available } from "@/lib/domain/stock";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, STOCK_KIND_LABEL, type StockKind } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";
import { createIssueRequest, deleteStock, importStock, processIssueRequest, saveStock } from "@/app/(app)/inventory/actions";

type Opt = { value: string; label: string };
export type StockOptions = { material: Opt[]; product: Opt[]; workshop: Opt[]; order: Opt[] };

export interface StockRowView {
  id: number;
  version: number;
  values: Record<string, string | number | null>;
  /** what each reference shows */
  labels: Record<string, string>;
  totalQty: number;
  reservedQty: number;
  unit: string;
}

export function StockView({ kind, rows, options, canEdit }: { kind: StockKind; rows: StockRowView[]; options: StockOptions; canEdit: boolean }) {
  const fields = STOCK_FIELDS[kind];
  const { run, pending } = useAction();
  const [edit, setEdit] = useState<StockRowView | "new" | null>(null);
  const [del, setDel] = useState<StockRowView | null>(null);
  const [reason, setReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const unit = kind === "RAW" || kind === "WIP_RAW" ? "kg" : "pcs";
  const totals = rows.reduce((s, r) => ({ t: s.t + r.totalQty, r: s.r + r.reservedQty }), { t: 0, r: 0 });

  const cols: Column<StockRowView>[] = [
    ...fields.filter((f) => f.key !== "totalQty" && f.key !== "reservedQty").map<Column<StockRowView>>((f) => ({
      key: f.key,
      label: f.unit ? `${f.label} (${f.unit})` : f.label,
      num: f.type === "number",
      className: f.key === "description" ? "wrap" : undefined,
      value: (r) => (f.type === "number" || f.type === "text" ? r.values[f.key] : r.labels[f.key] ?? null),
      render: (r) => {
        const v = f.type === "number" || f.type === "text" ? r.values[f.key] : r.labels[f.key];
        if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
        if (f.type === "order") return <Link className="code ink" href={`/work-orders/${r.values.workOrderId}`}>{v}</Link>;
        return typeof v === "number" ? fmtNum(v, 2) : v;
      },
    })),
    { key: "totalQty", label: `Total qty (${unit})`, num: true, value: (r) => r.totalQty, render: (r) => fmtNum(r.totalQty, 2) },
    { key: "reservedQty", label: `Reserved (${unit})`, num: true, value: (r) => r.reservedQty, render: (r) => fmtNum(r.reservedQty, 2) },
    { key: "available", label: `Available (${unit})`, num: true, value: (r) => available(r.totalQty, r.reservedQty), render: (r) => <b style={{ color: available(r.totalQty, r.reservedQty) <= 0 ? "var(--bad-fg)" : "var(--ok-fg)" }}>{fmtNum(available(r.totalQty, r.reservedQty), 2)}</b> },
  ];
  if (canEdit) cols.push({
    key: "_a", label: "Actions", noExport: true, sortable: false,
    render: (r) => (
      <div className="inline-flex gap-1">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Adjust" title="Adjust" onClick={() => { setReason(""); setEdit(r); }}><Pencil size={15} /></button>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove" title="Remove" style={{ color: "var(--bad-fg)" }} onClick={() => { setReason(""); setDel(r); }}><Trash2 size={15} /></button>
      </div>
    ),
  });

  async function upload(file?: File) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    await run(() => importStock(kind, fd));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(r) => r.id}
        exportName={STOCK_KIND_LABEL[kind]}
        empty={{ title: `No ${STOCK_KIND_LABEL[kind].toLowerCase()} lines` }}
        tools={<>
          <span className="badge tone-brand badge-plain">Total {fmtNum(totals.t, 1)} · Available {fmtNum(totals.t - totals.r, 1)} {unit}</span>
          {canEdit && <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadXlsx(`${STOCK_KIND_LABEL[kind]} template`, [{ name: STOCK_KIND_LABEL[kind], headers: fields.map((f) => (f.unit ? `${f.label} (${f.unit})` : f.label)), rows: [] }])}><Download size={15} aria-hidden /> Template</button>
            <input ref={fileRef} id={`stock-up-${kind}`} type="file" accept=".xlsx" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            <label htmlFor={`stock-up-${kind}`} className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}><Upload size={15} aria-hidden /> Upload</label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setReason(""); setEdit("new"); }}><Plus size={15} aria-hidden /> Add New</button>
          </>}
        </>}
      />
      {edit && <StockForm kind={kind} row={edit === "new" ? null : edit} options={options} reason={reason} setReason={setReason} onClose={() => setEdit(null)} />}
      {del && (
        <Modal title="Remove this stock line?" size="sm" onClose={() => setDel(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setDel(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={pending || !reason.trim()} onClick={() => run(() => deleteStock(del.id, reason), { onOk: () => setDel(null) })}>Remove</button>
        </>}>
          <p style={{ marginTop: 0 }}>{fmtNum(del.totalQty, 2)} {del.unit} leave the stock lists. The change history keeps the line.</p>
          <Field label="Reason" required><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
        </Modal>
      )}
    </>
  );
}

function StockForm({ kind, row, options, reason, setReason, onClose }: { kind: StockKind; row: StockRowView | null; options: StockOptions; reason: string; setReason: (s: string) => void; onClose: () => void }) {
  const { run, pending } = useAction();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(STOCK_FIELDS[kind].map((f) => [f.key, row?.values[f.key] === null || row?.values[f.key] === undefined ? (f.key === "reservedQty" ? "0" : "") : String(row.values[f.key])])));
  return (
    <Modal title={row ? "Adjust stock line" : `Add ${STOCK_KIND_LABEL[kind]} line`} onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" form="stock-form" className="btn btn-primary" disabled={pending || (!!row && !reason.trim())}>Save</button>
    </>}>
      <form id="stock-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveStock(kind, row?.id ?? null, row?.version ?? null, v, reason), { onOk: onClose }); }}>
        {STOCK_FIELDS[kind].map((f) => (
          <Field key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label} required={f.required}>
            {f.type === "number" ? <input type="number" min={0} step="any" className="input" value={v[f.key]} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} required={f.required} />
              : f.type === "text" ? <input className="input" value={v[f.key]} maxLength={300} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} required={f.required} />
              : <select className="select" value={v[f.key]} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} required={f.required} disabled={!!row && kind === "RAW" && f.key === "materialId"}>
                  <option value="">{f.required ? "Choose…" : "—"}</option>
                  {options[f.type].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>}
          </Field>
        ))}
        <Field label={row ? "Reason for the change" : "Reference (optional)"} required={!!row} className="sm:col-span-2" help="Goes into the stock ledger.">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={row ? "e.g. monthly count difference" : "e.g. opening balance, GRN no."} />
        </Field>
        {row && Number(v.totalQty) !== row.totalQty && <div className="sm:col-span-2"><Notice tone="info">Change of {fmtNum(Number(v.totalQty) - row.totalQty, 3)} {row.unit} will be posted to the ledger.</Notice></div>}
      </form>
    </Modal>
  );
}

export interface IssueRow { id: number; reqNo: string; date: string; material: string; qtyKg: number; workshop: string; wo: string | null; woId: number | null; status: string; requestedBy: string; processedBy: string | null; processedAt: string | null; note: string | null; availableKg: number }

export function IssueRequests({ rows, options, canRequest, canProcess, ownWorkshop }: { rows: IssueRow[]; options: StockOptions; canRequest: boolean; canProcess: boolean; ownWorkshop: number | null }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [rej, setRej] = useState<IssueRow | null>(null);
  const [note, setNote] = useState("");
  const [v, setV] = useState({ materialId: "", qtyKg: "", workshopId: ownWorkshop ? String(ownWorkshop) : "", workOrderId: "", note: "" });
  const ws = ownWorkshop ? options.workshop.filter((w) => w.value === String(ownWorkshop)) : options.workshop;
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        exportName="Issue requests"
        empty={{ title: "No issue requests" }}
        tools={canRequest && <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} aria-hidden /> New request</button>}
        columns={[
          { key: "reqNo", label: "Request ID", render: (r) => <span className="code">{r.reqNo}</span> },
          { key: "date", label: "Date", render: (r) => fmtDay(r.date), className: "nowrap" },
          { key: "material", label: "Material" },
          { key: "qtyKg", label: "Qty (kg)", num: true, render: (r) => fmtNum(r.qtyKg, 2) },
          { key: "workshop", label: "Workshop" },
          { key: "wo", label: "Work order", render: (r) => (r.wo ? <Link className="code ink" href={`/work-orders/${r.woId}`}>{r.wo}</Link> : "—") },
          { key: "status", label: "Status", value: (r) => REQUEST_STATUS_LABEL[r.status], render: (r) => <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge> },
          { key: "requestedBy", label: "Requested by" },
          { key: "processedBy", label: "Processed", render: (r) => (r.processedBy ? <>{r.processedBy}<div className="muted" style={{ fontSize: 11 }}>{fmtInstant(r.processedAt)}</div></> : "—"), value: (r) => r.processedBy },
          { key: "note", label: "Note", className: "wrap", render: (r) => r.note ?? "" },
          ...(canProcess ? [{
            key: "_p", label: "Store", noExport: true, sortable: false,
            render: (r: IssueRow) => r.status !== "PENDING" ? null : (
              <div className="inline-flex gap-1 items-center">
                <button type="button" className="btn btn-ok btn-sm" disabled={pending || r.availableKg < r.qtyKg} title={r.availableKg < r.qtyKg ? `Only ${fmtNum(r.availableKg, 1)} kg on hand` : "Issue from raw stock"} onClick={() => run(() => processIssueRequest(r.id, true, ""))}><Check size={14} aria-hidden /> Issue</button>
                <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => { setNote(""); setRej(r); }}><X size={14} aria-hidden /> Reject</button>
              </div>
            ),
          }] : []),
        ]}
      />
      {open && (
        <Modal title="New issue request" onClose={() => setOpen(false)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" form="ir-form" className="btn btn-primary" disabled={pending}>Send to store</button>
        </>}>
          <form id="ir-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => createIssueRequest(v), { onOk: () => { setOpen(false); setV((s) => ({ ...s, materialId: "", qtyKg: "", workOrderId: "", note: "" })); } }); }}>
            <Field label="Material" required><select className="select" value={v.materialId} onChange={(e) => setV((s) => ({ ...s, materialId: e.target.value }))} required><option value="">Choose…</option>{options.material.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Quantity (kg)" required><input type="number" min={0.001} step="any" className="input" value={v.qtyKg} onChange={(e) => setV((s) => ({ ...s, qtyKg: e.target.value }))} required /></Field>
            <Field label="Workshop" required><select className="select" value={v.workshopId} onChange={(e) => setV((s) => ({ ...s, workshopId: e.target.value }))} required><option value="">Choose…</option>{ws.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Work order"><select className="select" value={v.workOrderId} onChange={(e) => setV((s) => ({ ...s, workOrderId: e.target.value }))}><option value="">—</option>{options.order.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Note" className="sm:col-span-2"><input className="input" value={v.note} maxLength={300} onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))} /></Field>
          </form>
        </Modal>
      )}
      {rej && (
        <Modal title={`Reject ${rej.reqNo}?`} size="sm" onClose={() => setRej(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setRej(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={pending || !note.trim()} onClick={() => run(() => processIssueRequest(rej.id, false, note), { onOk: () => setRej(null) })}>Reject</button>
        </>}>
          <Field label="Reason" required><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
        </Modal>
      )}
    </>
  );
}

export interface MoveRow { id: number; at: string; kind: string; item: string; delta: number; unit: string; reason: string; ref: string | null; userName: string }
const REASON: Record<string, string> = { ADD: "Added", EDIT: "Adjustment", ISSUE: "Issued to floor", RECEIVE_WIP_RAW: "Received at workshop", WO_COMPLETE: "WO completed", IMPORT: "Excel upload", DELETE: "Removed" };

export function StockLedger({ rows }: { rows: MoveRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      exportName="Stock ledger"
      empty={{ title: "No stock movements in this period" }}
      columns={[
        { key: "at", label: "When", render: (r) => fmtInstant(r.at), value: (r) => r.at.slice(0, 16).replace("T", " "), className: "nowrap" },
        { key: "kind", label: "List", value: (r) => STOCK_KIND_LABEL[r.kind as StockKind] ?? r.kind },
        { key: "item", label: "Item", className: "wrap" },
        { key: "reason", label: "Movement", value: (r) => REASON[r.reason] ?? r.reason },
        { key: "delta", label: "Qty", num: true, render: (r) => <b style={{ color: r.delta < 0 ? "var(--bad-fg)" : "var(--ok-fg)" }}>{r.delta > 0 ? "+" : ""}{fmtNum(r.delta, 3)} {r.unit}</b> },
        { key: "ref", label: "Reference", render: (r) => r.ref ?? "—" },
        { key: "userName", label: "By" },
      ]}
    />
  );
}
