# Lab 4 UI Specification

Issue #56 revised draft, 2026-10-11; project design follows [specification.md](specification.md) and [api-spec.md](api-spec.md). User review requires action assignment/lifecycle and approves designing the resolution gate. U-01/U-02 are resolved through this proposal, still awaiting review of the concrete documents. No screens are implemented here.

## 1. Architecture and role navigation

Extend [App.tsx](../../client/src/App.tsx), [AppShell.tsx](../../client/src/components/AppShell.tsx), existing Ticket Detail/Queue/My Tickets components and [api.ts](../../client/src/api.ts). App currently uses pathname, history.pushState and popstate, without React Router. Keep this architecture; add query parsing/state propagation for drilldowns. Do not add a router framework solely for Lab 4.

| Role | New route/navigation | Preserved routes |
|---|---|---|
| REQUESTER | `/dashboard`, Dashboard | `/tickets`, `/tickets/new`, `/tickets/:id` |
| IT_STAFF | `/staff/dashboard`, Dashboard | `/staff/tickets`, `/staff/tickets/:id` |
| ADMINISTRATOR | `/staff/dashboard`, same staff Dashboard | Staff routes plus `/admin/users` |

Authentication/logout/mandatory initial-password-change remain in existing AuthScreen and shell behavior. P-09 adds Dashboard without changing current post-login landing/brand targets (`/tickets` for Requester; `/staff/tickets` for staff/Admin). Deep links/back/forward work and active links use `aria-current=page`; Dashboard is not marked active on Queue. Mobile navigation expands/collapses with existing labeled toggle and closes after selection. Hide wrong-role destinations; direct forbidden navigation shows safe unavailable feedback and no protected data. Backend role checks remain necessary.

## 2. Actions Taken within Ticket Detail

StaffTicketDetailScreen adds a distinct shared **Actions Taken** section alongside existing information, workflow, ownership, attachments, Public Comments and private Internal Notes. Keep these functions and Zen Green grouping. Requester TicketDetailScreen adds the same current-record history as read-only, using its ownership-scoped endpoint; do not show staff editors, private revision audit or Internal Notes.

Display helper text: "Actions Taken are visible to the Requester. Use Internal Notes for private staff information." Show all PENDING/COMPLETED/CANCELLED actions, all seven fields and action assignee, including terminal-Ticket history. Empty: "No actions recorded for this ticket." Staff see Add Action on active Tickets A; on RESOLVED/CLOSED/CANCELLED show disabled Add with explicit reopen guidance. Requester sees no create/edit/assign/complete/cancel/delete or formal workflow controls.

Desktop history uses entries or a compact table with original date/performer, assignee, action-status badge, description, follow-up and View/Edit controls. Expanded view shows full result/notes, plus textual assignment/status labels. Performed By means original authenticated record creator; completing/reassigning never replaces it. Ticket Owner remains a separate Ticket-level section. Cancelled records show Result as cancellation reason and "Cancelled — follow-up flag retained for history", not outstanding work. Show inactive/non-staff assignee warning from safe DTO without hiding the action. Null note labels, machine-readable `<time>`, localized timezone, original date and separately Updated/version remain. Fixed createdAt ASC/id ASC order and 10/20/50 pagination (default 20) keep every state reachable; do not move completed/edited records or hide cancelled work.

Current-user action dashboard links open parent staff detail and request its history using `focusActionId` from the hash. The history endpoint selects the bounded page containing that ticket-scoped action; highlight/focus the rendered target after loading. A missing target shows safe unavailable feedback and Retry/Back, never a dead anchor or unbounded history fetch.

### Create and view/edit modes

Add Action opens inline form (proposed ActionsTaken component), with PENDING status read-only. View expands full shared details; Edit loads current version into the same content form. "Discard changes" exits dirty form with confirmation, distinct from lifecycle "Cancel action". No delete control. Terminal actions retain content Edit but have no assignment or lifecycle destination selector.

| Field | Control/feedback |
|---|---|
| Action Date/Time | Read-only on persisted records; create displays "Recorded automatically when saved" (P-01). No editable timestamp. |
| Action Description | Labeled textarea, required, 1–2000 trimmed characters; nearby error. |
| Result | Labeled textarea, required, 1–2000 trimmed characters; plain text, no status selector. |
| Performed By (original record) | Create shows current authenticated name; persisted views show immutable creator. Helper: "Who originally recorded this action; completion may be by another staff member." Never an owner/assignee picker. |
| Follow-up Required? | Labeled checkbox, explicit boolean; default unchecked. |
| Follow-up Note | Required when checkbox true. When clearing true on an existing COMPLETED action, require a new explanation of work addressed/verified or an erroneous flag, different from the old plan; preserve the draft and link server errors here. Otherwise retain optional text when false. |
| Attachment Notes | Optional textarea naming relevant files; explain shared text and no upload; preserve existing attachment area. |

Assignment/lifecycle controls add only the two required business concepts:

| Control | Behavior |
|---|---|
| Action Assignee | Required select of active IT Staff/Admin from existing eligible-owner lookup; create defaults to current user. Label distinguishes from immutable Performed By and primary Ticket Owner. No unassigned option. |
| Assign/reassign | PENDING action on active Ticket only; choose eligible staff, Save assignment using same versioned action PATCH. Show current historical inactive target read-only and require eligible replacement before completion. |
| Action status | Text/badge PENDING, COMPLETED or CANCELLED; PENDING selector offers only COMPLETED/CANCELLED with named Complete action/Cancel action controls. Terminal actions have no outgoing choice. No extra in-progress/approval state. |
| Complete action | Confirm action/Ticket and reviewed Result; allow Result/follow-up corrections with same PATCH. Active assignee required; follow-up true may remain with note but Ticket resolution then stays blocked. |
| Cancel action | Confirm action/Ticket; required cancellation reason entered in Result, preserving older result in revision history. No delete; retain follow-up/notes unless explicitly edited. Current inactive assignee does not block cancellation. |

Create may select a different assignee; it never sends performer identity or initial state. Confirmations say "Completing as <current user>" / "Cancelling as <current user>"; backend records that session user in the terminal-transition revision. Later editors do not replace this attribution or original performer. Use "Performed By (original record)", "Action Assignee" and "Primary Ticket Owner" consistently in both role views; no revision-history UI is added. Existing PENDING actions can be completed/cancelled even after Ticket cancellation; no automatic child cancellation. New/reassigned pending work requires explicit Ticket reopen if parent is terminal. Resolved/closed content corrections that invalidate gate are rejected with reopen guidance.

P-08 sets text limits; browser validation mirrors backend but backend owns truth. Associate errors via FormField/aria-describedby and aria-invalid; focus first invalid control on failed validation. Validate merged edits, including toggling follow-up on while note blank. Map only safe server error fields through API helpers. Backend date, user identity, key and version are not user-editable fields.

Save prevents repeated clicks, shows Saving and keeps draft in memory. Create generates one clientRequestId and reuses it on retry. Recoverable 400/500/network failures preserve all input; retry does not generate a new key. After a successful create/replay/edit, show announced success, clear committed form, refresh bounded history/detail/version and visible summaries. If save succeeded but refresh failed, report "Saved; unable to refresh" and retry GET, not a second save with a new ID. On 409 stale edit, retain draft, explain another change occurred and offer Reload for review; do not automatically replace server content with the draft. On lost session/403 remove protected content/drafts from display and restore session/password guard rather than retaining sensitive state across users.

Page 11 Answer Part 6 assignment/status/complete/cancel/inactive-assignee requirements are now specified, not placeholders or deferred instructor questions. Assignment, content and lifecycle use one backend PATCH and expectedVersion. Refresh assignee/status/result/version/detail summary after success. Inactive-target 400 maps near Action Assignee; invalid/terminal-state 409 explains refresh/review; parent-policy 409 explains Ticket reopen. Preserve drafts/reason after recoverable failures, prevent repeated clicks and never silently submit as a different user. Confirm cancellation separately from form discard. Only permitted staff controls appear; requester receives identical shared lifecycle information read-only.

## 3. Ticket workflow controls

Retain the existing [eight-status matrix](specification.md#7-ticket-workflow-and-resolution), Requested Priority read-only, IT Priority editable, and primary owner claim/assign/reassign. Owner and action performer are distinct. Status selector displays only allowed destinations, text labels and current status; no Requester status selector. Confirm each status change, including existing cancellation/closure/reopen, with ticket number/current/next status; cancellation of confirmation sends no request. Existing native confirmation is acceptable or reuse ConfirmModal with focus trapping/return and keyboard cancel.

RESOLVED confirmation attests staff reviewed work. Show resolutionEligibility reasons: no completed action, remaining pending actions, or completed work with follow-up true. Explain "Cancelled actions are retained but do not count as completed evidence." Show counts and link/focus Actions Taken; Resolve may be disabled with explanation, but backend is authoritative. No separate approval record/checkbox workflow. Clearing a completed follow-up uses content Edit: uncheck the flag and replace Follow-up Note with an explanation of work addressed/verified or an erroneous flag. Missing/blank/unchanged explanation prevents save; successful save refreshes eligibility. Adding a follow-up action alone does not clear the original flag. Requester advisory indication never qualifies as completed evidence.

Send expectedWorkflowVersion from last detail (P-05); action assignment/state edits use expectedVersion. Busy prevents duplicate controls; success reloads confirmed Ticket/action status/versions/history summary. Stale 409 means reload/review, never automatic resubmit. Preserve unrelated drafts after recoverable failure. Close checks gate when actions exist, but legacy zero-action resolved Ticket may still close. Existing Ticket reopen unlocks new/assigned pending work without changing terminal action states. Ticket cancellation is explicit and does not auto-cancel actions. Dashboard refresh picks up confirmed activity.

## 4. Dashboard drilldowns

Exact metric populations/zero handling are [specification §8](specification.md#8-dashboard-definitions); no browser-computed aggregates. URL examples below are UI destinations; existing list components must translate/init controls and API queries. Use a real link or keyboard-accessible button with descriptive name, not a click-only card/div. Zero-count links remain usable and yield a meaningful empty filtered view.

| Card/item | UI destination/query |
|---|---|
| Staff total | `/staff/tickets` |
| Staff active | `/staff/tickets?statusGroup=active` |
| Unassigned active | `/staff/tickets?statusGroup=active&owner=unassigned` |
| My active | `/staff/tickets?statusGroup=active&owner=<authenticated-id>` |
| Staff status bucket | `/staff/tickets?status=<uppercase-status>` |
| Active IT priority bucket | `/staff/tickets?statusGroup=active&itPriority=<uppercase-priority>` |
| Staff recent row / View all | `/staff/tickets/:id` / `/staff/tickets?sort=updatedAt&order=desc` |
| My Actions Taken row | `/staff/tickets/:ticketId#action-<id>`; history `focusActionId=<id>` loads and focuses target (§2) |
| My Actions Taken total | Label "Actions originally recorded by you: N"; unchanged original performedById calculation across all states; up to five detail links |
| Requester total / active | `/tickets` / `/tickets?statusGroup=active` |
| Waiting for me / resolved | `/tickets?currentStatus=WaitingForRequester` / `/tickets?currentStatus=Resolved` |
| Requester status bucket | `/tickets?currentStatus=<mapped-Prisma-status>` |
| Requester recent row / View all | `/tickets/:id` / `/tickets?sortBy=recentlyUpdated` |
| Resolved-work row / View all | `/tickets/:id` / `/tickets?currentStatus=Resolved&sortBy=recentlyUpdated` |

Initialize page 1 for drilldowns, show active filter labels, permit reset and preserve query/sort through pagination and back/forward. Hash does not grant authorization. Later writes may make count/list totals differ; show authoritative list total and allow dashboard refresh.

## 5. Staff / Administrator Dashboard layout

Proposed StaffDashboard screen: heading, "Operational overview" scope label, Last refreshed time and Refresh control; compact total/active/unassigned/my-active cards; status and active IT Priority buckets with explicit labels; recent ticket list; current-user Actions Taken list/count. URGENT active bucket and unassigned cards identify attention without an invented SLA. Clearly distinguish global counts, owned-by-you tickets and performed-by-you actions; Administrator uses their own user ID for personal subsets and the same global data. No optional account-count card chosen.

Recent Ticket rows retain number/summary/Ticket status/IT Priority/owner/updated time. My Actions Taken adds action state and assignee to original date/description/follow-up; label "Actions originally recorded by you" distinguishes this unchanged performedById metric from assigned-to-you or completed-by-you work. All three states count, including cancelled/reassigned records; no new count or time window. Limit lists to five and keep Queue link.

## 6. Requester Dashboard layout

Proposed RequesterDashboard: heading "Your ticket overview", Refresh/time, total/active/waiting-for-you/resolved cards, all status buckets, up to five recently updated ticket rows and up to five currently resolved-work rows. Label "Recently updated resolved tickets", not a resolution-date KPI. Ticket rows show ticket number, summary, textual status and updated time; waiting state offers own-detail link. Keep My Tickets/Create Ticket navigation. Do not duplicate full lists, private notes, requester switching or global staff metrics.

## 7. Feedback and safe unavailable states

| State | Required behavior |
|---|---|
| Initial loading | `role=status`/aria-busy and stable card space; no zeros or stale previous-user data before response. |
| Empty | Actual counts 0; explicit no recent tickets/no actions; Requester may Create Ticket, staff may open Queue. |
| Filter no results | Show active predicates, clear/reset controls; distinguish from retrieval error. |
| Refresh loading | Mark busy; existing same-user data may stay labeled with last successful refresh time. |
| API/network failure | Safe ErrorAlert, Retry GET; no raw stack/secrets and no fabricated zero dashboard. |
| Save success | Announced confirmation only after confirmed write; refresh confirmed records; distinguish refresh failure. |
| Validation failure | Nearby linked field errors and concise safe summary; retain draft. |
| Conflict | Reload/review guidance; preserve recoverable draft, no blind mutation retry. |
| 401/password-change | Existing session-access-changed flow removes protected data and returns auth/password screen. |
| 403 forbidden | Clear protected results and controls; safe role-unavailable message; no retry that reveals protected records. |
| 404 ticket/action | Safe not found/unavailable, role-appropriate back link; never reveal another requester's existence. |

GET retries are safe. Mutation retry uses same create key; PATCH conflict needs review. Successful retry restores normal display and updates refresh time. Abort/ignore superseded requests on navigation or identity changes to prevent stale-user rendering. No persistent browser storage of private drafts is introduced.

### Screen-state/component matrix

Common feedback above applies throughout. N/A means no operation requiring that state; absent/foreign Tickets use safe 404 feedback, not an empty history.

| Screen/component | Loading | Empty | Normal | Validation | Conflict | Forbidden | Safe failure | Responsive |
|---|---|---|---|---|---|---|---|---|
| Staff Dashboard | Busy cards; no initial zeros | Zero buckets/empty lists | Server cards, recent tickets, original-creator actions | N/A, read-only | N/A, read-only | Clear data/controls | Alert + GET retry | Cards stack; rows wrap |
| Requester Dashboard | Busy; no prior-user rows | Own zeros/empty lists | Own cards/attention/recent/resolved | N/A, read-only | N/A, read-only | Clear data/controls | Alert + GET retry | Cards stack; rows wrap |
| Staff Actions Taken | Busy history; disable duplicate saves | No actions; Add if eligible | List/View/Create/Edit/assign/lifecycle | Linked fields, including clearing explanation | Retain draft; reload/review or reopen guidance | Clear protected forms/history | Retain recoverable draft/key; distinguish saved-refresh failure | Entries on mobile; stacked forms/controls |
| Requester read-only Actions Taken | Busy history | No actions | All own states/fields; pagination | N/A, no form | N/A, read-only | Clear history; no staff controls | Alert + GET retry | Wrapped entries/full notes |
| Ticket Workflow | Await detail/version; busy submit | N/A, Ticket must exist | Permitted choices, gate/advisory feedback | Safe invalid-input feedback | Gate reasons or stale reload/review | No formal requester controls; clear denied data | Safe alert; retain unrelated drafts | Wrapped controls; usable confirmation |

Verify these states through T-31–T-36, T-44/T-45 and T-61/T-62/T-66 in [tests.md](tests.md); no separate screens or revision browser are introduced.

## 8. Zen Green, responsive and accessibility requirements

Reuse [theme.css](../../client/src/theme.css), Bootstrap grid, zen-card, green button variants, StatusBadge, FormField, LoadingSpinner, EmptyState, ErrorAlert and existing confirmation conventions. Preserve typography/spacing/badge meanings; no new theme. Read-only date/performer/Requested Priority use information text, editable content uses controls. Shared Actions/Public Comments and private Internal Notes have textual labels; color is additional meaning only.

Desktop 1280 px: multi-column cards, readable history/table or entries, wrapped controls. Tablet 768 px: two-column cards where readable, stacked form groups and reduced optional table columns with expanded full information. Mobile 375 px: one-column cards/forms, history entries instead of a wide grid, wrapped long text/file notes and accessible navigation/submit/pagination. No document-level horizontal scroll, clipped controls or overlapping feedback. Reflow also works at 200% zoom; don't hardcode new viewport-specific redesigns.

Use headings/landmarks, labels, readable text/non-color status, visible focus, keyboard link/form operation, meaningful drilldown names, live status/error announcements without repetitive updates, semantic table headers if a table is used, no focus loss after save/refresh and proper modal focus return. Use native checkboxes; conditional note required state is announced. Dates have machine-readable `dateTime`. Verify contrast and focus visually, not solely with component assertions. Capture desktop/tablet/mobile and keyboard evidence for dashboards, create/edit/read-only actions and workflow states; checklist/status is in [tests.md](tests.md). Remove obsolete placeholders/broken controls only under later hardening scope, retaining the supported diagnostic behavior from Lab 1.
