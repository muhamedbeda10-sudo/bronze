"use client";

import { useRef, useState } from "react";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Confirm, Modal } from "@/components/Modal";
import { Badge, Field } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { downloadXlsx } from "@/components/excel";
import { SPECS, type Field as FieldSpec, type MasterEntity } from "@/lib/domain/master";
import { DIMENSION_FORMAT_LABEL, type DimensionFormat } from "@/lib/domain/weight";
import { deleteMasterRow, importMaster, saveMasterRow } from "@/app/(app)/master/actions";
import { fmtNum } from "@/lib/format";

type Row = Record<string, unknown> & { id: number };
type Option = { value: string; label: string };

export function MasterView({ tab, rows, options, refLabels, canEdit, canDelete }: {
  tab: MasterEntity;
  rows: Row[];
  options: Record<string, Option[]>;
  refLabels: Record<string, Record<string, string>>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const spec = SPECS[tab];
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportValue = (f: FieldSpec, r: Row): string | number | null => {
    const v = r[f.key];
    if (v === null || v === undefined) return null;
    if (f.type === "bool") return v ? "Yes" : "No";
    if (f.type === "ref") return refLabels[f.ref!]?.[String(v)] ?? null;
    return v as string | number;
  };

  const columns: Column<Row>[] = [
    ...spec.fields.map<Column<Row>>((f) => ({
      key: f.key,
      label: f.unit ? `${f.label} (${f.unit})` : f.label,
      num: f.type === "number" || f.type === "int",
      exportOnly: f.list === false,
      value: (r) => exportValue(f, r),
      className: f.type === "textarea" ? "wrap" : undefined,
      render: (r) => {
        const v = r[f.key];
        if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
        if (f.type === "bool") return <Badge tone={v ? "ok" : "neutral"}>{v ? "Yes" : "No"}</Badge>;
        if (f.key === "status") return <Badge tone={v === "Active" ? "ok" : v === "Inactive" ? "neutral" : "warn"}>{String(v)}</Badge>;
        if (f.key === "dimensionFormat") return DIMENSION_FORMAT_LABEL[v as DimensionFormat] ?? String(v);
        if (f.type === "ref") return refLabels[f.ref!]?.[String(v)] ?? "—";
        if (typeof v === "number") return fmtNum(v, 3);
        if (f.code || spec.keyFields[0] === f.key) return <span className="code">{String(v)}</span>;
        return String(v);
      },
    })),
  ];
  if (canEdit || canDelete) {
    columns.push({
      key: "_actions",
      label: "Actions",
      noExport: true,
      sortable: false,
      render: (r) => (
        <div className="inline-flex gap-1">
          {canEdit && <button type="button" className="btn btn-ghost btn-icon" title="Edit" aria-label={`Edit ${spec.singular}`} onClick={() => setEditing(r)}><Pencil size={15} /></button>}
          {canDelete && <button type="button" className="btn btn-ghost btn-icon" title="Delete" aria-label={`Delete ${spec.singular}`} onClick={() => setDeleting(r)} style={{ color: "var(--bad-fg)" }}><Trash2 size={15} /></button>}
        </div>
      ),
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    await run(() => importMaster(tab, fd));
    if (fileRef.current) fileRef.current.value = "";
  }

  const template = () => downloadXlsx(`${spec.label} template`, [{ name: spec.label, headers: spec.fields.map((f) => f.label), rows: [] }]);

  return (
    <>
      <p className="muted no-print" style={{ margin: "0 0 12px", fontSize: 13 }}>{spec.hint}</p>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        exportName={spec.label}
        searchPlaceholder={`Search ${spec.label.toLowerCase()}…`}
        empty={{ title: `No ${spec.label.toLowerCase()} yet`, hint: canEdit ? "Add them one by one, or upload an Excel sheet." : undefined }}
        tools={canEdit && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={template} title="An empty sheet with the right columns"><Download size={15} aria-hidden /> Template</button>
            <input ref={fileRef} type="file" accept=".xlsx" className="sr-only" id={`up-${tab}`} onChange={(e) => upload(e.target.files?.[0])} />
            <label htmlFor={`up-${tab}`} className="btn btn-secondary btn-sm" aria-disabled={pending} style={{ cursor: "pointer" }}><Upload size={15} aria-hidden /> Upload</label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}><Plus size={15} aria-hidden /> Add New</button>
          </>
        )}
      />
      {editing && <MasterForm tab={tab} row={editing === "new" ? null : editing} options={options} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm
          title={`Delete ${spec.singular}?`}
          danger
          busy={pending}
          confirmLabel="Delete"
          message={<>This removes <b>{spec.keyFields.map((k) => String(deleting[k])).join(" / ")}</b> for good. It is refused while orders, stock or logs still use it.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => run(() => deleteMasterRow(tab, deleting.id), { onOk: () => setDeleting(null) })}
        />
      )}
    </>
  );
}

function MasterForm({ tab, row, options, onClose }: { tab: MasterEntity; row: Row | null; options: Record<string, Option[]>; onClose: () => void }) {
  const spec = SPECS[tab];
  const { run, pending } = useAction();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of spec.fields) {
      const cur = row?.[f.key];
      v[f.key] = cur === null || cur === undefined ? (f.type === "bool" ? f.key !== "qcRequired" : f.type === "select" && f.key === "status" ? f.options?.[0] : "") : f.type === "bool" ? Boolean(cur) : String(cur);
    }
    return v;
  });
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <Modal
      title={row ? `Edit ${spec.singular}` : `Add ${spec.singular}`}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="master-form" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </>}
    >
      <form id="master-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveMasterRow(tab, row?.id ?? null, values), { onOk: onClose }); }}>
        {spec.fields.map((f) => (
          <Field key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label} required={f.required} help={f.help} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "bool" ? (
              <span className="check" style={{ height: 34 }}>
                <input type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                {values[f.key] ? "Yes" : "No"}
              </span>
            ) : f.type === "select" ? (
              <select className="select" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} required={f.required}>
                {!f.required && f.key !== "status" && <option value="">—</option>}
                {f.options!.map((o) => <option key={o} value={o}>{f.key === "dimensionFormat" ? DIMENSION_FORMAT_LABEL[o as DimensionFormat] : o}</option>)}
              </select>
            ) : f.type === "ref" ? (
              <select className="select" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} required={f.required}>
                <option value="">{f.required ? "Choose…" : "—"}</option>
                {(options[f.ref!] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea className="textarea" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} maxLength={500} />
            ) : (
              <input
                className="input"
                type={f.type === "number" || f.type === "int" ? "number" : "text"}
                step={f.type === "int" ? 1 : "any"}
                min={f.min}
                max={f.max}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
                required={f.required}
                maxLength={f.type === "text" ? 200 : undefined}
                style={f.code ? { textTransform: "uppercase" } : undefined}
              />
            )}
          </Field>
        ))}
      </form>
    </Modal>
  );
}
