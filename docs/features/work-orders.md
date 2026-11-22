# Work Orders

**Create:** WO date, Work Order No, one card per line (Add Line, Duplicate, Remove). A two-line order 14444 becomes 14444-1 and 14444-2 (1/2, 2/2).
The dimensions follow the product's format (OD × ID × L, W × L × H for plates, diameter for impellers).
The weights are worked out as you type and again on save (`lib/domain/weight.ts`): volume, unit weight at the material's own density, total, raw material req. (+ the allowance in Settings, 15% by default), mold-based weight. With no formula (impeller, custom) the mold-based weight is the planned one.
The line shows the raw material available and warns when it does not cover the requirement (the order can still be saved).
On save each line gets its own copy of its process's route; editing the route later does not move orders already on the floor.
**Upload Excel:** many orders at once, one row per line, grouped by Work Order No — all or nothing.
**Open Work Orders:** filter All open / Planned / In Production / Completed / Cancelled; late rows are tinted. Export, PDF.
**History:** start, due, ATP, delivery and completion dates, expected vs actual weight, quality status, final process, current stage, No. of days and Delay days.
**An order's page:** its route, weights and dates, stage history, inspections and workshop activity. Edit (enter & edit access; the process is fixed once production started), Cancel with a reason (full access).
Two people changing one order at once: the second is refused and their page refreshed.
