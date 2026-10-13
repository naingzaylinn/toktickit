# Lab 4 Test DD and Requirement Traceability

Issue #56 revised draft, 2026-10-11. All tests are **Planned**, including regression reruns; no feature tests implemented/executed. [Specification](specification.md), [API](api-spec.md) and [UI](ui-spec.md) now define required assignment/lifecycle and immutable revisions; U-01/U-02 are resolved by user-directed project proposal. Historical [Lab 3 results](../lab-03/tests.md) are not current Lab 4 evidence.

## Issue #60 implementation evidence ? 2026-10-13

The introductory Planned state and original table are historical #56 planning.
Actual #57?#59 evidence is in database.md/actions-backend.md/actions-ui.md.
[Ticket workflow evidence](ticket-workflow.md) records #60 implementation and
exact current commands/results. T-17?T-23/T-64/T-65 are implemented in
`server/tests/lab-04/ticket-workflow.api.test.ts` (172 cases); T-34/T-66 in
`client/tests/lab-04/TicketWorkflow.test.tsx` (24 cases) plus six real transport
cases; T-47 and focused workflow keyboard/reflow checks in
`client/e2e/lab-04/ticket-resolution.spec.ts` (six browser cases).
These workflow entries passed focused verification. T-41/T-42 affected regression
passed (506 backend / 223 client tests); no historical assertion was weakened.
Full browser regression passed all 29 cases, including the 18 existing Lab 3
cases, five #59 cases and six #60 cases; final scope evidence is recorded in the
linked implementation record. Dashboard/final-release entries remain future scope.

## 1. TDD and environment plan

For each later feature: approve the contract, add a meaningful failing test against the real rule, implement the minimum change, run focused checks, refactor, then run affected regression. Never remove/weaken existing coverage to obtain a pass. Existing valid-resolution fixtures will need recorded actions and workflow tokens after P-04/P-05 approval; retain matrix coverage and add explicit gate/stale negative cases. Preserve historical timestamps/fields in migration assertions.

Use Supertest/Vitest and real Prisma integration fixtures in disposable schemas following `server/tests/lab-03/databaseFixture.ts` and existing isolated scripts; React Testing Library/Vitest under `client/tests/lab-04`; browser tests under `client/e2e/lab-04` consistent with the actual repository rather than a new root `e2e` tree. All new paths below are proposed, not asserted to exist. See [reviewer commands and discovery limitation](reviewer.md#5-verification-commands-and-runner-limits).

No raw server `npm test`, seed/migration/reset or fixture deletion against the developer database. Future test isolation must account for new action/revision restrictive FKs before legacy suites delete their own tickets. Do not disable FK enforcement. No database/test commands run for #56.

## 2. Planned test matrix

Each row has category, related requirement/criterion, scenario, expected outcome, proposed file and status. IDs are unique to Lab 4; a row may correspond to a parameterized group, not one executable assertion. All cited ACs are defined in specification §11.

| ID | Category | Requirement / AC | Scenario | Expected result | Proposed test file | Status |
|---|---|---|---|---|---|---|
| T-01 | Unit validation | FR-01, BR-04, AC-02 | Missing, blank, overlong, null, non-string description/result; exact 1/2000 limits | Trimmed boundaries accepted; invalid inputs rejected with field errors | `server/tests/lab-04/action-validation.unit.test.ts` | Planned |
| T-02 | Unit validation | BR-04, AC-03 | Boolean vs string/number/null flag; true with missing/blank note; false with optional/null note | Exact conditional/type policy enforced | `server/tests/lab-04/action-validation.unit.test.ts` | Planned |
| T-03 | Unit validation | BR-04, BR-21, AC-03 | Optional note blank normalization, 2000/2001 limits, literal markup/file reference | Null/trim/limits correct; no upload or executable markup | `server/tests/lab-04/action-validation.unit.test.ts` | Planned |
| T-04 | API/integration | FR-01, BR-03, AC-01 | Staff and Administrator create valid actions | 201, all fields, correct parent/performer/server time and revision 1 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-05 | API/security | BR-03, BR-08, AC-02 | Inject performer/user/owner/date/initial status; malformed IDs/JSON | Safe 400; assigneeId accepted only as documented, never as performer; no forged identity/date | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-06 | API/integration | FR-03, BR-02, AC-04 | Three actions, different performers including a non-owner | Distinct records; primary Ticket owner unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-07 | API/history | FR-04, BR-16, AC-04, AC-15 | Equal create timestamps, edited item, pages 10/20/50, focusActionId across pages, empty/out-of-range, invalid/foreign focus query | createdAt/id order stable; exact totals/target page; no omission; invalid query 400, foreign target safe 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-08 | API/edit | FR-02, BR-07, AC-05 | Different permitted staff edits action and supplies valid version | Original performer/date retained; current fields and immutable revision/editor atomically updated | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-09 | API/validation | BR-04, BR-25, AC-03 | Partial true/required-note edits; COMPLETED true→false with omitted/null/blank/unchanged/overlong/new explanation; normal false notes | Invalid clearing returns linked 400 with no writes; new explanation succeeds, old plan/new reason retained in revisions; other false notes remain optional | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-10 | API/concurrency | BR-13, AC-05 | Two editors use version 1, including stale no-op | One wins; stale 409; no partial extra revision | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-11 | API/lifecycle | BR-07, BR-09, BR-27, AC-05, AC-29 | Matching-version content no-op, terminal-Ticket corrections, DELETE | No-op unchanged; terminal gate preserved or safe conflict/reopen guidance; no deletion/revision loss | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-12 | Authorization | FR-04, BR-05, AC-06, AC-28 | Requester reads owned pending/completed/cancelled actions, terminal Tickets, follow-up/attachment notes | Seven fields plus assignee/status visible across pages; no private audit/notes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-13 | Authorization | BR-05, AC-06 | Foreign/nonexistent ticket, mismatched action parent; requester POST/PATCH | Identical safe 404 reads; wrong-role writes 403 before lookup; no leaked fields | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| T-14 | Authorization/session | BR-05, AC-07 | Missing/expired/inactive session, required password change; cross-role dashboard paths | 401/403 as documented; no protected payload or write | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| T-15 | API/idempotence | BR-15, AC-12 | Exact create replay and simultaneous identical requests | One action/revision, 200 replay header vs original 201, no replay activity changes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-16 | API/idempotence | BR-15, AC-12 | Same key changed original assignee/data; replay after reassignment/completion/cancellation/Ticket cancellation/assignee deactivation | Changed intent 409; original retry returns current state before new-state business checks, no writes or bypass of session authorization | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-17 | Workflow/API | FR-06, BR-10, AC-08 | Parameterize every listed matrix edge for staff and Administrator with gate fixtures | Each edge succeeds; exact target/version persisted | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-18 | Workflow/security | BR-10, AC-08 | All 64 ordered status pairs: omitted/self edges; unknown enum; Requester direct writes | Nonedges 409, unknown 400, Requester 403; unchanged data | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-19 | Workflow/gate | BR-11, BR-25, AC-09 | Zero/all-cancelled; pending plus completed; completed true follow-up; completed false plus cancelled true; complete separate follow-up then explicitly clear original with explanation | C≥1/P=0/F=0 exactly; separate completion does not clear original; invalid clearing leaves gate blocked, valid clearing enables eligibility only if all predicates hold | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-20 | Workflow/legacy | BR-19, BR-27, AC-09, AC-29 | Legacy terminal zero actions; close with actions; reopen/resolution; resolved content correction | Zero-action legacy close allowed; other close/resolve guarded; invalid correction rejected without status cascade; reopen enables new pending action | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-21 | Workflow/concurrency | BR-13, AC-10 | Concurrent status changes from same token, stale screen, A→B→A | At most one same-token write; stale/ABA blocked even if current status matches | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-22 | Workflow/transaction | BR-14, BR-20, AC-10 | Race create/assignment/complete/cancel/follow-up edit against RESOLVED; forced rollback | Gate/version serializable, cancelled predicate correct, no invalid terminal correction or partial status/action/revision | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-23 | Workflow/regression | FR-08, BR-12, AC-11 | Own indication, duplicate/concurrent indication, foreign owner; staff formally resolves later | Timestamp only; duplicate conflict; no action/status/owner change; staff gate still required | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-24 | Dashboard integration | FR-09, BR-17, AC-13 | Dataset all eight statuses, four priorities, null/current/other/inactive owners, legacy rows | Global/active/status/IT-priority counts equal independent DB queries; correct inclusion rules | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| T-25 | Dashboard integration | FR-09, BR-02, BR-23, AC-13 | Staff/Admin owner/performer/assignee all differ; other staff completes; all action/parent statuses | Existing counts use original performer, not assignee/editor/completer; all action states count; personal Ticket owner count separate | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| T-26 | Dashboard ordering | BR-16, BR-20, AC-13 | >5 records, timestamp ties, action edits and comment-only operations | Correct capped lists/tie-breakers; action updates parent activity; no fabricated resolvedAt/recent window | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| T-27 | Dashboard isolation | FR-10, BR-05, AC-14 | Two Requesters with mixed statuses, one empty user; forged query identity | Counts/rows only session-owned; forged query rejected; no global/private data | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| T-28 | Dashboard calculation | BR-17, AC-14 | Independent own-status DB counts, >5 recent/resolved rows/ties | Exact buckets, currently RESOLVED summaries only, updatedAt order/caps | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| T-29 | Dashboard snapshot/empty | BR-18, AC-16 | Empty DB, no matching personal subsets, writes during multi-query read | Zero buckets and [] on success; internally consistent snapshot, safe error on failure | `server/tests/lab-04/dashboard-snapshot.api.test.ts` | Planned |
| T-30 | API/drilldown | FR-11, AC-15 | Every card predicate against staff/requester list; eight legacy filters, New compatibility, active intersection | Full filtered totals match metrics at same fixture state, exact query mapping, invalid filters safe | `server/tests/lab-04/dashboard-drilldowns.api.test.ts` | Planned |
| T-31 | UI/component | FR-01, FR-02, AC-03, AC-17 | Add/View/Edit, original-record identity label, separate assignee/status, completed follow-up clearing explanation and server field errors | Unambiguous read-only creator; missing/unchanged explanation prevents save, valid explanation included in PATCH; errors linked/draft retained | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| T-32 | UI/component failures | FR-07, FR-13, AC-17 | Repeated clicks/network failure/replay/stale edit/save succeeds refresh fails | Draft/key preserved; no duplicate submit; correct success vs refresh feedback and safe review | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| T-33 | UI/component visibility | FR-04, FR-05, AC-06 | Requester history loading/empty/normal/failure/retry/role denial, pagination and action target | All shared records reachable; no write controls/editor/private notes; safe state matrix behavior and intended target shown | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| T-34 | UI/workflow | FR-06, FR-07, AC-08–AC-11 | Permitted selector, cancel/accept confirmation, gate reasons, advisory display, stale conflict | Only valid destinations; token submitted; reload/review; no requester formal controls | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| T-35 | UI/dashboard | FR-09, FR-13, AC-13, AC-16 | Staff/Admin loading/zero/error/retry/forbidden/current-user labels | No initial false zeros; safe feedback; forbidden clears results; server values rendered with correct scopes | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| T-36 | UI/dashboard | FR-10, FR-13, AC-14, AC-16 | Own summary, attention/resolved labels, loading/empty/error/retry/forbidden/session loss | Correct server values and labels; forbidden clears results; no stale previous-user/private content | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| T-37 | UI/navigation | FR-11, AC-15 | Every card, history target, query initialization, reset/back/pagination | Existing destination and exact API predicates used; page resets to 1; query retained | `client/tests/lab-04/DashboardDrilldowns.test.tsx` | Planned |
| T-38 | Migration integration | FR-12, BR-19, AC-19 | Populated pre-Lab-4 fixture → all new migrations | IDs/fields/links/timestamps preserved; version 0; no fake actions; FK/index/drift verified | `server/tests/lab-04/migration.test.ts` | Planned |
| T-39 | Recovery integration | FR-12, AC-19 | Failed migration/retry and forward fix/code rollback in disposable environment | No partial loss; retained child records/verified recovery; no destructive real DB operations | `server/tests/lab-04/migration.test.ts` | Planned |
| T-40 | Seed integration | FR-12, AC-20 | Repeated seed after content/assignment/lifecycle/owner/password changes | Counts/IDs/revisions/human edits unchanged; three action states/different identities/inactive historic assignee/empty user; terminal fixtures satisfy gate | `server/tests/lab-04/seed.test.ts` | Planned |
| T-41 | Regression integration | FR-14, AC-22 | Full Lab 1–3 suites after approved migration/gate/token fixture amendments | Equivalent legacy checks pass; supported diagnostics/auth/attachments/ownership/users preserved | Existing `server/tests/lab-01`, `lab-02`, `lab-03` plus `server/tests/lab-04/regression.api.test.ts` | Planned |
| T-42 | Regression UI | FR-14, AC-22 | Existing component suites and cross-role session/navigation/notes/comments | Existing behavior retained; shared actions do not leak private fields or change owner | Existing `client/tests/lab-01`, `lab-02`, `lab-03` plus `client/tests/lab-04/Regression.test.tsx` | Planned |
| T-43 | Performance smoke | FR-15, AC-24 | Large disposable fixture, bounded dashboard and paginated action history; inspect query count/EXPLAIN | Five-item caps/page caps, no unbounded DTO/N+1 or client aggregation; record latency/query plans, investigate material regression | `server/tests/lab-04/performance-smoke.test.ts` | Planned |
| T-44 | Responsive/browser | FR-13, AC-18 | Dashboards, actions create/edit/history and workflow at 375/768/1280 px | Visible usable controls, wrapped content, no document overflow/overlap; capture screenshots | `client/e2e/lab-04/responsive.spec.ts` | Planned |
| T-45 | Accessibility | FR-13, AC-18 | Keyboard forms/cards/nav/modal, label/error associations, focus/200% zoom/color cues | Keyboard operation, focus return/visibility, readable non-color meaning and reflow | `client/e2e/lab-04/accessibility.spec.ts` plus manual checklist §4 | Planned |
| T-46 | E2E cross-role actions | FR-01–FR-05, FR-16–FR-18, AC-21 | Requester creates; staff A owns; B records; C assigned; staff edits/assigns/completes/cancels multiple actions | Three identities distinct, valid controls/rules/audit, requester sees all states and no private notes/write grant | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| T-47 | E2E resolution | FR-06–FR-08, AC-21 | Advisory → blocked gate → clear follow-up → resolve → close → reopen → work → resolve; separate cancellation path | Full approved lifecycle/guards, stale failures and requester restrictions demonstrated | `client/e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| T-48 | E2E dashboards | FR-09–FR-11, AC-21 | Each role login, metrics, drilldowns, empty/retry and cross-user switches | DB-backed cards/filter navigation accurate and isolated; no stale-user rows | `client/e2e/lab-04/dashboards.spec.ts` | Planned |
| T-49 | Unit/lifecycle | FR-17, BR-24, AC-26 | All nine action-state ordered pairs and unknown enum, separately from Ticket matrix | Only PENDING→COMPLETED/CANCELLED pass; terminal/reverse/self conflict, unknown enum validation | `server/tests/lab-04/action-lifecycle.unit.test.ts` | Planned |
| T-50 | Final evidence/style | FR-13–FR-15, AC-24 | Main verification, visual checklist, issue/review records and submission audit | Real evidence for Parts 1–9; no placeholders/false pass claims; console/link/theme review complete | Manual §4 and `docs/lab-04/reviewer.md` evidence record | Planned |
| T-51 | API/assignment | FR-16, BR-22, AC-23 | Explicit eligible create assignee vs omitted default, owner/performer/assignee distinct | Required persisted assignee, omitted=session performer, PENDING initial state, Ticket owner/original performer unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-52 | API/reassignment | FR-16, BR-26, AC-23 | Reassign pending action by non-owner/non-assignee staff; same eligible target no-op | Assignee changes only, original identity/date unchanged; authorized global staff scope; eligible no-op stable | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-53 | API/validation | FR-18, BR-22, AC-25 | Direct create/reassign null/blank/malformed/nonexistent/inactive/requester-role target, inactive same-target write | Safe INVALID_ACTION_ASSIGNEE with no writes, regardless of UI options | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-54 | API/account lifecycle | FR-18, BR-26, AC-25 | Deactivate/role-change existing assignee; try completion, text edit, cancel, active reassignment | History retained; completion rejected; text/cancel allowed; eligible reassignment enables later completion | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-55 | API/completion | FR-17, BR-25, AC-26 | Pending complete with merged result and eligible assignee, blank result, follow-up true/false | Valid outcome persists COMPLETED; blank fails; completed true follow-up retained/blocks gate | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-56 | API/cancellation | FR-17, BR-25, AC-26 | Pending cancel with missing/blank/valid explicit Result reason and inactive assignee | Explicit reason required, valid cancel retained/audited; no deletion/automatic Ticket change; cancelled flags excluded from gate | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-57 | API/terminal behavior | FR-17, BR-24, BR-27, AC-26 | Terminal reassignment, self/reverse state, content correction on completed/cancelled | State/assignee immutable even same target; safe 409; valid content correction retains history | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-58 | API/audit | FR-18, BR-23, BR-25, AC-27 | Different creators/assignees/completers/cancellers/later editors; combined assign+complete; follow-up clearing; database snapshots under §5 | One full session-actor revision per mutation; old rows unchanged field-for-field; original date/performer and terminal-transition actor survive later edits; no audit changes on rejected/no-op/replayed writes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-59 | API/concurrency | FR-07, FR-18, AC-27 | Assign vs complete vs cancel with same token; stale combined mutation | Only one wins, safe CONFLICT; no partial assignee/content/state/revision changes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-60 | API/deactivation race | FR-18, AC-25 | Assignment/completion races Administrator deactivation/role change | Eligible at assignment/completion commit under User lock; later deactivation preserves history and blocks next completion | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| T-61 | UI/assignment | FR-16, AC-23, AC-25, AC-28 | Default active select, alternate/reassign, inactive current badge/server rejection, requester hidden controls | Distinct assignee/performer/owner labels; required options; safe linked errors and preserved draft | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| T-62 | UI/lifecycle | FR-17, FR-13, AC-26, AC-28 | Complete/cancel confirmation naming current operator separately from original performer/assignee; Result reason, discard, terminal controls, failure/retry | Only permitted transitions; automatic actor, no client identity field; explicit cancel reason; dismissed confirmation makes no write; safe preserved drafts | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| T-63 | E2E/assignment visibility | FR-16–FR-18, AC-28 | Staff assigns/completes/cancels, inactive target rejected via API, requester reads all states, mobile/keyboard controls | All grading capabilities demonstrated; requester cannot write lifecycle; responsive/a11y evidence | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| T-64 | API/parent policy | BR-09, BR-27, AC-29 | New/reassign under terminal Ticket; cancel parent while action pending; cleanup/reopen/new work | Terminal create/reassign conflicts; no child cascade; existing complete/cancel allowed; explicit Ticket reopen enables new action, never reopens terminal action | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-65 | API/summary/audit atomicity | BR-11, FR-18, AC-09, AC-27 | Staff summary of all states and completed-follow-up counts; reject terminal correction/forced rollback | Exact total/pending/completed/cancelled/F and all reason codes; rejected write leaves audit/version/content unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| T-66 | UI/workflow guard | FR-06, FR-17, AC-09, AC-29 | Gate labels, explanation-guided completed follow-up clearing and refreshed eligibility; terminal create/reassign/reopen | Clear predicates/cancelled meaning; gate stays blocked on invalid clearing/failure, refreshes after confirmed correction; explicit reopen preserves Ticket matrix | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |

T-49 and T-51–T-66 cover the now-specified grading assignment/lifecycle rules. They are actual feature test plans, not a placeholder instructor-review gate. Action assignment has separate tests from Ticket ownership; all immutable-revision, terminal, deactivation and cancellation predicates have executable proposed paths.

T-43 has no arbitrary latency target: capture fixture size, query count, response size, timings/environment and comparison with existing list/detail workload. Bounded responses and no N+1 are objective assertions; agree a performance budget if required rather than inventing SLA/KPI thresholds.

## 3. Acceptance-criterion coverage audit

| AC | Planned test IDs |
|---|---|
| AC-01 | T-04 |
| AC-02 | T-01, T-05 |
| AC-03 | T-02, T-03, T-09, T-31 |
| AC-04 | T-06, T-07 |
| AC-05 | T-08, T-10, T-11 |
| AC-06 | T-12, T-13, T-33 |
| AC-07 | T-14 |
| AC-08 | T-17, T-18, T-34 |
| AC-09 | T-19, T-20, T-65, T-66 |
| AC-10 | T-21, T-22 |
| AC-11 | T-23, T-34 |
| AC-12 | T-15, T-16 |
| AC-13 | T-24, T-25, T-26, T-35 |
| AC-14 | T-27, T-28, T-36 |
| AC-15 | T-30, T-37 |
| AC-16 | T-29, T-35, T-36 |
| AC-17 | T-31, T-32 |
| AC-18 | T-44, T-45 |
| AC-19 | T-38, T-39 |
| AC-20 | T-40 |
| AC-21 | T-46, T-47, T-48 |
| AC-22 | T-41, T-42 |
| AC-23 | T-51, T-52, T-61 |
| AC-24 | T-43, T-50 |
| AC-25 | T-53, T-54, T-60, T-61 |
| AC-26 | T-49, T-55, T-56, T-57, T-62 |
| AC-27 | T-58, T-59, T-65 |
| AC-28 | T-12, T-13, T-61, T-62, T-63 |
| AC-29 | T-11, T-20, T-64, T-66 |

All 29 ACs map to at least one of 66 Planned entries. Assignment/lifecycle requirements are specified and traced; coverage is planning, not passing evidence.

## 4. Manual visual/accessibility and final evidence checklist

All entries are **Planned**. For each record role, viewport, screen/state, final commit, screenshot path, reviewer and actual result. Proposed screenshots: `artifacts/lab-04/screenshots/staff-dashboard/`, `requester-dashboard/`, `actions-taken/`, plus workflow/regression where needed; do not create artifacts in #56.

| Check ID | Inspection | Expected evidence/result | Status |
|---|---|---|---|
| VIS-01 | Zen Green dashboard cards/history/forms and existing shell | Consistent typography/spacing/buttons/badges; no obsolete controls | Planned |
| VIS-02 | Read-only date/performer vs editable content; owner distinction | Clear shared/private labels, no ambiguous assignee or performer edit | Planned |
| VIS-03 | Validation/loading/empty/error/success/conflict/retry | Readable nearby feedback, retained drafts, usable retry; no false zeros | Planned |
| VIS-04 | Desktop/tablet/mobile and long text/file notes | No clipping/overlap/document overflow, usable lists/forms/nav | Planned |
| VIS-05 | Keyboard and dialog cancel/return, pagination/card links | Visible focus/order, meaningful names and complete keyboard access | Planned |
| VIS-06 | Contrast, textual status/priority/follow-up labels, 200% zoom | Non-color meaning and readable/reflowing content | Planned |
| VIS-07 | Unauthorized/session loss/foreign owned-ticket navigation | Protected content cleared; no private notes or prior-user rows | Planned |
| VIS-08 | Links, console, placeholder and unfinished controls audit | No broken drilldowns, console errors or misleading placeholders | Planned |

Later update test statuses to actual Pass/Fail/Blocked with command output and actual executable paths. Component tests cannot prove browser contrast/focus appearance; responsive assertions cannot replace visual review. Final main verification and a complete Answer Part 1–9 PDF remain future work, not evidence produced by this contract.

## 5. Append-only revision proof procedure (T-58, Planned)

Run later against a disposable migrated test database, never the development database. Capture the fixture IDs, authenticated actors, API requests/responses and before/after query output as reviewer evidence. No revision-history UI is required. With psql, set `action_id` to the fixture UUID and run the following read-only snapshot before and after each operation (proposed Prisma table/column names):

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT to_jsonb(a) AS current_action_snapshot, t."workflowVersion",
       t."updatedAt" AS ticket_activity_time
FROM "ActionTaken" a JOIN "Ticket" t ON t."id" = a."ticketId"
WHERE a."id" = :'action_id';
SELECT r."id", r."version", to_jsonb(r) AS full_revision_snapshot
FROM "ActionTakenRevision" r
WHERE r."actionId" = :'action_id'
ORDER BY r."version" ASC;
COMMIT;
```

1. Create as staff B on a Ticket owned by A, assigned to C. Confirm revision 1 contains the initial complete snapshot and editorId=B; parent performedById/date remain B/original instant.
2. Using different authorized users, edit, reassign and complete (also test combined assign+complete); then correct completed content and clear outstanding follow-up with a new explanation. Use a separate PENDING fixture for cancellation and a later cancelled-content correction. Snapshot every step.
3. Compare every previously captured revision by ID and **all columns**, including editorId, createdAt, status, assigneeId and text/flags. They must be identical; exactly one new full snapshot/version appears per successful mutation. Revision versions are contiguous 1…action.version, with unique row IDs and one parent-version increment. Counts alone do not prove immutability.
4. Identify the first revision whose state changes PENDING→COMPLETED/CANCELLED. Its editorId is the actual operator, regardless of assignee/original performer; subsequent correction editors must not change that row. For follow-up clearing, prove the previous planning note remains and the clearing revision contains false plus the new explanation.
5. Repeat snapshots around stale/invalid/forbidden writes, missing/unchanged clearing explanations, forced transactional failure, matching-version content no-op and exact create replay: no projection/version/timestamp/revision change. Also verify no supported API permits revision update/delete. Save before/after outputs and comparison assertions for review; this proves application write behavior, not immunity to a privileged database administrator.


## Issue #60 Phase 3 correction evidence - 2026-10-13

[Correction record](ticket-workflow.md#phase-3---two-critical-review-corrections-2026-10-13)
records the two Minor review findings and exact current commands/results.
Five new `client/tests/lab-03/StaffTicketDetail.test.tsx` cases prove delayed-GET
disabling, zero refresh-time writes, explicit priority/owner/communication
recovery, recoverable failure and access-loss clearing. One new
`client/tests/lab-04/TicketWorkflow.test.tsx` case proves the mounted uncertain
Action editor and original create request survive the unresolved parent GET.
Focused component result: 39 passed (14 Staff detail + 25 workflow). Full client:
229 passed. The earlier 223/24-case evidence is historical Phase 2.

The existing 172-case backend workflow suite now verifies exact CONFLICT,
RESOLUTION_REQUIREMENTS_NOT_MET and TICKET_WORKFLOW_CONFLICT classification in
both deterministic race orderings. Actual gate rejections assert exact pending
reasons; the existing closing fixture asserts NO_COMPLETED_ACTIONS plus
PENDING_ACTIONS. All original synchronization/state/version/revision assertions
remain. Focused backend 172 and full backend 506 passed; stronger assertions do
not inflate the case count. Lab 4 browser regression passed 11 cases and full browser regression passed 29; final safety results
are in the linked correction record. Production backend,
API contracts, migrations and deferred dashboard/release scope are unchanged.
