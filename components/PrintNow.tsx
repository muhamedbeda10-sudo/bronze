"use client";

import { Printer } from "lucide-react";

/** A print bar over a printable page (hidden on paper). */
export function PrintNow({ count }: { count: number }) {
  return (
    <div className="no-print flex items-center gap-3" style={{ position: "sticky", top: 0, zIndex: 5, padding: "10px 16px", background: "var(--bar-bg)", color: "#fff" }}>
      <b>Production traveler{count > 1 ? `s · ${count}` : ""}</b>
      <span style={{ opacity: 0.7, fontSize: 13 }}>One A4 page per order line</span>
      <button type="button" className="btn btn-primary btn-sm" style={{ marginInlineStart: "auto" }} onClick={() => window.print()}><Printer size={15} aria-hidden /> Print</button>
    </div>
  );
}
