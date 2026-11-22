# Master Data

Tabs in setup order: Materials, FG Products, Status Types, Workshops, Manufacturing Processes, Routing Master, Machines, Molds, Operators, Rejection Reasons.
One spec per tab (`lib/domain/master.ts`) drives the table, the add/edit form, the Excel upload and the export, so a value is checked the same way however it arrives.
Every tab: Add New, edit, delete (full access only; refused while orders, stock or logs use the row), Upload (all-or-nothing, the rows to fix named), Export, Template.
An upload updates the row with the same key (code; route + stage no.) and adds the rest; references are given by code (workshop `WS-01`, process `PRC-01`, product name).
Codes are unique and upper-cased; names are trimmed of stray separators.
Status Types are fixed in code — the stage logic and the KPIs depend on them.
A route is the stages sharing a Route ID in Stage no. order; the last one ends it. QC required marks a quality stage.
