# Shop-floor kiosk

`/floor` — full screen, big touch targets, for a tablet at the workshop (Workshop Execution, enter & edit).
- **Scan** the traveler's QR with the tablet's camera (where the browser has a QR reader), or type the order (`14444-1`); or pick from the orders at my workshop.
- **The order**: its stage, quantity, due date, what was made today, its route and notes.
- **Start** the stage, then **report**: good and scrap pieces with steppers, the scrap reason as big buttons, machine, operator, from–to, shift, notes — **Save output** (an activity record — its pieces move on at once) or **Save & finish stage** (the record, then every piece still waiting at that stage is finished too — they wait for inspection, go on, or complete into FG stock). A supervisor reports on their own workshop's pieces of the order, wherever the rest stands ([pieces flow](pieces-flow.md)).
- Who may confirm (`lib/domain/floor.ts`, tested): Planning or Workshop Execution in full — any stage; a supervisor with enter & edit — their own workshop's stages only. A quality stage is never finished from the floor. A paused or closed order cannot be touched. The machine-overlap check of Workshop Execution applies.
