# Lab 4 AI Use and Reflection Record

## Issue #61 Phase 3 — two review findings, 2026-10-13

The user explicitly authorized only the two independently reproduced Minor fixes,
related regressions/documentation and complete verification. Codex verified the
unchanged branch/HEAD, eleven tracked modifications, eighteen new files and empty
index, then changed raw dashboard query validation and existing Retry focus intent.
No sub-agents, extra KPI, routing framework or unrelated feature change was used.

Eight backend, six component and two browser regression cases were added without
weakening previous assertions. Actual focused results: server/client builds pass,
18 authorization, 16 dashboard component and 3 accessibility browser cases pass.
The initial build rejected an unsupported Vitest matcher; equivalent separate
call-count/argument checks fixed it. Sandbox spawn EPERM required approved reruns
using the same disposable-schema infrastructure. The implementation record keeps
actual command totals and remaining manual limits. Human reflection/review is not
fabricated. No developer data, references, staging/commit/push/PR or branch changes.

Complete correction verification: server 545/0, client 262/0, browser 40/0;
both builds and focused 18/16/3 checks passed. The final raw-query prefix parsing
was rechecked at 18/0. Exact command evidence is in staff-dashboard.md. No
screen-reader/formal contrast audit or human approval is claimed.

## Issue #61 authorized implementation — 2026-10-13

The user supplied the complete Phase 2 scope and explicitly authorized dashboard
API/UI, Queue active filtering/URL navigation, isolated tests and documentation,
while prohibiting staging, commits, pushes, PRs, reference edits and developer
database changes. Codex verified branch/HEAD/empty tracked/index state first.

Codex implemented exact approved original-performer metrics, RepeatableRead,
narrow bounded DTOs, existing role/session gates, dashboard states and drilldowns,
History API query/hash handling and superseded-response protection. It authored
31 backend, 27 client and 9 browser cases plus the implementation record.
No sub-agents, new KPI, requester dashboard, migration/index, Action lifecycle or
Ticket workflow changes were introduced. Existing Queue assertions remain;
their setup now resets URL between tests.

Actual failures and corrections, final commands/counts, screenshot inspection
and limits are recorded in [staff-dashboard.md](staff-dashboard.md): sandbox
spawn EPERM required approved reruns; a test used the wrong comment endpoint;
browser testing found and verified the fix for Refresh focus loss. Final builds
and server 537/0, client 256/0, browser 38/0 passed. Only generated disposable
schemas and temporary services/storage were used. No references, developer data,
stage/commit/push/PR/branch switch or #62–#64 implementation. Human review and
student reflection remain human responsibilities; neither is fabricated.

Issue #56; draft created 2026-10-09, revised 2026-10-11 (Asia/Bangkok). Tool: **OpenAI Codex AI assistant** for specification/documentation. User reviewed the initial draft and requested revisions; design work is authorized, but no final revised-contract approval, peer approval, implementation, PR or passing feature tests is claimed.

## 1. Purpose and activities actually performed

AI assistance inspected the complete 11-page `docs/references/SE+Lab+4.pdf`, the six specified Lab 3 documents, Prisma schema, relevant routes/middleware/frontend/API helpers and package/test-runner structure. It drafted only specification.md, ui-spec.md, api-spec.md, tests.md, reviewer.md and this record under `docs/lab-04/`.

The first attempt stopped because the Lab 4 PDF was absent, as instructed. After the user supplied the handout, all pages were extracted read-only using a PDF reader installed in a temporary directory. Extraction required UTF-8 output for handout characters. No reference file was restored, edited, staged or committed. No application/schema/migration/seed/test changes or database operations were performed.

A temporary PDF renderer was also used to inspect the embedded dashboard illustrations on pages 5–6; rendered images stayed in temporary storage, not the repository. Illustration-only navigation and yesterday comparisons were not treated as new role permissions or invented metric windows.

AI identified rubric/main-text differences concerning action assignment/lifecycle and append-only/edit behavior, preserved the existing ticket transition matrix, and marked non-handout choices for human approval. Planned validation and tests are proposals, not verification of implemented features. Repository document checks do not replace execution/browser/database evidence.

On 2026-10-11 the user corrected the initial decision to defer page 11 grading requirements. AI revised all six files to specify one active Action Assignee, immutable original Performed By/date, separate primary Ticket Owner, PENDING/COMPLETED/CANCELLED action states, completion/cancellation rules, backend inactive-target rejection and immutable full revisions. The user authorized a project resolution-gate proposal; the chosen C≥1/P=0/F=0 predicate excludes cancelled work and is not attributed verbatim to the handout. Exact established #56–#64 titles/scopes were supplied by the user and copied into planning, without GitHub mutations. Dashboard count predicates and Ticket transition edges remain unchanged.

Documentation validation checked six files, 18 FRs/27 BRs, 29 ACs mapped to 66 Planned entries, local links/anchors, JSON examples, whitespace, reference IDs, unchanged eight-row backend Ticket matrix and exact supplied issue titles. No automated feature execution or manual implemented-screen review is claimed; all feature tests remain Planned.

## 2. Prompts recorded in this conversation

These are faithful **summaries**, not verbatim historical quotations. Four user task/planning messages are now recorded; do not fabricate 6–10 entries to meet final submission expectations.

| ID / date | User prompt summary | AI assistance / result | Human review status |
|---|---|---|---|
| AI-01 / 2026-10-09 | Prepare Issue #56 six-file Sprint 4 engineering contract after reading the assignment and existing system; stop if PDF unavailable; no implementation or Git writes. | Located only old Lab 2 references and stopped without creating documents. | User subsequently supplied required PDF. No approval claimed. |
| AI-02 / 2026-10-09 | Read newly added complete Lab 4 PDF, verify all pages and continue original documentation-only instructions; leave references/Git untouched. | Read all 11 pages and repository contracts; drafted six documents, test traceability and proposed decisions. | Awaiting user review; P/U items unresolved. |
| AI-03 / 2026-10-11 | User reviewed six documents against all 11 pages; require minimal action assignment/lifecycle, immutable audit, project resolution gate, compatibility, metrics and revised tests; documentation only. | Revised all six contracts with concrete assignment/transitions/gate/audit and additional AC/test coverage. | User review requested correction; revised concrete design awaits review. |
| AI-04 / 2026-10-11 | Supply exact existing Issue #56–#64 titles/scopes and workflow; use them without changing GitHub, continue documentation only. | Corrected issue plan and resolved former mapping uncertainty using user-provided facts. | Authoritative plan supplied by user; no live GitHub edits or final peer verdict. |

Final handout requires 6–10 selected actual key prompts across the sprint. Populate the following log only as later authorized work occurs, selecting real prompts/results; do not count imagined implementation tasks as past prompts.

| Future prompt ID/date | Actual prompt or labeled summary | AI tool/activity and files | Human verification and evidence | Accepted/corrected/rejected |
|---|---|---|---|---|
| To be recorded | No later prompt recorded | No implementation recorded | Not verified | Pending |

## 3. Human responsibilities and verification expectations

Student reviews concrete P-01–P-10 design and all six revised files and owns product choices. U-01/U-02 are resolved by user direction plus the specified lifecycle/revisions; U-03 is resolved by supplied existing issue plan. Human peer review/evidence still follows later; AI conclusions never constitute approval. Review explicit Lab 3 gate/token differences, three identity meanings, cancelled/pending/follow-up eligibility, inactive assignee race and requester-all-action visibility.

During implementation, verify meaningful failing/passing tests, real backend authorization, migration preservation/recovery, idempotent seeds, query/database metric agreement, complete regression, browser/accessibility/manual visual evidence and final main results. Record actual commands, commit IDs, screenshots/review links and corrections. Human handles authorized commits/push/PRs; none occurred in #56 drafting.

## 4. Corrections and rejected suggestions

| ID | Suggestion/assumption | Correction or disposition | Evidence / approval |
|---|---|---|---|
| C-01 | Treat requester action visibility as optional based only on page 2. | Draft follows explicit page 6: all actions on owned tickets are visible. | Handout §8.3; no human approval claim. |
| C-02 | Treat action edit or rubric-only assignment/lifecycle as already defined. | Create/edit included; additional assignee/status/complete/cancel rules require U-01/U-02 clarification. No new action statuses invented. | Handout pages 1/4/6 vs submission page 11. |
| C-03 | Assume existing E2E runner discovers new Lab 4 tests. | Plan documents current lab-03-only testDir and required future discovery adjustment. | Existing client/playwright.config.ts inspected. |
| C-04 | Initial draft deferred rubric action assignment/lifecycle as an instructor-blocked ambiguity. | User rejected that scope omission on 2026-10-11; now specify three action states, eligible assignee, all grading controls and full revision audit. U-01/U-02 no longer block drafting. | Actual user review, page 8/11 grading requirements. |
| C-05 | Initial gate only required any recorded result and no follow-up. | Revised project proposal requires completed evidence, no pending work and no completed follow-up; cancelled retained/excluded. | User requested a practical project gate; concrete predicate awaits revised-contract review. |
| C-06 | Initial issue scopes were guesses/proposals. | Use exact existing #56–#64 titles/scopes supplied by user; no issue creation/edit/closure. | User planning reply on 2026-10-11. |

C-01–C-03 record initial drafting corrections; C-04–C-06 record the actual user correction and resulting revision. Historical C-02 describes the first draft's disposition, superseded by C-04. No peer approvals or implementation/test evidence is inferred from this review. Add later actual rejected suggestions and their evidence when they occur.

## 5. My Reflection — student to complete

No student reflection has been supplied for Sprint 4. Before final submission, write a brief first-person reflection on specification-agent vs coding-agent use, helpful/rejected outputs, how tests and human review exposed errors, and remaining limits of AI assistance. Include concrete events and evidence from the completed sprint rather than attributing AI-authored opinions to the student.


## Issue #60 actual assistance ? 2026-10-13

Tool: OpenAI Codex in the user's IDE/workspace. The user first requested a
read-only investigation with exact source priority, branch/base checks and no
implementation; Codex inspected contracts/code/tests and reported the gate,
workflow-token, snapshot and UI gaps. GitHub CLI was unavailable and web Issue
access failed; no live description or comments were invented. The user then
supplied the actual Issue #60 objective/tasks/criteria, approved full scoped
implementation and explicitly prohibited staging/commits/push/PRs.

The Phase 2 prompt required unchanged eight statuses/edges, C>=1/P=0/F=0 gates,
legacy close, parent locking/version checks, consistent detail summary, explicit
UI review/recovery, preserved #59 drafts/replay, new workflow/API/component/browser
tests, the exact verification commands and a review report. Codex implemented
that scope and authored [ticket-workflow.md](ticket-workflow.md) with actual
results. No sub-agents, new statuses/history fields/migrations, dashboard or
release work were introduced. Student reflection and peer approval are not
AI-authored or claimed.

Corrections encountered: sandbox Vite/esbuild/Prisma process starts failed EPERM
and approved reruns were used; a new test helper had a TypeScript-invalid role
query option and was fixed; initial mobile browser setup expected collapsed
navigation and was corrected to authenticate before resizing without removing
workflow keyboard/reflow assertions. An unfinished confirmation-test refresh
caused act warnings and was explicitly awaited. Exact outcomes, including
intermediate failures and later passing verification, are in the implementation
record. Tests use generated disposable schemas and temporary services/storage;
no developer database or reference file changes. Human review and manual PR to
lab4-staging remain pending. No commit/staging/push/PR or branch switch occurred.


## Issue #60 targeted review corrections - 2026-10-13

The user explicitly requested fixing exactly two independent-review Minor
findings: parent controls enabled despite the refresh-time save guard, and
missing machine-readable conflict assertions in deterministic race tests.
Codex verified branch/HEAD/empty index and preserved the existing 19-file
implementation. It added one shared parent disabled condition, five delayed-GET
control/recovery/security cases, one actual mounted Action/key-preservation
case, exact error/reason assertions in the existing race cases and closing gate
fixture, and correction evidence in ticket-workflow.md/tests.md.

No backend production change, unrelated refactor, new workflow rule or test
weakening was needed. Existing sequential component assertions now wait for the
next control to become usable. The original PostgreSQL blocking synchronization
and both race orderings are preserved. Exact verification results (including
sandbox client-build spawn EPERM and approved successful rerun) are in the
correction record; no unexecuted check or additional backend case is claimed.
Only generated disposable schemas/temporary browser services were used. No
reference edit, developer-schema mutation, staging, commit, push, PR, branch
switch or Issue #61-64 implementation. Human review and manual PR remain pending;
no student reflection or peer approval is fabricated.
