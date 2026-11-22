# Workshop Execution

**Workshop Record:** context (date, workshop, machine, shift, operator, supervisor), activity (work order — or None for maintenance/setup — priority, task status), times and output (start, end, duration worked out, produced, scrap with its rejection reason when above 0, notes).
A supervisor tied to a workshop records for it alone. One machine cannot hold two overlapping records on the same day and shift. Maintenance produces nothing.
The record keeps the stage the order was at.
**Workshop History:** recent activity as cards, filtered by period, workshop and machine.
**Workshop Logs:** the full table, filtered by period, workshop and status, with totals; Export, PDF; full access can delete a record (kept in the change history).
