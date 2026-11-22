// The figures behind the reports (System Documentation §11), kept pure so
// they can be checked by hand and by test.

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
export const pctOf = (a: number, b: number): number | null => (b > 0 ? r1((a / b) * 100) : null);

/** Planned hours of the stages an order has passed (or all of them once complete). */
export function plannedHours(qty: number, stages: { seq: number; stdTimeMin: number; qcRequired: boolean }[], stageIndex: number | null, completed: boolean): number {
  const upto = completed ? Infinity : (stageIndex ?? -1);
  return r2(stages.filter((s) => !s.qcRequired && s.seq < upto).reduce((sum, s) => sum + (qty * s.stdTimeMin) / 60, 0));
}

export interface EfficiencyLine {
  plannedHrs: number;
  actualHrs: number;
  efficiencyPct: number | null;
  produced: number;
  scrap: number;
  yieldPct: number | null;
}

/** Efficiency = planned ÷ actual hours; yield = good ÷ (good + scrap). */
export function efficiency(plannedHrs: number, actualHrs: number, produced: number, scrap: number): EfficiencyLine {
  return { plannedHrs: r2(plannedHrs), actualHrs: r2(actualHrs), efficiencyPct: pctOf(plannedHrs, actualHrs), produced, scrap, yieldPct: pctOf(produced, produced + scrap) };
}

export interface MachineUse {
  availableHrs: number;
  orderHrs: number;
  setupHrs: number;
  idleHrs: number;
  utilizationPct: number | null;
}

/** A machine's period: available = days × hours a day (active machines only); idle is what is left. */
export function machineUse(active: boolean, days: number, hoursPerDay: number, orderHrs: number, setupHrs: number): MachineUse {
  const available = active ? days * hoursPerDay : 0;
  return { availableHrs: available, orderHrs: r2(orderHrs), setupHrs: r2(setupHrs), idleHrs: r2(Math.max(0, available - orderHrs - setupHrs)), utilizationPct: pctOf(orderHrs, available) };
}

export interface Delivery {
  leadDays: number;
  onTime: boolean | null;
  delayDays: number;
}

/** Lead time from WO date to completion; on time when completed on or before the due date. */
export function delivery(woDate: Date, completed: Date, due: Date | null): Delivery {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const lead = Math.round((day(completed) - day(woDate)) / 86_400_000);
  if (!due) return { leadDays: lead, onTime: null, delayDays: 0 };
  const late = Math.round((day(completed) - day(due)) / 86_400_000);
  return { leadDays: lead, onTime: late <= 0, delayDays: Math.max(0, late) };
}
