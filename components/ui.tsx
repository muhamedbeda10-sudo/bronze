import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { PRIORITY_LABEL, PRIORITY_TONE, statusLabel, STATUS_TONE, isWoStatus, type Tone } from "@/lib/domain/status";

// The small pieces every screen is built from — one look for each.

type Icon = ComponentType<LucideProps>;

export function Badge({ tone = "neutral", children, plain = false, title }: { tone?: Tone; children: ReactNode; plain?: boolean; title?: string }) {
  return <span title={title} className={`badge tone-${tone} ${plain ? "badge-plain" : ""}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={isWoStatus(status) ? STATUS_TONE[status] : "neutral"}>{statusLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: number }) {
  return <Badge plain tone={PRIORITY_TONE[priority] ?? "neutral"}>{priority} – {PRIORITY_LABEL[priority] ?? "Normal"}</Badge>;
}

export function EmptyState({ icon: I, title, hint, action }: { icon: Icon; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><I size={22} aria-hidden /></span>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Field({ label, required, help, children, className = "" }: { label: string; required?: boolean; help?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}{required && <span className="req" aria-hidden>*</span>}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

export function Kpi({ label, value, unit, sub, tone, icon: I }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: "bad" | "warn" | "ok" | "info"; icon?: Icon }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ""}`}>
      <div className="kpi-label">{I && <I size={13} aria-hidden />}{label}</div>
      <div className="kpi-value">{value}{unit && <span className="kpi-unit">{unit}</span>}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Card({ title, actions, children, pad = true, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title ? <h2 className="card-title">{title}</h2> : <span />}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? "card-pad" : ""}>{children}</div>
    </section>
  );
}

const NOTICE_ICON: Record<string, Icon> = { bad: XCircle, warn: AlertTriangle, ok: CheckCircle2, info: Info };

export function Notice({ tone = "info", children }: { tone?: "bad" | "warn" | "ok" | "info"; children: ReactNode }) {
  const I = NOTICE_ICON[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`notice tone-${tone}`}>
      <I size={16} aria-hidden style={{ flex: "none", marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

export function Meter({ pct, label }: { pct: number | null; label: string }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** The page's heading for screen readers and print; the top bar names the place on screen. */
export function PrintHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="print-only" style={{ marginBottom: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Lotfy Bronze — {title}</h1>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 12 }}>{sub}</p>}
    </div>
  );
}
