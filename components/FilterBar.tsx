"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export type FilterDef =
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; all?: string };

/** One row of filters over a page, kept in the address so a link shares the view. */
export function FilterBar({ filters, defaults = {}, end }: { filters: FilterDef[]; defaults?: Record<string, string>; end?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const value = (k: string) => sp.get(k) ?? defaults[k] ?? "";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v && v !== defaults[k]) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const dirty = filters.some((f) => sp.has(f.key));
  return (
    <div className="toolbar no-print" style={{ marginBottom: 16 }}>
      {filters.map((f) => (
        <label key={f.key} className="field" style={{ minWidth: f.type === "date" ? 150 : 180 }}>
          <span className="field-label">{f.label}</span>
          {f.type === "date" ? (
            <input type="date" className="input" value={value(f.key)} onChange={(e) => set(f.key, e.target.value)} />
          ) : (
            <select className="select" value={value(f.key)} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">{f.all ?? "All"}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </label>
      ))}
      {dirty && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-end", marginBottom: 3 }} onClick={() => { const next = new URLSearchParams(sp.toString()); filters.forEach((f) => next.delete(f.key)); router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); }}><RotateCcw size={14} aria-hidden /> Reset</button>}
      <div className="grow" />
      {end}
    </div>
  );
}
