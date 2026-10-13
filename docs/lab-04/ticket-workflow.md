# Issue #60 — Ticket Workflow and Resolution Rules

Implemented for review on `feature/sprint4-ticket-workflow`, based on `18c161c`,
2026-10-13. The user supplied the actual Issue #60 objective, ten tasks and seven
acceptance criteria and authorized implementation. This record describes the
working tree, not a commit, peer approval, PR, merge or release.

## Approved transitions and authorization

The eight Prisma values and API mappings are unchanged:
New/NEW, Open/OPEN, InProgress/IN_PROGRESS,
WaitingForRequester/WAITING_FOR_REQUESTER, Resolved/RESOLVED, Closed/CLOSED,
Reopened/REOPENED, Cancelled/CANCELLED.

| Current API status | Permitted destinations |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CANCELLED | REOPENED |

All omitted/self pairs return 409 CONFLICT. Active IT_STAFF/ADMINISTRATOR with
a valid session and completed password change may perform permitted transitions
on the shared Ticket scope; ownership is not a prerequisite. Requesters receive
403 before resource lookup. Existing authentication, account and role middleware
remain authoritative. Unknown statuses and invalid/missing versions return 400
VALIDATION_ERROR; missing Tickets return 404 TICKET_NOT_FOUND.

## Resolution, closing and history

Let C=count(COMPLETED), P=count(PENDING), F=count(COMPLETED with
followUpRequired=true). Entry to RESOLVED requires C>=1, P=0, F=0.
CANCELLED records neither qualify nor block, including their historical
follow-up flags. Completed results are validated by the existing Action API.
RESOLVED -> CLOSED uses the same gate when Actions exist; a legacy zero-Action
resolved Ticket can close. Existing legacy terminal Tickets remain readable.
Reopening permits new work without reopening terminal Actions. Re-resolution
uses the normal gate; existing reviewed completed Actions may qualify.

Gate rejection is 409 RESOLUTION_REQUIREMENTS_NOT_MET with
`error.reasonCodes`: NO_COMPLETED_ACTIONS, PENDING_ACTIONS, FOLLOW_UP_REQUIRED.
Every applicable reason is returned in that order. Errors include no Action
content, private notes, SQL or credentials. No synthetic work or resolution text
is created. Ticket status mutations leave Actions/revisions, ownership and
requester advisory timestamps unchanged; cancellation never cascades.

History continues through existing Ticket fields/timestamps, Action projections
and immutable actor-stamped revisions. This scope adds no Ticket status-history
table, resolver field, resolution date/text or new event type. Existing Action
ordering remains createdAt ASC/id ASC and revision ordering version ASC.

## Version protocol, transactions and locks

The existing `PATCH /api/staff/tickets/:ticketId/status` now requires
`{status, expectedWorkflowVersion}`. The version must be a JSON safe integer in
the existing Prisma Int range, 0 through 2147483647; coercion, missing/null,
fractional/negative/string values and undocumented body fields are rejected.
Success returns `{data:{status,workflowVersion}}` with version incremented once.
Tokenless old callers intentionally receive 400; deploy client/server together.

`ticketWorkflow.ts` owns the unchanged matrix, bounded grouped Action counts
and formal transition transaction. Order: middleware authorization -> body
validation -> parent Ticket FOR UPDATE -> fresh Ticket read/existence -> stale
version comparison -> matrix -> required gate -> conditional status/version
update. Prisma advances updatedAt in that same write. Rejection/failure rolls
back completely; P2034/P2028 transaction errors return safe CONFLICT, other
unexpected errors generic 500. No mutation is automatically retried.

Action mutations already lock the same Ticket before their mutable checks.
Their Ticket -> Action -> eligible-assignee User ordering and FOR NO KEY UPDATE
User lock remain unchanged. Formal transitions need only the parent lock;
there is no global workflow lock or new per-child lock. A winning Action write
advances the workflow token, so an old status request conflicts even if its
destination could otherwise be valid. A winning restrictive status prevents
new/reassigned pending work; existing terminal corrections must preserve the
post-write gate. Existing exact Action replay compares immutable revision 1
before current business checks and changes no versions/timestamps/revisions.

Owner/priority API payloads and version behavior remain unchanged. Requester
indication, comments and notes do not advance workflowVersion. Prisma's existing
automatic updatedAt behavior is retained.

## Staff detail snapshot and UI

The existing staff detail GET preserves every prior field and adds
workflowVersion, actionsTakenSummary (totalItems, pendingItems, completedItems,
cancelledItems, followUpRequiredItems) and resolutionEligibility
(eligible, reasonCodes). The Ticket and grouped counts use one RepeatableRead
transaction. Summary counts load no Action text and eligibility is independent
of whether RESOLVED is a current permitted destination.

The Staff/Admin screen displays the current status, permitted destinations,
counts, eligibility and all blockers, with cancelled/advisory explanations and
an accessible link focusing Actions Taken. Resolve remains available so the
backend can return current gate failures; it does not silently bypass validation.
Legacy close is explained separately. Native confirmations identify Ticket
number/current/destination, attest resolution review and explain close/reopen/
cancellation implications. Dismissing confirmation sends no mutation.

The status client sends the version from the last detail GET. A synchronous
pending guard prevents duplicate submissions. Status mutations are disabled
during parent refresh or unresolved conflict review. Stale conflicts retain
unrelated drafts, pause workflow and offer explicit Refresh Ticket detail.
Successful GET resets the destination selection; staff must choose/confirm again.
Gate failures have separate feedback and documented reason-code parsing.

A confirmed PATCH announces success before refresh. Recoverable GET failure
retains that confirmation and previously loaded detail, pauses workflow, preserves
the mounted Action editor/draft/key and offers GET retry. It never repeats the
PATCH. Identity/Ticket/role keys and request generations discard superseded
responses; access loss clears protected parent/Action state. Actions are not
keyed by workflowVersion. The only Action component change makes its heading
programmatically focusable for the workflow review link.

Requester indication remains owned-ticket advisory-only: no formal status,
workflow version, owner or Action changes. Duplicate indication conflicts,
including after reopen; foreign indication safely fails. Requester detail and
creation endpoints and formal-control visibility are unchanged.

## Tests and acceptance traceability

| Actual test file | Coverage / approved IDs |
|---|---|
| `server/tests/lab-04/ticket-workflow.api.test.ts` (172) | Both roles/all 64 pairs; tokens/stale/ABA; gate truth table/close/legacy/reopen/advisory; authorization; version/history/rollback; snapshot consistency; deterministic races; AC-08–11/22/27/29, T-17–23/64/65 |
| `client/tests/lab-04/TicketWorkflow.test.tsx` (25 after review correction) | All eight destination lists; confirmation/cancel; counts/reasons/legacy close; synchronous duplicate prevention; conflict/review/failed refresh; actual mounted Action draft/key retention; access/late responses; eligibility refresh/labels/focus; AC-08–11/17/18/22/29, T-34/66 |
| `client/tests/lab-04/ticket-workflow-api.test.tsx` (6) | Exact token payload/new token, additive detail, safe reason whitelist/conflict/errors, no retries |
| `client/e2e/lab-04/ticket-resolution.spec.ts` (6) | Real reviewed Actions -> resolve -> close -> reopen -> re-resolve/cancel; requester advisory; stale recovery; confirmed status/failed GET/original Action replay; keyboard/reflow at 375/768/1280; workflow portion AC-21, T-47 and focused T-44/45 |

Race tests pause the first actual parent lock, observe the competing connection
blocked using pg_blocking_pids, then release. Both orderings cover resolve/create,
resolve/complete, resolve/cancel, close/valid correction, close/invalid correction,
cancel/reassign, reopen/create and status/status. Exact HTTP results and version
increments are required; timing/timeout does not count as success. Existing
terminal state must retain a valid gate. Earlier revision rows are compared
field-for-field. A snapshot test pauses after the detail Ticket read, commits an
Action completion, then proves the old detail still contains its original
version/counts/eligibility and the next GET contains the new consistent state.
A disposable trigger forces status failure; existing #58 tests still prove
rollback after Action projection/revision writes.

Lab 3's original 64-pair test is preserved, with qualifying Action creation/
completion and read tokens added. Its fixture cleanup deletes revision/Action
children before Tickets. Connected API workflow requests now supply tokens.
Client typed mocks add real contract fields; previous assertions remain, except
the intentional additional token argument. The #59 browser's direct cancellation
request reads its token. Strict browser unexpected-network assertions remain.

Confirmed Issue #60 criteria 1–6 are covered by these changes/tests. Criterion 7's
workflow-test portion is covered; its human review/PR targeting lab4-staging is
pending and intentionally not performed by this task.

## Verification results - original Phase 2 (historical)

Run on 2026-10-13 against this working tree. Exact commands/results are recorded
below; no passing main/release or human review is claimed.

| Working directory | Exact command | Result |
|---|---|---|
| Root | `npm.cmd run build --prefix server` | Passed TypeScript |
| Root | `npm.cmd run build --prefix client` | Passed TypeScript/Vite |
| Root | `npm.cmd test --prefix client -- tests/lab-04` | 100 passed, 0 failed, 5 files |
| Root | `npm.cmd test --prefix client` | 223 passed, 0 failed, 19 files |
| server | `npm.cmd run test:isolated -- tests/lab-04/ticket-workflow.api.test.ts` | 172 passed, 0 failed, 1 file |
| server | `npm.cmd run test:isolated -- tests/lab-04` | 297 passed, 0 failed, 6 files |
| server | `npm.cmd run test:lab3` | 139 passed, 0 failed, 10 files |
| server | `npm.cmd run test:workflow` | 1 passed, 0 failed |
| server | `npm.cmd run test:isolated` | 506 passed, 0 failed, 26 files |
| server | `npm.cmd run test:e2e -- lab-04/ticket-resolution.spec.ts` | 6 passed, 0 failed |
| server | `npm.cmd run test:e2e -- lab-04` | 11 passed, 0 failed |
| server | `npm.cmd run test:e2e` | 29 passed, 0 failed |

Initial sandbox client build/client tests/Prisma workflow runner failed at spawn
EPERM before feature tests executed. Approved outside-sandbox reruns ran normally.
An intermediate client build failed on unsupported Testing Library `exact` role
query options in a new test helper; fixed, then build passed. Initial workflow
browser run had 4 passed/2 failed because mobile setup expected a collapsed
navigation link; authentication setup now precedes viewport resize, preserving
workflow keyboard/reflow assertions. All six then passed. No failing run is
counted as a pass. An early client run emitted act warnings for a confirmation
test's unfinished refresh; awaiting completion removed those warnings.

Both database runners deploy the existing 11 migrations and verify No difference
detected only in strictly generated disposable schemas. Fixtures, triggers,
account operations, seeds and cleanup target those schemas. Browser services and
attachment storage are temporary. No developer schema was migrated, seeded or
modified. No Prisma schema, migration, seed or runner definition changed.

## Limitations, scope and safety

Authentication continues to check the current session/account at request entry;
this feature does not introduce commit-time revocation semantics or a new
authorization lock. Owner/priority concurrency semantics remain their existing
Lab 3 contract. Privileged SQL can bypass application rules/revision immutability.
Legacy zero-Action terminal Tickets are intentionally permitted on read/close.
Drafts/keys stay in memory and are lost on deliberate navigation, as in #59.

Keyboard/focus and viewport overflow have browser evidence; comprehensive manual
contrast, zoom and screen-reader/visual review remain #63/#64 responsibilities.
No dashboards, dashboard drilldowns, extra statuses/endpoints/history fields,
global locks, child cascades, notifications or release work were implemented.

Branch remains feature/sprint4-ticket-workflow. No staging, commit, push, PR or
branch switch. The separately managed untracked docs/references/ is untouched.
Final `git diff --check` passed. `git diff --name-status lab4-staging`,
`git diff --stat lab4-staging` and `git status --short` show exactly 13 modified
tracked files and six new Issue #60 files, plus the pre-existing references.
`git diff --cached --name-only` is empty; `git branch --show-current` is unchanged.
All six new files also passed direct trailing-whitespace auditing and no-index
whitespace checks against NUL (difference exit 1, no whitespace diagnostics).

### Complete file inventory

| File | Purpose |
|---|---|
| `server/src/services/ticketWorkflow.ts` (new) | Matrix, gate summary and parent-locked versioned transition transaction |
| `server/src/routes/staffTickets.ts` | Snapshot detail additions and strict status route/errors |
| `server/tests/lab-04/ticket-workflow.api.test.ts` (new) | 172 isolated workflow/security/race/snapshot/rollback tests |
| `server/tests/lab-03/staff-ticket-operations.api.test.ts` | Preserve 64-pair coverage with token/qualifying work/child cleanup |
| `server/tests/lab-03/cross-role-workflow.api.test.ts` | Supply workflow token in existing connected status calls |
| `client/src/api.ts` | Required detail/token types and safe gate reason parsing |
| `client/src/components/StaffTicketDetailScreen.tsx` | Workflow eligibility, confirmations, review and safe refresh/response lifetime |
| `client/src/components/ActionsTaken.tsx` | Programmatically focusable heading for workflow review link only |
| `client/tests/lab-04/TicketWorkflow.test.tsx` (new) | 25 workflow component/integration scenarios after review correction |
| `client/tests/lab-04/ticket-workflow-api.test.tsx` (new) | Six real transport/error tests |
| `client/tests/lab-04/ActionsTicketIntegration.test.tsx` | Add required snapshot fields to typed #59 fixture |
| `client/tests/lab-03/StaffTicketDetail.test.tsx` | Add snapshot fields/token response and intentional token argument assertion |
| `client/e2e/lab-04/ticket-resolution.spec.ts` (new) | Six real lifecycle/recovery/keyboard/reflow tests |
| `client/e2e/lab-04/actions-taken-flow.spec.ts` | Read token for existing direct cancellation; replay assertions unchanged |
| `client/e2e/lab-03/ui-compliance.spec.ts` | Add snapshot fields; retain strict network guard |
| `docs/lab-04/ticket-workflow.md` (new) | This implementation, verification, scope and limitation record |
| `docs/lab-04/tests.md` | Actual workflow paths/results and historical-plan distinction |
| `docs/lab-04/reviewer.md` | Review preparation and current runner facts, no approval claim |
| `docs/lab-04/ai-use.md` | Actual prompts/assistance/corrections and human responsibilities |


## Phase 3 - two critical-review corrections, 2026-10-13

The independent review identified two Minor findings. This correction phase
changes exactly seven existing Issue #60 files: StaffTicketDetailScreen.tsx,
the Lab 3 StaffTicketDetail component test, the Lab 4 TicketWorkflow component
test, ticket-workflow.api.test.ts, this record, tests.md and ai-use.md.
No backend production file, Action component, browser test, API signature,
schema/migration, authentication rule, router or theme changed in this phase.

### Finding 1: enabled parent controls silently discarded refresh-time clicks

The existing shared save guard rejects mutations while the parent GET is pending,
but owner/priority/communication controls previously disabled only on busy.
StaffTicketDetailScreen now derives parentMutationDisabled = busy || loading.
Priority select/Save, Claim, owner select/Save, public-comment and private-note
inputs/submissions all use it. Existing unchanged-value restrictions remain.
Status controls retain their additional workflowReview restriction. Refresh/Retry
reuse the same equivalent condition. The save guard and backend behavior are
unchanged; neither a new mutation nor an automatic retry is introduced.

Five new Lab 3 cases use controlled unresolved/rejected parent GETs. They assert
every affected button/input is disabled, disabled clicks send no mutations,
success restores usability, explicit priority sends one PATCH, Claim and owner
assignment work again, and retained communication drafts each submit once.
Recoverable refresh failure restores non-workflow controls while status remains
paused pending review. Three access-loss cases (401/403/404) clear protected
controls/drafts. Existing sequential tests now await the next control becoming
enabled before submitting; their original mutation assertions are retained.

One new Lab 4 case uses the actual mounted Action component: an uncertain create
fails, parent refresh remains unresolved, the same editor DOM/input survives,
then successful GET recovery and explicit Action retry submit exactly the
original normalized request and clientRequestId. The existing failed-refresh,
access-loss, pagination/lookup, stale-review and replay tests remain unchanged.
No Action key depends on workflowVersion and no parent refresh unmount was added.

### Finding 2: deterministic races did not assert error classification

The existing 16 race cases still pause a real Ticket lock and observe competing
PostgreSQL blocking with pg_blocking_pids before release. Synchronization, both
orderings, HTTP results, parent versions, terminal eligibility and field-for-field
earlier revision checks are unchanged. Rejected formal status writes now assert
CONFLICT unless the status-first resolve/complete or resolve/cancel scenario
actually fails its gate; those assert RESOLUTION_REQUIREMENTS_NOT_MET and exactly
[PENDING_ACTIONS]. Rejected Action operations assert TICKET_WORKFLOW_CONFLICT;
the competing formal status in status/status asserts CONFLICT. Non-gate errors
also assert absence of reasonCodes. These fixtures do not produce Action-version
conflicts, so no incorrect Action-version expectation was added.

The existing closing-gate fixture has zero completed/one pending Action and now
asserts HTTP 409, RESOLUTION_REQUIREMENTS_NOT_MET and exactly
[NO_COMPLETED_ACTIONS, PENDING_ACTIONS], retaining its full unchanged snapshot.
This is a real gate rejection, not an invented concurrent closing outcome.
Production error codes needed no correction. Backend test count remains 172;
stronger assertions do not count as additional cases.

### Actual correction verification

| Working directory | Exact command | Result |
|---|---|---|
| Root | `npm.cmd run build --prefix server` | Passed |
| Root | `npm.cmd run build --prefix client` | Passed |
| Root | `npm.cmd test --prefix client -- tests/lab-03/StaffTicketDetail.test.tsx tests/lab-04/TicketWorkflow.test.tsx` | 39 passed, 0 failed, 2 files (14 + 25) |
| Root | `npm.cmd test --prefix client` | 229 passed, 0 failed, 19 files |
| server | `npm.cmd run test:isolated -- tests/lab-04/ticket-workflow.api.test.ts` | 172 passed, 0 failed |
| server | `npm.cmd run test:isolated` | 506 passed, 0 failed, 26 files |
| server | `npm.cmd run test:e2e -- lab-04` | 11 passed, 0 failed |
| server | `npm.cmd run test:e2e` | 29 passed, 0 failed |

An initial client build again failed Vite/esbuild spawn EPERM in the sandbox;
approved outside-sandbox rerun passed. No correction test failures occurred.
The final focused backend run includes the added closing-reason assertion.
Client total increased by exactly six cases (five Lab 3 + one Lab 4); previous
223/24 totals above describe Phase 2. No existing assertion was weakened.
Database/browser runners deployed the unchanged eleven migrations and reported
No difference detected in generated disposable schemas only; the developer
schema was not modified. Full browser regression passed 29/0. Final
`git diff --check`, changed-file/stat/status/index/branch checks passed; the
index is empty and scope remains the original 13 tracked + six new Issue #60
files. All six untracked files were inspected separately and passed no-index
whitespace checks (difference exit 1, no whitespace diagnostics). No stage/commit/push/PR,
branch switch, reference edit or Issue #61-64 work.
