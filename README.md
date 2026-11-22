# Lotfy Bronze ERP — CastFlow MES

نظام إدارة التصنيع لمسبك لطفي برونز: أوامر الشغل، مسارات الإنتاج، تنفيذ الورش، الجودة، المخزون والأوفرتايم.

The foundry's web app: every casting order from entry, through each workshop on its route (pattern, molding, melting & pouring, fettling, machining), through quality inspection, into finished-goods stock.
It implements the live MES scope of *Lotfy Bronze ERP — System Documentation* (§1–§14, §18), with the data issues of §14 fixed by design.
English UI; Arabic names are welcome in the data.

## Stack
Next.js 16 (App Router, server actions) · TypeScript · Tailwind v4 · Prisma + PostgreSQL · exceljs · Recharts · Vitest.
Same house rules as Production-Control: pure, tested logic in `lib/domain/`, database access in `lib/server/`, one look across every screen (`app/globals.css`).

## Run it on a Windows computer (to try it)
Needs **Node.js LTS** (nodejs.org) and **PostgreSQL** running on the computer (the portable one at `D:\SYS\pgsql` that Production-Control uses is started by `run.bat` by itself).
1. Get the code: `git clone https://github.com/muhamedbeda10-sudo/bronze.git` (or Code → Download ZIP and unzip it).
2. Double-click **`setup.bat`** once: it asks for the PostgreSQL user and password and the app's first admin, writes `.env`, installs, creates its own database `lotfy_bronze`, loads the demo data and builds.
3. Double-click **`run.bat`**: the browser opens **http://localhost:3001** (Production-Control keeps 3000). **`stop.bat`** stops it; **`reset-demo.bat`** wipes the database and reloads the demo data.

On a tablet on the same network, open `http://<this computer's IP>:3001` (Windows firewall: allow Node.js on private networks). The kiosk's camera needs HTTPS, so on plain http type the order number instead of scanning.

## Setup
```bash
npm install                     # .npmrc sets legacy-peer-deps
cp .env.example .env            # DATABASE_URL of a PostgreSQL of your own
npx prisma migrate deploy       # create the tables
npm run seed                    # demo master data, orders, logs, stock, users
npm run dev                     # http://localhost:3000
npm run test:run                # unit tests
npm run e2e                     # end-to-end, against the running app on a freshly seeded database (BASE_URL)
```
`npm run seed` refuses a database that already holds orders; `npm run seed -- --force` wipes it first (development only).
Sign in as `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Demo users (same password): `gm@`, `planner@`, `melting@` (supervisor of Melting & Pouring), `qc@`, `store@`, `tech@lotfybronze.com`.

On a real database create the first admin with:
```bash
ADMIN_EMAIL=you@lotfybronze.com ADMIN_PASSWORD='…' npm run create-admin
```

## Deploy
`Dockerfile` builds one image; the container applies the migrations when it starts (`scripts/docker-start.sh`) and answers on port 3000.
Needs `DATABASE_URL` at runtime. Behind plain http (no TLS) set `INSECURE_COOKIES=1`, otherwise leave it unset.
CI (`.github/workflows/ci.yml`): types, lint, unit tests, build and seed against a throw-away PostgreSQL.

## Modules
| Module | Path | Feature doc |
|---|---|---|
| My Work (home), notifications, search | `/` | [my-work](docs/features/my-work.md) |
| Production Analytics | `/analytics` | [dashboard](docs/features/dashboard.md) |
| Master Data | `/master/*` | [master-data](docs/features/master-data.md) |
| Work Orders | `/work-orders` | [work-orders](docs/features/work-orders.md) |
| Production Planning | `/planning` | [planning](docs/features/planning.md) |
| Workshop Execution | `/workshop` | [workshop](docs/features/workshop.md) |
| Shop-floor kiosk, traveler QR | `/floor`, `/print/traveler` | [shop-floor-kiosk](docs/features/shop-floor-kiosk.md) |
| Quality Control | `/quality` | [quality](docs/features/quality.md) |
| Inventory | `/inventory/*` | [inventory](docs/features/inventory.md) |
| Overtime | `/overtime` | [overtime](docs/features/overtime.md) |
| Reporting | `/reports` | [reports](docs/features/reports.md) |
| Settings | `/settings` | [settings](docs/features/settings.md) |

Design and layout: [docs/design.md](docs/design.md) · Code layout: [docs/layout.md](docs/layout.md).

## Fixed from the documentation's review (§14)
- **Density**: the weight uses each material's own density (8.8 only when a material has none).
- **Duplicate IDs**: workshop, machine, material, process, mold, operator and reason codes are unique (database constraint), upper-cased on entry.
- **Stray characters / spelling**: names are trimmed of stray separators (`Shakeout & Fettling|` → `Shakeout & Fettling`); the seed uses *Turning*, *Mold Prepare*.
- **Units**: stock units are fixed per list (kg / pcs) — never typed.
- **Routing**: a route is its stages in order; the last one ends it — there is no "Next Stage = END" to mistype. Orders keep a copy of the route they were saved with.
- **Browser tab**: *Lotfy Bronze — CastFlow MES*.
- **Capacity**: built (load vs machine hours per workshop).

## Enterprise features
- Dynamics/Odoo-style shell: app bar with module menus, breadcrumb control panel, Ctrl+K search, notifications.
- Role-based **My Work** home.
- Work orders as **List / Kanban / Gantt** with filters, group by, saved favorites, bulk actions; drag on the board and the timeline.
- **Record page** with a status bar, notebook and **chatter** (@mentions, attachments, history).
- **Traveler** with QR and a **shop-floor kiosk** for tablets.

## Not built yet (on purpose or for later phases)
- Sales & Customers (§15), HR & Payroll (§16) and the full Inventory & Warehouse module (§9.2: GRN, heat numbers, valuation) — the next phases of §19.
- Google sign-in (email + password only for now).
- *Delete All History* — left out: history is the audit trail; cancel orders instead.
