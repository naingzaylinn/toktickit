# Lab 3 integration and release evidence

Evidence collected on `feature/integration-release-evidence` on 2026-09-20. This verifies the integrated Lab 3 code on the feature branch, not final-`main` submission evidence. The product definition of done in [specification.md](specification.md) also requires final evidence from `main` and visual review.

## Integrated scope and traceability

The integrated system implements the three single-role journeys, preserves the Lab 2 Requester ticket and attachment flow, and uses server-enforced sessions and authorization. Test IDs below refer to [tests.md](tests.md); that file retains the original planning tables and historical issue results.

| Requirement / acceptance criteria | Implementation and evidence | Verification |
|---|---|---|
| FR-01–08; AC-01/02/05; BR-01/02/07/23/24/26/27 | `server/src/routes/auth.ts`, authentication middleware, password/login/session services; `client/src/components/AuthScreen.tsx`, `client/src/App.tsx` | `auth.api.test.ts`, `auth.unit.test.ts`, `authorization.api.test.ts`; `AuthScreen.test.tsx`, `AppShell.test.tsx`, `authentication.spec.ts` (API-01–17, UNIT-01–04, E2E-01–05). Covers normalized email, safe failures, inactive accounts, current user, logout/replay, eight-hour expiry, cookie flags, five-failure limit, and first-login restriction. |
| FR-07–14; AC-03/04/06/11/18; BR-03–06/29 | Authenticated ownership in `tickets.ts`, `attachments.ts`, `requesterActions.ts`; Requester screens and API transport | `requester-regression.api.test.ts` (AUTH-01–05/07–09, RESOLVE-01–03, COMMENT-01/03–05), Lab 2 API/client suites, `RequesterDiscussion.test.tsx`, `requester-regression.spec.ts`, `staff-ticket-flow.spec.ts` (E2E-10/12/18). Forged requester IDs cannot replace session identity; foreign ticket/attachment and private note content remain unavailable; resolution indication leaves formal status unchanged. |
| FR-15–20; AC-07 | `server/src/routes/staffTickets.ts`, `StaffTicketQueueScreen.tsx` | `staff-ticket-queue.api.test.ts` (QUEUE-01–12), `StaffTicketQueue.test.tsx`, `staff-ticket-flow.spec.ts` (E2E-06): search, status/priority/owner filters, sorting, pagination, detail navigation, empty/no-results and safe failure states. |
| FR-21–27; AC-08–12; BR-10–19/25/28 | Staff ticket routes and `StaffTicketDetailScreen.tsx`; distinct Public Comment and Internal Note records | `staff-ticket-operations.api.test.ts` (DETAIL/COMMENT/NOTE), `StaffTicketDetail.test.tsx`, `cross-role-workflow.api.test.ts`, `staff-ticket-flow.spec.ts` (E2E-07–12). Checks active permitted owner, IT Priority separate from Requested Priority, transition matrix, append-only/trimmed communication, server authorship, attachments, and Requester note exclusion. |
| FR-28–38; AC-13–17; BR-08/09/20–22 | `server/src/routes/adminUsers.ts`, `UserManagementScreen.tsx` | `users-admin.api.test.ts` (ADMIN-01–17), `UserManagement.test.tsx`, `cross-role-workflow.api.test.ts`, `user-administration.spec.ts` (E2E-13–17). Covers list/search/role filter, create/edit, normalized unique email, one valid role, active state, initial-password replacement, self/last-admin protection and safe role boundaries. |
| Migration; AC-18; BR-13 | Prisma migrations `20260918000000`–`20260922000000`, `schema.prisma` | `migration.test.ts` (MIG-01–05) starts from populated Lab 2 data and checks IDs, ownership, tickets, attachments, events, reference data, sequence, credentials and initial IT Priority. Isolated runners deploy all 10 migrations and run Prisma diff with no drift. |
| Seed distribution and repeatability | `server/prisma/seed.ts` | `seed.test.ts` (SEED-01–08) checks four active and one inactive Requester, three active and one inactive IT Staff, an active Administrator, varied ticket status/priority/ownership, example comment/note, and repeat execution without duplicate or changed user credentials. |
| FR-08; UI spec shell, feedback and responsiveness | `App.tsx`, role screens, Zen Green CSS | Lab 3 component suites cover role navigation and representative loading, validation, success, no-results, forbidden and safe-failure states. `responsive.spec.ts` checks login, Requester navigation/create, staff queue and Admin list at 375/768/1280 px, active navigation and document overflow. Manual visual review remains below. |

The tests above exercise the integrated behavior through unit, API, React component and real-browser layers. Individual planned cases in `tests.md` are not each a separate executable test; several IDs are grouped within one test. The API workflow uses real Express sessions and database writes in a disposable schema. Playwright uses Edge, real Vite/Express services and its own disposable schema.

## Verification results

| Working directory | Command | Result |
|---|---|---|
| `server` | `npm.cmd run test:isolated` | Pass after fixture correction: 20 files, 209 tests. Runner applied all 10 migrations, found no Prisma schema drift, seeded the schema, and ran migration and seed tests. Initial run: 20 files, 204 passed and 5 failed from the fixture collision described below. |
| `server` | `npm.cmd run build` | Pass. |
| `client` | `npm.cmd test` | Pass, 14 files and 90 tests. |
| `client` | `npm.cmd run build` | Pass, TypeScript and Vite production build. |
| `server` | `npm.cmd run test:e2e` | Pass, 9 Playwright tests including three responsive viewport cases. Runner applied all 10 migrations, detected no Prisma schema drift and seeded its disposable schema. |
| Repository | `git diff --check` | Pass (LF/CRLF normalization warnings only). |

The first sandboxed server test attempt failed before running tests with Node `uv_os_get_passwd` ENOMEM. Sandboxed client test/build attempts could not read Vite config through esbuild. Their outside-sandbox reruns reached the suites and build. The `NO_COLOR`/`FORCE_COLOR` warning during Playwright was non-failing.

## Integration correction

`server/tests/lab-02/reference-data.api.test.ts` now removes only comment/note rows newly introduced by its seed idempotence case. The seed itself correctly supplies Lab 3 communication examples; the old Lab 2 fixture later deletes all tickets and its setup could fail on the new restrictive foreign keys. This is a test isolation fix, with no production behavior change. The full isolated suite passed after the correction.

## Release/readiness checklist

- [x] Contract and integrated implementation cross-checked against specifications, migrations, seed, scripts and test suites.
- [x] Isolated migration deploy/schema-diff and seed checks executed in disposable schemas; no normal development database reset.
- [x] Client tests, production build and Lab 3 browser suite passed.
- [x] Full isolated server regression passes after fixture correction.
- [x] Manual visual inspection completed during Zen Green visual/responsive verification, including 375 px, 768 px, and 1280 px checks; the Ticket Queue wrapping issue found during inspection was corrected and reverified.
- [ ] Submission screenshots captured for the required Lab 3 evidence.
- [ ] Repeat final verification and capture results on `main` after approved merge; current branch must remain unmerged for this issue.

## Limits and human evidence

Lab 3 intentionally excludes self-registration, email password reset, MFA, user deletion, bulk management, SLA/notifications, dashboards, cloud deployment and Actions Taken by IT Staff (see `specification.md`). Automated responsive checks verify controls, navigation and page overflow; they do not judge spacing, typography, contrast, keyboard focus appearance, zoom or all form/detail states. No submission screenshots were found in the repository.

Capture a small set of screenshots manually, with no sensitive credentials visible:

1. Login and mandatory password-change screens, including a safe validation state.
2. Requester My Tickets/detail with Public Comments and Problem Appears Resolved, showing no Internal Notes or Development Requester selector.
3. IT Staff queue and detail with owner, IT Priority, status, Public Comments and visually distinct Internal Notes.
4. Administrator User Management list/search and create/edit or initial-password feedback.
5. Representative desktop (1280 px), tablet (768 px) and mobile (375 px) views, including navigation and a detail/form screen. Inspect clipping, focus, contrast, badges, editable versus read-only fields and validation placement against VIS-01–10 in `tests.md`.
