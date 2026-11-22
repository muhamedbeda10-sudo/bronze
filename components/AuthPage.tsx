import type { ReactNode } from "react";

/** The sign-in screens: the brand on the left (wide screens), the form on the right. */
export function AuthPage({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center gap-3">
            <span className="side-mark" aria-hidden style={{ width: 44, height: 44, fontSize: 22 }}>LB</span>
            <span className="side-word"><b style={{ fontSize: 22 }}>LOTFY BRONZE</b><span>since 1960</span></span>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 520 }}>
          <div className="tag">CastFlow MES</div>
          <h2 className="display" style={{ marginTop: 14 }}>Quality From Experience</h2>
          <p style={{ marginTop: 16, color: "#c9ccd9", fontSize: 15, lineHeight: 1.6 }}>
            Every casting order from entry to finished-goods stock — pattern, molding, melting &amp; pouring, fettling, machining and inspection, in one place.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, color: "#8d92ab", fontSize: 12 }}>Bronze bearings · Propellers · Impellers · Bronze bars</div>
      </div>
      <div className="grid place-items-center" style={{ padding: "40px 20px" }}>
        <div className="login-card">
          <div className="lg:hidden flex items-center gap-3" style={{ marginBottom: 28 }}>
            <span className="side-mark" aria-hidden>LB</span>
            <span className="display" style={{ fontSize: 22, color: "var(--brand-ink)", letterSpacing: "0.06em" }}>LOTFY BRONZE</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>{title}</h1>
          <p className="muted" style={{ margin: "6px 0 24px" }}>{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
