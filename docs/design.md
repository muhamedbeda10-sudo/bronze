# Design

Enterprise pattern of Dynamics 365 / Odoo Enterprise, in the Lotfy Bronze brand (lotfybronze.com and its logo): **bronze `#A26E55`**, deep navy **`#181B31`**, **Roboto** for the work, **Forum** for the brand mark only.

- **App bar** (`components/AppShell.tsx`): the navy bar with the module menus — My Work · Production · Quality · Inventory · People · Reporting · Configuration — each a dropdown of its places (`lib/nav.ts`, one list for the menus, the phone's drawer, the breadcrumb and the command palette). An account sees only the entries it can open. Search (Ctrl+K), notifications, light/dark, the account.
- **Control panel**: under the bar, the breadcrumb (menu / place, a record adds its name — `Crumb`) and the page's actions on the right (`CpanelActions`, `components/Cpanel.tsx`).
- **List views**: a search box with facets (filter, group), Filters, Group by and Favorites (saved searches, one default per person), a view switcher List | Kanban | Gantt, selectable rows with bulk actions, clickable rows, groups that fold with sums, paging of 80.
- **Record page (form view)**: action buttons and a status bar of the stages as chevrons, the title and badges, fields in columns, a notebook of tabs, and the **chatter** beside it — messages with @mentions, attachments, and the record's history in one timeline.
- **Shop floor**: a full-screen kiosk with big touch targets, for a tablet; the printed traveler carries a QR that opens the order there.
- Neutral surfaces, sharp radii (4/6/8 px), 32 px controls, 36 px table rows; bronze marks actions and the current place, never the chrome. Status colours stay apart from the brand and always carry a label.
- Which bronze when (WCAG AA for each job, both themes): `--brand` bars and rings; `--brand-fill` under white text; `--brand-ink` bronze text; `--brand-light` a tint.
- Charts: thin marks, recessive grid, one axis, a legend only for two series, a hover tooltip; the `--viz-*` colours checked with the dataviz validator, light and dark.
- Dark mode is selected, not flipped. Every screen is checked light, dark and at 390 px.
