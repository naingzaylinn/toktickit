# Lab 4 Review and Integration Plan

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
