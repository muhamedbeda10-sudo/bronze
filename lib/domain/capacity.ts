// The load still ahead of each workshop (Planning → Capacity).
//   load (h)      Σ over open orders, over each non-QC stage from the one it is at:
//                 qty × standard minutes per piece ÷ 60
//   capacity      active machines × hours a machine runs a day
//   days of work  load ÷ capacity
//   5-day use %   load ÷ (capacity × 5), capped at 999

export interface LoadOrder {
  qty: number;
  stageIndex: number | null;
  stages: { seq: number; workshopId: number | null; stdTimeMin: number; qcRequired: boolean }[];
}

export interface WorkshopLoad {
  workshopId: number;
  name: string;
  orders: number;
  loadHours: number;
  machines: number;
  capacityPerDay: number;
  days: number | null;
  weekPct: number | null;
}

export function workshopLoad(orders: LoadOrder[], machines: { workshopId: number }[], workshops: { id: number; name: string }[], hoursPerDay: number): WorkshopLoad[] {
  const load = new Map<number, number>();
  const count = new Map<number, Set<number>>();
  orders.forEach((o, i) => {
    for (const s of o.stages) {
      if (s.qcRequired || s.workshopId === null || s.seq < (o.stageIndex ?? 0)) continue;
      load.set(s.workshopId, (load.get(s.workshopId) ?? 0) + (o.qty * s.stdTimeMin) / 60);
      count.set(s.workshopId, (count.get(s.workshopId) ?? new Set()).add(i));
    }
  });
  return workshops.map((w) => {
    const n = machines.filter((m) => m.workshopId === w.id).length;
    const cap = n * hoursPerDay;
    const h = Math.round((load.get(w.id) ?? 0) * 10) / 10;
    return {
      workshopId: w.id,
      name: w.name,
      orders: count.get(w.id)?.size ?? 0,
      loadHours: h,
      machines: n,
      capacityPerDay: cap,
      days: cap > 0 ? Math.round((h / cap) * 10) / 10 : null,
      weekPct: cap > 0 ? Math.min(999, Math.round((h / (cap * 5)) * 1000) / 10) : null,
    };
  });
}
