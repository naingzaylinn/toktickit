# Issue #61 — IT Staff Dashboard

## Phase 3 — two independent-review corrections, 2026-10-13

The independent read-only review reproduced two Minor defects: special raw query
keys could disappear from Express's parsed object, and keyboard Retry lost focus
when its error alert unmounted. This section supersedes the earlier implementation
evidence for the affected behavior; the original results below remain historical.

Finding 1: the dashboard route now parses the original query substring starting
at the first question mark in req.originalUrl and checks URLSearchParams.size. It rejects
every actual key, including plain/encoded/nested/repeated __proto__, before calling
the calculation service. The existing auth/password/Staff/Admin gates still run
first. No global parser, successful DTO, calculation or unrelated route changed.

Finding 2: the existing focus-intent ref now recognizes a focused control in the
dashboard error region as well as Refresh. When Retry unmounts and Refresh is
disabled, focus moves from BODY to the stable programmatically focusable dashboard
heading. After success or another recoverable failure it returns to enabled
Refresh only if focus is still on BODY, the heading or Refresh. Deliberate movement
to another control is respected. No new focus framework, request loop or duplicate
request is introduced; loading, retained data, timestamps and denied clearing stay.

Changed for this correction only: staffDashboard.ts route, authorization.api.test.ts,
StaffDashboardScreen.tsx, StaffDashboard.test.tsx, accessibility.spec.ts and the
four existing Issue #61 documentation/evidence records. The complete implementation
inventory remains eleven modified tracked files and eighteen new files.

Added eight backend cases (authorization suite 10 -> 18): one real authorized
no-query success and seven additional rejected key variants. Every invalid case,
including the existing five, uses a call-through service spy and proves no service
invocation, exact 400/INVALID_QUERY_PARAMS and no data. The successful control
proves one invocation with the authenticated ID and the real fixture count.

Added six component cases (dashboard suite 10 -> 16): initial versus refresh
failure crossed with retry success/failure, including a second retry after another
failure; two explicit deliberate-focus-movement cases. They use keyboard Enter,
controlled pending promises, heading focus while busy, Refresh focus when settled,
retained server data and exact request counts. Added two real-browser cases
(accessibility suite 1 -> 3) for initial/refresh failure recovery; a held HTTP
request proves Retry disappears and focus is not BODY before releasing recovery.
All original tests/assertions are retained.

Focused actual results: server/client builds passed; authorization 18/0,
StaffDashboard 16/0 and accessibility browser 3/0. Initial server build caught a
test matcher unavailable in installed Vitest; replaced with separate exact call
count and argument assertions. Initial Vite/Vitest/Prisma starts hit sandbox
spawn EPERM; approved outside-sandbox isolated reruns passed. No focused executed
test failed. Only generated disposable schemas and temporary services were used.

### Phase 3 final actual verification

| Working directory | Exact command | Result |
|---|---|---|
| Root | npm.cmd run build --prefix server | Passed |
| Root | npm.cmd run build --prefix client | Passed |
| Root | npm.cmd test --prefix client -- tests/lab-04/StaffDashboard.test.tsx | 16 passed, 0 failed, 1 file |
| server | npm.cmd run test:isolated -- tests/lab-04/authorization.api.test.ts | 18 passed, 0 failed, 1 file |
| server | npm.cmd run test:e2e -- lab-04/accessibility.spec.ts | 3 passed, 0 failed |
| Root | npm.cmd test --prefix client | 262 passed, 0 failed, 22 files |
| server | npm.cmd run test:isolated | 545 passed, 0 failed, 31 files |
| server | npm.cmd run test:e2e | 40 passed, 0 failed |

The final authorization check was repeated after retaining the original query
prefix for standard URLSearchParams parsing; it passed 18/0 and the server build
passed. Compared with Phase 2, exactly eight server, six client and two browser
cases were added. All previous 537/256/38 cases remain passing, including
unchanged dashboard metrics, snapshot/drilldown tests, Queue/navigation, #59
Actions, #60 workflow, requester advisory and Labs 1–3 regressions. Eleven
existing migrations deployed without schema drift only in disposable schemas.

Manual screen-reader, formal contrast and comprehensive browser-zoom audits remain
unclaimed. Human review/PR is still pending. No reference or developer-schema
changes, schema/migration/workflow/Action/Queue changes, staging, commit, push,
PR, branch switch or #62–#64 implementation.

Implemented for independent review on `feature/sprint4-staff-dashboard`, based on
`fa2e42fb902edfb32d2eee9614af652fe92d9676`, 2026-10-13 (Asia/Bangkok).
No commit, PR, peer approval, merge or final release is claimed.

## Approved metrics and API

Sources: [specification §8](specification.md#8-dashboard-definitions),
[API §§8–9](api-spec.md#8-dashboards--new), [UI §§4–8](ui-spec.md#4-dashboard-drilldowns).
Active means New, Open, InProgress, WaitingForRequester and Reopened. Resolved,
Closed and Cancelled are outside active. Open alone is one status bucket.

| Response field | Exact population |
|---|---|
| totalTickets | All shared staff Tickets, including terminal/legacy records |
| activeTickets | Tickets in the five-status active set |
| unassignedActiveTickets | Active AND ownerId IS NULL; inactive/role-changed owners remain assigned |
| myActiveTickets | Active AND ownerId equals the authenticated Staff/Admin identity |
| byStatus | All Tickets grouped into eight uppercase API buckets, including zeros |
| activeByItPriority | Active grouped by itPriority, four uppercase buckets including zeros; never requestedPriority |
| recentTickets | All shared Tickets, take 5, updatedAt DESC then ticketNumber ASC; no age cutoff |
| myActions.totalItems | Action records with original performedById equal to authenticated user; all Action and parent states |
| myActions.items | Same performer predicate, take 5, createdAt DESC then id DESC; createdAt becomes actionDateTime |

The active URGENT bucket is the urgency cue. No separate urgent list, assigned
Action KPI, SLA/window, account metric or aggregate Action endpoint is added.
Ticket owner, original performer, current assignee and revision editor/completer
remain distinct. Reassignment/cancellation/editing does not replace the performer.

GET `/api/staff/dashboard` returns the exact approved data object and UTC
meta.generatedAt, generated after reads finish. Unsupported queries, including
repeated/structured/identity parameters, return 400 INVALID_QUERY_PARAMS. No
query/body identity override is used.

Existing active-session/password middleware precedes the Staff/Admin role gate.
Requester: 403; absent/expired/inactive session: 401; initial password: 403
PASSWORD_CHANGE_REQUIRED. The current User is loaded per request, so subsequent
requests observe role/account changes. Existing no-store and safe error envelopes
remain; unexpected failures expose only generic INTERNAL_SERVER_ERROR.

Recent rows contain only id/number/summary/status/IT priority/updated time and
owner id/name. Action rows contain approved parent identifiers/number, original
date/description/follow-up/state and current assignee id/name/role/isActive.
No emails, credentials, private notes, revisions, storage keys, results or
follow-up notes are exposed. Historical inactive assignees remain visible.

## Queries and snapshot

The service performs seven logical Prisma operations in one interactive
RepeatableRead transaction: status groups, unassigned count, personal owner
count, active priority groups, bounded recent Tickets, personal Action count and
bounded Action rows. Total/active sum database aggregate groups. Zero-filled
enum buckets and empty lists represent successful empty data, never failures.
Relation projections are bulk-loaded rather than queried in a per-item loop.
No full Ticket/Action collections are fetched. No migration/index is introduced.

Queue adds only statusGroup=active using the shared active definition. It
intersects single status and existing filters; active+CLOSED returns zero.
Invalid/repeated/structured groups fail safely. Existing DTO, pagination,
search/owner/priority/sort/defaults and authorization are preserved.

## UI, navigation and feedback

Staff/Admin receive /staff/dashboard and Dashboard navigation. Login/brand
targets remain /staff/tickets; requester routes remain unchanged. Existing
History API navigation tracks pathname/search/hash separately, dispatches
popstate after application navigation and observes popstate/hashchange.

Cards/rows use exact UI §4 real-link destinations, including zeros. Global
scope, primary ownership and “Actions originally recorded by you” are labeled
explicitly. Action total is text, not an unsupported aggregate link.
Queue controls initialize filters/sort/page/pageSize from URL, synchronize
changes into history, restore on back/forward and retain predicates through
pagination. Reset clears applicable filters and returns page 1. Owned by you
is a visible owner choice; other owner IDs have a visible option.

Action links reuse Issue #59's hash target, focusActionId bounded history page,
highlight and actual focus. Hash never becomes part of Ticket ID. Browser
coverage creates 23 Actions and proves target page 2, bounded rows and focus.

Initial loading has stable busy space with no fake zeros. Refresh retains
same-user data with the last successful time. Recoverable failure shows safe
Retry and explicitly labels retained data as previously loaded. Success updates
time. Denial/session/password loss clears data/controls; user/role keys and
request generations reject obsolete responses. No browser persistence is added.

Zen Green tokens, Bootstrap grid, zen-card and existing feedback/badges are
reused. Cards stack, long text/rows wrap, links/headings are semantic, dates use
dateTime and feedback is accessible. Refresh returns keyboard focus after native
disabled loading unless the user moved to another control.

## Changed files

| File | Change / responsibility |
|---|---|
| server/src/routes/staffDashboard.ts | New role-scoped dashboard route/queries/errors |
| server/src/services/staffDashboard.ts | New snapshot calculations and narrow DTO |
| server/src/services/ticketDashboardDefinitions.ts | New shared active set/enum maps |
| server/src/app.ts | Dashboard registration behind existing gates |
| server/src/routes/staffTickets.ts | Active-group validation/intersection |
| client/src/components/StaffDashboardScreen.tsx | New dashboard/refresh/access safety/links |
| client/src/api.ts | Exact DTO/helper and Queue group transport |
| client/src/App.tsx | Dashboard route and pathname/search/hash handling |
| client/src/components/AppShell.tsx | Staff/Admin Dashboard navigation |
| client/src/components/StaffTicketQueueScreen.tsx | URL controls/history/group/owner and request safety |
| client/src/theme.css | Five dashboard-specific wrapping/card/busy rules |
| server/tests/lab-04/dashboardFixture.ts | New guarded nested disposable-schema setup/cleanup |
| server/tests/lab-04/staff-dashboard.api.test.ts | New calculation/identity/order/projection/activity cases |
| server/tests/lab-04/dashboard-snapshot.api.test.ts | New true empty DB and overlapping snapshot cases |
| server/tests/lab-04/dashboard-drilldowns.api.test.ts | New metric/Queue parity and intersections |
| server/tests/lab-04/authorization.api.test.ts | New session/role/query/failure cases |
| server/tests/lab-04/performance-smoke.test.ts | New bounds/fixed operations/EXPLAIN evidence |
| client/tests/lab-04/dashboardFixture.ts | New typed UI fixture |
| client/tests/lab-04/StaffDashboard.test.tsx | New dashboard state/access/late-response cases |
| client/tests/lab-04/DashboardDrilldowns.test.tsx | New links/shell/URL/App integration |
| client/tests/lab-04/staff-dashboard-api.test.tsx | New transport/error/session-event cases |
| client/tests/lab-03/StaffTicketQueue.test.tsx | Reset URL before existing tests; assertions retained |
| client/e2e/lab-04/dashboards.spec.ts | New real-service flows and controlled empty/403 visual states |
| client/e2e/lab-04/responsive.spec.ts | New 375/768/1280 px navigation/overflow/screenshots |
| client/e2e/lab-04/accessibility.spec.ts | New keyboard/focus/200% text reflow/screenshots |
| docs/lab-04/staff-dashboard.md | This implementation and evidence record |
| docs/lab-04/tests.md | Actual #61 evidence/coverage |
| docs/lab-04/reviewer.md | Independent-review preparation/current discovery |
| docs/lab-04/ai-use.md | Authorized AI work, outcomes and limitations |

Inventory: 11 modified tracked files and 18 new files. References are separate.
Ignored build/test outputs and four screenshots in client/node_modules/.cache
are verification artifacts, not staged implementation files.

## Test coverage and actual verification

New backend: 7 calculations + 2 snapshot/empty + 11 drilldowns + 10 authorization
+ 1 performance = **31**. New client: 10 dashboard + 9 navigation + 8 transport
= **27**. New browser: 5 dashboard + 3 responsive + 1 accessibility = **9**.

Independent DB predicates verify all statuses/priorities, owner/null/inactive
users, Staff/Admin identity, performer versus assignee/completer, terminal and
legacy records, conflicting Requested Priority, Action states/reassignment/edit,
zero buckets and tied ordering/caps. Exact safe projections are asserted.
Real API writes verify parent Action activity versus replay/no-op/comment/note
operations. Queue full totals match every card predicate at unchanged fixture state.

Snapshot test pauses a real transaction after status grouping, commits Ticket
and Action changes on another connection, resumes and proves coherent old
counts/rows and new state on next GET. Barrier timeout is failure; sleeps are
not proof of concurrency.

Only existing isolated runners are used; nested dashboard fixture names and
runner URL guards prevent developer targeting. All eleven existing migrations
deploy in generated schemas with No difference detected; cleanup drops only
owned generated schemas. No raw server npm test or developer migration/seed.

| Working directory | Exact command | Final actual result |
|---|---|---|
| Root | npm.cmd run build --prefix server | Passed |
| Root | npm.cmd run build --prefix client | Passed |
| Root | npm.cmd test --prefix client -- tests/lab-04 | 128 passed, 0 failed, 8 files |
| Root | npm.cmd test --prefix client | 256 passed, 0 failed, 22 files |
| server | npm.cmd run test:isolated -- tests/lab-04 | 328 passed, 0 failed, 11 files |
| server | npm.cmd run test:isolated | 537 passed, 0 failed, 31 files |
| server | npm.cmd run test:e2e -- lab-04/dashboards.spec.ts lab-04/responsive.spec.ts lab-04/accessibility.spec.ts | 9 passed, 0 failed |
| server | npm.cmd run test:e2e | 38 passed, 0 failed |

Intermediate outcomes: sandbox Vite/Vitest/Prisma spawn EPERM prevented startup;
approved outside-sandbox reruns succeeded. Initial focused backend passed 29
before two additional cases. First Lab 4 backend run had 327 passed/1 failed:
the new activity test used a nonexistent staff comment URL; corrected to the
existing /api/tickets/:id/comments without weakening timestamp checks. First
focused browser run had 8 passed/1 failed: native disabled Refresh lost focus;
production focus return was fixed and the unchanged assertion passed. A jsdom
modified-link navigation warning was removed by preventing only the browser
default in that test. A documentation patch initially failed context matching;
the patch tool wrote no files and the corrected patch was applied.

Full server regression retains all **506** previous cases; client retains **229**;
browser retains **29**, including Lab 2–3 and #57–#60. Strict unexpected-network
tests remain unchanged. No existing assertion is weakened or removed.

Performance smoke: 150 Tickets/150 Actions, seven logical Prisma operations,
five rows/list, 3331-byte response. Measured request-plus-plan interval was
68 ms in full regression and 97 ms in final focused Lab 4 run. EXPLAIN uses
Ticket_updatedAt_ticketNumber_idx with Limit. Local Windows/Node 24/PostgreSQL,
headless installed Edge; this is not a production budget or physical SQL count.

Screenshots captured and visually inspected at 375/768/1280 px plus 200% text:
client/node_modules/.cache/staff-dashboard-375.png,
staff-dashboard-768.png, staff-dashboard-1280.png, staff-dashboard-text-200.png.
Cards stack appropriately and visible rows/controls wrap without overlap or
document overflow. Text reflow and keyboard focus are tested; this is not a full
browser zoom, screen-reader or formal contrast audit.

## Scope, limitations and review

Only Issue #61 is implemented. Requester dashboard/filter extensions remain #62;
product-wide hardening/release remain #63/#64. No schema/migration/index/seed,
Action lifecycle/revision/idempotency, Ticket workflow, requester advisory or
requester endpoint changes. No references, developer data or branch changes.

Later drilldowns can differ after committed writes; dashboard snapshot is not
cross-request persistence. Authorization is existing request-time middleware,
not a new mid-request revocation lock protocol. Browser empty/403 visual tests
use controlled responses; true empty database and authorization use real backend
fixtures. Production-scale benchmarking and full manual assistive-technology/
contrast/browser-zoom audit remain unclaimed. No known failing test remains.

Independent human review and eventual PR to lab4-staging are pending. No staging,
commit, push, PR, merge or final-main evidence is claimed.

Final Git audit: git diff --check passed; git diff --name-status/stat lab4-staging
showed exactly the eleven modified tracked files above (192 insertions,
32 deletions). The eighteen new files were separately enumerated and inspected
without staging; each passed no-index whitespace checking against NUL and had
zero trailing-whitespace lines. No-index difference exit 1 and Windows LF/CRLF
notices are expected, not whitespace failures. git diff --cached --name-only
was empty. Branch/HEAD remained the verified baseline; unrelated untracked
docs/references remained untouched. Ordinary git diff does not include new files.
