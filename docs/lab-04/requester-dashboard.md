# Issue #62 - Requester Dashboard

## Phase 3B - targeted independent-review corrections (2026-10-14)

The independent review returned REQUEST CHANGES: R1 Major, R2-R4 Minor,
and O1 test-quality observation. Earlier implementation/review evidence below is
historical and remains intact; this section records the targeted corrections.

| Finding | Root cause | Correction and regression evidence |
|---|---|---|
| R1: obsolete authentication failure cleared a newer user's dashboard | Shared error parsing dispatched global access loss before component generation checks | Optional ApiReadContext checks signal and current-read validity immediately before dispatch, after error-body parsing. Requester Dashboard, My Tickets and its reference reads cancel/invalidate superseded or unmounted reads. Real deferred fetch tests exercise delayed 401/password-change, identity/role changes, ignored abort, unmount, body parsing, superseded filters, current access loss and recoverable errors. Default Staff/API behavior remains enabled. |
| R2: historical category/system predicates displayed All | Active-only options omitted selected historical IDs | A selected-only, neutral ID fallback option preserves the predicate without inventing a name or offering inactive records as new choices. Tests cover category/system/both, API values, pagination, restoration and reset. |
| R3: Detail explicit Back lost its originating list after browser restoration | One mutable return reference was cleared by Dashboard navigation | An opaque per-entry History state key references an in-memory identity/role-scoped map. Multiple Detail entries retain independent list URLs; access/identity changes clear the map. Direct and Dashboard-origin Detail fall back to /tickets. Component tests cover separate entries and identity invalidation; real browser tests traverse Back/Forward through Dashboard. |
| R4: an empty page claimed no Tickets existed | Empty state used row length without authoritative matching totals | Positive pagination.totalItems with zero rows displays a page-specific empty state and first-page action, preserving filters/sort in History. Zero totals retain genuine-empty versus filtered-empty behavior; errors remain separate. Browser/component tests verify recovery and history. |
| O1: timestamp direction was untested | All own fixture timestamps tied | Fixed mixed dates, multiple ties, eight Resolved Tickets and newer foreign rows now produce literal expected ID sequences for both capped lists, independently of production ordering helpers. |

New regression file: client/tests/lab-04/RequesterReadContext.test.tsx (real API
transport and global event). Extended RequesterDashboardDrilldowns.test.tsx,
MyTickets.test.tsx (context assertions), requester-dashboard.api.test.ts and
requester-dashboard.spec.ts. The API contract, requester predicates, metrics,
RepeatableRead transaction, schema, workflow, Actions and Staff calculations did
not change. No browser storage contains protected data or return URLs.

Detail return metadata intentionally lasts only for this mounted authenticated
App session; a full document reload/direct entry falls back to /tickets.
Manual screen-reader evaluation remains a separate human check. Independent
re-review is still required; passing tests are not a merge approval.

### Phase 3B verification results

- `npm.cmd run build --prefix server`: passed (TypeScript).
- `npm.cmd run build --prefix client`: passed (TypeScript and Vite).
- Focused client run covering RequesterReadContext, RequesterDashboard,
  RequesterDashboardDrilldowns, requester-dashboard-api, MyTickets,
  StaffDashboard, DashboardDrilldowns and session-transport: 105 tests / 8 files
  passed. Two additional late-success/failure cases were then included in the
  final complete run.
- `npm.cmd test --prefix client`: final run 332 tests / 26 files passed.
- From server, `npm.cmd run test:isolated`: 587 tests / 35 files passed,
  including the mixed-timestamp ordering regression and both snapshot suites.
- From server, `npm.cmd run test:e2e`: 55 browser tests passed, including
  Detail restoration, out-of-range page recovery, responsive and focus suites.
- No test assertion failed in these runs. The first focused client startup and
  first browser startup were blocked by sandbox `spawn EPERM` (esbuild/Prisma);
  authorized outside-sandbox retries passed. The backend/browser runners were
  inspected first and created/removed only generated disposable schemas.
- Relative to Phase 2: 30 additional client cases, one additional backend case,
  two additional browser cases. Existing assertions were retained; query-call
  expectations additionally verify the new validity context.
- `git diff --check` passed; all 15 new Issue #62 files passed a separate
  trailing-whitespace/final-newline scan. Branch and HEAD remain
  feature/sprint4-requester-dashboard / 8ee1b934ad1a4c9b8f0212c2d4cda792912bd3b2;
  local lab4-staging is unchanged and the index is empty. Total Issue #62 scope
  is 17 modified tracked files and 15 new files; docs/references/ was excluded
  from enumeration/content reads and remains unrelated and untouched.

The regression tests execute the reported failure sequences against the corrected
implementation. A separate pre-correction red run was not recorded in Phase 3B;
no red-run claim is made. The independent review supplied the original reproductions.

Implemented for independent review on `feature/sprint4-requester-dashboard`, based on
`8ee1b934ad1a4c9b8f0212c2d4cda792912bd3b2`, 2026-10-14 (Asia/Bangkok).
The user approved Phase 1 and authorized implementation/testing/documentation.
No staging, commit, push, PR, branch switch, human approval or release is claimed.

## Approved metrics

Sources: specification section 8 / BR-16 through BR-20, API sections 8-9, UI sections 1/4/6-8.
Every population is constrained by Ticket.requesterId = authenticated session User ID.
Owner, Action performer, assignee and revision editor do not establish membership.

| Response field | Population |
|---|---|
| totalTickets | All own Tickets, including Resolved/Closed/Cancelled and legacy records |
| activeTickets | Own New/Open/InProgress/WaitingForRequester/Reopened |
| waitingForRequesterTickets | Own WaitingForRequester only |
| resolvedTickets | Own currently Resolved only; Closed is separate |
| byStatus | Own counts in all eight uppercase API status buckets, including zeros |
| recentTickets | Own Tickets, updatedAt DESC / ticketNumber ASC, take 5 |
| resolvedTicketsRecent | Own currently Resolved Tickets, same ordering, take 5 |

There are no windows, SLAs, urgency scores or Action-derived attention metrics.
Resolved rows mean recently updated Tickets currently resolved, not resolution dates.
No resolvedAt exists. Historical zero-Action Tickets and inactive staff owners remain
included. Approved Action writes advance parent activity; no-op/replay does not.

## API, authorization and snapshot

GET `/api/requester/dashboard` is REQUESTER only. Existing session/password middleware
runs first; inactive/missing/expired sessions are 401, mandatory password change is
403 PASSWORD_CHANGE_REQUIRED, wrong roles are 403 FORBIDDEN. Identity is req.auth.user.id;
query/header/body values cannot override it. No dashboard alias is introduced.

The route inspects raw URLSearchParams before calculations, after access gates.
Every query key, including encoded/nested/repeated/parser-discarded __proto__, returns
400 INVALID_QUERY_PARAMS. The global Express parser remains unchanged.
Existing Cache-Control:no-store and safe error envelopes apply; failures expose no
SQL/stack/secret or fabricated zero data.

One interactive RepeatableRead transaction performs three Ticket operations: scoped
status groupBy, scoped recent findMany and scoped Resolved findMany. Scalars sum the
aggregate, all buckets are prefilled with zero, and both lists select only
id/ticketNumber/summary/currentStatus/updatedAt. Serialization maps currentStatus to
uppercase status and dates to ISO UTC. meta.generatedAt is generated after reads.
There are no joins, N+1 queries, stored totals, schema changes or new indexes.

## My Tickets and navigation

Both existing list aliases accept all eight Prisma-spelled currentStatus values and
statusGroup=active. Group/status intersect through AND; Closed+active returns no rows.
Invalid/empty/repeated/structured new filter values fail safely. Existing ownership,
search/category/system/Requested Priority/sort/pagination/envelope remain.

Requester `/dashboard` adds Dashboard navigation; login/brand stay `/tickets`.
Staff/Admin `/staff/dashboard`, landing and navigation remain unchanged. The dashboard
uses the exact UI section 4 card/bucket/list hrefs, including usable zero links.
Uppercase-to-Prisma status conversion is explicit for all eight statuses.

My Tickets initializes/synchronizes query controls, preserves predicates through
pagination and restores back/forward state. Changed queries reset page 1; Reset clears
filters/sort/page size, including recent-only URLs. Search remains debounced 300 ms.
The existing History API architecture keeps pathname/search/hash independent.

App retains the entered Ticket's prior list URL in identity-scoped memory. Explicit
Back restores that same-user URL; direct/dashboard detail entry falls back to /tickets.
Other navigation/access loss/identity changes discard unrelated return state. Browser
Back/Forward uses the actual history URL. No protected data or return URL is persisted.

## Loading, errors, privacy and accessibility

Initial loading reserves busy space without fake zeros. Real empty data shows zero
links, empty lists and Create Ticket. Refresh keeps only same-user results and the
last successful server timestamp; recoverable failure labels retained data and offers
Retry. Initial failure has no metric/empty success. Successful refresh replaces data/time.

Identity-tagged results, request generations, cleanup and access events prevent late
responses/failures from restoring prior-user data. Role/password/activation loss clears
dashboard results and controls. My Tickets is keyed by identity/role and clears on
access loss; retrieval errors do not also display empty results. Existing App auth flow
handles expired sessions and mandatory password changes.

Retry/Refresh reuse Issue #61's focus intent: the stable focusable heading holds focus
while controls disappear/disable, then enabled Refresh receives focus after settlement
unless the user moved elsewhere. Semantic headings, real links, textual statuses,
ISO time attributes, status/alert announcements and Zen Green components remain.
Requester-scoped wrapping/card/busy CSS supports mobile/tablet/desktop and long text.

## File inventory

| File | Responsibility |
|---|---|
| server/src/routes/requesterDashboard.ts (new) | Role/raw-query/error boundary |
| server/src/services/requesterDashboard.ts (new) | Three scoped snapshot reads and exact DTO |
| server/src/app.ts | Register endpoint behind existing gates |
| server/src/routes/tickets.ts | All statuses and active intersection |
| client/src/components/RequesterDashboardScreen.tsx (new) | Cards/lists/refresh/privacy/focus |
| client/src/api.ts | DTO/helper/status mapping/list transport |
| client/src/App.tsx | Dashboard route, requester keys and detail return URL |
| client/src/components/AppShell.tsx | Requester Dashboard navigation |
| client/src/components/MyTicketsScreen.tsx | URL filters/history/request safety/errors |
| client/src/theme.css | Scoped responsive wrapping/card rules |
| server/tests/lab-04/requesterDashboardFixture.ts (new) | Multiple Requesters in guarded disposable fixture |
| server/tests/lab-04/requester-dashboard.api.test.ts (new) | Independent counts, safe rows, ties/caps/legacy semantics |
| server/tests/lab-04/requester-dashboard-authorization.api.test.ts (new) | Session/password/role/query/injection/errors |
| server/tests/lab-04/requester-dashboard-snapshot.api.test.ts (new) | Empty own population and deterministic real overlap |
| server/tests/lab-04/requester-dashboard-drilldowns.api.test.ts (new) | Both aliases, count/list parity and intersection/validation |
| server/tests/lab-04/performance-smoke.test.ts | Three scoped operations/projections and EXPLAIN |
| server/tests/lab-02/my-tickets.api.test.ts | Closed is now valid; preserve rejection test using invalid uppercase CLOSED |
| client/tests/lab-04/requesterDashboardFixture.ts (new) | Typed UI fixture |
| client/tests/lab-04/RequesterDashboard.test.tsx (new) | Metrics/states/access/late responses/focus |
| client/tests/lab-04/requester-dashboard-api.test.tsx (new) | Typed transport and safe errors/events |
| client/tests/lab-04/RequesterDashboardDrilldowns.test.tsx (new) | Links/list URLs/history/detail return and isolation |
| client/tests/lab-02/MyTickets.test.tsx | URL isolation plus full status/group and failure recovery |
| client/tests/lab-04/DashboardDrilldowns.test.tsx | Superseded requester navigation expectation; staff checks retained |
| client/e2e/lab-04/requester-dashboard.spec.ts (new) | Real personal metrics/privacy/navigation/recovery/held identity switch |
| client/e2e/lab-04/dashboards.spec.ts | Preserve staff denial; expect requester Dashboard href |
| client/e2e/lab-04/responsive.spec.ts | Requester 375/768/1280 layout/navigation/screenshots |
| client/e2e/lab-04/accessibility.spec.ts | Requester keyboard/focus/200% text/screenshots |
| docs/lab-04/requester-dashboard.md (new) | This implementation/evidence record |
| docs/lab-04/tests.md | Current coverage/results |
| docs/lab-04/reviewer.md | Independent-review preparation |
| docs/lab-04/ai-use.md | Authorized AI work and limitations |

Inventory: 17 modified tracked files, 14 new files. References are unrelated.
Issue #61 production service/route/screen/Queue and all its assertions remain intact.
Only navigation assertions explicitly superseded by #62 change. The Lab 2 invalid-status
input changes because Closed is now approved; its 400/code assertions are retained.

## Coverage and actual verification

41 added backend cases: 4 calculations, 20 authorization, 2 snapshot/empty,
14 drilldown/validation and 1 performance. 40 added client cases: 19 dashboard,
8 transport, 11 drilldown/state and 2 My Tickets. 13 added browser cases:
7 Requester flows, 3 responsive and 3 accessibility.

Independent database predicates cover multiple Requesters, all statuses, inactive/null
owners, terminal/legacy rows, zero buckets, foreign newest rows, tied ordering and caps.
A real transaction barrier pauses after groupBy, commits a status/activity change on
another connection and proves both lists/counts retain the old snapshot; next GET sees
new state. No sleep is used as concurrency proof. Query rejection spies prove zero
calculation calls, including parser-discarded raw keys. Both aliases match full filtered
totals, including active intersections. Safe projections contain exactly five fields.

Client/browser coverage includes all approved destinations, truthful timestamp, empty
versus failure, role/session clearing, late success/failure, identity switches, URL
restoration, explicit detail return and keyboard Retry/Refresh focus. Browser scenarios
use real services; network/failure/held response states use controlled interception.

| Working directory | Exact command | Actual result |
|---|---|---|
| Root | npm.cmd run build --prefix server | Passed |
| Root | npm.cmd run build --prefix client | Passed |
| Root | npm.cmd test --prefix client -- tests/lab-04 | 172 passed, 0 failed, 11 files |
| Root | npm.cmd test --prefix client | 302 passed, 0 failed, 25 files |
| server | npm.cmd run test:isolated -- tests/lab-04 | 377 passed, 0 failed, 15 files |
| server | npm.cmd run test:isolated | 586 passed, 0 failed, 35 files |
| server | npm.cmd run test:e2e -- lab-04/requester-dashboard.spec.ts | 7 passed, 0 failed |
| server | npm.cmd run test:e2e | 53 passed, 0 failed |
| server | npm.cmd run test:e2e -- lab-04/responsive.spec.ts lab-04/accessibility.spec.ts | 12 passed, 0 failed |

The final label-only correction was verified by client build, complete 302-case client
regression and the 12-case browser layout/focus rerun. All previous 545 backend,
262 client and 40 browser cases remain passing; case totals increased by 41/40/13.
Eleven existing migrations deploy without drift only in disposable schemas.
No known failing test remains. These results do not claim final-main/release approval.

Screenshots were generated and visually inspected at 375/768/1280 px and 200% text:
client/node_modules/.cache/requester-dashboard-375.png,
requester-dashboard-768.png, requester-dashboard-1280.png and
requester-dashboard-text-200.png. Cards stack into one/two/four columns, rows and
scope text wrap, and controls do not overlap or create document overflow. Screenshot
review caught and verified the correction of a scope-label encoding artifact.
Keyboard focus is also browser-tested; formal contrast/screen-reader audit is unclaimed.

Intermediate failures: generated test-import typos caught by server build; sandbox
Vite/Vitest/Prisma spawn EPERM required approved outside-sandbox reruns. Backend fixture
cookie initially used a UUID instead of the required 64-hex token (two failures), then
a fixture had only four Resolved rows while asserting five (one failure). Corrected token
and population preserve intended assertions. Browser Back locator omitted its visible
arrow (one timeout); corrected locator and unchanged navigation assertions pass. Full
backend found the superseded Lab 2 Closed-rejection expectation; corrected input to
invalid uppercase CLOSED while preserving its rejection checks. No existing assertion
is removed to conceal a regression.

Performance smoke: 150 own Tickets, three logical operations, 1120-byte response.
Scoped EXPLAIN used Ticket_requesterId_idx plus sort and Limit on this small fixture.
Measured request-plus-plan intervals were 102 ms focused and 16 ms in the final full run; this is local
Windows/Node 24/PostgreSQL evidence, not a production latency budget or physical SQL count.
Only existing generated disposable schemas were migrated/seeded; no developer-schema
writes or changes to runners/schema/migrations/seeds.

## Remaining limits and scope

No known production defect is claimed fixed outside #62. Subsequent writes can change
list totals after the dashboard snapshot. Request-time account/role checks retain the
existing middleware model, not a new mid-request revocation-lock protocol. Production-scale
benchmarking, manual screen-reader/formal contrast and comprehensive actual browser zoom
checks remain unclaimed. Automated 200% text reflow is not a complete zoom audit.

Issue #62 only: existing creation/detail/attachments/Public Comments/Internal Notes,
Actions lifecycle/revisions/replay, Ticket workflow/gate/owner/priority and staff Queue
remain. No #63/#64 hardening/release, human approval, PR, commit or main verification.
References were neither inspected nor modified. Final Git/whitespace checks are recorded
with final results; build/test screenshots remain ignored verification artifacts.

## Final Git safety audit

Branch remains feature/sprint4-requester-dashboard. HEAD, local lab4-staging and merge
base remain 8ee1b934ad1a4c9b8f0212c2d4cda792912bd3b2. Index is empty.
Tracked diff and all 14 new files pass whitespace checks; ordinary diff does not
include new files. New-file enumeration explicitly excludes docs/references/**;
status reports the unrelated directory without inspecting its contents.
Only the 31 inventory files changed; generated builds/tests/screenshots remain ignored.
No references, schema/migration/seed, staff production code, branch or remote changes.
