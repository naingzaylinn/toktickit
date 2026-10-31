# Issue #58 — Actions Taken backend implementation

Implemented on `feature/sprint4-actions-backend` for review, 2026-10-11.
The approved specification/API rules remain unchanged. This record covers the
backend portion of the contract; it does not claim UI, Ticket transition service,
dashboard, release or human review completion.

## Files and scope

| File | Purpose |
|---|---|
| `server/src/app.ts` | Register staff actions and requester history, including the existing requester alias |
| `server/src/routes/actionsTaken.ts` | Role guards, path/query/body validation, documented envelopes/status codes and safe errors |
| `server/src/services/actionValidation.ts` | Strict field whitelist, normalized text/notes, UUIDs, enums and version validation |
| `server/src/services/actionsTaken.ts` | Transactional creation/mutations/revisions, eligibility, replay, concurrency, terminal parent guard and snapshot pagination |
| `server/tests/lab-04/actions-taken.api.test.ts` | Real Prisma/Supertest authorization, lifecycle, history, rollback, concurrency and account-race tests |
| `server/tests/lab-04/action-validation.unit.test.ts` | Text/type/length/null/version/forbidden-field boundary tests |
| `docs/lab-04/actions-backend.md` | Implementation, verification, traceability and remaining integration responsibilities |

No Prisma schema/migration/seed, existing Ticket handler, client or reference
file changes. No branch switch, staging, commit, push or PR.

## API and authorization

| Method/path | Permission and behavior |
|---|---|
| GET `/api/staff/tickets/:ticketId/actions` | IT_STAFF/ADMINISTRATOR shared Ticket scope; bounded current history |
| POST `/api/staff/tickets/:ticketId/actions` | Same roles; 201 new Action, 200 exact replay with `Idempotent-Replay: true` |
| PATCH `/api/staff/tickets/:ticketId/actions/:actionId` | Same roles; versioned content/assignment/completion/cancellation, 200 success/no-op |
| GET `/api/tickets/:ticketId/actions` | REQUESTER only; database query constrains authenticated requester ownership |
| GET `/api/v1/tickets/:ticketId/actions` | Existing requester alias with identical protection/response |

Existing session middleware requires active account, valid unexpired hashed
session and completed initial-password change. Role guards precede resource
lookup. Staff are not restricted to Ticket Owner, original performer or current
assignee. Performer/editor derive exclusively from the session. Foreign and
missing requester Tickets return the same 404 TICKET_NOT_FOUND. Missing or
foreign-parent Actions return 404 ACTION_NOT_FOUND. No action deletion or audit
editing/browsing endpoint is exposed.

Current DTOs contain the seven shared fields, Ticket/Action IDs, safe performer
id/name/role, assignee id/name/role/isActive, status, version and ISO timestamps.
`actionDateTime` aliases original `createdAt`. Credentials, email, session data,
client request keys, private notes and revision rows are excluded.

GET uses `data` plus `meta {page,pageSize,totalItems,totalPages}`. Defaults are
page 1/size 20; allowed sizes 10/20/50. Ordering is createdAt ASC/id ASC for all
states, unaffected by edits. Staff-only UUID focusActionId selects the target's
page and cannot combine with explicit page. Invalid/repeated/unknown queries
return 400 INVALID_QUERY_PARAMS. Missing/foreign focus is safe 404. Valid pages
beyond the total return an empty list with actual totals. All ownership, target,
count and paginated row reads run in one RepeatableRead transaction. Explicit
relation projections load users in bulk, without per-action queries.

## Validation, assignment and lifecycle

Create requires UUID clientRequestId, trimmed description/result of 1–2000
characters and an actual JSON boolean followUpRequired. Optional notes accept
omission/null/text up to 2000 trimmed characters; blank becomes null. True
follow-up requires a nonblank note. False does not silently erase an existing
note on PATCH. Request bodies must be objects containing only documented fields;
all server-owned identity, date, parent, key/version and audit injection fails.
Malformed JSON uses the existing safe application error handler. Invalid input
returns 400 VALIDATION_ERROR with field-specific errors.

U+0000 is rejected in all four text fields before persistence on creation and
PATCH, returning 400 VALIDATION_ERROR with the offending field identified.

PATCH requires a positive integer expectedVersion and at least one documented
mutation field. It preserves omitted fields and validates merged content. Null
is permitted only for optional notes. Unknown Action statuses fail validation.
UUID assignee input defaults to the performer only when omitted on create.
Explicit malformed/null/missing/inactive/requester-role targets and an ineligible
assignee on completion return 400 INVALID_ACTION_ASSIGNEE with assigneeId error.
Historical inactive assignees stay visible; content corrections/cancellation do
not require inherited assignee eligibility. Reassignment restores eligibility
without changing Ticket ownership, original performer or date.

Actions start PENDING/version 1. Only PENDING→COMPLETED or PENDING→CANCELLED are
allowed. Cancellation requires explicitly submitted nonblank actionResult.
Completion requires valid merged result and eligible merged assignee. Terminal
records permit content corrections, but no state or assignee writes, including
same-state/same-assignee submissions (409 ACTION_STATE_CONFLICT). Clearing an
existing COMPLETED action's true follow-up flag requires an explicitly supplied,
nonblank new explanation different from its old trimmed note.

Creation and any explicit pending assignment require parent New/Open/InProgress/
WaitingForRequester/Reopened. Existing pending completion/cancellation can occur
on a cancelled parent and never change Ticket status. Real mutations under
Resolved/Closed must leave completed≥1, pending=0 and completed-follow-up=0;
cancelled actions do not block or qualify. Violations return 409
TICKET_WORKFLOW_CONFLICT and require explicit reopening. Matching-version no-ops
still validate state/eligibility, but make no writes.

## Atomic audit, concurrency and idempotency

Explicit write lock order is Ticket → Action (PATCH) → affected assignee User.
Ticket/Action use FOR UPDATE; assignee eligibility uses FOR NO KEY UPDATE.
Action creation also references performer and assignee Users; revision inserts
reference editor and assignee Users. Their implicit FK FOR KEY SHARE checks are
compatible with FOR NO KEY UPDATE. Thus reciprocal assignments on different
Tickets cannot form the previous assignee-lock/performer-or-editor-FK cycle.
Role/isActive UPDATEs acquire conflicting NO KEY UPDATE locks, protecting the
eligibility check through commit; key changes/deletions also conflict. Unrelated
Ticket operations require no global serialization. See PostgreSQL's
[row-lock compatibility documentation](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).
Under ReadCommitted, a waiting writer reads the committed row after acquiring
its lock. PATCH checks expectedVersion before state-dependent rules and also
uses an atomic `updateMany` predicate on ID/Ticket/version. Stale requests,
including stale no-ops, return 409 CONFLICT without automatic mutation retries.
Prisma deadlock/transaction-race errors are mapped safely; unexpected failures
return generic 500 INTERNAL_SERVER_ERROR.

Creation saves projection plus nested full revision 1 in a transaction. Every
real PATCH conditionally updates projection, appends exactly one full revision
n+1 with session editor, and advances parent workflowVersion/updatedAt exactly
once. Combined assignment/content/state changes remain one revision. Original
performer/date are never included in update data. Earlier revisions have no
application update/delete path. The first terminal-state revision permanently
identifies the actual completing/cancelling actor even after later corrections.
The transaction rolls back all projection, revision and parent changes on error.

Create replay uses the existing unique Ticket/performer/clientRequestId scope.
It compares normalized content, original assignee and initial PENDING state
against immutable revision 1, before current Ticket/assignee eligibility checks.
Thus retries remain valid after edits, reassignment, completion, parent
cancellation or assignee deactivation. Exact retry returns current DTO/current
parent version with no writes; changed original intent returns 409
IDEMPOTENCY_CONFLICT. Parent locking prevents duplicate API creation. A defensive
P2002 fallback first allows full rollback, then rereads/compares in a fresh
RepeatableRead transaction. Replays retain current caller authorization.

## Test evidence

Review corrections, 2026-10-12: all four text fields reject NUL with field-specific
400 errors; rejected create/PATCH requests leave counts, projection, revisions
and parent activity/version unchanged. Full snapshots now compare every content,
assignment, status, version and editor field at creation, editing, reassignment,
completion, cancellation and both terminal corrections. Independent expected
snapshots supplement current-projection comparisons. Each rejected completed
follow-up clearing compares all three records immediately before/after rejection.

Three reciprocal creation/reassignment/completion tests use real PostgreSQL and
API calls on distinct Tickets. A test-only transaction proxy pauses after each
assignee SQL lock succeeds; both must arrive before either reaches FK writes.
The barrier expires after 3 seconds, transactions after 8 seconds and requests
after 10 seconds. Exact success responses and complete revisions are required;
setup, timeout and database failures cannot count as success. Two additional
races call the actual Administrator account PATCH route, pause its uncommitted
User UPDATE, observe assignment blocked via pg_blocking_pids, then commit
deactivation/role change and verify assignment rejects without writes. Polling
delays only pace observation; observed blocking proves the ordering.

Correction verification: `npm.cmd run build` passed. The focused command
`npm.cmd run test:isolated -- tests/lab-04` passed 125 tests in 5 files, 0 failed,
60.59 seconds (57 API + 60 validation + 8 unchanged Issue #57 tests). An earlier
intermediate correction run passed 122 tests, 0 failed. The historical 320-test
results below describe the implementation before these review corrections.

Final corrected regression: `npm.cmd run test:isolated` passed 334 tests in
25 files, 0 failed, 145.14 seconds: 209 unchanged Lab 1–3 tests, 8 unchanged
Issue #57 tests and 117 Issue #58 tests (57 API + 60 validation). This adds
14 cases to the earlier 320 total. The final regression includes the corrected
snapshot helper that reads each Action's actual parent Ticket. Both isolated
runners deployed all 11 migrations and reported `No difference detected`.
No database definitions changed. Git whitespace checks passed for tracked and
all six added files; the branch and seven-file implementation scope are
unchanged, with the pre-existing untracked reference PDF untouched. No build
or test failures occurred during the review corrections.

Commands run from `server` unless stated otherwise. Tests use generated
`issue2_test_<UUID>` schemas and nested disposable migration/seed fixtures.
The new API suite refuses execution without the runner's schema name. No test
targets the normal developer schema.

| Command/run | Actual result |
|---|---|
| `npm.cmd run test:isolated -- tests/lab-04/actions-taken.api.test.ts`, before implementation | Sandbox engine spawn EPERM before tests; required approved rerun executed 34 tests, all failed because routes were absent (404 and consequent missing fixture records) |
| `npm.cmd run build`, first implementation | Failed: TypeScript null narrowing for throwing helper functions and overly narrow test payload inference. Changed missing-resource helpers to explicit never-returning function declarations and typed test payloads as object |
| Same focused API command, after implementation/type corrections | 34 passed, 0 failed |
| `npm.cmd run test:isolated -- tests/lab-04/actions-taken.api.test.ts tests/lab-04/action-validation.unit.test.ts` | Intermediate coverage: 92 passed in 2 files, 0 failed |
| `npm.cmd run build`, final source/tests | Passed |
| `npm.cmd run test:isolated -- tests/lab-04` | 111 passed in 5 files, 0 failed (47 API, 56 validation, 8 unchanged database/migration/seed cases), 50.53 seconds |
| `npm.cmd run test:isolated` | 320 passed in 25 files, 0 failed, 128.57 seconds: 209 unchanged Lab 1–3 cases + 8 unchanged Lab 4 foundation cases + 103 new Issue #58 cases |
| Repository: `git diff --check` and `git diff --no-index --check -- NUL <each added file>` | Passed with no whitespace errors; only Windows LF/CRLF notices |
| Repository: `git status --short`; `git branch --show-current` | Exactly the seven implementation/documentation files above, plus pre-existing untracked `docs/references/`; still `feature/sprint4-actions-backend` |

Every initial failed API case was resolved by implementing the specified
handlers and rules; no assertion was weakened. Later executed test runs have no
failures. Schema validation/client generation are not required for this change:
the schema is unchanged and the existing generated client compiles. Each
isolated runner deploys migrations and checks datasource/datamodel drift.

Audit tests compare every column of earlier revision rows before/after later
edits, reassignment, terminal transitions and follow-up clearing. Stale, invalid,
no-op, replay and rejected terminal changes compare complete projection/revision/
parent snapshots. Simultaneous edits prove [200,409] with one next revision;
identical creates prove [201,200] with one Action/revision; conflicting creates
prove [201,409]. Deterministic User-lock tests observe actual PostgreSQL blocking
before committing deactivation/role change, then prove waiting assignment and
completion reject without changes. A disposable BEFORE UPDATE Ticket trigger
forces failure after Action/revision writes to prove both create and PATCH roll
back completely and return no database diagnostics. Retrieval tests prove tied
ordering, focus pages, all three states, ownership isolation, safe DTOs, aliases,
empty/out-of-range pages and unsupported methods.

## Contract traceability and remaining responsibilities

| Relevant requirement | Status / evidence |
|---|---|
| FR-01–FR-04; BR-01–BR-08; AC-01–AC-07 backend portions | Implemented and Verified: create/edit/history, immutable identity/date, validation, scoped access |
| FR-07 action portion; BR-13–BR-16, BR-20; AC-05/AC-12 | Implemented and Verified: versions, ordered locks, immutable original replay, concurrency and atomic parent activity |
| FR-16–FR-18; BR-22–BR-26; AC-23/AC-25–AC-28 backend portions | Implemented and Verified: independent assignment, eligible-user races, full three-state matrix, explanations/reasons, revision attribution |
| BR-09/BR-27; AC-29 Action-side portion | Implemented and Verified: active-parent policy, cleanup without cascades, terminal corrections preserve gate |
| T-01–T-16, T-49, T-51–T-60 Action backend scenarios | Verified in the two actual new test files; T-49 matrix is API integration rather than a duplicated unit state machine |
| FR-14/AC-22 server regression | Verified: all 209 existing Lab 1–3 cases plus foundation seed/migration cases pass unchanged; authentication, roles, eight Ticket statuses/edges, comments, notes and attachments retained |
| Staff detail summary/eligibility and Ticket status version/gate/transition service, BR-11/BR-14 global action-vs-resolution race, AC-08–AC-11, T-17–T-23, full T-64/T-65 | Deferred to #60; this change supplies Action-side parent locking/version/activity and terminal correction guard only |
| React actions/detail UI, forms and browser accessibility | Deferred to #59 |
| Staff/Requester dashboards and drilldowns | Deferred to #61/#62 |
| Product-wide hardening/performance/E2E and Zen Green/release evidence | Deferred to #63/#64 |

Known integration limitation: existing Lab 3 Ticket status handler remains
ungated and lacks expectedWorkflowVersion by explicit #58 scope. Its UPDATE
shares the parent row lock, but full action-vs-resolution correctness requires
#60 to lock before checking status/gate and committing the workflow token. No
global resolution-race guarantee or completed Sprint 4 workflow is claimed here.
Staff detail additions also remain with #60. Database-level privileged writers
can still alter revisions; immutability here is enforced by the application, as
the #57 foundation documents. Large-dataset latency/query-plan benchmarks and
truthfulness of staff explanations are not established by these tests. No
unresolved contract ambiguity, blocked implementation or developer deployment.
