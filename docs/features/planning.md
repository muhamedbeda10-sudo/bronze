# Production Planning

**Work Order Execution:** a card per order — its full name, process, current stage and workshop, due date, and its route as numbered stages (done ✓, current in bronze, QC stages dashed).
Filters: workshop, WO no, stage, All / Not Complete / Complete.
Buttons (full planning access): Start Stage, Next Stage, Prev Stage, Rework (with a reason); under More… put on hold, waiting material, waiting technical office, resume.
Next onto a QC stage puts the order Under Inspection — only Quality passes or rejects it. Next past the last stage completes the order and puts its pieces into FG stock.
The rules are `lib/domain/routing.ts` (tested).
**Open Order – Workshop:** released orders grouped by the stage they are at — each supervisor's daily queue.
**Weekly Production Plan:** each order's full routing sequence, material, process, current stage, planned start; filter by week and workshop.
**Capacity:** per workshop, the load still ahead (qty × standard minutes of every non-QC stage from the current one) against active machines × machine hours a day; days of work and the share of the next five days used.
**Planning Notification:** pending overtime to approve or reject (never your own request).
