"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, Save, UploadCloud } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, Field, Notice } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { useToast } from "@/components/Toast";
import { LEVEL_LABEL, MODULE_LABEL, MODULES, ROLE_ACCESS, ROLE_LABEL, ROLES, type Access, type Level, type Role } from "@/lib/domain/access";
import { fmtInstant } from "@/lib/domain/dates";
import type { AppSettings } from "@/lib/domain/settings";
import { saveGeneral, saveUser } from "@/app/(app)/settings/actions";

export interface UserRow { id: number; name: string; email: string; role: string; access: Access; workshopId: number | null; workshop: string | null; position: string | null; department: string | null; active: boolean; lastSeen: string | null }

export function UsersView({ rows, workshops, myId }: { rows: UserRow[]; workshops: { id: number; name: string }[]; myId: number }) {
  const [edit, setEdit] = useState<UserRow | "new" | null>(null);
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        exportName="Users"
        searchPlaceholder="Search name, email, role…"
        tools={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit("new")}><Plus size={15} aria-hidden /> Add user</button>}
        columns={[
          { key: "name", label: "Name", render: (r) => <><b>{r.name}</b>{r.id === myId && <span className="muted"> (you)</span>}</> },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", value: (r) => ROLE_LABEL[r.role as Role] ?? r.role },
          { key: "menus", label: "Menus", value: (r) => MODULES.filter((m) => r.access[m]).map((m) => `${MODULE_LABEL[m]} (${r.access[m]})`).join(", "), render: (r) => <span style={{ fontSize: 12 }}>{MODULES.filter((m) => r.access[m]).map((m) => `${MODULE_LABEL[m]} ${r.access[m]}`).join(" · ") || <span className="muted">None</span>}</span>, className: "wrap" },
          { key: "workshop", label: "Own workshop", render: (r) => r.workshop ?? "—" },
          { key: "position", label: "Position", render: (r) => r.position ?? "—" },
          { key: "department", label: "Department", render: (r) => r.department ?? "—" },
          { key: "active", label: "Status", value: (r) => (r.active ? "Active" : "Inactive"), render: (r) => <Badge tone={r.active ? "ok" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge> },
          { key: "lastSeen", label: "Last sign-in", render: (r) => fmtInstant(r.lastSeen) || "—" },
          { key: "_e", label: "", noExport: true, sortable: false, render: (r) => <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${r.name}`} title="Edit" onClick={() => setEdit(r)}><Pencil size={15} /></button> },
        ]}
      />
      {edit && <UserForm row={edit === "new" ? null : edit} workshops={workshops} isSelf={edit !== "new" && edit.id === myId} onClose={() => setEdit(null)} />}
    </>
  );
}

function UserForm({ row, workshops, isSelf, onClose }: { row: UserRow | null; workshops: { id: number; name: string }[]; isSelf: boolean; onClose: () => void }) {
  const { run, pending } = useAction();
  const [v, setV] = useState({ name: row?.name ?? "", email: row?.email ?? "", role: (row?.role ?? "USER") as Role, workshopId: row?.workshopId ? String(row.workshopId) : "", position: row?.position ?? "", department: row?.department ?? "", active: row?.active ?? true });
  const [access, setAccess] = useState<Access>(row?.access ?? ROLE_ACCESS.USER);
  const [pw, setPw] = useState("");
  return (
    <Modal title={row ? `Edit ${row.name}` : "Add user"} size="lg" onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" form="user-form" className="btn btn-primary" disabled={pending}><Save size={16} aria-hidden /> Save</button>
    </>}>
      <form id="user-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(() => saveUser(row?.id ?? null, { ...v, access }, pw), { onOk: onClose }); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input className="input" value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} required maxLength={100} /></Field>
          <Field label="Email" required><input type="email" className="input" value={v.email} onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))} required /></Field>
          <Field label="Role" required help="Choosing a role fills its menus; change any of them below.">
            <select className="select" value={v.role} onChange={(e) => { const r = e.target.value as Role; setV((s) => ({ ...s, role: r })); setAccess(ROLE_ACCESS[r]); }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Own workshop" help="A supervisor records and requests for this workshop only.">
            <select className="select" value={v.workshopId} onChange={(e) => setV((s) => ({ ...s, workshopId: e.target.value }))}>
              <option value="">— (all workshops)</option>
              {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Position"><input className="input" value={v.position} onChange={(e) => setV((s) => ({ ...s, position: e.target.value }))} maxLength={100} /></Field>
          <Field label="Department"><input className="input" value={v.department} onChange={(e) => setV((s) => ({ ...s, department: e.target.value }))} maxLength={100} /></Field>
          <Field label={row ? "New password" : "Password"} required={!row} help={row ? "Leave empty to keep the current one. A new one signs the user out." : "At least 8 characters."}>
            <div className="relative"><KeyRound size={15} className="absolute muted" style={{ insetInlineStart: 10, top: 9 }} aria-hidden /><input type="password" autoComplete="new-password" className="input" style={{ paddingInlineStart: 32 }} value={pw} onChange={(e) => setPw(e.target.value)} required={!row} minLength={row ? undefined : 8} /></div>
          </Field>
          <Field label="Status">
            <span className="check" style={{ height: 34 }}><input type="checkbox" checked={v.active} disabled={isSelf} onChange={(e) => setV((s) => ({ ...s, active: e.target.checked }))} />{v.active ? "Active" : "Inactive — cannot sign in"}</span>
          </Field>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>Menus</div>
          <div className="table-frame free">
            <table className="dt">
              <thead><tr><th>Module</th>{(["", "V", "E", "F"] as const).map((l) => <th key={l} style={{ textAlign: "center" }}>{l ? LEVEL_LABEL[l] : "No access"}</th>)}</tr></thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m}>
                    <td>{MODULE_LABEL[m]}</td>
                    {(["", "V", "E", "F"] as const).map((l) => (
                      <td key={l} style={{ textAlign: "center" }}>
                        <input type="radio" name={`acc-${m}`} aria-label={`${MODULE_LABEL[m]}: ${l ? LEVEL_LABEL[l] : "no access"}`} checked={(access[m] ?? "") === l} disabled={isSelf && m === "settings"} onChange={() => setAccess((a) => { const n = { ...a }; if (l) n[m] = l as Level; else delete n[m]; return n; })} style={{ accentColor: "var(--brand-fill)", width: 16, height: 16 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>View = see only · Enter &amp; edit = create and change records · Full = also approve, cancel and delete.</p>
        </div>
      </form>
    </Modal>
  );
}

export function GeneralForm({ s }: { s: AppSettings }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const [v, setV] = useState({ ...s });
  function pickLogo(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.err("Choose an image file.");
    if (f.size > 1024 * 1024) return toast.err("The logo must be 1 MB or less.");
    const rd = new FileReader();
    rd.onload = () => setV((x) => ({ ...x, companyLogo: String(rd.result) }));
    rd.readAsDataURL(f);
  }
  return (
    <form className="card" style={{ maxWidth: 820 }} onSubmit={(e) => { e.preventDefault(); run(() => saveGeneral(v)); }}>
      <div className="card-head"><h2 className="card-title">Company profile</h2></div>
      <div className="card-pad grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required><input className="input" value={v.companyName} onChange={(e) => setV((x) => ({ ...x, companyName: e.target.value }))} required maxLength={100} /></Field>
        <Field label="Company email"><input type="email" className="input" value={v.companyEmail} onChange={(e) => setV((x) => ({ ...x, companyEmail: e.target.value }))} /></Field>
        <div className="sm:col-span-2 flex items-center gap-4">
          <div className="grid place-items-center" style={{ width: 96, height: 96, borderRadius: 12, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.companyLogo ? <img src={v.companyLogo} alt="Company logo" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span className="side-mark" aria-hidden>LB</span>}
          </div>
          <div className="flex flex-col gap-2">
            <span className="field-label">Company logo</span>
            <span className="muted" style={{ fontSize: 12 }}>256×256 px, up to 1 MB. Printed on reports.</span>
            <div className="flex gap-2">
              <input id="logo-up" type="file" accept="image/*" className="sr-only" onChange={(e) => pickLogo(e.target.files?.[0])} />
              <label htmlFor="logo-up" className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}><UploadCloud size={15} aria-hidden /> Choose image</label>
              {v.companyLogo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV((x) => ({ ...x, companyLogo: "" }))}>Remove</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}><h2 className="card-title">Plant settings</h2></div>
      <div className="card-pad grid gap-4 sm:grid-cols-3">
        <Field label="Raw material allowance (%)" help="Added to the casting weight for gates, risers and machining (doc: 15%)."><input type="number" min={0} max={100} step="any" className="input" value={v.rawAllowancePct} onChange={(e) => setV((x) => ({ ...x, rawAllowancePct: Number(e.target.value) }))} /></Field>
        <Field label="Default density (g/cm³)" help="Used only when a material has no density of its own."><input type="number" min={0.5} max={25} step="any" className="input" value={v.defaultDensity} onChange={(e) => setV((x) => ({ ...x, defaultDensity: Number(e.target.value) }))} /></Field>
        <Field label="Machine hours a day" help="Both shifts — the base of machine utilization and capacity."><input type="number" min={1} max={24} step="any" className="input" value={v.machineHoursPerDay} onChange={(e) => setV((x) => ({ ...x, machineHoursPerDay: Number(e.target.value) }))} /></Field>
        <div className="sm:col-span-3"><Notice tone="info">A new allowance or density applies to orders saved from now on; saved orders keep the weights they were planned on until they are edited.</Notice></div>
      </div>
      <div className="modal-foot" style={{ borderRadius: "0 0 var(--r-md) var(--r-md)" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}><Save size={16} aria-hidden /> Save settings</button>
      </div>
    </form>
  );
}

export interface AuditRow { id: number; at: string; userName: string; action: string; entity: string; entityId: string | null; summary: string; before: unknown; after: unknown }

export function AuditView({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<AuditRow | null>(null);
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        exportName="Change history"
        searchPlaceholder="Search who, what…"
        empty={{ title: "No changes in this period" }}
        columns={[
          { key: "at", label: "When", render: (r) => fmtInstant(r.at), value: (r) => r.at.slice(0, 19).replace("T", " "), className: "nowrap" },
          { key: "userName", label: "Who" },
          { key: "action", label: "Action", render: (r) => <Badge plain tone={r.action === "delete" || r.action === "reject" ? "bad" : r.action === "create" || r.action === "approve" || r.action === "issue" ? "ok" : "neutral"}>{r.action}</Badge> },
          { key: "entity", label: "Record", value: (r) => `${r.entity}${r.entityId ? ` #${r.entityId}` : ""}` },
          { key: "summary", label: "What", className: "wrap" },
          { key: "_d", label: "", noExport: true, sortable: false, render: (r) => (r.before || r.after ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(r)}>Details</button> : null) },
        ]}
      />
      {open && (
        <Modal title={open.summary} size="lg" onClose={() => setOpen(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            {(["before", "after"] as const).map((k) => (
              <div key={k}>
                <div className="field-label" style={{ marginBottom: 4 }}>{k}</div>
                <pre style={{ margin: 0, padding: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{open[k] ? JSON.stringify(open[k], null, 2) : "—"}</pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
