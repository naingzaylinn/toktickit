# Lab 4 Specification — Sprint 4 Engineering Contract

Issue #56; branch `feature/sprint4-engineering-contract`; target `lab4-staging`.
Status: **Revised draft for human review, documentation only**, 2026-10-11. The user has approved designing the assignment/lifecycle and resolution-gate proposal; the concrete design below remains reviewable, not a verbatim handout rule or implementation approval. IDs are local to Lab 4.

## 1. Authority and source review

The complete [Lab 4 handout](../references/SE+Lab+4.pdf), all 11 pages, is authoritative. Pages 1–3 define the increment, fields, roles and workflow; pages 4–6 cover migration, APIs and screens; pages 7–9 cover hardening, Spec DD, Test DD and repository structure; pages 10–11 cover submission evidence. All pages were accessible and text-readable on 2026-10-09. Reference files were read only.

Compatibility sources inspected: Lab 3 [specification](../lab-03/specification.md), [UI](../lab-03/ui-spec.md), [API](../lab-03/api-spec.md), [tests](../lab-03/tests.md), [reviewer](../lab-03/reviewer.md) and [AI-use record](../lab-03/ai-use.md); [Prisma schema](../../server/prisma/schema.prisma); backend ticket, staff, requester-action, authentication and role middleware; frontend `App`, `AppShell`, detail screens and `api.ts`; package scripts and test runners. Existing executable behavior takes precedence over inconsistent older planning prose when the handout does not require a change.

Page 6 explicitly requires Requesters to see **all** Actions Taken on owned tickets. Page 11 Answer Part 6 requires action assign, status transition, complete, cancel and inactive-assignee rejection; page 8 references an approved action assignee. These are required grading capabilities. The user's 2026-10-11 review resolves the earlier scope question: include them with the smallest coherent lifecycle below. Required editing and page 11 append-only auditability are reconciled by immutable revisions, not by dropping edit support. U-01/U-02 are resolved design interpretations, not instructor-blocked requirements.

Embedded dashboard illustrations on pages 5–6 were also visually inspected. Their concise cards/lists/refresh/drilldown layout informs the draft, but the staff illustration's Create Ticket/profile links and yesterday-comparison figures do not define new permissions, profile features or date-window calculations. P-09 selects explicit metrics and preserves the existing requester-only ticket-creation permission rather than inferring new behavior from illustrative navigation.

## 2. Sprint goal and stakeholder needs

Complete the service-desk lifecycle with shared, attributable Actions Taken, safe formal ticket resolution, concise role dashboards and verified regression across Labs 1–3. Requesters need understandable progress and attention cues; staff need recorded work independent of primary ownership and operational drilldowns; administrators need the same staff capability plus their existing user-management functions. Reviewers need traceable rules, tests, migration safety and final evidence.

## 3. Scope

Included: action list/create/assign/reassign/edit/complete/cancel, a three-state action lifecycle, all seven handout fields, separate assignee/performer/Ticket Owner relationships, immutable revisions, requester visibility, existing ticket workflow plus the project resolution gate, stale-write handling, backend dashboards/drilldowns, additive migration/seed planning, Zen Green, accessibility and full regression/hardening.

Excluded by handout §4.2: SLA clocks/escalations/on-call/breach notifications; external notifications; inventory/purchasing/service cost accounting; timesheet billing/payroll; multi-level approvals/e-signatures; advanced BI/report builders/export warehouses; multi-tenancy and production-scale cloud operations. No action deletion, additional intermediate action states, action approvals/reopening, new Ticket statuses, redesigned authentication or replacement of existing screens.

Issue #56 changes only these six Markdown files. Implementation, schema, migrations, seeds, tests, README updates, screenshots, database work, Git writes and PR creation belong to later authorized activities.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | IT Staff and Administrators shall create Actions Taken under accessible tickets using the seven handout fields. |
| FR-02 | Permitted staff shall edit action content with validation, stale-write protection and retained previous versions; Requesters shall never write actions. |
| FR-03 | Each ticket shall support zero or many actions; the authenticated performer need not be its primary owner. |
| FR-04 | Staff shall retrieve ordered action history; Requesters shall see all actions on their own tickets and no actions on other tickets. |
| FR-05 | Actions Taken, Public Comments and Internal Notes shall remain separate concepts with explicit shared/private labels. |
| FR-06 | The backend shall enforce all eight existing ticket statuses, the unchanged transition edges and an approved formal resolution rule. |
| FR-07 | The backend shall detect concurrent and stale workflow/action updates and prevent duplicate action creation on retry. |
| FR-08 | The Requester Problem Appears Resolved indication shall remain advisory and shall not change ticket status. |
| FR-09 | Staff and Administrators shall receive backend-calculated operational counts, current-user actions and concise recent ticket information. |
| FR-10 | Requesters shall receive backend-calculated own-ticket counts, attention cues, recent updates and resolved-work summaries. |
| FR-11 | Dashboard items shall drill into existing role-appropriate ticket lists/details with matching filters and ordering. |
| FR-12 | Migration and idempotent seeds shall preserve existing records and cover legacy, zero/one/many actions and dashboard distributions. |
| FR-13 | UI extensions shall preserve Zen Green, responsive behavior, accessible operation and safe feedback with retained drafts after recoverable failures. |
| FR-14 | Labs 1–3 shall remain functional; final hardening shall cover security, failure states, links, console errors and obsolete UI. |
| FR-15 | All requirements and criteria shall have planned tests and later actual evidence from verified `main`. |
| FR-16 | IT Staff/Administrators shall assign/reassign PENDING actions to one eligible active staff/Admin user, without changing original performer or primary Ticket Owner. |
| FR-17 | The backend shall enforce PENDING → COMPLETED or CANCELLED, terminal-state restrictions, completion evidence and cancellation reason; Requesters have read-only lifecycle visibility. |
| FR-18 | The backend shall reject inactive/non-staff/missing assignees at creation, assignment and completion, and atomically audit every assignment/lifecycle/content change. |

## 5. Business rules

| ID | Rule |
|---|---|
| BR-01 | Each Action Taken belongs to exactly one existing Ticket; a Ticket can have multiple actions. |
| BR-02 | A Ticket has zero or one primary owner who coordinates work; action performer may be a different staff member or Administrator. Action creation/edit does not reassign the Ticket. |
| BR-03 | Performer is set from the active authenticated session on create. It is immutable on edit; edit actor is recorded separately by the backend. Client identity fields cannot override either actor. |
| BR-04 | All seven fields are represented as specified below. Plain text is trimmed and safely rendered; conditional note validation is enforced on every write. |
| BR-05 | Active session and completed initial-password change are required. Requester action reads require `Ticket.requesterId = authenticatedUser.id`; staff roles access the existing shared ticket scope. |
| BR-06 | Requesters see all current action records and their seven fields on owned tickets, including Follow-up and Attachment Notes. These are shared work records, not private Internal Notes. |
| BR-07 | Proposed P-02: action lines are retained; edits append immutable revisions and update the current projection atomically. No delete endpoint or control. Public Comments and Internal Notes stay append-only without edit/delete. |
| BR-08 | Proposed P-01: action date/time is the server-generated creation instant, immutable and identical to `createdAt`; editing changes `updatedAt`, not the original date/performer. |
| BR-09 | P-03: create or reassign PENDING work only while Ticket is in active set A (§8). Complete/cancel existing PENDING work or correct content on any Ticket status, subject to terminal-Ticket guard BR-27. No action mutation automatically changes Ticket status. |
| BR-10 | Only IT Staff/Administrator perform formal ticket transitions. All omitted pairs and self-transitions are invalid. No owner-only restriction is added. |
| BR-11 | Approved project design proposal P-04: entry to RESOLVED requires ≥1 COMPLETED action with nonblank result, zero PENDING actions, and zero COMPLETED actions with followUpRequired=true. CANCELLED actions neither qualify nor block, regardless of their retained follow-up flag. Staff submission attests review. |
| BR-12 | Requester indication is insufficient for BR-11, never generates an action, never resolves/closes, and remains recorded across status changes. Repeated indication continues to conflict. |
| BR-13 | Proposed P-05: all status writes require the workflow version last read; action edits require their action version. Atomic conditional writes reject stale versions without overwriting. |
| BR-14 | Action mutations and status writes serialize on the same parent Ticket. Resolution checks and status commit use one transaction; no action edit can invalidate the gate during that commit. |
| BR-15 | Proposed P-06: a create request ID is unique per ticket and performer. Exact normalized retry returns the existing record; changed payload with the same key conflicts. No additional revision or activity timestamp on replay. |
| BR-16 | Action order is `createdAt ASC, id ASC` regardless of edits. Revision order is `version ASC`. Recent Ticket order is `updatedAt DESC, ticketNumber ASC`. |
| BR-17 | Dashboard metrics use authoritative database rows and the predicates below, not current client page counts. Requester identity/current staff identity are session-derived. |
| BR-18 | All dashboard status/priority buckets exist, including zero buckets. No matches means counts 0 and lists `[]`; API failure never becomes a displayed zero. |
| BR-19 | Existing tickets participate in dashboard calculations without age cutoffs or fabricated actions. Migration preserves their status, ownership, timestamps and resolution indication. |
| BR-20 | P-07: a successful action create/content edit/assignment/lifecycle change advances parent updatedAt and workflowVersion once and appends one action revision. No-op/replay does neither. Dashboard activity means persisted Ticket.updatedAt, not every comment/note event. |
| BR-21 | Attachment Notes are shared free text naming relevant files, not a new upload service, attachment foreign key or authorization grant. Existing attachment permissions and removal history remain intact. |
| BR-22 | One required Action Assignee handles the action; omitted create assignee defaults to session performer for request compatibility. Explicit assignee must exist, be active and have IT_STAFF/ADMINISTRATOR role. Null/unassigned actions are not part of this minimal model. |
| BR-23 | Original Performed By is the authenticated creator; Action Assignee is the designated worker; primary Ticket Owner coordinates the Ticket. The actual completing/cancelling user is the backend-authenticated editorId of the revision that first transitions PENDING to that terminal state, not the assignee or latest editor. Later corrections never replace that attribution. All these users may differ; no additional identity columns are needed. |
| BR-24 | Actions start PENDING. Only PENDING → COMPLETED and PENDING → CANCELLED are permitted. Terminal states have no outgoing transitions; self-transitions conflict. Any permitted staff/Admin may operate accessible actions, not only owner/assignee/creator. |
| BR-25 | Completion requires a valid merged nonblank result and currently eligible assignee. Follow-up may remain true on COMPLETED work, but blocks resolution. To clear an existing COMPLETED action's true flag, staff must address/verify the work or correct an erroneous flag and explicitly submit a nonblank followUpNote explaining which and why, different from the previous trimmed note. Missing/blank/unchanged explanation fails validation; retain previous plan and new explanation in immutable revisions. Cancellation requires an explicitly submitted nonblank actionResult explaining cancellation; no separate reason field or deletion. |
| BR-26 | Only PENDING actions can be assigned/reassigned. Inactive assignee targets are rejected by backend even if submitted directly; an existing assignee later deactivated/role-changed remains visible historically. Reassign active work before completion; cancellation is still allowed without assignee eligibility. |
| BR-27 | COMPLETED/CANCELLED records permit validated text/follow-up corrections but not assignee/state changes. CANCELLED flags are historical, not outstanding-work predicates. Any action mutation under a RESOLVED/CLOSED Ticket must leave BR-11 valid; otherwise reject and require explicit Ticket reopen before operational changes. Legacy zero-action terminal tickets remain valid with no child writes/backfill. |

### Actions Taken fields and lifecycle

All seven fields remain mandatory concepts. Their requiredness/limits beyond the explicitly conditional Follow-up Note are selected project proposals P-01/P-08, not extra unresolved handout requirements.

| Handout field | Proposed storage / API | Validation and behavior |
|---|---|---|
| Action date and time | `createdAt` / `actionDateTime` | Required; backend UTC instant, database `now()` default; read-only. No separate duplicate date column. |
| Action Description | `actionDescription: String` | Required string, 1–2000 characters after trim. |
| Result | `actionResult: String` | Required string, 1–2000 characters after trim; plain text, distinct from ActionStatus enum. |
| Performed By (auto) | `performedById` / `performedBy` | Required User FK; authenticated creator; display safe id/name/role, never credentials. Historical records survive deactivation/role change. |
| Follow-Up Required? | `followUpRequired: Boolean` | Required JSON boolean on create; database default false. Strings/numbers/null invalid. |
| Follow-up Note | `followUpNote: String?` | Required 1–2000 trimmed characters when flag true; normally optional text/null when false, blank normalizes to null. Exception: clearing true on an existing COMPLETED action requires an explicit new explanation under BR-25. |
| Attachment Notes | `attachmentNotes: String?` | Optional shared text up to 2000 trimmed characters; blank normalizes to null. No file existence check; literal text only. |

All seven fields remain required concepts; assignee and status are the only additional business fields needed for grading. PENDING result is a truthful interim observation such as "Awaiting verification", not proof of completion. Completion records the actual outcome; cancellation records the reason in Result and retains prior results in immutable revisions.

Content edit permits description/result/flag/follow-up note/attachment notes. The same versioned PATCH supports assigneeId and status under BR-22–BR-27, avoiding separate assignment/complete/cancel APIs. Merge before validation. An assignment plus completion/content change can be one atomic write/revision. No silent note erasure when toggling follow-up off; a matching-version no-op leaves versions/activity unchanged. Any permitted staff can operate an accessible action; requester cannot mutate.

| Action current status | Permitted next | Conditions / result |
|---|---|---|
| PENDING | COMPLETED | Valid result; eligible current/merged assignee; follow-up flag/note retained, may still require follow-up |
| PENDING | CANCELLED | Caller explicitly supplies Result as cancellation reason; assignee may now be inactive; all records retained |
| COMPLETED | None | Content corrections only, immutable state/assignee |
| CANCELLED | None | Content corrections only, immutable state/assignee |

No implicit PENDING→COMPLETED on save, no action reopening and no extra approval workflow. Assign/reassign is not a status transition. Unknown statuses fail validation; omitted/self/reverse transition pairs conflict. Requesters see all three statuses, assigned user and all seven fields, including cancelled work. Creation/assignment require an active parent Ticket A; Ticket cancellation does not cascade/delete actions. Existing PENDING work under a CANCELLED Ticket can be completed/cancelled with its own audited operation, or Ticket can be REOPENED for reassignment/new work. A Ticket reopen does not reopen terminal actions; create a new action when more work is needed.

## 6. Authorization matrix

All cells presume active sessions and completed initial-password change; backend enforcement is mandatory.

| Capability | REQUESTER | IT_STAFF | ADMINISTRATOR |
|---|---|---|---|
| Requester Dashboard | Own tickets | No | No |
| Staff Dashboard | No | Global + current-user subsets | Same, current Administrator identity |
| My Tickets/Create Ticket/requester detail | Own identity/tickets | No | No |
| Staff Queue/detail; attachments | No | Shared accessible tickets | Same |
| View Actions Taken | All current records, owned tickets only | All accessible tickets | Same |
| Create/edit Actions Taken | No | Yes, not owner-only | Same |
| Claim/assign Ticket; change IT Priority/status | No | Existing rules + approved resolution gate | Same |
| Public Comments | Read/post own tickets | Read/post accessible tickets | Same |
| Internal Notes | No content or metadata | Read/create | Same |
| Problem Appears Resolved | Own ticket; advisory only | No | No |
| User Management | No | No | Existing Lab 3 rules |
| Delete action/comment/note | No | No | No |
| Assign/reassign PENDING action | No | Yes, active Ticket, eligible target | Same |
| Complete/cancel PENDING action | No | Yes, BR-24/BR-25 | Same |
| View action assignee/status | Own tickets, all statuses | All accessible tickets | Same |

Immutable revision rows are retained for test/reviewer audit evidence under P-02, not exposed through a new product API or UI in this draft. Current action history is available through the role-scoped endpoints above; no additional revision-browsing permission is implied.

## 7. Ticket workflow and resolution

The following is exactly the matrix in `server/src/routes/staffTickets.ts` and `StaffTicketDetailScreen.tsx`, consistent with Lab 3 specification/API. It uses API status labels; Prisma retains `New`, `Open`, `InProgress`, `WaitingForRequester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`.

| Current | Permitted next (staff and Administrator only) |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CANCELLED | REOPENED |

All other pairs, including same-state requests, return 409 CONFLICT; an unknown status returns 400 VALIDATION_ERROR. Requester writes return 403 before ticket lookup. A race/stale token returns 409 CONFLICT and requires reload/review, never an automatic status retry.

P-04 is an **approved project design proposal**, not a quoted handout predicate. It adds guards without changing transition edges. Let C = count(COMPLETED), P = count(PENDING), F = count(COMPLETED AND followUpRequired=true). Resolution eligibility is **C ≥ 1 AND P = 0 AND F = 0**; completed results are nonblank by validation. Zero actions or all-cancelled work cannot prove resolution. Cancelled actions are retained but excluded from C/P/F. A completed action with follow-up true must be corrected after follow-up is actually addressed, or a pending follow-up action completed and the original flag cleared. Advisory requester indication never substitutes for these conditions.

RESOLVED → CLOSED checks the same gate when actions exist. A legacy RESOLVED Ticket with zero actions may still close; no synthetic evidence is added. Existing RESOLVED/CLOSED rows remain valid on read. If reopened, any subsequent resolution must satisfy the gate; reviewed earlier completed actions may qualify, but terminal action states stay terminal. Corrections on RESOLVED/CLOSED cannot introduce an invalid gate; return TICKET_WORKFLOW_CONFLICT and require explicit existing Ticket reopen for operational changes. Creating/reassigning pending work is restricted to A. Ticket cancellation remains permitted without completing/cancelling its children automatically, preserving their audit records and explicit lifecycle operations.

Current Lab 3 status requests contain only `{status}`; server conditional updates compare the status read during that request. P-05 adds required `expectedWorkflowVersion` to protect stale screens and same-status ABA changes. This is an explicit proposed request compatibility change; old status-only clients would receive 400, so frontend API callers and relevant regression fixtures must update together after approval. No status edge or other Lab 3 endpoint is removed. A silent tokenless fallback is not promised.

## 8. Dashboard definitions

P-09 proposes the exact cards below from the handout's illustrative metrics. Let **A** = NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED. RESOLVED, CLOSED and CANCELLED are outside A. "Active/open work" always means A; the status OPEN is one bucket, not a synonym for A.

Staff source: proposed `GET /api/staff/dashboard`. Requester source: proposed `GET /api/requester/dashboard`. Both perform all reads in one consistent database snapshot, return `meta.generatedAt` (UTC), and use zero/no-list behavior from BR-18. Counts use COUNT of Tickets unless explicitly actions. No SLA thresholds, KPI goals, calendar periods or time windows are proposed. "Recent" means first five in a documented sort, not "last seven days". Five is a proposed presentation limit P-09.

| Metric / key | Exact predicate and scope | Closed/cancelled | Drilldown |
|---|---|---|---|
| Staff total / `totalTickets` | All Tickets, global | Both included | Staff Queue, no filters |
| Staff active / `activeTickets` | All Tickets with status in A | Both excluded | Staff Queue `statusGroup=active` |
| Staff unassigned / `unassignedActiveTickets` | Global A and `ownerId IS NULL` | Both excluded | Queue `statusGroup=active&owner=unassigned` |
| My active / `myActiveTickets` | A and `ownerId = session user id` | Both excluded | Queue `statusGroup=active&owner=<session-id>` |
| By status / `byStatus` | Global count for each of all eight statuses | Each included in own bucket | Queue `status=<API-value>` |
| By IT priority / `activeByItPriority` | Global A grouped by LOW/MEDIUM/HIGH/URGENT; never Requested Priority | Both excluded | Queue `statusGroup=active&itPriority=<value>` |
| Recent Tickets / `recentTickets` | Top five global Tickets, BR-16 recent order; summary rows only | Both included | Each staff detail; View all Queue `sort=updatedAt&order=desc` |
| My Actions Taken / `myActions` | All ActionTaken whose original `performedById = session user id`; ALL action states including CANCELLED; totalItems counts actions, top five createdAt DESC/id DESC | Parent status unrestricted, both included | Each anchors into staff Ticket Detail; label original record creator, not assignee/current operator |
| Requester total / `totalTickets` | Tickets where `requesterId = session user id` | Both included | My Tickets unfiltered |
| Requester active / `activeTickets` | Own Tickets in A | Both excluded | My Tickets `statusGroup=active` |
| Waiting for me / `waitingForRequesterTickets` | Own WAITING_FOR_REQUESTER only; attention-required means this predicate | Both excluded | My Tickets `currentStatus=WaitingForRequester` |
| Resolved work / `resolvedTickets` | Own RESOLVED only | Both excluded; Closed separate bucket | My Tickets `currentStatus=Resolved` |
| Requester by status / `byStatus` | Own Tickets grouped into all eight API-labelled buckets | Both included in own buckets | My Tickets mapped `currentStatus=<Prisma-value>` |
| Recently updated / `recentTickets` | Top five own Tickets, BR-16 recent order | Both included | Own detail; View all My Tickets `sortBy=recentlyUpdated` |
| Resolved-work summaries / `resolvedTicketsRecent` | Top five own RESOLVED, updatedAt DESC, ticketNumber ASC | Both excluded | Own detail; View all `currentStatus=Resolved&sortBy=recentlyUpdated` |

Resolved-work summaries are **recently updated tickets currently resolved**, not a resolution-date metric: no `resolvedAt` exists. Do not label them "resolved this week". Comment/note/attachment operations that do not advance Ticket.updatedAt are not represented as ticket activity; P-07 adds action writes only. Staff unassigned/my-active cards and URGENT active priority bucket are work-attention cues; no separate overdue metric is defined. Administrator reuses staff dashboard; optional account counts are not selected.

Counts include historical tickets and tickets involving now-inactive users. Reference category/system labels remain on existing detail views; no extra category chart is required. Drilldowns can change after a later database write; a refresh updates counts, rather than asserting a permanent cross-request snapshot. Dashboard lists are limited server-side and never entire ticket collections.

## 9. Proposed database and migration design

All changes below are **documentation design plans**, not changes to [schema.prisma](../../server/prisma/schema.prisma). User authorized this proposal revision, not schema/application implementation.

| Model/change | Fields, defaults and relationships |
|---|---|
| New `ActionTaken` | UUID id default uuid(); required ticketId/ performedById/ assigneeId String FKs; status ActionStatus default PENDING; required description/result; followUpRequired Boolean default false; nullable followUpNote/attachmentNotes; required clientRequestId; version Int default 1; createdAt default now(); updatedAt managed by Prisma. |
| New `ActionStatus` enum | PENDING, COMPLETED, CANCELLED only; separate from untouched TicketStatus. |
| New `ActionTakenRevision` | UUID id; required actionId/editorId FKs and version; full snapshot of five content fields plus assigneeId FK User and ActionStatus; createdAt default now(). First revision 1 actor = performer; each content/assignment/state mutation appends n+1. No update/delete route. Original action performer/date stay immutable. |
| Existing Ticket | Add `actionsTaken ActionTaken[]` inverse and `workflowVersion Int @default(0)`. Do not rename currentStatus or add ticket statuses. |
| Existing User | Add named inverse action-performer, current-action-assignee, revision-editor and revision-assignee relations. Do not modify role/account/session behavior. |

All action/assignee/revision foreign keys use restrictive deletion, not cascading loss of evidence. Deactivation remains User lifecycle. Add unique [ticketId, performedById, clientRequestId], action indexes [ticketId, createdAt, id], [performedById, createdAt, id], [assigneeId] and [ticketId, status]; revision unique [actionId, version] and indexes on editorId/assigneeId. Existing owner/requester indexes remain. Proposed Ticket [currentStatus, ownerId] and [updatedAt, ticketNumber] support metrics/drilldowns; justify with EXPLAIN before adding more. No stored dashboard totals or new priority enum.

Two design justifications: separate child records permit many performers without changing primary Ticket ownership; immutable revisions reconcile required edits with retained evidence/append-only intent (U-02). Integer versions detect ABA changes without relying on millisecond timestamp uniqueness; parent version advances on action writes so gate decisions cannot unknowingly use stale action content. Reuse createdAt for action date to avoid competing timestamps (P-01).

Safe forward plan:

1. Capture baseline IDs/counts, FK links and representative field checksums for Users, Tickets, Attachments including removed rows, Public Comments, Internal Notes, TicketEvents, reference data and TicketSequence; secure backup before later real deployment.
2. In a disposable populated pre-Lab-4 schema, add child tables/indexes and non-null workflowVersion with default 0. No table drops, resets, user/ticket rewrites or invented action backfill.
3. Verify old records, timestamps and relationships unchanged, every old ticket version 0, actions/revisions empty, expected FK/index constraints and Prisma schema diff. Existing resolved/closed tickets remain viewable/closable as §7.
4. Test failed deployment/retry and the recovery plan in a disposable environment. Prefer forward fix/redeployment; reverting application code keeps added tables/data. Do not drop action tables with real records. If a destructive rollback is unavoidable, export new records and restore a verified backup to a separate environment first, reconcile post-backup work, and obtain separate operational authorization.
5. Later seed extension uses deterministic request/action IDs and create-if-absent/upsert update:{}; never reset credentials/owners/status/content/assignment/revisions. Fixtures cover all Ticket statuses/priorities, assigned/unassigned Tickets, all three action states, completed follow-up true/false, cancellation reasons, owner/performer/assignee all different, zero/one/many actions and empty requester. Include a formerly active assignee now inactive to demonstrate historical visibility/completion rejection. Resolved/closed examples with actions satisfy the gate; legacy zero-action rows remain unchanged.

The current isolated runner removes Lab 3 note/comment fixtures before legacy tests delete tickets; new FK child data will also require a scoped fixture strategy in the later testing issue. Do not disable FK checks or weaken existing assertions. Migration and seed commands are not executed for Issue #56.

## 10. API and UI summary

[API specification](api-spec.md) defines create/history plus one versioned action PATCH for content, assignment and lifecycle, reuses eligible-owner lookup for assignee options, and defines two dashboards. Staff detail/status and list filters change as documented; requester history is additive. Existing sessions/aliases/attachments/comments/notes/admin APIs remain.

[UI specification](ui-spec.md) adds role dashboards to AppShell and creates/view/edits actions within StaffTicketDetailScreen, with a read-only owned-ticket requester section. Existing navigation destinations and Zen Green components remain. Cards link to existing lists/details; state handling, responsive layouts and accessibility are contractual.

## 11. Acceptance criteria

Criteria are testable targets for the user-authorized design proposal, not implementation/test results. Coverage is in [tests.md](tests.md).

| ID | Observable criterion | Requirements |
|---|---|---|
| AC-01 | Valid staff/Admin create saves all seven fields, eligible assignee and initial PENDING state under the ticket with session performer, original date and full revision 1. | FR-01, FR-03, FR-16–FR-18 |
| AC-02 | Blank/overlong/wrong-type required text or flag is rejected; invalid/forged server-owned fields cannot alter date or performer. | FR-01, FR-07 |
| AC-03 | Follow-up true without a nonblank note fails on create and merged edit; false normally accepts null/optional note. Clearing a COMPLETED action's true flag requires a new explicit explanation under BR-25, preserved with the old note in revisions; attachment-note limits are enforced. | FR-01, FR-02 |
| AC-04 | Multiple actions and a performer different from owner are saved without reassigning owner; ties have deterministic history order. | FR-03, FR-04 |
| AC-05 | Valid edits preserve date/performer, retain prior revisions and editor, increment versions; stale edits fail, no-op edits do not append, no delete exists. | FR-02, FR-07 |
| AC-06 | Requester sees every action on own tickets but cannot create/edit; foreign-ticket read yields safe 404 and no action data. | FR-04 |
| AC-07 | Missing/expired/inactive session and initial-password users cannot access normal actions/dashboards; wrong-role endpoints safely fail before lookup. | FR-04, FR-09, FR-10 |
| AC-08 | Each matrix edge succeeds with valid prerequisites; every omitted/self pair conflicts and unknown status is rejected. | FR-06 |
| AC-09 | RESOLVED requires completed≥1, pending=0 and completed follow-up=0; cancelled work is excluded and all-cancelled work fails. Close checks current gate when actions exist; legacy zero-action close remains valid. | FR-06, FR-17 |
| AC-10 | Two same-version status writes cannot both succeed; old-screen/ABA writes conflict; racing action edits and resolution cannot commit an inconsistent gate decision. | FR-07 |
| AC-11 | Own requester resolution indication sets timestamp only; repeat conflicts; status/owner/actions unchanged and formal resolution still needs staff review. | FR-08 |
| AC-12 | Retrying the same action-create key/payload returns one record; changed payload conflicts; concurrent retries cannot create two actions. | FR-07 |
| AC-13 | Staff metrics match §8 database predicates for every status/priority/ownership bucket, legacy records and current staff/Admin performed actions. | FR-09 |
| AC-14 | Requester metrics/recent rows contain only session-owned tickets; all counts and capped summaries match §8. | FR-10 |
| AC-15 | Every selected dashboard count/list item opens the correct role view with matching filter/order; back/reset/pagination preserve understandable query state. | FR-11 |
| AC-16 | Empty datasets yield every defined zero bucket and empty list; loading has no false zeros; errors show safe retry and recover successfully. | FR-09, FR-10, FR-13 |
| AC-17 | Form validation is field-linked, recoverable failures preserve drafts, successful create/edit refreshes history; repeated clicks do not duplicate work. | FR-13 |
| AC-18 | New views remain usable at 375, 768 and 1280 px, keyboard-operable with visible focus, semantic labels, textual status cues and no page overflow. | FR-13 |
| AC-19 | Migration preserves baseline records/links/timestamps, initializes versions, verifies constraints and demonstrates safe forward recovery without data loss. | FR-12 |
| AC-20 | Repeated seed leaves counts/IDs and human edits stable while covering all declared fixture distributions and zero metrics. | FR-12 |
| AC-21 | Cross-role browser flow connects creation, distinct owner/performer/assignee, assignment/edit/complete/cancel, advisory indication, formal Ticket resolution/closure/reopen/cancellation and dashboard refresh with correct visibility. | FR-01–FR-11, FR-16–FR-18 |
| AC-22 | Existing Labs 1–3 regression remains intact; intentional gate/token assertions are updated explicitly with equivalent positive/negative coverage; health, private notes, attachments and user safety stay correct. | FR-14 |
| AC-23 | Create selects an eligible assignee or defaults to performer; pending reassignment changes assignee only, not performer/date/Ticket Owner; all three identities can differ. | FR-16, FR-18 |
| AC-24 | Bounded dashboard/history responses and database queries pass performance smoke; final main evidence, issue/review records, visual checklist and actual traceability meet handout submission Parts 1–9. | FR-15 |
| AC-25 | Backend rejects nonexistent/inactive/requester-role/null assignees on create/reassign and inactive current assignee on completion, including direct API bypass and deactivation races; historical records remain visible. | FR-18 |
| AC-26 | PENDING→COMPLETED with valid result succeeds; PENDING→CANCELLED requires explicit nonblank Result reason. Every other/self action transition fails; terminal content corrections retain immutable lifecycle/assignment. | FR-17 |
| AC-27 | Assignment/completion/cancellation/content writes append one immutable actor-stamped full revision and increment action/parent versions once; original performer/date and the terminal-transition actor remain attributable after later edits. Before/after database snapshots prove earlier revisions unchanged; stale combined operations cannot partially change state/assignment. | FR-02, FR-07, FR-18 |
| AC-28 | Requester can view all PENDING/COMPLETED/CANCELLED own actions, assignee and seven fields, but every assignment/lifecycle write is denied; responsive UI exposes valid staff controls, confirmations and safe failures. | FR-04, FR-13, FR-16–FR-18 |
| AC-29 | New/reassigned pending work requires active Ticket; completion/cancellation cleans up existing pending children without automatic Ticket changes; resolved/closed corrections preserve gate; reopen permits new action without reopening terminal actions. | FR-06, FR-17 |

## 12. Product Definition of Done

Sprint completion requires approved FR/BR/AC implemented and covered; list/create/assign/edit/transition/complete/cancel and backend inactive-assignee rejection demonstrated; seven fields, original performer/date, append-only revisions and requester visibility preserved; stale writes/retries/gate races verified; dashboards/drilldowns, additive migration/recovery and idempotent seeds verified; all Labs 1–3 regression and new unit/API/UI/authorization/workflow/migration/performance/E2E checks pass on final main; manual Zen Green/responsive/accessibility evidence and hardening audit complete; README/demo instructions current in later scope; human-reviewed feature→lab4-staging→main integration recorded; actual paths/results replace Planned entries; one PDF has Answer Part 1 through Answer Part 9. Documents alone are not feature completion.

## 13. Assumptions, approval decisions and unresolved questions

| ID | Proposed decision / question | Approval and consequence |
|---|---|---|
| P-01 | Immutable server-created date/time per page 6 create-date wording, not user-entered work date. | Selected project design; no additional work-date field needed. |
| P-02 | Staff operate accessible actions; each change retains immutable revision, original performer/date; no delete. | Selected design reconciles required edit and auditability. |
| P-03 | New/reassigned pending work only on active Tickets; existing completion/cancellation and validated corrections as BR-09/BR-27. | Selected terminal-Ticket policy; explicit reopen for new work; no automatic status cascade. |
| P-04 | Gate C≥1, P=0, F=0; cancelled excluded; legacy zero-action close exception; guard terminal corrections. | Approved project design proposal requested by user on 2026-10-11, not verbatim handout. Lab 3 ungated behavior intentionally changes. |
| P-05 | Require expectedWorkflowVersion on Ticket status writes and expectedVersion on every action mutation. | Selected safety design; explicit legacy status-only request change, deploy client/backend together. |
| P-06 | Persistent per-ticket/performer create key; immutable revision 1 compares original content/assignee after edits. | Selected duplicate-prevention/replay design, preserving authorization and current data. |
| P-07 | Action mutations advance Ticket.updatedAt/workflowVersion; other existing activity timestamp behavior stays. | Selected exact activity definition. |
| P-08 | Description/result required, 2000-character limits, required flag, optional Attachment Notes; cancellation reason in Result. | Selected validation proposal, not unspecified handout blocker. |
| P-09 | Exact metrics, five-row recent lists, no windows, shared staff/Admin dashboard, existing login landing. | Selected concise presentation; no new assignee KPI or account counts. |
| P-10 | Required active assignee, default performer; PENDING/COMPLETED/CANCELLED; one PATCH and no action reopen/approval. | Minimal authorized assignment/lifecycle proposal. Actor responsible for each operation is retained in revisions. |
| U-01 (resolved) | Page 11 assignment/lifecycle and page 8 approved assignee must be included. | User review on 2026-10-11 authorizes design; FR-16–FR-18/BR-22–BR-27 implement it in this contract. |
| U-02 (resolved) | Edit vs append-only evidence. | Immutable full revisions reconcile both; current projection editable, original actor/date and revision rows immutable. |
| U-03 (resolved) | Exact existing Issue #56–#64 plan supplied by user on 2026-10-11. | [reviewer.md](reviewer.md) now contains exact established titles/scopes, not proposed issues; GitHub left unchanged. |

Routine implementation choices are settled by explicit design; three state names/gate/default assignment/terminal policy/limits are chosen project proposals, not claimed handout quotations. No remaining assignment requirement needs external clarification to draft this contract. Future reviewer identity and actual final evidence are unrecorded facts, not invented approvals. Concrete revised contract awaits user review; no implementation approval, peer verdict or passing feature evidence claimed.
