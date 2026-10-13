# Issue #59 — Actions Taken UI and Ticket Detail integration

Implemented for review on `feature/sprint4-actions-ui`, 2026-10-12.
The approved engineering contract is unchanged. No Git staging, commits,
branch switching, pushes, PRs or merges were performed.

## Changed files

| File | Purpose |
|---|---|
| `client/src/components/ActionsTaken.tsx` | Shared bounded history, inline staff forms, assignment/lifecycle controls, validation, recoverable drafts and feedback |
| `client/src/components/StaffTicketDetailScreen.tsx` | Staff/Admin integration and confirmed parent detail refresh |
| `client/src/components/TicketDetailScreen.tsx` | Owned-ticket Requester read-only integration |
| `client/src/api.ts` | Action DTO/input/envelope types, existing fetch/error convention, safe Action field error mapping |
| `client/src/App.tsx` | Include authenticated user ID in staff detail key to prevent reuse across identities |
| `client/tests/lab-04/ActionsTaken.test.tsx` | 42 component cases covering history, forms, lifecycle, permission, pagination, replay and deferred lookup/history responses |
| `client/tests/lab-04/ActionsTicketIntegration.test.tsx` | 15 real parent-child component cases covering refresh recovery, preserved identity/version, access loss and workflow review |
| `client/tests/lab-04/actions-api.test.tsx` | 13 real-client transport/error-envelope cases |
| `client/e2e/lab-04/actions-taken-flow.spec.ts` | Real-service cross-role lifecycle, committed-create response loss/replay, workflow recovery and keyboard/reflow checks |
| `client/playwright.config.ts` | Discover both existing Lab 3 and new Lab 4 browser directories |
| `client/tests/lab-02/TicketDetail.test.tsx` | New history fixture and explicit Lab 4 read-only contract assertions |
| `client/tests/lab-02/Attachments.test.tsx` | New history fixture; attachment assertions unchanged |
| `client/tests/lab-03/StaffTicketDetail.test.tsx` | New history fixture; existing staff assertions unchanged |
| `client/e2e/lab-03/ui-compliance.spec.ts` | Mock new history GET; retain strict unexpected-request assertion |
| `docs/lab-04/actions-ui.md` | This implementation, verification and scope record |

No dependencies, backend code, schema, migrations, seed definitions or reference
files changed. Existing automated infrastructure was sufficient.

## Role experience and API

Both existing detail screens show every permitted current Action state, original
date/performer, current assignee/role, status, description, full Result, follow-up
flag/note, attachment notes, created/updated timestamps and version. Native
details disclosure expands full content. Null notes show None. Dates use semantic
time elements and the browser's local timezone. Text is rendered as React text.
Action assignment is separate from the existing Ticket Ownership section.
Historical ineligible assignees remain visible.

Requesters use GET `/api/tickets/:ticketId/actions`; staff/Admin use GET
`/api/staff/tickets/:ticketId/actions`. Requester ownership, session and role
enforcement remain in the existing backend. The read-only section has no editor,
staff lookup, mutation control, private notes or revision management.

History preserves server order (`createdAt ASC, id ASC`) and uses the documented
`data/meta` envelope. Previous/Next and 10/20/50 page sizes expose the complete
bounded collection, default 20. Staff `#action-<UUID>` deep links use
`focusActionId` without an explicit page, focus/highlight the bounded target and
handle missing targets safely. Hash/back navigation updates the target.

Staff creation POSTs to the staff history path; content, reassignment, completion
and cancellation PATCH its `/:actionId` child. DTOs include safe performer and
assignee projections, Action version and mutation `meta.workflowVersion`.
Both 201 creation and 200 replay succeed. Same-origin session transport and the
existing session-access-changed flow are retained; no second API client exists.
The existing GET `/api/staff/tickets/owners` supplies active staff/Admin options.
No new public lookup or backend authorization change was necessary.

## Forms, validation and lifecycle

Add Action opens an inline PENDING form with automatic date and original session
performer. Assignee defaults to the current user. Edit opens the same content
form with the read Action version. Required description/result accept 1–2000
characters after trim; optional notes accept up to 2000, blank maps to null.
All text rejects NUL. Follow-up is an explicit boolean; true requires a note.
Optional notes remain when follow-up is false. Clearing a COMPLETED Action's
true flag requires a new nonblank explanation different from the server plan.
Only documented content/assignee/status/key/version fields are sent.

PENDING Actions allow completion or cancellation. Completion confirms Ticket,
reviewed Result and current operator; eligibility is required. Cancellation
opens a reason-entry mode in Result, then separately confirms cancellation and
current operator. Previously recorded Result remains in backend revisions.
Terminal Actions expose content correction only, without state/assignee writes.
Pending assignment and creation require an active parent Ticket. Add is disabled
with reopen guidance on terminal Tickets. Existing pending cleanup remains
possible on a cancelled Ticket. Parent-policy errors explain explicit reopening;
no Ticket resolution gate or new Ticket workflow is implemented.

On TICKET_WORKFLOW_CONFLICT, the form blocks another mutation until explicit
Refresh Ticket and Actions for review. This fetches the existing parent detail
and bounded history, keeps the draft and expected Action version, updates the
Ticket status/available existing transitions, and announces the current state.
It does not retry a mutation. Fresh creation remains disabled on a terminal
parent; an exact uncertain-operation replay may still reach the backend.

Linked safe backend field errors, network/server errors, loading, empty,
submission and success states preserve recoverable drafts. A synchronous request
guard and disabled controls prevent duplicate writes. Permission/session loss
clears protected Action content/forms; superseded history responses are ignored.
After confirmed writes, bounded history and staff Ticket detail refresh are
requested. A recoverable parent refresh failure retains the last successfully
loaded Ticket and mounted Action component, including drafts, read versions and
pending create identity. A warning identifies the detail as previously loaded;
Retry or Refresh Ticket detail repeats the GET without another mutation.
Initial-load failure has no cached detail to show. Session/password, 403 and
404 parent failures clear protected detail. An Action-level 401/403/password
failure also clears the entire parent and invalidates pending detail responses.
Ticket/user/role keys reset state on identity changes; parent, history and lookup
generations ignore superseded responses.

Confirmed Action-save feedback stays visible if the following parent refresh
fails. History Retry stores the failed Ticket, role endpoint, page/page size or
focus query and repeats that exact GET, rather than using the last successful
page. New page-size/identity requests replace obsolete retry state. Eligible-user
lookups have an independent generation and latest-request loading/error state:
an older success or failure cannot override the latest lookup.

## Concurrency and creation retries

Every PATCH sends the version read into the editor. CONFLICT or
ACTION_STATE_CONFLICT blocks further writes and retains the draft. Reload for
review reads the bounded target page and displays all current server content.
Using the current version requires an explicit button; it does not submit.
A subsequent explicit save retries with that version. Newly terminal records
remove lifecycle/assignment controls while retaining the correction draft.
Nothing automatically overwrites another user's Action.

A UUID create key is retained with the complete normalized original request and
its fingerprint for the logical operation. Network/5xx outcomes are treated as
uncertain. An unchanged uncertain retry submits that stored request and key even
if the refreshed lookup no longer contains the original assignee, or the current
parent is terminal: the backend performs original revision-1 comparison before
current eligibility/parent checks. Current eligibility is still required for a
new or changed create. Changed attempted content requires confirmation that this
starts a new logical Action, then uses a new UUID. Known rejected requests do
not bypass eligibility. Discard/new resets the key. Backend
IDEMPOTENCY_CONFLICT gets explicit review guidance; successful replay is handled
like confirmed creation. No browser storage of drafts or keys is added.

## Accessibility

Reuse Zen Green, StatusBadge, FormField and ErrorAlert. Controls have visible
labels and meaningful names; required inputs carry required semantics; errors
use aria-invalid/aria-describedby. Failed validation focuses its first field.
Opening the inline form focuses Description; cancellation reason focuses Result;
save/discard returns focus to its Action or Add button. Native confirmations
manage their own keyboard/focus behavior. Native details, checkbox and select
controls remain keyboard operable. Status uses text plus distinct badge variants;
loading/success use role=status, errors use alerts and the region exposes busy.
Entries and controls wrap without a new theme or wide table.

The Follow-up Note requirement is calculated once from either true follow-up or
clearing a previously true COMPLETED flag. It drives the visible required marker,
native required and aria-required attributes, linked explanation helper and
validation. Empty/unchanged explanations remain rejected; a valid new explanation
is sent with the false flag and the expected version.

Browser checks prove keyboard opening, validation focus, discard focus return
and no document overflow at 375/768/1280 px. They do not establish a comprehensive
manual contrast, 200% zoom or screen-reader audit; final visual evidence belongs
to #63/#64.

## Original verification before review corrections

Commands and final results are recorded below after execution. Server runners
create generated disposable schemas, migrate/seed only those schemas and clean
them up. The developer database is not a test target.

| Working directory / command | Actual result |
|---|---|
| Repository: `npm.cmd run build --prefix client` | Passed TypeScript and Vite production build |
| Repository: `npm.cmd test --prefix client` | 166 passed, 0 failed, 16 files: 123 existing Lab 1–3 cases + 43 new Lab 4 cases |
| Server: `npm.cmd run test:isolated -- tests/lab-04/actions-taken.api.test.ts tests/lab-04/action-validation.unit.test.ts` | 117 passed, 0 failed, 2 files (57 API integration + 60 validation); 11 migrations deployed, no drift |
| Server: `npm.cmd run test:e2e -- lab-04` | 4 passed, 0 failed |
| Server: `npm.cmd run test:e2e` | 22 passed, 0 failed: all 18 existing Lab 3 cases + 4 new Lab 4 cases |
| Repository: `git diff --check` and `git diff --no-index --check -- NUL <each added file>` | Passed with no whitespace errors |

Tracked whitespace check returned 0. Added-file no-index comparisons returned 1
because each new file differs from NUL, with only LF/CRLF conversion notices and
no whitespace diagnostics. A direct audit of all five added files found zero
trailing-whitespace errors. Scope check found exactly the 14 files above; the
pre-existing untracked `docs/references/` remains untouched. The index has no
staged changes and the current branch remains `feature/sprint4-actions-ui`.

Initial sandbox launches of Vite/Prisma/esbuild failed with spawn EPERM before
their tests ran; approved reruns executed successfully. Intermediate component
runs had 4 failed/119 passed, then 1 failed/148 passed, then 1 failed/161 passed.
They exposed missing history fixtures and outdated Lab 2 prohibitions on shared
Actions and any combobox. Lab 4 explicitly requires history and read-only
pagination: assertions now require both while prohibiting mutation controls,
private notes and workflow/assignment selectors. Existing unrelated assertions
were retained. An intermediate Lab 3 browser run had 15 passed/3 failed because
its strict interceptor lacked the new GET; the fixture was added without
weakening the unexpected-traffic assertion. An intermediate full component run
passed 162/0 before four additional failure-state tests; the original component
count was 166/0. No failing checks are counted as passes.

## Six-finding review corrections, 2026-10-12

The review correctly found that the original isolation-only refresh test did
not exercise parent unmounting, and that eligible-list validation could prevent
backend-supported replay. The original broad claims about preserved drafts,
refresh recovery and safe replay were stronger than that evidence. The behavior
above describes the corrected implementation; the original verification table
is historical evidence, not proof of those previously missing cases.

This correction changes six Issue #59 files: the two Action/detail components,
the existing Action component test, the new parent-child integration test,
the existing Lab 4 browser test and this record. No Lab 2–3 assertions were
modified or weakened during the corrections. The complete Issue #59 inventory
now contains 15 files, including six new files; references remain untouched.

| Finding | New regression evidence |
|---|---|
| 1, parent refresh | Real StaffTicketDetailScreen/ActionsTaken integration: committed-in-memory uncertain POST retains exact request through a failed comment-triggered refresh; one record on replay; confirmed save/failed refresh retains feedback; network/500 preserves the same editor DOM node and expected version; initial failure, 401/403/404, Ticket/user/role switching and late responses clear/ignore protected data |
| 2, exact replay | Component: old assignee excluded after lookup refresh, original request/key still submitted; changed intent requires eligible replacement/confirmation/new UUID. Browser: real backend POST commits 201, only its response is aborted, Administrator deactivates a dedicated disposable assignee, exact retry returns 200 with replay header/same Action ID; total remains one and version remains one |
| 3, pagination retry | Distinct page-2 records/metadata after failed page 2 then retry; exact focus-query retry; page-size/identity retry reset; controlled older history response cannot replace a newer result in the same mounted component |
| 4, parent workflow | Component and real browser: another actor changes parent to CANCELLED, Action mutation conflicts, explicit parent/history review updates status and REOPENED option without another mutation; draft remains |
| 5, accessibility | Required marker/native required/aria-required, associated explanation helper, linked error, empty rejection, valid explanation and exact false-flag/version payload |
| 6, lookup ordering | Controlled promises: newer success then older success/failure; newer failure then older success; Ticket/user change invalidates old results; latest options/error/loading retained |

The correction adds 27 client cases (12 Action cases + 15 parent integration
cases) and one real-service browser case. The 13 transport cases remain unchanged.
An initial no-emit TypeScript check found one redundant narrowed comparison and
two unsupported test-query options; those were corrected. The first focused run
passed 67/0, then 70/0 after three additional Action-level access-loss cases.
An intermediate complete client run passed 190/0; an intermediate complete
browser run passed 23/0. Final correction verification is recorded below.

| Working directory / exact command | Final correction result |
|---|---|
| Repository: `npm.cmd run build --prefix client` | Passed TypeScript and Vite production build |
| Repository: `npm.cmd test --prefix client -- tests/lab-04` | 70 passed, 0 failed, 3 files (42 Action + 15 integration + 13 transport cases) |
| Repository: `npm.cmd test --prefix client` | 193 passed, 0 failed, 17 files: all 123 existing Lab 1–3 cases + 70 Lab 4 cases |
| Server: `npm.cmd run test:isolated -- tests/lab-04/actions-taken.api.test.ts tests/lab-04/action-validation.unit.test.ts` | 117 passed, 0 failed, 2 files: 57 API + 60 validation cases |
| Server: `npm.cmd run test:e2e` | 23 passed, 0 failed: all 18 existing Lab 3 cases + 5 Lab 4 cases; includes real committed-create response loss/inactive-assignee replay |
| Repository: `git diff --check`, no-index checks against NUL and direct added-file whitespace audit | No whitespace errors; six added files each have zero trailing-whitespace errors |
| Repository: `git diff --name-only lab4-staging`, `git status --short`, `git diff --cached --name-only`, `git branch --show-current` | Exactly 9 tracked + 6 added Issue #59 files; no staged changes; still `feature/sprint4-actions-ui`; pre-existing references untouched |

Both isolated backend/browser runners deployed the existing 11 migrations and
reported No difference detected. Fixtures, account changes and API services
targeted only generated disposable schemas, with runner cleanup; no developer
records were modified. No schema/migration/seed/backend definition changed.
No additional database checks or server build were necessary for these client
corrections. All executed correction test runs passed; the initial TypeScript
diagnostics above were fixed before the successful production builds.

The two Major findings are now resolved with actual integrated failure/retry
evidence. Remaining limits are intentional navigation losing memory-only drafts/
keys, backend authority over changing eligibility/parent status, the existing
#60 workflow dependency and the manual accessibility checks stated above.

Server build/full server regression were not rerun: no backend files changed.
Relevant real backend integration tests did run. This record claims no final
main, release, peer approval or complete Sprint 4 regression.

## Contract traceability and deferred work

- FR-01–FR-05, FR-07 action portion, FR-13, FR-16–FR-18; AC-01–AC-07,
  AC-12, AC-17/18, AC-23, AC-25–AC-29 action UI portions: implemented with
  component/API/browser and existing backend evidence.
- T-31–T-33, T-61/T-62: component/transport coverage in the new Lab 4 tests.
  T-42: existing component regression; T-44/T-45: focused Action keyboard/reflow
  coverage; T-46/T-63: focused real cross-role Action lifecycle.
- Immutable revision/actor and account-race guarantees remain backend concerns;
  the existing 117-test focused suite passes. No revision browser is added.
- #60 retains Ticket resolution gate/workflow token/summary implementation.
  Current Lab 3 Ticket status calls remain unchanged and ungated, as documented
  by #58. Mutation parent versions are available from the Action API, but the
  future workflow integration must consume the #60 detail contract.
- #61/#62 retain dashboards; only the existing supported Action hash target is
  integrated here. #63/#64 retain product-wide hardening, full visual/zoom/
  screen-reader review and release evidence.

No contract conflict or missing eligible-user capability blocked implementation.
Keys/drafts are intentionally in memory: leaving the detail page loses them.
Backend remains authoritative if eligibility or parent status changes after
the UI loads. No persistence/recovery service, undocumented action transition,
workflow rule, dashboard or redesign was introduced.
