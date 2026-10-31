# Issue #63 — Final Regression and Product Hardening

Phase 2 implementation on `feature/sprint4-final-hardening`, based on
`9076badbb61479e95584f25e7e2c399f89b8cff5`, 2026-10-14 (Asia/Bangkok).
This is working-tree evidence, not a commit, independent review, merge or release.
Issue #64 is not implemented. The user authorized F-01–F-10 and bounded
observation checks following the Phase 1 READY FOR TARGETED HARDENING verdict.

## Baseline and safety

Branch, HEAD, local lab4-staging and merge base matched the expected commit.
Tracked working tree and index were initially empty. Unrelated docs/references/
was excluded from searches/content reads and left untouched. No staging, commit,
push, PR, branch switch, fetch, pull, reset or stash was performed.

Phase 1 actually passed 587 server tests/35 files, 332 client tests/26 files,
55 browser tests and both builds. Initial sandbox Prisma/esbuild spawn EPERM
attempts ran no tests; authorized retries supplied that passing baseline.

Every database run in this phase uses the approved isolated runner. Its generated
schema deploys 11 existing migrations, checks schema parity, seeds fixtures and is
dropped afterward. The server runner now also provides a generated temporary
attachment directory, matching browser isolation, so neither new nor legacy tests
write developer attachment storage. New fixture schemas are nested under that
approved runner. No developer schema was migrated, seeded or fixture-mutated.

## Corrections and regression mapping

| Finding | Preserved reproduction/root cause | Smallest correction | Regression evidence |
|---|---|---|---|
| F-05 Major | Unmounted Staff Dashboard 401/password-change response dispatches global access loss after a newer identity loads; local generation checks occur too late | Optional ApiReadContext through getStaffDashboard, abort/current identity-role checks after body parsing; preserve current denial handling | StaffReadContext.test.tsx: obsolete 401/403, delayed body, ignored abort, identity/role/unmount, late success/failure/current denial; existing Staff/Requester focus/refresh suites |
| F-03 Major | Two uploads see four active files and both insert; uncoordinated capacity read | Stage binary outside transaction; lock owned parent Ticket FOR UPDATE, count and create metadata atomically; compensate loser/failure | attachment-hardening.api.test.ts: actual database competing requests, five-file invariant, available slots, different Tickets, removal race and failed metadata cleanup |
| F-04 Major | Two removals pass an outside-transaction active check and overwrite tombstone/create duplicate events | Same parent-first lock; conditional active-to-removed update, exactly one event in same transaction; binary removal after commit | attachment-hardening.api.test.ts: 200/409 winners, immutable reason/actor/time, one event, repeat/download denial, audit-failure rollback/binary retained |
| F-02 Major | Both same-key creates miss preflight; loser uniqueness error becomes 500 | Handle only Ticket requesterId/clientRequestId P2002; fresh owned lookup after failed transaction rolls back; same normalized comparison/DTO for sequential and concurrent replay | ticket-creation-hardening.api.test.ts: identical/different intents, cross-requester keys, exact replay, unrelated unique errors, sequence and injected failure rollback |
| F-01 Major | UUID generated inside every submission; double dispatch/uncertain retry starts another Ticket | Synchronous pending guard; in-memory normalized intent/key; unchanged uncertain retry reuses key; changed uncertain intent requires confirmation; definitive rejection releases key | CreateTicketHardening.test.tsx and connected product-hardening.spec.ts committed-response-loss journey; one persisted Ticket and matching request bodies |
| F-06 Minor | Hardcoded activeAttachmentCount=0 in My Tickets | Filtered relation count inside bounded list projection; same DTO and ownership | release-validation.api.test.ts: zero/active/removed/multiple Requesters/pagination; product browser asserts exact attachment cell |
| F-07 Minor | Upload return discarded, catch empty | Successful creation retained; explicit accepted/rejected summary before opening existing Ticket; unknown network results labelled uncertain; retry failures only in existing detail | CreateTicketHardening.test.tsx all-success/partial/capacity/total/network; browser partial upload then existing-Ticket retry, two files/one Ticket |
| F-08 Minor | Multer parser errors fall into generic 500 | Route-scoped safe 413 for transport size, 400 malformed/count/field, 415 unsupported supplied content type; existing 5 MiB business validation intact | release-validation.api.test.ts boundaries, excess files, wrong field, malformed multipart/content, safe envelope/no metadata/storage change |
| F-09 Minor | PostgreSQL-incompatible U+0000 passes length/email checks | Reject NUL without stripping content in comments/notes, ticket summary/description, user name/email, removal reason and filename; login email checked too | release-validation.api.test.ts reproduced comment plus notes/ticket/user/reason 500s before fixes; multilingual text and no-write checks; existing Action validation remains |
| F-10 Minor | README presents Lab 3/current old test/discovery scope | Current Labs 1–4 setup/upgrade/seed/start/test/demos/limitations and linked working-tree evidence | Script/config/seed-source walkthrough; builds, production-start smoke and complete suites |

Changed production locations: client/src/api.ts and StaffDashboardScreen,
CreateTicketScreen; server/src/routes/attachments.ts and tickets.ts; narrow NUL
guards in ticketValidation, attachmentValidation, requesterActions, staffTickets,
adminUsers and auth. Observation read contexts additionally touch the existing
ActionsTaken, StaffTicketDetail/Queue, TicketDetail, UserManagement and
RequesterDiscussion read owners. No schema/migration/seed definition changes.

## Concurrency and storage correctness

Upload and removal acquire the parent Ticket before child writes, the same order
used by Actions/workflow. Capacity count and metadata insertion share a transaction.
File writes occur before locking; loser/error compensation and removal unlink occur
outside transactions. Different parents can proceed independently. Attachments do
not introduce new workflow-version or Ticket activity semantics.

Removal still checks requester ownership independently. A conditional update
transitions only an active owned attachment. Its event and tombstone commit or roll
back together; competing/repeated attempts preserve the first reason/actor/time.
Staff/Admin retain shared active downloads but requester-only upload/removal.

Concurrency tests hold an independent real parent row lock, start actual HTTP
requests, inspect pg_blocking_pids (including dependent blockers), then release.
Passing interleavings require exact response/row/event counts; sleeps are not proof.
Ticket tests pause both actual owned preflight reads, then let PostgreSQL uniqueness
select the winner. The failed transaction must fully roll back before replay;
sequence increments cannot leak. Other unique/database failures remain safe 500s.

## Frontend reliability and observations

- O-01 confirmed: eight other protected read helpers reproduced obsolete global
  denial after deferred error-body parsing. They now accept optional read context;
  existing owning components cancel/invalidate their reads. ProtectedReadContext
  tests real transport plus actual unmounted Queue/detail/Actions/users/references.
  Default current-session handling and mutation transport remain enabled.
  The final getter scan included attachment binary transport: late denied reads
  emitted obsolete events, and late successful reads started a download after
  unmount. Its optional read context and owning lifetime guard now prevent both.
  Preview URLs are revoked on replacement/close/unmount through one effect; a
  reproduced preview leak is covered as bounded attachment-resource evidence.
- O-03 confirmed: failed comment GET displayed a false empty state. A distinct
  failure/Retry Public Comments state now replaces it; comment posting waits for
  a valid snapshot. Genuine empty and successful states/drafts remain.
- O-04: supported My Tickets scalar parameters now reject repeats/structured names,
  including encoded equivalents. Unknown TEXT relatedSystemId remains a valid
  nonmatching predicate; this is not a general unknown-query/UUID rewrite.
- O-02: bounded 61-Ticket list/Queue smoke verifies one findMany/count each and
  20-row pages with projections; 40 public/40 private rows use bulk authors with
  requester privacy. Dashboard smoke remains 150 Tickets/Actions. Attachment smoke
  is bounded size/capacity/compensation coverage, not uncontrolled load. Histories
  and administrator lists retain unpaged contracts.
- O-05: critical browser creation/retry/attachment and cross-role dashboard journeys
  assert console errors and pageerror. Allowances consume exact 401 messages only
  for concrete signed-out auth/me probes or known read requests captured in flight
  at explicit logout, matched to their actual 401 responses. Delayed old responses
  remain identifiable after the next login. The deliberately aborted create has
  one specific URL/message allowance. Current-session unexpected errors fail.
- Additional confirmed startup defect: npm start referenced missing dist/index.js;
  compiler emits dist/src/index.js. Only the script target was corrected.
- Additional confirmed favicon 404: index.html now declares an empty data favicon.
- O-06 remains unverified: manual screen-reader, contrast, real browser zoom,
  production-scale migration lock duration and production load. Width/focus/text
  reflow assertions are not claims of full accessibility compliance.

Creation/upload outcomes retain Ticket identity without resubmitting Ticket creation.
Known rejected filenames/reasons and accepted files are reported. Unknown upload
outcomes instruct users to inspect existing files before reselecting, avoiding blind
duplicate upload. Retry is explicit in the existing detail upload UI. Logical keys
and drafts are in memory and do not survive deliberate navigation/document reload.
Self-review added focus to the newly displayed outcome heading so replacing the
form does not strand keyboard focus on body. Component assertions cover all failure
outcomes; the connected browser uses Tab/Enter to open the retained Ticket.
The Ticket race barrier additionally asserts that both actual initial reads returned
null, so its cleanup timeout cannot make a sequential replay count as race evidence.

## Failures and corrections retained

| Command / directory | Original result and disposition |
|---|---|
| npm test -- tests/lab-04/StaffReadContext.test.tsx / client | Before fix: 9 failed/2 passed; after fix related staff/requester set 51 passed |
| npm run test:isolated -- tests/lab-04/attachment-hardening.api.test.ts / server | Before fix: cap regression failed; two removal/race cases hit a blocker-observation harness timeout; 4 passed. Recursive blocker observation fixed the harness. Upload-only intermediate run: 26 passed/1 removal failure, proving duplicate 200s. Both fixes then 27 passed including legacy upload/lifecycle |
| npm run test:isolated -- tests/lab-04/ticket-creation-hardening.api.test.ts / server | Before fix: identical and changed-intent races failed (201/500), 4 passed. Intermediate subsequent-replay failure traced to Vitest restore on Prisma dynamic delegate, fixed by restoring bound original. Focused creation/validation/attachments then 47 passed |
| npm test -- tests/lab-04/CreateTicketHardening.test.tsx / client | Before fix: 8 failed/3 passed, act warnings in failed-confirmation paths. Fixed suite plus legacy Create Ticket: 20 passed; legacy creation-success assertion preserved after explicit feedback/open step |
| npm run test:isolated -- tests/lab-04/release-validation.api.test.ts tests/lab-04/ticket-creation-hardening.api.test.ts / server | Before minor fixes: 13 validation/count failures plus delegate-restoration harness failure; 8 passed. No failure counted as a pass |
| npm test -- tests/lab-04/ProtectedReadContext.test.tsx / client | Before observation fixes: 9 failed/2 passed; final actual-owner expansion: 17 passed |
| npm test / client (intermediate) | 15 failed/350 passed: mock-call expectations needed the new optional context argument. Original payload/page/filter assertions retained; signal/currency assertions added. Subsequent focused set: 70 passed |
| npm run build / server (intermediate) | TS2322 nullable storageKey captured in transaction. Capturing the definite savedKey corrected it; subsequent build passed |
| npm run test:e2e -- lab-04/product-hardening.spec.ts / server | First run 3 failures: favicon 404, expected signed-out probes, wrong detail upload label. Second 2 passed/1 wrong table-role locator; actual row intentionally has button role. Correct DOM row/exact count cell then 3 passed (11.4s) |
| npm run test:isolated -- tests/lab-04/attachment-hardening.api.test.ts tests/lab-04/release-validation.api.test.ts tests/lab-04/product-performance-smoke.test.ts tests/lab-04/performance-smoke.test.ts / server | 35 passed/1 dynamic Prisma history-spy harness failure; bound original supplied. Focused product smoke then 3 passed |
| npm run start --prefix server / root (before correction) | MODULE_NOT_FOUND for dist/index.js; emitted entry inspected and script corrected |
| npm run test:isolated / server (first complete run) | 626 passed/1 failed, 39 files, 199.51s. Existing AUTH-09 correctly caught unsupported-content validation returning 415 before foreign ownership 404. Ownership was moved before the parser/content check; its original assertions remain intact. Full verification repeated after this production correction |
| npm run test:isolated -- tests/lab-03/requester-regression.api.test.ts tests/lab-04/attachment-hardening.api.test.ts tests/lab-04/release-validation.api.test.ts / server | After ordering correction: 57 passed/3 files, 24.61s; no skips |
| npm run test:e2e / server (first complete browser run) | 58 passed (3.0m); repeated against final ownership-order correction |
| npm run test:e2e / server (outcome-focus verification) | 57 passed/1 console assertion failure (3.3m): a delayed reference-read 401 after explicit logout outlived the UI phase. The guard now matches actual marked requests/responses and consumes one exact-message allowance each; no current-session or pageerror filter was relaxed |
| npm test -- tests/lab-04/ProtectedReadContext.test.tsx / client (binary getter scan) | Getter-only addition failed 1/18; actual binary lifetime tests failed 4/21; preview cleanup addition failed 5/22 before correction. These are additional confirmed O-01/resource reproductions, not silent passing retries |
| npm test -- tests/lab-04/ProtectedReadContext.test.tsx tests/lab-02/Attachments.test.tsx / client (binary correction) | 27 passed/1 legacy PDF mock-argument failure (3.65s); its three original arguments remain asserted with the added context. Subsequent complete frontend suite: 376 passed |
| npm run build / client (binary regression addition) | TS2769: new getByRole query used unsupported exact option. Replaced with anchored role-name regex; subsequent TypeScript/Vite build passed |

One scripted edit failed to parse before writing; the correction was applied using
apply_patch. Phase 2 executable checks ran outside sandbox with approval because
Phase 1 already established blocked native Prisma/esbuild/browser process launches.
No dependency upgrade or installation was performed. Playwright emits the harmless
NO_COLOR/FORCE_COLOR environment warning. Git may report LF-to-CRLF normalization;
this is distinct from whitespace errors.

## Final verification

Final focused self-review checks: `npm run test:isolated -- tests/lab-04/ticket-creation-hardening.api.test.ts`
from server passed 6 tests (5.85s), explicitly proving both preflight misses.
`npm run test:e2e -- lab-04/product-hardening.spec.ts` from server passed 3 tests
(12.0s) with the request-scoped console guard and keyboard feedback navigation.
Final binary-lifetime focused verification from client, `npm test -- tests/lab-04/ProtectedReadContext.test.tsx tests/lab-02/Attachments.test.tsx`, passed 28 tests (5.82s).
The first whitespace check reported appended blank EOF lines in three historical
records; these were removed and the subsequent git diff --check passed. All nine
new files passed direct trailing-whitespace/final-newline checks; 23 README local
link targets existed. Remaining LF-to-CRLF output is a Git normalization warning.

Commands run from server/client as labelled; production smoke uses a temporary port
and public health only. Results apply to this working tree on the baseline HEAD.

| Directory | Exact command | Final result |
|---|---|---|
| server | npm run test:isolated | 627 passed / 39 files, 245.92s |
| client | npm test | 376 passed / 29 files, 28.98s after binary lifetime self-review |
| server | npm run test:e2e | 58 passed, 3.2m after binary lifetime self-review |
| server | npm run build | Passed TypeScript, 8.06s after final test review |
| client | npm run build | Passed TypeScript/Vite after binary lifetime self-review; Vite stage 2.49s |
| server | npm start (PORT=59070, NODE_ENV=production) | Emitted dist/src/index.js started; GET /api/health returned 200 with status ok; stopped by Ctrl+C |

Complete backend includes both existing populated migration tests, seed regressions,
Action/workflow races/snapshots and both performance files. Complete E2E includes
every prior Lab 3/Lab 4 journey and three new product journeys. No skips or weakened
assertions are introduced. Final Git/whitespace/new-file checks are recorded after
execution below. Independent review remains required; no release approval is claimed.

## Final scope and review status

The branch and HEAD remain feature/sprint4-final-hardening at
9076badbb61479e95584f25e7e2c399f89b8cff5; merge base with local lab4-staging is
identical. The index is empty. Scope is 29 tracked modifications and nine new
Issue #63 files. docs/references/ remains the unrelated untracked directory and
was never read or changed. No schema, migration, seed, dependency-lock or Issue #64
changes were made.

Tracked changes: README; client favicon declaration/API and eight read/form
components; five existing client regression files; three historical Lab 4 records;
server start script, isolated runner, six route files and two validation services.
New files: this evidence record; product-hardening browser journey;
CreateTicketHardening, ProtectedReadContext and StaffReadContext component suites;
attachment-hardening.api, ticket-creation-hardening.api, release-validation.api and
product-performance-smoke server suites. Existing assertions were retained while
accommodating explicit upload-feedback navigation and optional read-context arguments.

Self-review checked parent-first locking, aborted-transaction replay, scoped
uniqueness handling, compensation, tombstone/event atomicity, role/ownership
guards, request invalidation, duplicate/uncertain submissions, safe upload/text
errors, README scripts and all new-file whitespace. Phase 2 self-review reported
no open confirmed finding; independent Phase 3A subsequently confirmed Major R-01
and returned REQUEST CHANGES. Its focused correction is recorded below.
Remaining observations are manual accessibility,
production-scale migration/load evidence and intentionally unpaged legacy lists.

Verdict: **READY FOR INDEPENDENT CRITICAL REVIEW**. This is implementation evidence,
not independent review or final release approval.

## Phase 3A independent review and Phase 3B R-01 correction

The independent read-only review reproduced A submitting with an attachment,
logging out, B logging in, then A's delayed creation response initiating an upload
under B and navigating B to A's Ticket. Backend ownership still denied foreign
access. A late upload success also called onCreated after unmount. Contextless
mutation denials could emit obsolete global access-loss events. This was Major
R-01, a remaining submission-lifetime weakness, and blocked publication.

The review independently ran server test:isolated (627/39, 281.08s), client test
(376/29, 26.86s), server test:e2e (58, 3.5m), both builds and a public production
health smoke. These passes did not cover R-01 and did not constitute approval.

Only App.tsx, CreateTicketScreen.tsx and the create/upload API helper signatures
receive additional production changes in Phase 3B. The component snapshots its
identity/role/activation/password-access key, lifetime, submission generation,
AbortController and originating App session-revision predicate. The existing App
revision invalidates work synchronously at logout start; no new global session
system or persistent private storage is introduced. Render-time identity/access
checks close the gap before effect cleanup. Unmount, replacement and access loss
invalidate generation/abort and prevent obsolete continuation.

Currency is checked before creation, after response/body parsing, before upload,
after upload, before feedback and navigation. Only the still-mounted matching
generation can release its pending guard. A failed logout leaving the same
identity/form mounted preserves its uncertain key for explicit same-intent retry.
Identity/access replacement clears private drafts/outcomes and never reuses them
for another identity. Already committed Tickets are not undone.

The established optional ApiReadContext now travels through creation and upload,
including fetch cancellation and readApiError after upload's cloned partial-result
parse. Post-parse currency checks suppress obsolete 401/password-change dispatch.
Current scoped and default callers retain genuine denial dispatch. Upload remains
one fetch for the batch; component guards suppress late success/error feedback.

CreateTicketHardening.test.tsx expands the existing transport suite with actual
App/AuthScreen logout/login journeys and deferred responses that ignore abort.
It covers late creation success/failure/401/403 after B login, logout-only and
logout-in-flight, upload success/partial/server/network/auth failure after unmount,
delayed success/error body parsing, same-ID role/inactive/password changes,
overlapping generations, current scoped/default denials and same-identity retry
after a failed session change. Existing F-01/F-07 assertions remain. The legacy
upload assertion retains Ticket/files and additionally checks the optional context.

First focused run: 6 failed/31 passed (37), 10.79s. Failures were a legacy exact
upload-argument assertion, a wrong pending-button name and four App login fixtures
using data:user rather than the documented data:{user} shape. They were corrected
without weakening expectations. Next focused run passed 41 (4.88s); expanded
submission/legacy/Staff-read/Requester-dashboard set passed 75 (6.37s).
Initial complete frontend verification passed 401/29 (44.45s), both builds passed;
self-review then added the explicit failed-session-change retry-key regression.
Final commands/results are recorded below after completion. No tests were skipped.

Self-review additionally checked empty-form access recovery: a ref update alone
could leave the guarded fallback rendered when all cleared fields were already
empty. A render-access state commits the replacement explicitly; the new test
recovers from Staff to Requester and an empty-form identity replacement. Final
focused CreateTicketHardening passed 38 tests (7.87s), up from the original 11.
The preceding complete client run passed 402/29 (35.15s). These repetitions were
triggered by added regressions/self-review changes, not retries to hide failures.

| Directory | Exact command | Phase 3B final result |
|---|---|---|
| server | npm run test:isolated | 627 passed / 39 files, 289.60s; migration, seed, concurrency, workflow and smoke included |
| client | npm test | 403 passed / 29 files, 40.94s |
| server | npm run test:e2e | 58 passed (3.3m) after final access recovery; earlier correction run also passed 58 (3.4m) |
| server | npm run build | Passed TypeScript; no backend production changes in Phase 3B |
| client | npm run build | Passed TypeScript/Vite after final access recovery; Vite stage 8.01s |

All database/schema/storage actions used the existing disposable runners. No
schema/seed/developer-database changes or new dependency installation occurred.
Known environment warnings remain NO_COLOR/FORCE_COLOR and Git LF/CRLF
normalization. Manual accessibility, production-scale migration/load and the
review's nonblocking exact-6-MiB/single-use-console-allowance coverage observations
remain outside this R-01 correction. R-01 App races are tested with actual React
App/AuthScreen and deferred API transport in JSDOM; the existing browser journeys
provide broader product regression, not a newly added R-01 browser scenario.

Phase 3B scope is R-01 only with supporting tests/evidence. Backend/schema/migration/
seed/session policy/workflow/attachment concurrency remain unchanged. The complete
Issue #63 scope now has 30 tracked modifications (App.tsx is additionally modified)
and the same nine new files, with empty index and unchanged baseline HEAD.
Independent re-review remains required; Phase 3A REQUEST CHANGES is historical
evidence, not erased or converted into approval.

Final self-review inspected all three R-01 production files and supporting test
changes. Git diff --check and direct whitespace/newline checks for all nine new
Issue #63 files passed. Branch, HEAD and local lab4-staging remain at the verified
baseline; index remains empty; unrelated docs/references/ remains uninspected and
untouched. No staging/commit/push/PR/branch/fetch/pull/reset/stash occurred.

Phase 3B verdict: **READY FOR INDEPENDENT RE-REVIEW**. R-01 is corrected with
regression evidence; no independent approval or publication readiness is claimed.

## Phase 3C independent review and Phase 3D R-02 correction

Phase 3C independently verified original R-01: A logout/B login/late success,
401 and password-change 403 left B on My Tickets without uploads/navigation or
global events. Its focused set passed 77 (10.14s), full server 627/39 (275.89s),
client 403/29 (53.01s), browser 58 (3.5m), and both builds. It nevertheless returned
REQUEST CHANGES for Major R-02: creation succeeded, upload began, logout failed,
the late upload result was ignored, and unchanged Submit replayed creation and
resent the original attachment batch. Success and partial success both reproduced
duplicate requests. Review transport evidence demonstrated emitted requests, not
a separately persisted diagnostic duplicate. Existing database fixtures demonstrate
same-file uploads are permitted within capacity.

Root cause: retaining only the creation key lost the confirmed creation stage.
Ticket idempotency does not make uploads idempotent. Phase 3D changes production
only in CreateTicketScreen.tsx; no App/API/backend/schema/session-policy changes.

A synchronous identity/access-scoped confirmed-creation ref now records the
fingerprint, clientRequestId, validated Ticket ID/number, originating revision
predicate, upload stage and known outcome. It is recorded before the batch starts;
state mirrors it only for rendering. Before confirmation, F-01 uncertain creation
retries remain unchanged. After confirmation, every submit attempt is intercepted
before validation/create/upload; editing fields cannot turn it into a blind replay.
Normal active success still uploads once and navigates normally.

If logout fails, App's fresh current revision renders an explicit recovery for
the same Requester while the original continuation remains invalid. Upload results
after invalidation are never applied, so their outcome stays conservatively
uncertain, even when transport ignores abort or never settles. Known current
partial outcomes retain accepted/rejected names/reasons. Recovery opens the owned
existing Ticket for review/manual retry; it sends no creation or upload request.
The warning explains that the original upload may still finish.

Identity/access replacement and access-loss clearing remove recovery state. Its
render guard and guarded navigation prevent disclosure to B. An explicit confirmed
Start a new Ticket action keeps the old Ticket, aborts/supersedes the old generation,
clears draft/files/old key and moves keyboard focus to the new form heading. The
next intent obtains a fresh key/identity; no obsolete callback is made valid again.
Recovery is in memory only and is not durable across unmount/document reload.
Already committed Ticket/attachments are never rolled back or deleted by the UI.

CreateTicketHardening grows from 38 to 46 cases. Five actual App/AuthScreen cases
cover failed logout with late success, partial success, failure, never-settled
ignored-abort outcome and subsequent B login. Assertions check one creation, one
batch, correct filenames/Ticket navigation, focus, no old recovery/global event
for B and no request from repeated Submit. Further tests cover edited/rapid retries,
declined/accepted explicit new intent with fresh key/ID and cleared files, and
malformed success remaining an uncertain F-01 retry. Original R-01/F-01/F-07
assertions remain; deferred body waits now run within act for new state updates.

Preserved runs:

- `npm test -- tests/lab-04/CreateTicketHardening.test.tsx -t 'R-02 App'` / client:
  initial four failures included an ambiguous status locator. After correcting
  the locator/partial fixture, before production changes, four cases still failed
  (5.59s): three observed two creation calls; never-settled upload lacked recovery.
  The selector excluded 38 unrelated cases; no skip annotations were introduced.
- `npm test -- tests/lab-04/CreateTicketHardening.test.tsx tests/lab-02/CreateTicket.test.tsx`
  / client: initial correction passed 51 (11.64s), with act warnings in existing
  delayed-body cases. Expanded tests passed 55 (11.84s). Final focus/warning
  correction passed 55 (12.73s), including 46 hardening cases, without those warnings.

Phase 3D verification:

| Directory | Exact command | Final result |
|---|---|---|
| server | npm run test:isolated | 627 passed / 39 files, 284.59s; migration/seed/concurrency/workflow/smoke included |
| client | npm test | 411 passed / 29 files, 44.98s |
| server | npm run test:e2e | 58 passed, 3.6m |
| server | npm run build | Passed TypeScript |
| client | npm run build | Passed TypeScript/Vite; Vite stage 9.03s |

Full verification uses the existing disposable schema/temporary attachment
infrastructure. No skip annotations or expectations were weakened. Known warnings
remain the environment NO_COLOR/FORCE_COLOR and Git newline normalization warning.
Recovery cannot establish whether an ignored-abort upload is still committing;
it truthfully directs review/manual recovery and warns that the batch may finish.
No automatic attachment retry or backend upload idempotency was introduced.
Independent approval and Git publication remain pending. Existing manual
accessibility/production-scale migration/load limits and nonblocking coverage
observations are unchanged.

Final self-review checked the synchronous confirmed-stage boundary, no blind
creation/upload replay, immutable originating context, identity/access clearing,
generation-owned cleanup, conservative late outcomes, explicit new-intent key/ID
and keyboard focus. All 30 tracked modifications and the same nine new Issue #63
files remain unstaged; branch/HEAD/local lab4-staging/merge base are unchanged at
9076badbb61479e95584f25e7e2c399f89b8cff5. Tracked diff and direct whitespace/newline
checks for all nine new files pass. docs/references/ remains uninspected/untouched.
No developer database, backend/schema/migration/seed, Git publication or Issue #64
change occurred in Phase 3D.

Phase 3D verdict: **READY FOR INDEPENDENT RE-REVIEW**. R-02 is corrected with
regression evidence; this is not independent approval or permission to publish.
