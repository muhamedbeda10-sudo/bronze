# Reporting

Each report over a period (default the last 30 days), with its summary figures, Excel export and PDF (print). Formulas in `lib/domain/reports.ts` (tested).
- **Work Order Status** — every open order (and those of the period): stage, workshop, status, priority, due, delay.
- **Production Efficiency** — per order logged in the period: planned hours (standard minutes of the stages passed) vs actual hours logged, efficiency %, produced, scrap, yield %.
- **Machine Utilization** — per machine: available hours (active machines × days × machine hours a day), uptime on orders, setup/maintenance, idle, utilization %.
- **Material Consumption** — per material: raw req. of new orders, metal issued, finished weight of completed orders, scrap weight (estimated from unit weights), metal yield %.
- **Scrap Analysis** — pieces scrapped or rejected by reason, material, process and where found.
- **Delivery Performance** — completed orders: lead time, on time (completed on or before the due date), delay; on-time delivery %.
