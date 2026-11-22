# Pieces flow — Plan Tracker and Workshop Floor

An order moves by **quantities**, not as one block: part of an order can be in machining while the rest is still being poured.
Each stage records only what it **finished** (good) and what it **lost** (scrap); the pieces go on to the next stage by themselves.

## The ledger
`StageOutput` (one row per record: order, stage, day, good, scrap with its reason, source, who) is the one source of every stage's numbers (`lib/domain/flow.ts`, tested):
- the first stage receives the order's quantity once it is released; every other stage receives what the stage before finished;
- **waiting** at a stage = received − finished − scrapped;
- a record cannot finish more than is waiting, and a correction cannot take back pieces the next stage already used;
- a correction is a row with negative numbers — rows are never edited.

The order's **current stage** (lists, Kanban, Gantt) is the earliest stage with pieces waiting, and its status follows by itself: **Under Inspection** when those pieces wait at a quality stage, **Completed** when nothing waits anywhere (every piece finished the route or was scrapped).
Pieces finishing the last stage go into the order's FG stock row as they finish; a paused, closed or not-released order takes no record.
`lib/server/flow.ts` writes every record in one transaction with the order locked: the row, the FG stock, the inspection of a quality stage, the order's state, the stage move, the change history and the notifications (Quality hears when pieces reach it; Planning when an order completes).

Orders that existed before were given their rows by the migration: every stage before the current one finished the whole quantity.

## Plan Tracker (Manufacturing → Planning → Plan Tracker, `/planning/tracker`)
One table per route — its stages as columns — and one row per open order.
A cell shows finished / received, with what waits there and what was scrapped; the last column is the order's finished pieces against its quantity.
Whoever runs a stage clicks its cell and types the stage's **new total** (and any scrap now, with its reason); the difference is recorded for today.
Search, and All · On the floor · Not released · Late.

## Workshop Floor (Manufacturing → Operations → Workshop Floor, `/workshop/floor`)
Each workshop's own page: the workshops as tabs (a supervisor opens on their own), then every lot of pieces waiting there — order, where it came from and goes next, pieces waiting of the order's quantity, and **how long it has waited** (since the stage before last handed pieces over: fresh, 3 days and more, a week and more).
Each lot takes **Done now** and **Scrap** (with its reason), or **All N done** in one click.
At a quality stage the fields are Passed now / Rejected, for Quality.

## The other ways in
- **Record Activity** and the **kiosk**: produced and scrap move the pieces at the stage of the record's workshop; deleting a record takes them back (refused when a later stage already used them, or the order is closed).
- **Execution Board** buttons: Next finishes every piece waiting at the current stage, Prev sends them back one stage.
- **Quality**: Pass finishes the inspected pieces (the rejected ones as scrap), Reject to Last / Start sends the rejected pieces back to be made again; the rest keep waiting.
- **Overview** (Manufacturing's home) is a card per workshop with the lots waiting there.

## Who records
A quality stage: Quality in full. Any other stage: Planning or Workshop Execution in full — any workshop; Workshop Execution enter & edit — their own workshop only (`canRecordStage` in `lib/domain/floor.ts`, tested).
