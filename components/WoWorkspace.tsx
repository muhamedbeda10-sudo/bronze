"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChartGantt, Check, ChevronDown, Filter, Kanban, Layers, List, Plus, Printer, Search, Star, Trash2, X } from "lucide-react";
import { CpanelActions } from "@/components/Cpanel";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, Field, PriorityBadge, StatusBadge } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { useToast } from "@/components/Toast";
import { WoGantt } from "@/components/WoGantt";
import { fmtDay } from "@/lib/domain/dates";
import { PRIORITY_LABEL, statusLabel } from "@/lib/domain/status";
import { ACTION_LABEL } from "@/lib/domain/routing";
import { applyFilters, columnOf, DONE, FILTERS, GROUPS, isFilter, isGroup, kanbanColumns, kanbanMove, NOT_RELEASED, type FilterKey, type GroupKey } from "@/lib/domain/woViews";
import { fmtNum } from "@/lib/format";
import { deleteView, saveView } from "@/app/(app)/work-orders/actions";
import { stageAction } from "@/app/(app)/planning/actions";
import type { WoRow } from "@/lib/server/woQueries";

export type View = "list" | "kanban" | "gantt";
export interface SavedViewRow { id: number; name: string; query: string; isDefault: boolean }

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const c = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", c);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", c); document.removeEventListener("keydown", k); };
  }, [open]);
  return { open, setOpen, ref };
}

function Drop({ label, icon, children, active }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; active?: boolean }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className={`btn btn-ghost btn-sm ${active ? "ink" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{icon}{label}<ChevronDown size={13} aria-hidden /></button>
      {open && <div className="dropdown" style={{ top: 34, insetInlineStart: 0 }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function WoWorkspace({ rows, routes, canMove, canEdit, saved, dueBy }: { rows: WoRow[]; routes: string[][]; canMove: boolean; canEdit: boolean; saved: SavedViewRow[]; dueBy: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const view: View = (["list", "kanban", "gantt"] as const).find((v) => v === sp.get("view")) ?? "list";
  const filters = (sp.get("f") ?? "open").split(",").filter(isFilter);
  const groupParam = sp.get("g") ?? "";
  const group: GroupKey | null = isGroup(groupParam) ? groupParam : null;
  const [text, setText] = useState(sp.get("q") ?? "");
  const [saveOpen, setSaveOpen] = useState(false);
  const { run, pending } = useAction();

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") n.delete(k); else n.set(k, v); }
    router.replace(`${pathname}${n.size ? `?${n}` : ""}`, { scroll: false });
  }, [sp, router, pathname]);

  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== text) setParams({ q: text || null }); }, 250);
    return () => clearTimeout(t);
  }, [text, sp, setParams]);

  const toggleFilter = (k: FilterKey) => {
    const next = filters.includes(k) ? filters.filter((x) => x !== k) : [...filters, k];
    setParams({ f: next.length ? next.join(",") : "none" });
  };
  const shown = useMemo(() => applyFilters(rows, filters, sp.get("q") ?? "", dueBy), [rows, filters, sp, dueBy]);

  const columns: Column<WoRow>[] = [
    { key: "code", label: "Reference", render: (r) => <Link href={`/work-orders/${r.id}`} className="link">{r.code}</Link>, value: (r) => r.code },
    { key: "woDate", label: "WO date", render: (r) => fmtDay(r.woDate), className: "nowrap" },
    { key: "product", label: "Product" },
    { key: "material", label: "Material" },
    { key: "dims", label: "Dimensions", className: "nowrap" },
    { key: "qty", label: "Qty", num: true, sum: true },
    { key: "process", label: "Process" },
    { key: "stage", label: "Stage", render: (r) => r.stage ?? <span className="muted">Not released</span> },
    { key: "workshop", label: "Workshop", render: (r) => r.workshop ?? <span className="muted">—</span> },
    { key: "priority", label: "Priority", value: (r) => `${r.priority} – ${PRIORITY_LABEL[r.priority]}`, render: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "dueDate", label: "Due", render: (r) => <span style={{ color: r.late ? "var(--bad-fg)" : undefined, fontWeight: r.late ? 600 : undefined }}>{fmtDay(r.dueDate) || "—"}</span>, className: "nowrap", value: (r) => r.dueDate },
    { key: "delayDays", label: "Delay", num: true, render: (r) => (r.delayDays ? <b style={{ color: "var(--bad-fg)" }}>{r.delayDays} d</b> : <span className="muted">—</span>) },
    { key: "rawReqKg", label: "Raw req. kg", num: true, sum: true, render: (r) => fmtNum(r.rawReqKg, 1) },
    { key: "status", label: "Status", value: (r) => statusLabel(r.status), render: (r) => <StatusBadge status={r.status} /> },
    { key: "fullName", label: "Full name", exportOnly: true },
  ];

  const facets: { k: string; v: string; clear: () => void }[] = [
    ...(filters.length ? [{ k: "Filter", v: filters.map((f) => FILTERS[f].label).join(" or "), clear: () => setParams({ f: "none" }) }] : []),
    ...(group ? [{ k: "Group", v: GROUPS[group].label, clear: () => setParams({ g: null }) }] : []),
  ];

  const printTravelers = (sel: WoRow[]) => window.open(`/print/traveler?ids=${sel.map((r) => r.id).join(",")}`, "_blank");

  return (
    <>
      <CpanelActions>
        <div className="btn-group" role="group" aria-label="View">
          {([["list", List, "List"], ["kanban", Kanban, "Kanban"], ["gantt", ChartGantt, "Gantt"]] as const).map(([v, I, l]) => (
            <button key={v} type="button" className={`btn btn-secondary btn-sm ${view === v ? "on" : ""}`} aria-pressed={view === v} title={l} onClick={() => setParams({ view: v === "list" ? null : v })}><I size={15} aria-hidden /><span className="hidden md:inline">{l}</span></button>
          ))}
        </div>
        {canEdit && <Link href="/work-orders/new" className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> New</Link>}
      </CpanelActions>

      <div className="flex flex-wrap items-center gap-2 no-print" style={{ marginBottom: 12 }}>
        <div className="searchbox">
          <Search size={15} className="muted" aria-hidden style={{ marginInlineStart: 2 }} />
          {facets.map((f) => (
            <span key={f.k} className="facet"><span className="facet-k">{f.k}</span><span className="facet-v">{f.v}</span><button type="button" aria-label={`Remove ${f.k}`} onClick={f.clear}><X size={12} /></button></span>
          ))}
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search reference, product, material, stage…" aria-label="Search work orders" />
        </div>
        <Drop label="Filters" icon={<Filter size={14} aria-hidden />} active={filters.length > 0}>
          {() => (
            <>
              {(Object.keys(FILTERS) as FilterKey[]).map((k, i) => (
                <div key={k}>
                  {(i === 3 || i === 5) && <div className="dropdown-sep" />}
                  <button type="button" className={`dropdown-item ${filters.includes(k) ? "on" : ""}`} onClick={() => toggleFilter(k)}>
                    <span style={{ width: 14 }}>{filters.includes(k) && <Check size={14} aria-hidden />}</span>{FILTERS[k].label}
                  </button>
                </div>
              ))}
            </>
          )}
        </Drop>
        <Drop label="Group by" icon={<Layers size={14} aria-hidden />} active={!!group}>
          {(close) => (
            <>
              {(Object.keys(GROUPS) as GroupKey[]).map((k) => (
                <button key={k} type="button" className={`dropdown-item ${group === k ? "on" : ""}`} onClick={() => { setParams({ g: group === k ? null : k }); close(); }}>
                  <span style={{ width: 14 }}>{group === k && <Check size={14} aria-hidden />}</span>{GROUPS[k].label}
                </button>
              ))}
            </>
          )}
        </Drop>
        <Drop label="Favorites" icon={<Star size={14} aria-hidden />}>
          {(close) => (
            <>
              {saved.map((s) => (
                <div key={s.id} className="flex items-center">
                  <button type="button" className="dropdown-item" onClick={() => { router.replace(`${pathname}?${s.query}`); setText(new URLSearchParams(s.query).get("q") ?? ""); close(); }}>
                    <Star size={14} className="di-icon" aria-hidden fill={s.isDefault ? "currentColor" : "none"} />{s.name}
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => run(() => deleteView(s.id))}><Trash2 size={14} /></button>
                </div>
              ))}
              {saved.length > 0 && <div className="dropdown-sep" />}
              <button type="button" className="dropdown-item" onClick={() => { close(); setSaveOpen(true); }}><Plus size={14} className="di-icon" aria-hidden />Save current search</button>
            </>
          )}
        </Drop>
        <span className="muted" style={{ marginInlineStart: "auto", fontSize: 12 }}>{shown.length} of {rows.length}</span>
      </div>

      {view === "list" && (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          searchable={false}
          exportName="Work orders"
          rowClass={(r) => (r.late ? "late" : "")}
          rowHref={(r) => `/work-orders/${r.id}`}
          selectable
          groupBy={group ? { label: GROUPS[group].label, key: GROUPS[group].key } : null}
          bulkActions={(sel) => <button type="button" className="btn btn-secondary btn-sm" onClick={() => printTravelers(sel)}><Printer size={14} aria-hidden /> Print travelers</button>}
          empty={{ title: "No work order matches", hint: "Change the filters or the search." }}
        />
      )}
      {view === "kanban" && <WoKanban rows={shown} routes={routes} canMove={canMove} />}
      {view === "gantt" && <WoGantt rows={shown} canEdit={canEdit} />}

      {saveOpen && <SaveViewDialog query={sp.toString()} pending={pending} onSave={(name, def) => run(() => saveView("work-orders", name, sp.toString(), def), { onOk: () => setSaveOpen(false) })} onClose={() => setSaveOpen(false)} />}
    </>
  );
}

function SaveViewDialog({ query, pending, onSave, onClose }: { query: string; pending: boolean; onSave: (name: string, def: boolean) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [def, setDef] = useState(false);
  return (
    <Modal title="Save current search" size="sm" onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={pending || !name.trim()} onClick={() => onSave(name, def)}>Save</button>
    </>}>
      <div className="flex flex-col gap-3">
        <Field label="Name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Late urgent bushings" /></Field>
        <label className="check"><input type="checkbox" checked={def} onChange={(e) => setDef(e.target.checked)} /> Open Work Orders with it by default</label>
        <p className="muted" style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>{query ? `Keeps: ${decodeURIComponent(query)}` : "Keeps the default list."}</p>
      </div>
    </Modal>
  );
}

/** The board: a column per stage; a card moves one step along its own route. */
function WoKanban({ rows, routes, canMove }: { rows: WoRow[]; routes: string[][]; canMove: boolean }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const [drag, setDrag] = useState<WoRow | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const cols = useMemo(() => {
    const all = kanbanColumns(routes);
    const used = new Set(rows.map(columnOf));
    // keep the stage columns of the routes on screen; Not released and Completed only when they hold cards
    return all.filter((c) => (c === NOT_RELEASED || c === DONE ? used.has(c) : true));
  }, [routes, rows]);
  const byCol = useMemo(() => {
    const m = new Map<string, WoRow[]>();
    for (const r of rows) m.set(columnOf(r), [...(m.get(columnOf(r)) ?? []), r]);
    for (const list of m.values()) list.sort((a, b) => b.priority - a.priority || (a.dueDate || "9").localeCompare(b.dueDate || "9"));
    return m;
  }, [rows]);

  function drop(r: WoRow, col: string) {
    setDrag(null);
    setOver(null);
    if (!canMove) return toast.err("Moving orders needs full Planning access.");
    const m = kanbanMove(r, col);
    if (!m.ok) { if (m.reason) toast.warn(m.reason); return; }
    run(() => stageAction(r.id, r.version, m.action, null));
  }

  return (
    <div className="kanban" aria-busy={pending}>
      {cols.map((c) => {
        const list = byCol.get(c) ?? [];
        const verdict = drag ? kanbanMove(drag, c) : null;
        const qty = list.reduce((s, r) => s + r.qty, 0);
        const late = list.filter((r) => r.late).length;
        return (
          <section
            key={c}
            className={`kcol ${drag && verdict?.ok ? "drop-ok" : ""} ${drag && !verdict?.ok && columnOf(drag) !== c ? "drop-no" : ""}`}
            onDragOver={(e) => { if (drag) { e.preventDefault(); if (verdict?.ok) setOver(c); } }}
            onDragLeave={() => over === c && setOver(null)}
            onDrop={(e) => { e.preventDefault(); if (drag) drop(drag, c); }}
            aria-label={`${c}: ${list.length} orders`}
          >
            <header className="kcol-head"><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span><span className="n">{list.length} · {fmtNum(qty, 0)} pcs</span></header>
            <div className="kcol-bar" aria-hidden title={`${late} late`}>
              {list.length > 0 && <><span style={{ width: `${(late / list.length) * 100}%`, background: "var(--bad-fg)" }} /><span style={{ flex: 1, background: "var(--ok-fg)", opacity: 0.6 }} /></>}
            </div>
            <div className="kcol-list">
              {list.map((r) => {
                const nextCol = r.stageIndex === null ? r.stages[0]?.name : r.stageIndex + 1 < r.stages.length ? r.stages[r.stageIndex + 1]!.name : DONE;
                const step = canMove && nextCol ? kanbanMove(r, nextCol) : null;
                return (
                  <article
                    key={r.id}
                    className={`kcard p${r.priority} ${drag?.id === r.id ? "dragging" : ""}`}
                    draggable={canMove && r.status !== "COMPLETED"}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(r.id)); e.dataTransfer.effectAllowed = "move"; setDrag(r); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/work-orders/${r.id}`} className="link" style={{ fontWeight: 600 }}>{r.code}</Link>
                      {r.status !== "IN_PRODUCTION" && r.status !== "PLANNED" && <StatusBadge status={r.status} />}
                    </div>
                    <div style={{ fontSize: 12, margin: "3px 0 6px" }}>{r.product} · {r.material}{r.dims ? ` · ${r.dims}` : ""}</div>
                    <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
                      <span className="muted">Qty <b style={{ color: "var(--foreground)" }}>{r.qty}</b></span>
                      <span className="muted">Due <b style={{ color: r.late ? "var(--bad-fg)" : "var(--foreground)" }}>{fmtDay(r.dueDate).slice(0, 6) || "—"}</b></span>
                      {r.stageState === "IN_PROGRESS" && <Badge plain tone="info">started</Badge>}
                      {step?.ok && (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ marginInlineStart: "auto", height: 24, padding: "0 6px" }} disabled={pending} title={`${ACTION_LABEL[step.action]} → ${nextCol}`} aria-label={`${ACTION_LABEL[step.action]} ${r.code}`} onClick={() => run(() => stageAction(r.id, r.version, step.action, null))}>
                          <ArrowRight size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {!list.length && <p className="muted" style={{ textAlign: "center", fontSize: 12, margin: "10px 0" }}>{drag && verdict?.ok ? "Drop here" : "Empty"}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
