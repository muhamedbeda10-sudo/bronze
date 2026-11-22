# Notes for Claude

- Read `README.md` first; each module has its own file in `docs/features/` — edit the feature's own file when the feature changes.
- Pure logic lives in `lib/domain/` with a `*.test.ts` beside it; database access in `lib/server/` (`server-only`). A rule the floor depends on (weights, stage moves, KPIs, validation) is written and tested there, never inside a component.
- Every server action: check access with `actionUser(module, level)` (`F` full · `E` enter/edit · `V` view), validate with the domain function, write in one `prisma.$transaction` together with `audit(...)`.
- Work orders and stock lines carry a `version`: an update is `updateMany where { id, version }` so a stale screen is refused (`STALE`).
- Scripts that import server code run with `tsx --conditions=react-server` (see `package.json`).
- UI: the tokens and component classes in `app/globals.css` (inside `@layer components`); text never wears a series colour; check light and dark and a 390 px phone.
- `npm install` needs `legacy-peer-deps` (set in `.npmrc`).
- Navigation is one list, `lib/nav.ts` (menus, drawer, breadcrumb, palette). A page puts its buttons in the control panel with `CpanelActions`, a record its name in the breadcrumb with `Crumb` (`components/Cpanel.tsx`).
- After a change to a flow, run `npm run e2e` against the dev server on a freshly seeded database (`npm run seed -- --force`).
