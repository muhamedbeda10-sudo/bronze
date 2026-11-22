import { Check, ChevronRight } from "lucide-react";

/** An order's route as numbered stages: done, the one it is at, the ones ahead. */
export function RouteSteps({ stages, stageIndex, status, compact = false }: { stages: { name: string; qc: boolean }[]; stageIndex: number | null; status: string; compact?: boolean }) {
  const doneAll = status === "COMPLETED";
  return (
    <ol className="route" aria-label="Route" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {stages.map((s, i) => {
        const done = doneAll || (stageIndex !== null && i < stageIndex);
        const now = !doneAll && stageIndex === i;
        return (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="route-sep" aria-hidden />}
            <span className={`route-step ${done ? "done" : ""} ${now ? "now" : ""} ${s.qc ? "qc" : ""}`} title={`${s.name}${s.qc ? " (quality stage)" : ""}${now ? " — current" : done ? " — done" : ""}`} aria-current={now ? "step" : undefined}>
              <span className="no">{done ? <Check size={11} aria-hidden /> : i + 1}</span>
              {(!compact || now) && s.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
