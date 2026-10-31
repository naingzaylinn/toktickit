# TokTickIT — IT Service Desk

TokTickIT implements the CPE334 Labs 1–4 service desk: authenticated ticketing,
attachments and communication, attributable Actions Taken, the Ticket lifecycle,
and Staff/Requester Dashboards. Issue #63 is prepared for independent review;
this README does not declare release or merge approval.

## Stack and repository

React 18, TypeScript, Vite, Bootstrap 5; Express/Node.js; PostgreSQL/Prisma 5.22.
Vitest, React Testing Library, Supertest and Playwright provide regression coverage.

| Directory | Contents |
|---|---|
| client/src | Application, role screens, API transport |
| client/tests/lab-01 through lab-04 | Component/transport regressions |
| client/e2e/lab-03 and lab-04 | Browser journeys |
| server/src | Middleware, routes, transactional services |
| server/prisma | Schema, 11 committed migrations, local seeds |
| server/scripts | Disposable-schema test runners |
| server/tests/lab-01 through lab-04 | Unit/API/integration/migration/smoke tests |
| docs/lab-01 through lab-04 | Specifications and historical/current evidence |

## Roles and permissions

| Role | Capabilities |
|---|---|
| Requester | Create/search/filter/page own Tickets; owned attachments and Public Comments; advisory Problem Appears Resolved; all shared Actions on own Tickets; personal Dashboard |
| IT Staff | Shared Queue/detail; claim/reassign ownership; IT Priority and approved transitions; active attachment downloads; Public Comments/Internal Notes; Actions creation/edit/assignment/completion/cancellation; Staff Dashboard |
| Administrator | Staff capabilities plus user creation/editing, single-role assignment, activation and initial-password management |

Requesters cannot formally resolve, close, cancel or reopen Tickets. Internal Notes
are private to Staff/Admin. Actions retain immutable revisions and have no deletion.
Reference-data CRUD, self-registration and email password reset are not implemented.

## Prerequisites and environment

- Node.js 20 or higher, npm, running PostgreSQL 14 or higher.
- Microsoft Edge installed for the configured browser suite.
- Migration permissions; tests additionally require generated-schema creation/drop.
- Issue #63 was exercised with Node 24.19.0 and npm 11.17.0.

From the repository root:

```powershell
npm ci --prefix server
npm ci --prefix client
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

On macOS/Linux use `cp` instead of `Copy-Item`. Edit `server/.env` for your
database. The committed template contains this local example:

```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
PORT=3000
NODE_ENV=development
```

Do not commit real environment files. `DATABASE_URL`, `PORT`, `NODE_ENV`
configure the backend. Optional `ATTACHMENT_STORAGE_DIRECTORY` selects local
storage (default `server/storage/attachments` when started from server).
Test runners use temporary storage. No `VITE_API_URL` is needed.

## Fresh database and existing-data upgrade

Create the PostgreSQL database/user in your connection URL first. From server:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

For authoring development migrations, `npm run prisma:migrate` invokes migrate dev
and needs shadow-database permissions. Use deploy to apply committed migrations.

For an existing Labs 1–3 database, verify the URL/schema and take a verified backup,
then apply `npx prisma migrate deploy`; do not reset. The migration sequence
preserves IDs, ownership, attachments, communication, statuses and credentials.
Lab 4 adds Actions/revisions, workflow versions and seed identity mappings without
fabricating legacy work. Deploy client/backend together: status writes need a version.

Normalized-email collisions need an explicit identity decision. Inspect failed
deployments before resolve/retry; follow [database recovery](docs/lab-04/database.md).
Large/live migration lock duration is not measured. Verification uses disposable schemas.

## Seed behavior and demonstration accounts

From server, `npm run prisma:seed` creates local role/status/Action examples,
including empty, pending, completed, cancelled and historical-assignee cases.
Seeds refuse production and preserve edited fixture rows.

**Newly created** users use **Initial123** and require a password change. Reseeding
does not reset changed passwords, roles or activation. Existing users may no longer
accept Initial123. These are public local lab fixtures, never production credentials.

| Account | Role/state |
|---|---|
| alice@kmutt.ac.th, bob@kmutt.ac.th, charlie@kmutt.ac.th, diana@kmutt.ac.th | Active Requester |
| evan@kmutt.ac.th | Inactive Requester |
| lab4-empty@example.com | Active Requester with no seeded Tickets |
| staff1@example.com, staff2@example.com, staff3@example.com | Active IT Staff |
| staff-inactive@example.com | Inactive IT Staff |
| admin@example.com | Active Administrator |

Ambiguous renamed legacy users are not recreated. See
[authentication](docs/lab-03/authentication.md) and [seed evidence](docs/lab-04/database.md).

## Startup, builds and production origin

Use separate terminals: `npm run dev` from server and `npm run dev` from client.
Defaults are API http://localhost:3000 and UI http://localhost:5173.
Vite proxies /api to localhost:3000. Custom API ports require corresponding
environment/proxy configuration.

From the repository root:

```powershell
npm run build --prefix server
npm run build --prefix client
```

From server, `npm start` runs emitted `dist/src/index.js`. Client output is
`client/dist`; `npm run preview` from client is a local preview, not production hosting.

Production requires one HTTPS origin for UI and /api, configured database/storage
and `NODE_ENV=production` for Secure cookies. Credentialed cross-origin CORS is
not enabled. Public health/categories diagnostics preserve Lab 1 functionality.

## Safe regression commands

After installing both dependency trees, from the repository root:

```powershell
npm test --prefix client
npm run build --prefix server
npm run build --prefix client
```

From server:

```powershell
npm run test:isolated
npm run test:lab3
npm run test:workflow
npm run test:migration
npm run test:e2e
```

The complete isolated suite includes unit, integration, API, database, populated
migration, seed, authorization and performance checks. **Do not run raw npm test
in server against developer data**: legacy suites replace fixtures.
The runner creates a random schema, deploys 11 migrations, verifies schema parity,
seeds, tests, then removes its schema and temporary attachment storage.

Focused checks from server:

```powershell
npm run test:isolated -- tests/lab-04
npm run test:isolated -- tests/lab-04/migration.test.ts tests/lab-04/seed.test.ts
npm run test:isolated -- tests/lab-04/performance-smoke.test.ts tests/lab-04/product-performance-smoke.test.ts
npm run test:e2e -- lab-04/product-hardening.spec.ts
```

E2E starts temporary API/Vite services and storage, seeds a disposable schema,
discovers **both Lab 3 and Lab 4**, then cleans up. Edge, one worker and zero retries
are configured. Controlled browser failures have narrow documented console allowances.

## Demonstrations

### Requester and Requester Dashboard

Sign in as Alice/Bob and change the initial password if required. Create a Ticket
with active Category/System, summary, description and requested priority.
Attach JPG/PNG/WEBP/PDF (5 MiB per file, five active files). Exercise My Tickets
search/filters/pages/counts, detail, Public Comments, downloads and removal.
Foreign requester Tickets remain unavailable.

After uncertain creation, unchanged intent retries the same key; changed intent
requires confirmation. Upload failures do not undo creation: review successful/
failed files, open the existing Ticket and retry only failures. If upload results
are uncertain, inspect existing attachments before reselecting files.
Once creation is confirmed, retries review that existing Ticket and never
automatically resend the original attachment batch. This also applies when logout
fails during upload; the original upload may still finish. Use the confirmed
Start a new Ticket action to clear the draft and begin a separate intent.

Open Dashboard for personal totals, active/attention/status counts, recent updates
and currently resolved Tickets. Cards drill into matching My Tickets filters;
rows open detail. Refresh errors retain truthful prior data. Use the empty
requester for zero states. Problem Appears Resolved remains advisory.

### IT Staff and Staff Dashboard

Sign in as Staff One. Search/filter/page the shared Queue, claim an unassigned
Ticket or assign eligible Staff/Admin, change IT Priority, download attachments,
post Public Comments and private Internal Notes. Ticket ownership and Action
assignment are independent.

Dashboard shows global/active/unassigned/own-active counts, status/IT-priority
buckets, recent Tickets and Actions originally recorded by this identity.
Exercise card/row drilldowns and Refresh. Admin shares this view with personal subsets.

### Administrator

Sign in as Admin. Create/edit users with one role, change activation and set
another user's initial password. Demonstrate initial-password and inactive access
restrictions. Self-deactivation and removing the last active Admin are protected.
User deletion and reference-data administration are not provided.

### Actions Taken and complete Ticket lifecycle

On an active Ticket add PENDING work with Description, Result, Follow-up flag/
conditional Note and optional Attachment Notes. Original date/performer are automatic.
Assign/reassign active Staff/Admin independently of Ticket Owner; complete with valid
evidence or cancel with an explicit Result explaining cancellation.
Terminal Actions allow content correction, not state reversal/reassignment/deletion.

Move NEW to OPEN/IN_PROGRESS using allowed destinations. Resolution requires
at least one COMPLETED Action, no PENDING Actions and no COMPLETED follow-up flags.
CANCELLED Actions neither qualify nor block. Clearing completed follow-up needs
a new explanation. Review evidence, resolve, close, reopen for more work and
re-resolve/cancel through permitted transitions. Legacy zero-Action RESOLVED
Tickets may close. Reopen retains Action history. Stale writes require explicit
refresh/review and are never automatically repeated.

## Verification, limitations and documents

The verified pre-change baseline at `9076bad` was 587 server tests, 332 client tests,
55 browser tests and both builds passing. Current working-tree results, initial
failures and retries are in [Issue #63 evidence](docs/lab-04/final-hardening.md).
After R-01 and R-02 corrections, verification passed 627 server tests, 411 client tests,
58 browser tests and both production builds. Database verification used disposable
schemas and temporary attachment storage.
This is branch/working-tree evidence, not a released main commit. Independent
critical review remains required.

Automated focus/keyboard/width/text-reflow checks do not establish screen-reader,
contrast or actual browser-zoom compliance. Bounded local smoke is not production
load evidence; communication/user lists retain their unpaged contracts.
Production-scale migration timing remains unverified.

- [Lab 1 tests](docs/lab-01/tests.md).
- [Lab 2 specification](docs/lab-02/specification.md), [API](docs/lab-02/api-spec.md), [tests](docs/lab-02/tests.md).
- [Lab 3 specification](docs/lab-03/specification.md), [authentication](docs/lab-03/authentication.md), [release evidence](docs/lab-03/release-evidence.md).
- [Lab 4 specification](docs/lab-04/specification.md), [API](docs/lab-04/api-spec.md), [UI](docs/lab-04/ui-spec.md).
- [Database](docs/lab-04/database.md), [Actions backend](docs/lab-04/actions-backend.md), [Actions UI](docs/lab-04/actions-ui.md), [workflow](docs/lab-04/ticket-workflow.md).
- [Staff Dashboard](docs/lab-04/staff-dashboard.md), [Requester Dashboard](docs/lab-04/requester-dashboard.md).
- [Tests](docs/lab-04/tests.md), [review preparation](docs/lab-04/reviewer.md), [AI use](docs/lab-04/ai-use.md).
