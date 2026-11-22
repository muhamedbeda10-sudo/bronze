# Quality Control

**Pending Inspection:** every order with pieces waiting at a quality stage — part of an order can wait here while the rest is still being made — urgent first, with how many wait and since when.
Decisions (full quality access) act on those pieces ([pieces flow](pieces-flow.md)): Pass Stage (the inspected pieces go on to the next stage, or into FG stock; the rejected ones are scrapped), Reject to Last (the rejected pieces go back one stage as rework), Reject to Start (back to the first stage — re-cast); the rest keep waiting.
Each decision records the quantity inspected and rejected; any rejected piece needs its rejection reason, which feeds the scrap analysis and the dashboard.
**Inspection History:** every decision with WO, stage, result, material, quantities, reason and inspector — traceability for customer complaints.
