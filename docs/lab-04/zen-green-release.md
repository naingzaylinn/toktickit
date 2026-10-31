# Issue #64 — Zen Green UI, Accessibility and Release Integration

## Phase 2 scope and safety — 2026-10-14–15 (Asia/Bangkok)

Before editing: feature/sprint4-zen-green-release; HEAD, lab4-staging and
origin/lab4-staging all c651d11d9a1ffad5224caad65e75d05270768f21; clean tracked
tree and empty index. Git contains merge PR #72. The user reports #63 independently
approved/completed; no reviewer identity or approval comment is invented here.

Authorized work is bounded UI/accessibility/feedback, risk reproduction, tests,
documentation and real disposable-environment capture. No Git publication,
branch/fetch/pull/merge operation or main integration occurred. docs/references/
was excluded from enumeration/content reads. Backend source, schema, migrations,
seeds, dependencies, role/session policy and business workflows remain unchanged.
Verification uses runner-generated schemas and temporary attachment storage only.

## Corrections and tests

| ID | Correction | Evidence |
|---|---|---|
| ZG-01 | Existing Bootstrap link tokens use secondary green and primary hover/visited accents; attachment Download uses green outline; focus/destructive/warning styling preserved | Browser link normal/hover/focus and Download variant checks |
| ZG-02 | Primary Ticket Owner labels distinguish Ticket ownership from Action Assignee/original performer | Staff ownership journey retains claimed-user assertion with updated label |
| ZG-03 | form-select for Actions page size; comparable h5 Requester Public Comments heading | Browser class assertions |
| AX-01 | Shared useDialogFocus enters named/described dialogs, traps Tab/Shift+Tab and programmatic background focus, respects busy Escape, restores trigger or stable Attachments heading, cleans handlers on close/unmount | Attachment components and real Edge keyboard journey |
| AX-02 | Linked/focused local and server comment/removal-reason errors; removal feedback inside modal; obsolete scheduled focus cannot target a replacement field | FormField associations, retained drafts, server validation and focus tests |
| AX-03 | Native desktop tr with actual ticket-number href; row click ignores nested controls; mobile cards unchanged | Component/native-row/link/Enter and real desktop navigation |
| AX-04 | Identity-scoped Admin trigger restoration after Cancel/save/list refresh, stable heading fallback, preserved validation focus | Create/edit/password Cancel, refreshed replacement, missing trigger and old identity cases |
| AX-05 | Create local and password local/server validation focus first invalid control | No-create validation and password field association/focus |
| FB-01 | Confirmed attachment writes separated from GET failure; retained success and GET-only recovery; unknown results require explicit review before writes; synchronous ownership prevents rapid duplicate recovery GETs | Upload/removal write-success/read-failure, uncertainty, definitive rejection and no duplicate-write/GET assertions |
| FB-02 | Explicit empty staff comments/notes, accurate Requester busy text, stable Retry focus | Communication regressions and browser journeys |
| O-01 | Confirmed obsolete global mutation denial fixed using existing optional transport context, captured App revision and guarded continuations | Actual App/API delayed-response/error-body tests; current/default denial controls |

CreateTicket fingerprint/key/confirmed-stage retry semantics are untouched; its only
production change directs focus after local validation. All #63 assertions remain.

## Responsive reproductions

Real headless Microsoft Edge rendered the application with intercepted stress
fixtures at 320×812, 375×812, 768×1024, 1280×800 and 1440×900. Every API call is
handled or fails an unexpected-request assertion. Checks measure document width,
control edges and pairwise overlap. Connected seeded dashboard/Actions journeys
provide separate real-service evidence.

| Risk | Initial result | Fix/current result |
|---|---|---|
| R-01 | Staged filenames contained. Recovery overflow at all widths; 320 px scrollWidth 3267 px | Shared zen-card wrapping; all widths pass |
| R-02 | Requester metadata overflow at all widths; 320 px scrollWidth 3282 px | Shared min-width:0/overflow-wrap:anywhere; all pass |
| R-03 | Staff header/reference/owner overflow at all widths; 320 px scrollWidth 4644 px | Same shared containment; unchanged selector/columns; all pass |
| R-04 | Preview close beyond viewport, e.g. right edge 4133 px at 320 px; removal page also overflowed | Modal content/title containment plus card wrapping; all pass |
| R-05 | Conflict screen overflowed alongside previously overflowing Staff metadata; individual paragraph contribution was not separately isolated | Shared wrapping covers review/history; long conflict state now passes all widths |
| R-06 | Existing ErrorAlert/Retry and EmptyState/CTA did not overflow at requested widths | No one-off feedback layout rewrite |

Queue local table scrolling remains covered by the existing Lab 3 responsive suite.
No overflow-hiding rule or column removal was introduced. Existing 200% font-size
tests establish text reflow, not actual browser zoom. Real browser zoom is pending.

## O-01: actual red evidence and root cause

Before production changes, RequesterMutationContext ran 16 cases: 12 failed,
4 passed (6.40s). Actual App and API helpers started comment, advisory indication,
upload or removal as A; A logged out; B logged in; then A's 401/password-change 403
or delayed error JSON was released. Each denial emitted one obsolete global
session-access-changed event. Late successes did not expose A's records.
Confirmed impact was global access-loss dispatch; cross-identity disclosure and
stale navigation were not demonstrated.

These callers omitted the existing optional request context, so component unmount
could not suppress readApiError's post-body global event. The correction captures
the originating session predicate/lifetime, passes context, guards UI/refresh
continuations and prevents obsolete cleanup from affecting current work. Current
and default 401/password-change denials still emit access loss. Ordinary permission
403 remains local unavailable feedback. No backend/session policy change.

Abort cannot undo committed mutations. Unknown attachment outcomes require review
and never automatically replay uploads/removals. Recovery is in-memory only.

## Verification and retained failures

| Directory/command | Actual result |
|---|---|
| client: npm.cmd test -- tests/lab-04/RequesterMutationContext.test.tsx, before fix | 12 failed / 4 passed |
| server: npm.cmd run test:e2e -- lab-04/zen-green-release.spec.ts, before layout fix | 5 failed: measured overflow plus missing mocked Queue response |
| Same focused responsive command, corrected | 5 passed, 35.4s |
| client: seven focused component files, intermediate | 10 failed / 108 passed: linked-label text and old API argument expectations; corrected without weakening payload checks |
| Same expanded focused run | 136 passed / 7 files, 18.20s |
| client: intermediate build | Test-only TypeScript errors: Playwright exact option in RTL queries, then missing upload activeAttachmentCount fixture; corrected |
| server: focused keyboard/evidence browser run | 6 passed / 4 failed, 1.6m: login/navigation race and mouse-modality focus-visible assertion; awaited landing and exercised keyboard modality |
| client: npm.cmd test, first complete run | 453 passed / 30 files, 44.17s |
| client: npm.cmd test, intermediate after focus correction | 455 passed / 30 files, 40.72s; original-control focus and busy-dialog tests included |
| client: npm.cmd test, after server validation | 457 passed / 30 files, 26.73s |
| client: npm.cmd test, concurrent verification | 457 passed / 1 failed, 43.72s; existing ActionsTicketIntegration initial Add timeout; no assertion/timeout change |
| client: npm.cmd test, sequential verification | 458 passed / 30 files, 28.90s; current permission-denial clearing included |
| client: npm.cmd test -- tests/lab-02/Attachments.test.tsx -t "rapid attachment-review", before synchronous guard | 1 failed, 1.95s; two clicks emitted two recovery GETs (three total including initial load). Sixteen unrelated cases excluded by -t; no skip annotations added |
| client: npm.cmd test, final after synchronous recovery guard | 459 passed / 30 files, 37.28s; zero skips |
| server: npm.cmd run test:isolated | 627 passed / 39 files, 211.21s; migration/seed/concurrency/workflow/smoke included |
| server: ZEN_GREEN_SCREENSHOTS=1; npm.cmd run test:e2e, first complete run | 71 passed / 1 failed, 4.7m; historical owner-label locator corrected |
| Same full browser command, intermediate regression run | 72 passed, 5.0m; zero skips/retries |
| Same full browser command, intermediate strict scroll assertion | 69 passed / 3 capture failures, 4.8m; focused offscreen textareas moved scroll after reset (26/19/94 px); capture-only correction below |
| Same full browser command, after capture correction | 72 passed, 4.3m |
| Same full browser command, final after synchronous recovery guard | 72 passed, 4.2m; zero skips/retries; regenerated 22 captures |
| server: npm.cmd run build | Passed TypeScript |
| client: npm.cmd run build, initial complete build | Passed TypeScript/Vite, 49 modules; Vite stage 1.83s |
| server/client: npm.cmd run build, final after all production changes | Both passed; client 49 modules and Vite stage 1.61s |
| server: ZEN_GREEN_SCREENSHOTS=1; npm.cmd run test:e2e -- lab-04/responsive.spec.ts lab-04/release-evidence.spec.ts, capture iterations | 13 passed in 58.8s, then 13 passed in 49.9s with instant scroll; full-suite strict check subsequently exposed caret motion and was corrected |

Initial sandbox client/E2E starts failed spawn EPERM in esbuild/Prisma. Approved
outside-sandbox retries used inspected runners. Browser retries are configured zero.
No assertions/cases are skipped or removed to obtain a pass. The first complete
browser run found the historical Current owner expectation; it now checks Primary
Ticket Owner and still asserts IT Staff One. NO_COLOR/FORCE_COLOR warnings remain.

## Screenshot workflow and provenance

From server, set ZEN_GREEN_SCREENSHOTS=1 and run npm.cmd run test:e2e. The runner
creates a random schema, deploys/checks migrations, seeds public accounts, starts
isolated API/Vite and cleans schema/storage. Never target developer services.

release-capture.ts writes ignored client/node_modules/.cache/issue-64-evidence/
PNGs plus JSON: full HEAD/branch, explicit uncommitted-working-tree status,
role/state, viewport, UTC capture time, Asia/Bangkok display timezone and SHA-256
hashes of all production sources including new hooks. No env/reference files read.

Capture set: staff-dashboard-normal-{320,375,768,1280,1440};
requester-dashboard-normal-{320,375,768,1280,1440};
actions-{staff-history,create,edit,requester-read-only}-{375,768,1440}.
Each basename has .png/.json. Actions use real disposable Ticket/Action writes
showing pending/completed/cancelled records, create/edit and own read-only history.
22 PNGs and 22 JSON sidecars were generated and verified. Every sidecar's production
source hashes matched the working tree (zero mismatches). Representative Staff
desktop, Requester tablet and Actions mobile captures were inspected by Codex;
this is not an independent visual or manual accessibility approval. The mobile
Actions capture exposed a capture-only issue: opening the form had scrolled the
page, leaving the sticky navbar mid-image. captureRelease now scrolls to the top
after fonts settle, without changing application layout. The final helper temporarily
sets scroll behavior to auto and blurs the offscreen control to stop caret motion,
checks scroll position zero, captures the normal reading state, then restores the
original focus with preventScroll and the original scroll setting. Both temporary
capture settings are explicitly recorded in each JSON sidecar. Keyboard/focus
assertions are separate evidence; these PNGs do not certify focus-ring appearance.
Final full regression regenerated all 22 images. Sidecar production hashes were
rechecked against current sources. Representative final images were inspected;
full manual review remains Phase 3 work. Crop full-page images into readable PDF
figures later.

Declared opaque green/white token contrast remains 6.63:1 (primary) and 5.40:1
(secondary). Browser tests verify rendered link colors/hover and keyboard outline;
this is not complete rendered-state/disabled/focus contrast certification.

Eventual submission candidates are the 375/768/1440 dashboard and Actions PNGs;
320/1280 dashboard images are supplemental. Retain JSON provenance. Later copy
reviewed files to planned artifacts/lab-04/screenshots/ destinations. These are
working-tree artifacts, not staging/main evidence. No screenshots are staged.
Exclude real identities, private information, credentials/tokens and env values.

## Documentation and remaining gates

ui-spec/tests retain historical contract/planning while pointing to current evidence.
AI-use records actual instructions/assistance; human reflection/approval is not
fabricated. VIS-01–VIS-08 remain pending manual/final evidence; automated subsets
do not complete them. Phase 3 must review captures, rendered contrast/focus/touch
targets, actual 200% browser zoom and screen-reader operation, then independent
review. No GitHub approval, staging/main integration or final submission claimed.

## Final scope and handoff

Production (13 files, including two new hooks): client/src/App.tsx, api.ts,
theme.css; components/ActionsTaken.tsx, AuthScreen.tsx, CreateTicketScreen.tsx,
MyTicketsScreen.tsx, RequesterDiscussion.tsx, StaffTicketDetailScreen.tsx,
TicketDetailScreen.tsx, UserManagementScreen.tsx;
components/common/useDialogFocus.ts and useMutationContext.ts.

Component tests (7 files, including new context suite):
client/tests/lab-02/Attachments.test.tsx and MyTickets.test.tsx;
lab-03/AuthScreen.test.tsx, RequesterDiscussion.test.tsx, UserManagement.test.tsx;
lab-04/CreateTicketHardening.test.tsx and RequesterMutationContext.test.tsx.

Browser files (5, three new): client/e2e/lab-03/staff-ticket-flow.spec.ts;
lab-04/responsive.spec.ts, release-capture.ts, release-evidence.spec.ts,
zen-green-release.spec.ts. Documentation (4, one new): docs/lab-04/ai-use.md,
tests.md, ui-spec.md and this record. Total: 22 modified tracked and 7 new files.
Generated builds/cache screenshots are ignored, outside this source scope.

Final safety checks: branch and full HEAD/staging refs unchanged; index empty;
git diff --check passed and new files separately checked for whitespace/newline.
No excluded reference access, developer-data changes or Git publication/integration.
Handoff recorded 2026-10-15. Final 22 PNG/JSON pairs have matching production hashes
and declared normal-reading capture settings; all seven new files pass the separate
whitespace/newline check.
Final verdict: **READY FOR PHASE 3 VISUAL VERIFICATION**. This is a self-review
handoff backed by automated evidence, not independent approval or release readiness.

## Phase 3A pre-push reconciliation — 2026-10-29

This addendum records the later focused fixes and read-only pre-push review. The
2026-10-15 handoff counts and 22-capture inventory above are historical; the
current counts and evidence inventory are below. This is not an approval or a
claim that Issue #64 is fully verified.

### Targeted fixes

- Requester Dashboard guidance now uses the existing `text-primary-green` class.
  Headless Edge rendered it as `rgb(0, 107, 60)` on `rgb(245, 247, 246)`, measured
  at 6.16:1. New mocked-API screenshot/JSON pairs are
  `requester-dashboard-contrast-fix-{375,768,1440}` at 375×812, 768×1024 and
  1440×900. These captures show the dashboard at those viewports and record the
  paragraph colors/contrast; they do not independently prove every visual or
  accessibility criterion.
- Staff queue drilldowns preserve the originating queue URL in in-memory return
  context scoped to the current staff identity. Back restores the matching
  filtered URL; direct detail entry falls back to `/staff/tickets`. The App test
  covers filtered return, direct-entry fallback and identity-change clearing.
- `App.tsx` also contains the pre-existing requester-session `isSessionCurrent`
  change. It is preserved and is separate from the later staff queue return fix.

### Focused verification observed

| Command | Observed result |
|---|---|
| `npm.cmd test -- tests/lab-04/RequesterDashboard.test.tsx --reporter=dot` | 19 passed |
| `npm.cmd test -- tests/lab-04/DashboardDrilldowns.test.tsx --reporter=dot` | 12 passed |
| `npm.cmd test -- tests/lab-04/ProtectedReadContext.test.tsx --reporter=dot` | 22 passed |
| `npm.cmd test -- tests/lab-02/TicketDetail.test.tsx --reporter=dot -t UI-031` | 1 passed; 5 skipped by name filter |
| `git diff --check` | Passed |

These focused client tests use mocked APIs. The UI-031 test verifies the neutral
not-found presentation for a mocked 404; it does not verify backend ownership
enforcement.

### Current evidence and working-tree scope

The evidence cache currently contains 25 PNGs and 25 JSON sidecars: the original
22 pairs plus the three contrast-fix viewport pairs above. The new dashboard
captures use mocked API responses and record role, viewport, rendered contrast
and source provenance. Image existence or a screenshot alone is not proof that
all VIS criteria pass.

At this reconciliation, Git status showed 24 modified tracked files, no staged
changes, and 9 untracked status entries. The seven identified Issue #64 untracked
files are `client/e2e/lab-04/release-capture.ts`,
`client/e2e/lab-04/release-evidence.spec.ts`,
`client/e2e/lab-04/zen-green-release.spec.ts`,
`client/src/components/common/useDialogFocus.ts`,
`client/src/components/common/useMutationContext.ts`,
`client/tests/lab-04/RequesterMutationContext.test.tsx` and this report. The
untracked `server/check-local-users.mjs` is a user-record diagnostic; it was not
run and is unreviewed for release inclusion, subject to user decision. The
untracked `docs/references/` directory remains protected and unreviewed; its
contents were not inspected.

### Remaining verification and status

The browser test named `two Requesters have distinct personal rows and foreign
detail is concealed` was not run: it creates a ticket and uses the E2E service/data
setup. Foreign-requester ownership enforcement was therefore not independently
verified through a safe isolated browser test. The component-level mocked 404
test is UI evidence only.

The user reports completing actual 200% browser zoom checks and keyboard
navigation on staff and requester screens. These are user-reported observations;
they were not independently repeated as part of this reconciliation. Screen-reader
testing is **NOT VERIFIED**.

VIS-01–VIS-08 remain partial/pending; none are marked passed by this addendum.
Authenticated-screen contrast/touch-target coverage, broader link/console review,
foreign-ticket browser verification, screen-reader testing, independent review,
GitHub approval, staging/main verification and final submission evidence remain
incomplete or unclaimed as appropriate. No release approval or merge is claimed.
