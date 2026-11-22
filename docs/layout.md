# Code layout

- `lib/domain/*` — pure, unit-tested rules: `weight` (volume, weights, full name), `routing` (stage moves), `kpi` (dashboard), `capacity`, `reports`, `master` (master-data specs and row checks), `workOrder`, `activity`, `overtime`, `stock`, `users`, `access` (roles and levels), `dates`, `settings`, `status`.
- `lib/server/*` — database access (`server-only`): `auth` (sessions, guards), `audit`, `workOrders` (create, edit, `applyStageAction`), `woQueries`, `dashboard`, `reports`, `refs`, `excelRead`, …
- `app/(app)/*` — the signed-in screens and their server actions (`actions.ts` beside each module).
- `components/*` — the shell (`AppShell`), `DataTable`, `FilterBar`, `Modal`, `Toast`, `ui` primitives, and each module's client views.
- `prisma/` — the schema and migrations. `scripts/` — `seed`, `create-admin`, `docker-start.sh`.
