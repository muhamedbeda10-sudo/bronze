# My Work (home)

Everyone opens on their own work, by what their account can act on (`app/(app)/page.tsx`):
tiles (open, late, due in 7 days, waiting inspection, overtime to decide, issue requests) that open the matching filtered list, then panels — at my workshop (a supervisor's stages), waiting for my inspection, ready to release (planned, start date reached), overtime to decide (never one's own), issue requests to process, late orders, due in the next 7 days, on hold / waiting, and the person's mentions and notifications.
The production analytics moved to Reporting → Production Analytics (`/analytics`).

## Notifications
The bell in the app bar (`/api/notifications`, read every minute and when the tab comes back). People are told when: someone @mentions them; an order reaches a quality stage (Quality, full); a QC rejection sends an order back, or an order completes (Planning, full); overtime is requested (Planning / Overtime, full) and decided (the requester); an issue request is made (Inventory, full) and processed (the requester). `lib/server/notify.ts`.

## Search (Ctrl+K)
Work orders, materials, machines, operators and molds matching a few letters — only of what the account can see (`/api/search`) — and every page of the menus.
