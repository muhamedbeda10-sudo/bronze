"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Minus, Play, Plus, Save, ScanLine } from "lucide-react";
import { Field, Notice } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { parseScan } from "@/lib/domain/floor";
import { kioskFind, kioskReport, kioskStart } from "@/app/floor/actions";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

/** Scan the traveler's QR with the tablet's camera, or type the order. */
export function KioskScan() {
  const router = useRouter();
  const { run, pending } = useAction();
  const [code, setCode] = useState("");
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && !!window.BarcodeDetector;

  useEffect(() => {
    if (!cam) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new window.BarcodeDetector!({ formats: ["qr_code"] });
        while (!stop) {
          const hits = await det.detect(video.current).catch(() => []);
          const p = hits[0] ? parseScan(hits[0].rawValue) : null;
          if (p && "id" in p) { stop = true; router.push(`/floor/wo/${p.id}`); return; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setErr("The camera could not be opened — allow it in the browser, or type the order below.");
        setCam(false);
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [cam, router]);

  return (
    <section className="card card-pad flex flex-col gap-3">
      <h1 style={{ margin: 0, fontSize: 22 }}>Scan a traveler</h1>
      {supported && (cam ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <video ref={video} playsInline muted style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
          <div aria-hidden style={{ position: "absolute", inset: "15% 25%", border: "3px solid #e0b496", borderRadius: 12 }} />
          <button type="button" className="btn btn-secondary" style={{ position: "absolute", bottom: 10, insetInlineEnd: 10 }} onClick={() => setCam(false)}>Stop</button>
        </div>
      ) : (
        <button type="button" className="kbtn primary" onClick={() => { setErr(null); setCam(true); }}><Camera size={32} aria-hidden /> Scan QR with the camera</button>
      ))}
      {err && <Notice tone="warn">{err}</Notice>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => kioskFind(code), { onOk: (r) => r.data && router.push(`/floor/wo/${r.data}`) }); }}>
        <input className="input kinput" style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="or type: 14444-1" aria-label="Order number" autoCapitalize="characters" inputMode="text" />
        <button type="submit" className="kbtn" style={{ minHeight: 56, padding: "0 20px", flexDirection: "row" }} disabled={pending || !code.trim()}><ScanLine size={22} aria-hidden /> Open</button>
      </form>
    </section>
  );
}

function Stepper({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <Field label={label}>
      <div className="stepper">
        <button type="button" aria-label={`Less ${label}`} onClick={() => set(Math.max(0, value - 1))}><Minus size={22} aria-hidden /></button>
        <input className="input kinput" inputMode="decimal" value={value} onChange={(e) => set(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))} aria-label={label} />
        <button type="button" aria-label={`More ${label}`} onClick={() => set(value + 1)}><Plus size={22} aria-hidden /></button>
      </div>
    </Field>
  );
}

export interface KioskOrderData {
  id: number;
  version: number;
  started: boolean;
  released: boolean;
  canConfirm: boolean;
  reason: string | null;
  qty: number;
  machines: { id: number; name: string }[];
  operators: { id: number; name: string }[];
  reasons: { id: number; name: string }[];
  defaultShift: "DAY" | "NIGHT";
  now: string;
  date: string;
}

/** The big buttons: start the stage; report what was made; finish the stage. */
export function KioskOrder({ d }: { d: KioskOrderData }) {
  const { run, pending } = useAction();
  const [good, setGood] = useState(0);
  const [scrap, setScrap] = useState(0);
  const [v, setV] = useState({ machineId: d.machines[0] ? String(d.machines[0].id) : "", operatorId: "", shift: d.defaultShift, startTime: "", endTime: d.now, rejectionReasonId: "", notes: "" });
  const set = (k: keyof typeof v, x: string) => setV((s) => ({ ...s, [k]: x }));
  const raw = { ...v, date: d.date, qtyProduced: String(good), qtyScrap: String(scrap) };
  const ready = !!v.startTime && !!v.endTime && (scrap === 0 || !!v.rejectionReasonId);

  if (!d.canConfirm) return <Notice tone="info">{d.reason ?? "This stage is not yours to confirm."}</Notice>;
  if (!d.started) {
    return <button type="button" className="kbtn primary" disabled={pending} onClick={() => run(() => kioskStart(d.id, d.version))}><Play size={34} aria-hidden /> Start {d.released ? "the stage" : "production"}</button>;
  }
  return (
    <section className="card card-pad flex flex-col gap-4">
      <h2 style={{ margin: 0, fontSize: 20 }}>Report this stage</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stepper label="Good pieces" value={good} set={setGood} />
        <Stepper label="Scrap pieces" value={scrap} set={setScrap} />
      </div>
      {scrap > 0 && (
        <Field label="Why scrap?" required>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {d.reasons.map((r) => <button key={r.id} type="button" className={`kbtn ${v.rejectionReasonId === String(r.id) ? "primary" : ""}`} style={{ minHeight: 56, fontSize: 15 }} aria-pressed={v.rejectionReasonId === String(r.id)} onClick={() => set("rejectionReasonId", String(r.id))}>{r.name}</button>)}
          </div>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Machine"><select className="select kinput" style={{ fontSize: 16, textAlign: "start" }} value={v.machineId} onChange={(e) => set("machineId", e.target.value)}><option value="">No machine</option>{d.machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Operator"><select className="select kinput" style={{ fontSize: 16, textAlign: "start" }} value={v.operatorId} onChange={(e) => set("operatorId", e.target.value)}><option value="">—</option>{d.operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="From" required><input type="time" className="input kinput" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
        <Field label="To" required><input type="time" className="input kinput" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
      </div>
      <div className="seg" role="group" aria-label="Shift" style={{ alignSelf: "flex-start" }}>
        {(["DAY", "NIGHT"] as const).map((s) => <button key={s} type="button" style={{ height: 44, padding: "0 22px", fontSize: 15 }} className={v.shift === s ? "on" : ""} aria-pressed={v.shift === s} onClick={() => set("shift", s)}>{s === "DAY" ? "Day" : "Night"}</button>)}
      </div>
      <Field label="Notes"><input className="input" style={{ height: 44 }} value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} placeholder="Problems, downtime…" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="kbtn" disabled={pending || !ready} onClick={() => run(() => kioskReport(d.id, d.version, raw, false), { onOk: () => { setGood(0); setScrap(0); } })}><Save size={28} aria-hidden /> Save output</button>
        <button type="button" className="kbtn ok" disabled={pending || !ready} onClick={() => run(() => kioskReport(d.id, d.version, raw, true))}><CheckCircle2 size={28} aria-hidden /> Save &amp; finish stage</button>
      </div>
    </section>
  );
}
