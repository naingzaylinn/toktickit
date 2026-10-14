# Lab 4 Review and Integration Plan

## Issue #63 Phase 3D — response to R-02 REQUEST CHANGES

Re-review the confirmed-creation ref recorded before upload, same-identity failed-logout recovery without create/upload replay, conservative uncertainty, guarded existing-Ticket navigation, record clearing on identity/access replacement, and explicit new-Ticket generation/key clearing. Check that retained metadata cannot revive old callbacks or be shown to B. Original R-01 and Phase 3C REQUEST CHANGES evidence remain in [final-hardening.md](final-hardening.md). This is correction preparation, not independent approval or publication readiness.

Current Issue #63 self-review preparation and verification are in
[final-hardening.md](final-hardening.md). Independent re-review remains pending.

## Issue #63 Phase 3B — response to REQUEST CHANGES

Phase 3A confirmed Major R-01: obsolete creation/upload work survived unmount/session replacement. Phase 3B adds component lifetime/identity/access/generation checks and scoped mutation error contexts, using App's existing session revision at logout start. Re-review the originating revision capture, post-body dispatch checks, generation-owned finally, same-identity uncertain key preservation, current-denial handling and real App logout/login tests. See [final-hardening.md](final-hardening.md) for independent and corrective evidence. No independent approval or Git publication is claimed; earlier review records remain historical.

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

## Issue #62 independent-review preparation - 2026-10-14

The user approved Phase 1 and authorized full Requester implementation, testing and
documentation on feature/sprint4-requester-dashboard at 8ee1b934ad1a4c9b8f0212c2d4cda792912bd3b2.
[requester-dashboard.md](requester-dashboard.md) contains all 31 changed/new files,
exact predicates, privacy/snapshot behavior, URL return state and verification evidence.

Review every aggregate/list requesterId predicate, five-field projections and caps,
active versus Open distinction, currently Resolved versus Closed, raw query validation
behind all guards, deterministic snapshot barrier and full My Tickets parity.
Check identity/role/access-loss clearing, late success/failure, truthful refresh time,
Retry/Refresh focus, query/back/forward/detail return, 375/768/1280 wrapping and keyboard.
Existing staff production code, Action lifecycle and Ticket workflow remain unchanged.
Only authorized superseded navigation/status-input expectations were updated.

Focused backend 377/0, client 172/0 and Requester browser 7/0 passed; full client 302/0
and browser 53/0 passed. Final full backend passed 586/0; final label verification passed build/full client and 12 browser layout/focus checks.
No stage/commit/push/PR/branch switch, developer-data writes, references access or
#63/#64 work. Peer review, PR to lab4-staging and any later integration remain future
human-controlled steps. Do not infer approval or issue completion from AI verification.


## Issue #61 Phase 3 correction review — 2026-10-13

The two reproduced Minor findings (parser-discarded raw keys and keyboard Retry
focus loss) are corrected with focused real HTTP/component/browser coverage;
see [staff-dashboard.md](staff-dashboard.md#phase-3--two-independent-review-corrections-2026-10-13).
Review raw-key validation before service invocation, pending Retry heading focus,
settled Refresh focus and respect for deliberate focus movement. Previous metric,
snapshot, privacy and Queue behavior is unchanged. Human re-review and eventual
PR remain pending; no new approval, commit, push or PR is claimed.

Phase 3 final checks passed: builds, focused authorization 18/0, dashboard
component 16/0, accessibility browser 3/0 and complete server/client/browser
regressions 545/262/40 with zero failures. Re-review scope is the two fixes and
their 8/6/2 added cases, not a changed metric or workflow contract.

## Issue #61 independent-review preparation — 2026-10-13

[staff-dashboard.md](staff-dashboard.md) records all 29 implementation/documentation
files, exact predicates, snapshot/authorization, navigation, tests, actual results
and limitations. Staff dashboard and active Queue drilldowns are implemented;
requester dashboard, final hardening and release remain #62–#64.

Review original performer versus current assignee/owner, eight/four zero buckets,
RepeatableRead and deterministic concurrent test, narrow DTOs, active+CLOSED
intersection, URL/back/pagination/reset, late responses, forbidden clearing and
Action focusActionId page targeting. New cases: 31 backend/27 client/9 browser.
Final checks: builds pass; server 537/0, client 256/0, browser 38/0. Previous
506/229/29 cases retained. Human review and manual PR to lab4-staging are pending;
no approval, stage, commit, push, PR or merge is claimed.

Current discovery correction: Playwright testDir is ./e2e following #59, so the
historical Lab-3-only warning in §5 no longer describes current infrastructure.
Both Lab 3 and Lab 4 browser suites were discovered and executed. The isolated
runner already cleans Action/revision seed children before legacy fixtures.

Issue #56 engineering contract; branch `feature/sprint4-engineering-contract`; integration target `lab4-staging`. Revised 2026-10-11 following user review. **Design revision authorized; concrete revised contract awaits review. No Sprint 4 PR, peer approval, merge, feature-test execution or release claimed.**

## Issue #60 review preparation ? 2026-10-13

The #56 drafting/approval/runner statements below are historical. The user now
supplied the actual #60 objective/tasks/acceptance criteria and explicitly
approved implementation on feature/sprint4-ticket-workflow at 18c161c.
[Ticket workflow implementation](ticket-workflow.md) records gates, tokens,
locks, preserved Action safeguards, real regression results and limits.
Review the intentional token-only status compatibility change, all gate reasons,
legacy close, both race orderings, snapshot consistency and retained drafts/keys.
No peer review, PR, merge, Project status update or final-main evidence is claimed.
Issue #60's PR review acceptance step remains for the human, targeting lab4-staging.

Current Playwright testDir is `./e2e` (changed in #59), so both Lab 3 and Lab 4
are discovered. The old lab-03-only warning in the #56 record is superseded.
The existing disposable database/browser runners and all eleven migrations are
reused; no new migration, developer-database mutation or runner change is needed.

## 1. Overview and review responsibilities

Sprint 4 adds shared Actions Taken with edit/audit behavior, formal resolution rules, role dashboards and full regression/hardening. Review [specification](specification.md), [UI](ui-spec.md), [API](api-spec.md), [tests](tests.md) and [AI use](ai-use.md) as one contract against all 11 handout pages.

Author identity recorded in Lab 3: Naing Zay Linn, 67070503484, GitHub `@naingzaylinn`. Lab 3 peer reviewer: Lae Lae Kaung Nyunt, 67070503481, `@LaeLaeKaungNyunt`. Sprint 4 reviewer assignment is **to be confirmed**; do not copy historical approvals into this sprint.

Author verifies source accuracy/design decisions/scoped changes and responds to review; peer reviewer independently checks evidence/code/data safety. User review on 2026-10-11 directs inclusion of grading-required action assignment/lifecycle and immutable audit revisions, resolving U-01/U-02. Human handles board/Git/PR when separately authorized; AI assistance is not peer approval or issue completion.

## 2. Established issue mapping and implementation order

The user supplied the following exact existing GitHub issue titles/scopes on 2026-10-11 and confirmed they are already created/on the TokTickIT Individual Sprints Project board. This replaces the prior draft mapping. Source is the user's established plan; live GitHub access was unavailable, and no issue/board changes were made.

| Issue | Exact established title | Scope / review focus |
|---|---|---|
| #56 | Sprint 4 Engineering Contract (Spec DD & Test DD) | Create/review six files: requirements, rules, UI/API, planned tests, ACs and DoD; current issue |
| #57 | Actions Taken Database and Migration | Prisma models/relationships/indexes/safe migrations, preserved data, idempotent seeds and database/migration tests; assignment/lifecycle/audit revisions |
| #58 | Actions Taken Backend API and Authorization | REST APIs, roles/session performer, assignment/inactive target rejection, lifecycle/edit/validation/safe failures, concurrency/idempotence/audit and integration tests |
| #59 | Actions Taken UI and Ticket Detail Integration | Staff list/create/assign/view/edit/transition/complete/cancel; requester own read-only history; responsive validation and UI tests |
| #60 | Ticket Workflow and Resolution Rules | Project gate, unchanged eight Ticket statuses/edges, stale/concurrent updates, advisory requester indication and workflow/regression tests |
| #61 | IT Staff Dashboard | Backend staff/Admin metrics, operational/ownership/current-user actions/recent or urgent information, drilldowns/states/responsive UI/tests |
| #62 | Requester Dashboard | Backend session-owned summaries/attention/recent/resolved work, drilldowns/isolation/responsive UI/tests |
| #63 | Final Regression and Product Hardening | Full Labs 1–4 regression for auth/roles/actions/workflow/dashboards/attachments/comments/notes/users; E2E/accessibility/responsive/failures/performance smoke and defect fixes |
| #64 | Zen Green UI, Accessibility and Release Integration | Final visual/accessibility/desktop-tablet-mobile checks, unfinished UI/visual defects, release integration/README/documentation/evidence and final main verification |

Plan: review revised contract → #57 foundation → #58 action APIs → #59 UI → #60 Ticket gate/concurrency → #61/#62 dashboards → #63 full regression/hardening → #64 final Zen Green/accessibility/release. Tests accompany every feature, not postponed. #57–#59 include assignment/status/complete/cancel and revision audit by contract; #60 depends on that data. README/demo corrections/screenshots are later #64 scope, not #56. No implementation begins in this task.

## 3. Branch, PR and board workflow

Required integration: **Feature branch → Pull Request → `lab4-staging` → final verified integration into `main`**. Feature branches derive from current integrated staging under later authorization. PRs name issue and resulting behavior, reference approved AC/test IDs, list actual verification and risks; request human peer review and fix findings before merge. Reconcile staging changes before integration and preserve history/evidence; no automatic branch change/commit/push/PR occurs in this documentation task.

Use exact Project statuses: **Backlog → Specified → Started → PR Review → Fixing → Done**. Specified means reviewed contract/test expectations; Started is authorized implementation; PR Review requires a concrete PR; Fixing records review corrections; Done requires implemented/verified acceptance and review/merge evidence. Do not invent statuses or mark #56 Done while major requirements/approvals are unresolved.

## 4. Review checklist and integration gates

- Verify seven fields and all owned-action visibility, plus page 8/11 assignment/lifecycle: three distinct identities, PENDING→COMPLETED/CANCELLED only, inactive target rejection and cancellation reason.
- Check FR/BR/AC/test links, exact metric predicates, active vs OPEN labels, terminal-ticket inclusion, five-row bounds, zero/error behavior and drilldown filters.
- Verify session/password/role gates precede resource disclosure; session-derived performer/identity; requester ownership and no Internal Note leakage.
- Preserve eight statuses and every transition edge. Review proposed gate/legacy-close behavior and required status token as explicit Lab 3 changes.
- Verify one immutable full revision per content/assignment/state mutation, original performer/date, terminal assignment/state restrictions, cancellation retention, conditional validation, same-key retry after reassignment/deactivation and stale/ABA/gate races.
- Verify C≥1/P=0/F=0 gate, cancelled exclusions, legacy close exception and terminal-Ticket correction guard; this is project design, not a handout quotation.
- Inspect migration SQL and defaults/FKs/indexes; compare old-data baseline; prove recovery and repeat seeds preserve human edits.
- Run meaningful focused and full isolated regressions; retain existing assertions; review performance/query bounds and backend metric/database comparisons.
- Verify query-aware existing navigation, drafts/error/retry behavior, accessible focus/labels, Zen Green and mobile/tablet/desktop evidence.
- Confirm no secrets, destructive operations, unrelated changes, broken links, placeholders or unsupported controls.
- Require real reviews, actual results and final main evidence; no documentation-only completion claim for product features.

Each feature PR first passes its focused checks and affected regressions. On `lab4-staging`, deploy migrations/seeds only in verified disposable verification environments, run full checks and manual review, resolve conflicts/defects and recheck affected behavior. Final integration to `main` happens only after staging gates and human review; rerun full verification from final main commit, record hash/output and compare metrics to independent DB queries. Do not reset development data to make tests pass.

Documentation-only audit on 2026-10-09: all six files exist; 24 acceptance criteria map to 50 Planned test entries; local Markdown link targets/anchors resolve; eight transition rows match the backend matrix; fenced blocks and whitespace checks pass. `git diff --check` was clean; because the new files are untracked, each was also checked with `git diff --no-index --check` against `/dev/null` and a direct whitespace audit. No feature tests/builds/database commands were executed. Git status shows only new `docs/lab-04/` and separately user-managed untracked `docs/references/`; no tracked source changes. This is draft-document verification, not product or issue completion evidence.

Revised documentation audit on 2026-10-11: six files, 18 FRs, 27 BRs, 29 ACs and 66 Planned test entries; every AC has mapped tests. Checked local link targets/anchors, JSON examples, fenced blocks, whitespace, defined FR/BR/AC references, all eight backend Ticket transition rows and all nine exact user-supplied issue titles. Checks pass; no feature tests/builds/database work. The old 24/50 counts above describe the original draft only. Current Git status remains six untracked Lab 4 Markdown files and the user-managed untracked PDF; branch unchanged, no tracked source modifications/staging/commits/pushes/PRs.

## 5. Verification commands and runner limits

Commands are based on actual [server package scripts](../../server/package.json), [client scripts](../../client/package.json), [isolated runner](../../server/scripts/test-isolated.ts), [E2E runner](../../server/scripts/test-e2e.ts) and [Playwright configuration](../../client/playwright.config.ts). These are **future verification commands**, not commands executed for #56. On Windows use `npm.cmd` where PowerShell blocks npm.ps1.

| Working directory | Command | Purpose / caution |
|---|---|---|
| Repository | `npm.cmd run build --prefix server` | Server TypeScript build |
| Repository | `npm.cmd run build --prefix client` | Client TypeScript/Vite build |
| Repository | `npm.cmd test --prefix client` | All component tests discovered by Vitest |
| server | `npm.cmd run test:isolated -- tests/lab-04` | Future focused Lab 4 API/unit/integration checks in generated disposable schema |
| server | `npm.cmd run test:isolated` | Full server regression; runner deploys migrations, checks drift and seeds disposable schema |
| server | `npm.cmd run test:lab3` | Existing focused Lab 3 regression |
| server | `npm.cmd run test:workflow` | Existing Lab 3 connected API workflow; not a Lab 4 suite alias |
| server | `npm.cmd run test:migration` | Existing Lab 3 migration test only; new Lab 4 tests run through focused isolated command |
| server | `npm.cmd run test:e2e` | Current real-service isolated E2E runner; see discovery limitation below |
| Repository | `git diff --check` | Whitespace errors in tracked diff |
| Repository | `git status --short` | Scope/status audit, preserve separately managed references |

Current Playwright `testDir` is **only `client/e2e/lab-03`**, uses installed Microsoft Edge and one worker. `test:e2e` passes arguments but does not make `lab-04` files discoverable outside that testDir. A later authorized testing change must broaden testDir to `./e2e` while retaining Lab 3 discovery; then the existing server `npm.cmd run test:e2e` can discover both directories, and `npm.cmd run test:e2e -- lab-04` can focus the new suite. Confirm discovery before claiming Lab 4 E2E passes. No nonexistent `test:lab4`, lint or accessibility script is claimed.

Server raw `npm test` exists but does not isolate destructive fixture setup; use test:isolated. Test scripts create/drop only their generated schemas; that is future authorized verification, not permission to reset development data. New seed action FKs need scoped test-fixture cleanup/isolation compatible with legacy ticket deletion; review the runner adjustment before invoking new seeds. `prisma:migrate`/`prisma:seed` scripts exist but mutate the configured database: do not run them for #56 or against an unverified development target. Recovery tests must use disposable copies.

## 6. Submission and review evidence

Handout pages 10–11 require exactly one concise PDF with **Answer Part 1** through **Answer Part 9** in order, readable screenshots and working links. Repository/final main is authoritative.

| Part | Required future evidence |
|---|---|
| 1 | Feature→staging→main history, actual final Project issues Done, reviewer identities/PR links/comments/responses/approvals, README/.gitignore/directory evidence |
| 2 | Rendered specification and link; numbered rules/metrics/gate/migration/DoD; proof contract existed before main implementation PR completion |
| 3 | Rendered tests with actual paths/statuses and complete unit/API/UI/auth/workflow/regression/E2E output from main |
| 4 | AI-use record naming tool, 6–10 real selected prompts and student-authored My Reflection |
| 5 | Staff dashboard metrics, current-user actions, recent/urgent info, drilldowns/states/responsive and independent DB count comparisons |
| 6 | Action list/create/assign/edit/status transition/complete/cancel, backend inactive-assignee rejection, role restrictions/safe failures/responsive; multiple actions on one Ticket |
| 7 | Ticket matrix/lifecycle, stable ordering, immutable action revision and append-only comment/note evidence, role visibility |
| 8 | Own requester dashboard attention/recent/drilldowns/isolation plus representative Labs 1–3 UI regression |
| 9 | Rendered ui-spec, desktop/tablet/mobile screenshots and completed theme/accessibility/focus/overflow checklist |

Future review record (unfilled; no historical reviews fabricated):

| Issue/PR link | Author / reviewer | Commit reviewed | Actual comment / response | Verdict | Verification/evidence | Merge outcome |
|---|---|---|---|---|---|---|
| #56; PR not created | Author above; user review received, peer TBD | Uncommitted documentation working tree | User on 2026-10-11 requested full page 11 action lifecycle and supplied exact issue plan; AI revised six files (summary, not quoted PR comment) | Revised contract pending review; no peer approval | Documentation audit only | Not merged |

Add real entries for #57–#64 and final integration when they occur. Record explicit approval separately from merge; do not infer review from a merge event.

## 7. Risks and unresolved decisions

U-01/U-02 are resolved by required lifecycle/immutable revision design; U-03 is resolved by the exact user-supplied existing issue plan. Routine date/limits/metric/terminal choices are explicit project decisions P-01–P-10, not missing handout requirements. Revised design still awaits user review; future peer reviewer identity and actual release evidence remain unrecorded facts. Technical risks: ordered Ticket/Action/User locks and deactivation race, original-assignee replay comparison, terminal gate guard, FK fixtures/migration indexes, E2E discovery, mixed enum/envelope formats, action pagination and stale-user UI. No GitHub changes or #57 implementation in this task.

## Issue #63 independent critical-review preparation — 2026-10-14

Review [final-hardening.md](final-hardening.md), all production diffs and new tests. Check parent-before-child locks, capacity/metadata atomicity, immutable single removal event, rollback and binary compensation, relevant P2002 classification/fresh replay after rollback, normalized frontend intent/confirmation, current-read checks after body parsing, caller invalidation, attachment outcome handoff and narrow console allowances. Confirm unchanged schema/seeds/role/workflow/dashboard/session policy, disposable migration evidence, README start path and manual limitations. This is self-review preparation, not an independent verdict, approval, PR or merge.
