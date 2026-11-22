# Work Orders

## The list (Production → Work Orders)
Three views of the same orders (`components/WoWorkspace.tsx`, rules in `lib/domain/woViews.ts`, tested):
- **List**: reference, dates, product, material, dimensions, qty, process, stage, workshop, priority, due, delay, raw req., status. Late rows are marked. Select rows to print their travelers or export them.
- **Kanban**: a column per stage, in the order routes run through them, plus Not released and Completed; each column counts orders and pieces and shows its late share. Drag a card one step along its own route (start, next, back) — full Planning access; any other drop is refused with the reason. A quality stage is left by Quality only. The → on a card does the same without dragging.
- **Gantt**: each order from its planned start to its due date, filled by its progress through the route, late bars red, today's line in bronze, Friday shaded. With edit access, drag a bar to move both dates or its end to move the due date (`rescheduleOrder`, version-checked, audited).
Filters (Open, Late, Due in 7 days, Urgent/high, Not released, On the floor, Under inspection, On hold/waiting, Completed, Cancelled — status filters widen each other, the rest narrow), Group by (status, stage, workshop, process, material, product, priority), search, and **Favorites**: the current search saved under a name, one of them the default the list opens with. All of it lives in the address, so a link shares the view.
The list holds open orders and those closed in the last six months; Work Order History has every order.

## Create
WO date, Work Order No, one card per line (Add Line, Duplicate, Remove). A two-line order 14444 becomes 14444-1 and 14444-2. The dimensions follow the product's format; the weights are worked out as you type and on save (`lib/domain/weight.ts`): volume, unit weight at the material's own density, total, raw material req. (+ the allowance in Settings), mold-based weight. The raw material available is shown and a shortfall warned. Each line keeps its own copy of its route. **Upload Excel** creates many orders, one row per line.

## The record (an order's page)
- Buttons: the stage moves open to the account (Start, Next, Prev, Rework with a reason, More: hold / waiting / resume), Inspect when it waits for QC; Traveler, Edit, Cancel in the control panel.
- The status bar: the route's stages as chevrons, done ✓, the current one in bronze, then Done.
- Fields in three columns: what, when, weights.
- Notebook: **Route & times** (planned hours = qty × standard minutes vs actual hours logged per stage, produced, scrap), **Shop floor** (every activity), **Quality** (every inspection), **Material & stock** (issue requests, FG received).
- **Chatter**: messages (type @ to mention — the person is notified, only if they can open the order), attachments (drawings, PDFs, images, CAD, Office, ZIP; 10 MB each; kept in the database; PDFs and pictures open in the browser, the rest downloads; never HTML or SVG), and the record's history — creation, edits, stage moves, inspections — in one timeline, filtered All / Messages / Files.

## Traveler (print)
`/print/traveler?ids=…`: one A4 per order line — the company, the order, its QR (opens it on the shop-floor kiosk), the key facts, the route with a row per stage for date, operator, good, scrap and signature, heat no. and final inspection. From an order's page, or for every selected row of the list.

Two people changing one order at once: the second is refused and their page refreshed.
