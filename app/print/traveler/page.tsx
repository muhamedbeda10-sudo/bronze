import type { Metadata } from "next";
import QRCode from "qrcode";
import { PrintNow } from "@/components/PrintNow";
import { pageUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { appOrigin } from "@/lib/server/origin";
import { prisma } from "@/lib/db";
import { fmtDay } from "@/lib/domain/dates";
import { dimensionText } from "@/lib/domain/weight";
import { PRIORITY_LABEL } from "@/lib/domain/status";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Production Traveler" };

/**
 * The paper that travels with the castings: one A4 per order line, its QR
 * opens the order on the shop-floor kiosk, its route has a row per stage
 * for the date, operator, good and scrap and a signature.
 */
export default async function Traveler({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await pageUser("workOrders");
  const ids = (await searchParams).ids?.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100) ?? [];
  const [orders, settings, origin] = await Promise.all([
    prisma.workOrder.findMany({ where: { id: { in: ids } }, include: { product: true, material: true, process: true, mold: true, stages: { orderBy: { seq: "asc" }, include: { workshop: true } } }, orderBy: [{ woNo: "asc" }, { lineNo: "asc" }] }),
    getSettings(),
    appOrigin(),
  ]);
  const qrs = await Promise.all(orders.map((o) => QRCode.toString(`${origin}/floor/wo/${o.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" })));
  const cell: React.CSSProperties = { border: "1px solid #999", padding: "6px 8px", fontSize: 12, textAlign: "start", verticalAlign: "top" };
  return (
    <div style={{ background: "#fff", color: "#111", minHeight: "100dvh", fontFamily: "var(--font-sans)" }}>
      <PrintNow count={orders.length} />
      {!orders.length && <p style={{ padding: 40 }}>No order to print.</p>}
      {orders.map((o, k) => (
        <section key={o.id} style={{ maxWidth: 800, margin: "0 auto", padding: "28px 28px 18px", breakAfter: k < orders.length - 1 ? "page" : undefined }}>
          <header style={{ display: "flex", alignItems: "flex-start", gap: 16, borderBottom: "3px solid #8a5a43", paddingBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-brand)", fontSize: 22, letterSpacing: "0.08em", color: "#8a5a43" }}>{settings.companyName.toUpperCase()}</div>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#555" }}>Production traveler</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 8, letterSpacing: "-0.01em" }}>{o.woNo}-{o.lineNo}</div>
              <div style={{ fontSize: 14 }}>{o.fullName}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 112, height: 112 }} dangerouslySetInnerHTML={{ __html: qrs[k]! }} />
              <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Scan at the kiosk</div>
            </div>
          </header>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
            <tbody>
              {[
                [["Product", o.product.name], ["Material", `${o.material.code} · ${o.material.name}`], ["Process", o.process.name]],
                [["Dimensions", dimensionText(o.product.dimensionFormat, o) || "—"], ["Quantity", `${o.qty} pcs`], ["Mold", o.mold?.moldNo ?? "—"]],
                [["Priority", `${o.priority} – ${PRIORITY_LABEL[o.priority]}`], ["Start", fmtDay(o.startDate) || "—"], ["Due", fmtDay(o.dueDate) || "—"]],
                [["Unit weight", o.unitWeightKg ? `${fmtNum(o.unitWeightKg, 3)} kg` : "—"], ["Total weight", o.totalWeightKg ? `${fmtNum(o.totalWeightKg, 2)} kg` : "—"], ["Raw material", o.rawReqKg ? `${fmtNum(o.rawReqKg, 2)} kg` : "—"]],
              ].map((row, i) => (
                <tr key={i}>{row.map(([l, v]) => <td key={l} style={{ ...cell, width: "33%" }}><div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div></td>)}</tr>
              ))}
            </tbody>
          </table>
          {(o.dimensionNotes || o.commentNotes) && <p style={{ fontSize: 12, margin: "8px 0 0" }}><b>Notes:</b> {[o.dimensionNotes, o.commentNotes].filter(Boolean).join(" · ")}</p>}
          <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>Route</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["#", "Stage", "Workshop", "Std min/pc", "Date", "Operator", "Good", "Scrap", "Sign"].map((h) => <th key={h} style={{ ...cell, background: "#eee", fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {o.stages.map((s, i) => (
                <tr key={s.id} style={{ height: 38 }}>
                  <td style={cell}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>{s.name}{s.qcRequired ? " (QC)" : ""}</td>
                  <td style={cell}>{s.workshop?.name ?? ""}</td>
                  <td style={cell}>{fmtNum(s.stdTimeMin, 1)}</td>
                  <td style={cell} /><td style={cell} /><td style={cell} /><td style={cell} /><td style={cell} />
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, fontSize: 12 }}>
            <div style={{ borderTop: "1px solid #999", paddingTop: 4 }}>Heat no. / remarks</div>
            <div style={{ borderTop: "1px solid #999", paddingTop: 4 }}>Final inspection — signature</div>
          </div>
          <footer style={{ marginTop: 14, fontSize: 10, color: "#666", display: "flex", justifyContent: "space-between" }}>
            <span>Printed {new Date().toISOString().slice(0, 10)} · WO date {fmtDay(o.woDate)}</span>
            <span>{settings.companyName} · CastFlow MES</span>
          </footer>
        </section>
      ))}
    </div>
  );
}
