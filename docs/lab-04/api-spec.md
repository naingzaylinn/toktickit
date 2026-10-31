# Lab 4 API Specification

Revised draft for Issue #56, 2026-10-11. [Specification](specification.md) owns FR/BR/AC IDs and project design decisions. User review requires assignment/lifecycle and approves designing the resolution-gate proposal; U-01/U-02 are resolved. This specifies endpoints, not implementation or passing tests.

## 1. Existing transport and compatibility

Preserve [Lab 3 API conventions](../lab-03/api-spec.md) and actual [app mounts](../../server/src/app.ts). Same-origin JSON requests use the `toktickit_session` HttpOnly, SameSite=Lax cookie (Secure in production), eight-hour sessions, active-account lookup and mandatory initial-password-change guard. Session tokens are stored hashed, not returned in DTOs. No requester/performer identity headers, bearer replacement or client-supplied role grants. Authenticated responses use `Cache-Control: no-store`.

Existing authentication paths remain `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`; password and rate-limit rules remain unchanged. `GET /api/health` and the legacy `GET /api/categories` diagnostic remain public and retain their existing response shapes. Normal APIs require session and completed password change. Role guards run before ticket/action lookup; scoped requester queries constrain ownership before serialization.

Keep `/api/tickets` and existing `/api/v1/tickets` aliases for ticket operations, attachments, Public Comments and advisory indication. Staff routes actually mount under `/api/staff/tickets`; `/api/v1/staff` has a role guard but no existing staff handler alias, so do not claim that alias exists. User Management stays `/api/admin/users`. Preserve requester `data` + `pagination`, staff collection `data` + `meta`, mixed existing enum formats, binary downloads and error conventions rather than normalizing unrelated APIs.

## 2. Endpoint inventory

| Change | Method/path | Roles and purpose |
|---|---|---|
| New | POST `/api/staff/tickets/:ticketId/actions` | IT_STAFF/ADMINISTRATOR create shared action |
| New | PATCH `/api/staff/tickets/:ticketId/actions/:actionId` | Same, content edit/assign/reassign/complete/cancel with one retained revision |
| New | GET `/api/staff/tickets/:ticketId/actions` | Same, paginated current action history |
| New | GET `/api/tickets/:ticketId/actions` | REQUESTER, owned ticket only; read-only current history; mount also under existing `/api/v1/tickets` alias |
| Modified, additive DTO | GET `/api/staff/tickets/:ticketId` | Same existing staff detail, add workflow version/action summary |
| Modified, project P-04/P-05 | PATCH `/api/staff/tickets/:ticketId/status` | Same roles/matrix, explicit project gate and required stale-write token |
| New | GET `/api/staff/dashboard` | IT_STAFF/ADMINISTRATOR, global/current-user operational snapshot |
| New | GET `/api/requester/dashboard` | REQUESTER, own-ticket snapshot |
| Modified, additive filters | GET `/api/staff/tickets` | Add active status group to existing Queue |
| Modified, additive filters | GET `/api/tickets` (and existing alias) | Add all eight currentStatus filters and active group to My Tickets |
| Existing, reused | GET `/api/tickets/:ticketId`; POST `/:ticketId/problem-appears-resolved` | Owned requester detail/advisory indication; no new resolution endpoint |
| Existing, reused | PATCH `/api/staff/tickets/:ticketId/owner`, `/priority`; GET `/owners` | Ticket assignment/priority unchanged; reuse active staff/Admin options from owners lookup for action assignee picker; action PATCH owns assignment |
| Existing, reused | Ticket comments, staff notes, attachments, auth, reference data, Administrator APIs | Existing signatures/permissions unchanged |

No action DELETE route, edit-performer route or additional dashboard drilldown endpoint. Staff detail/history integration reuses dedicated history rather than embedding all actions. Register fixed dashboard paths so they are not consumed by dynamic ticket ID routes.

## 3. Common new-endpoint conventions

IDs in examples such as `ticket-id` are placeholders; actual ticket/action IDs are UUID strings. Validate path IDs after role authentication, return 400 VALIDATION_ERROR for malformed new-route IDs. Check that actionId belongs to ticketId; mismatched/nonexistent action returns the same 404 ACTION_NOT_FOUND. Missing ticket yields 404 TICKET_NOT_FOUND. Requester foreign-ticket and nonexistent-ticket reads use identical 404 TICKET_NOT_FOUND responses.

New requests accept only documented body/query fields; arrays, repeated query values, unknown filters and malformed JSON fail safely. Dates in DTOs are ISO 8601 UTC; no client date boundaries or timezone-dependent count calculations. Treat action text as plain text. Requiredness, trim rules and lengths follow BR-04/P-08 exactly. Existing endpoints retain their existing validation/error behavior unless explicitly modified below.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": { "followUpNote": "Enter a follow-up note when follow-up is required." }
  }
}
```

`error.correlationId` may be present; the existing auth error helper does not always generate one. Existing requester `error.details` arrays remain supported. Lab 4 action helpers must safely map the new field whitelist in `client/src/api.ts`; currently non-auth helpers do not map action field errors. Never return stack traces, SQL, secret data, private notes, storage keys or unscoped ticket metadata. Shared action text is not internal-note content.

| HTTP/code | Meaning |
|---|---|
| 200 | Read, edit, no-op edit or exact create replay |
| 201 | New action created |
| 400 VALIDATION_ERROR | Invalid body, identity/date injection, field type/length, missing version |
| 400 INVALID_ACTION_ASSIGNEE | Missing/nonexistent/inactive/non-staff explicit target, or current assignee ineligible for completion; safe assigneeId field error |
| 400 INVALID_QUERY_PARAMS | Unsupported pagination/filter/order or repeated query value |
| 401 AUTHENTICATION_REQUIRED | Missing, expired, inactive or invalid session |
| 403 PASSWORD_CHANGE_REQUIRED | Normal endpoint before mandatory password change |
| 403 FORBIDDEN | Wrong role, including all requester staff-action writes |
| 404 TICKET_NOT_FOUND / ACTION_NOT_FOUND | Missing or safely concealed scoped resource |
| 409 CONFLICT | Stale version, forbidden matrix edge or transactional race; safe reload message |
| 409 ACTION_STATE_CONFLICT | Invalid/self/terminal action transition or assignment on terminal action |
| 409 TICKET_WORKFLOW_CONFLICT | Create/reassign on non-active Ticket or resolved/closed correction would invalidate gate |
| 409 RESOLUTION_REQUIREMENTS_NOT_MET | Proposed gate fails; staff-only safe reason codes |
| 409 IDEMPOTENCY_CONFLICT | Same create key with changed normalized original payload |
| 500 INTERNAL_SERVER_ERROR | Generic unexpected failure; no partial mutation |

Existing login 429 behavior remains; no new throttling policy is asserted. New routes do not grant unsupported methods; unknown endpoints/methods retain safe routing failure. Denied writes must leave database rows/timestamps unchanged.

## 4. Create Actions Taken — new

`POST /api/staff/tickets/:ticketId/actions`, IT_STAFF/ADMINISTRATOR, P-01/P-03/P-06/P-08.

```json
{
  "clientRequestId": "7f39adbf-06be-4fd6-a6fb-1ed083d6a7aa",
  "assigneeId": "other-staff-id",
  "actionDescription": "Checked the access point configuration.",
  "actionResult": "Connection restored; requester verification is needed.",
  "followUpRequired": true,
  "followUpNote": "Ask the requester to test the connection.",
  "attachmentNotes": "See the existing access-point screenshot attachment."
}
```

Request ID is a UUID generated once per form intent, retained across retries. Description/result/boolean/key are required; optional notes may be omitted/null, but followUpNote must be nonblank when true. assigneeId is an optional UUID input: omitted defaults to authenticated performer, preserving the prior draft's create payload; explicit null/blank/malformed/nonexistent/inactive/non-staff target fails 400 INVALID_ACTION_ASSIGNEE. Backend sets immutable performer/date and initial PENDING status. Reject performedById/userId/ownerId/actionDateTime/createdAt/status and other undocumented fields. Parent Ticket must be in active set A; otherwise 409 TICKET_WORKFLOW_CONFLICT. Any permitted staff can create, not only Ticket Owner. The example assignee string is a placeholder for an actual UUID.

201 response (also defines the Action DTO used by history/edit):

```json
{
  "data": {
    "id": "action-id",
    "ticketId": "ticket-id",
    "actionDateTime": "2026-10-09T03:00:00.000Z",
    "actionDescription": "Checked the access point configuration.",
    "actionResult": "Connection restored; requester verification is needed.",
    "performedBy": { "id": "staff-id", "name": "IT Staff One", "role": "IT_STAFF" },
    "assignee": { "id": "other-staff-id", "name": "IT Staff Two", "role": "IT_STAFF", "isActive": true },
    "status": "PENDING",
    "followUpRequired": true,
    "followUpNote": "Ask the requester to test the connection.",
    "attachmentNotes": "See the existing access-point screenshot attachment.",
    "version": 1,
    "createdAt": "2026-10-09T03:00:00.000Z",
    "updatedAt": "2026-10-09T03:00:00.000Z"
  },
  "meta": { "workflowVersion": 1 }
}
```

Safe performer role/name reflects referenced user at read time; original performer ID/date remain unchanged after reassignment/completion/deactivation. Assignee is a separate required safe user DTO with current isActive/role so historical ineligibility can be shown; no email/password/session fields. actionDateTime aliases createdAt. Neither performer nor assignee implies Ticket Owner. Requesters receive the same shared assignee/status information for owned Tickets.

For a new request, lock parent and target User; verify parent state and eligible assignee; create action/revision 1 with status/assignee/content, advance Ticket.updatedAt/workflowVersion atomically. Unique (ticketId, performedById, clientRequestId) prevents concurrent duplicates. Normalize omitted assignee to session ID; compare replay against immutable revision 1 INCLUDING original assignee and content, not the reassigned/edited current state. After authorization/basic body validation, check replay BEFORE current parent/assignee business-state checks: a previously successful intent remains replayable after Ticket cancellation, action completion or assignee deactivation. Exact replay returns 200 with Idempotent-Replay:true/current DTO/current parent version and no writes; changed original assignee/content conflicts. Uniqueness races roll back then reread/compare safely. Replays never bypass current caller/session authorization.

## 5. Edit, assign and transition Actions Taken — new

`PATCH /api/staff/tickets/:ticketId/actions/:actionId`, IT_STAFF/ADMINISTRATOR, P-02/P-03/P-05.

```json
{
  "expectedVersion": 1,
  "actionResult": "Requester confirmed the connection works.",
  "followUpRequired": false,
  "followUpNote": "Verification completed."
}
```

Required expectedVersion is integer ≥1. At least one of actionDescription/actionResult/followUpRequired/followUpNote/attachmentNotes/assigneeId/status is present; null only for optional notes. Omission preserves current values. Merge and validate full content so partial edits cannot bypass follow-up checks. Backend-owned performer/date/ticket/key/version and undocumented fields fail 400. Any permitted staff/Admin may operate accessible actions, regardless of owner/assignee/creator. Original Performed By remains the creator; assignee denotes designated worker, not necessarily operator. Backend session identity sets revision.editorId: the first PENDING→COMPLETED/CANCELLED revision identifies the actual completer/canceller even after subsequent content edits. No client-supplied editorId/completedBy/cancelledBy, additional identity fields or revision-history endpoint.

For a persisted COMPLETED action with followUpRequired=true, clearing to false requires an explicitly supplied followUpNote of 1–2000 trimmed characters, different from the previous trimmed note, explaining work addressed/verification or correction of an erroneous flag (BR-25). For example, submit `{ "expectedVersion": 3, "followUpRequired": false, "followUpNote": "Requester retested successfully; no follow-up remains." }`. Omitted/null/blank/unchanged explanation returns 400 VALIDATION_ERROR with a followUpNote field error and no writes. Backend validates this transition-specific exception before commit; it cannot verify the truth of staff's attestation. The atomic revision retains the new explanation, previous revisions retain the old plan, and the gate is recalculated from committed data. Completing another action never clears this flag automatically. Other false-flag writes keep the normal optional-note rule; later note corrections cannot erase the clearing revision.

Minimal assignment uses the SAME PATCH, no extra resource/command endpoints:

```json
{ "expectedVersion": 1, "assigneeId": "eligible-staff-uuid" }
```

Only a currently PENDING action under an active Ticket A can be assigned/reassigned. Candidate must be an existing active IT_STAFF/ADMINISTRATOR; explicit invalid/null/foreign-role/inactive target returns 400 INVALID_ACTION_ASSIGNEE. Reassigning to the same eligible assignee is a matching-version no-op. Revalidating an explicitly supplied now-ineligible same target fails, even if otherwise a no-op. An unchanged inherited inactive assignee does not prevent text correction or cancellation; it DOES prevent completion. Terminal action assignee writes return 409 ACTION_STATE_CONFLICT even if the submitted ID is unchanged.

Completion example:

```json
{ "expectedVersion": 2, "status": "COMPLETED", "actionResult": "Connection restored and tested.", "followUpRequired": false }
```

Only PENDING→COMPLETED. Validate merged nonblank result and active staff/Admin assignee at commit; completion may include reassignment when parent is active. No owner-only/assignee-only grant. Completed work may retain followUpRequired=true plus its required note, but then blocks Ticket resolution until audited follow-up correction clears it.

Cancellation example:

```json
{ "expectedVersion": 2, "status": "CANCELLED", "actionResult": "Cancelled because this action duplicates the replacement action." }
```

Only PENDING→CANCELLED, with explicitly present nonblank actionResult as cancellation reason (400 field validation if absent/blank). No separate reason property. Retain follow-up/notes unless explicitly changed; cancelled flags are historical/ignored by gate. Inactive assignee does not block cancellation; supplied reassignment still passes its rules. Completing/cancelling existing pending children is allowed on any Ticket status subject to RESOLVED/CLOSED post-write gate below; never automatically change Ticket status.

COMPLETED/CANCELLED have no outgoing or self transitions. Invalid action pair/terminal reassignment yields 409 ACTION_STATE_CONFLICT; unknown status yields 400 VALIDATION_ERROR. Content corrections remain allowed with merged validation/revisions, state/assignee immutable. ALL action mutations under RESOLVED/CLOSED must leave post-write gate valid, else 409 TICKET_WORKFLOW_CONFLICT; explicitly reopen Ticket first. No implicit action reopen/delete/approval.

Success 200 returns current Action DTO (including assignee/status), version n+1/updatedAt and meta.workflowVersion. Lock order: Ticket → Action → affected User rows in stable ID order. Check expectedVersion before state-dependent rules; validate merged content/state/assignment; lock eligible User before validation to serialize assignment/completion with account deactivation or role change. Deactivation AFTER a committed assignment is allowed historically and checked again on completion. Commit projection, ONE full revision (content+assignee+status+session editor), and parent version/activity once, even for combined operations. Rollback leaves all rows unchanged. Matching-version content no-op leaves versions/revisions unchanged; self-status transition still conflicts. Stale no-op/combined PATCH returns 409 CONFLICT. No automatic mutation retry after conflict; reload/review with retained draft. No requester write/DELETE or revision overwrite.

## 6. Retrieve action history — new

Staff GET `/api/staff/tickets/:ticketId/actions`; requester GET `/api/tickets/:ticketId/actions` (existing ticket alias also mounted). Query `page` integer ≥1 default 1; `pageSize` one of 10/20/50 default 20. No sort/filter override: `createdAt ASC, id ASC`. Staff history additionally accepts optional UUID `focusActionId`, mutually exclusive with explicit `page`: find that action within this ticket, count preceding records in the fixed order, and select page `floor(precedingCount / pageSize) + 1`. A missing/foreign target returns 404 ACTION_NOT_FOUND without metadata; malformed/combined query returns 400 INVALID_QUERY_PARAMS. This provides a bounded action-anchor drilldown using the same endpoint. Both return:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 }
}
```

Nonempty data contains §4 DTOs with all seven shared fields plus current assignee/status. All PENDING/COMPLETED/CANCELLED records remain included; no state filter silently hides cancelled work. Counts/rows use a consistent snapshot. Out-of-range valid pages return []/actual totals; not 404. Requesters see all own records/assignee/status but no private notes/audit rows/secrets. Immutable revisions are retained for test/reviewer verification, not a new product browsing endpoint. Role matrix is authoritative.

## 7. Staff detail/status — modified existing endpoints

`GET /api/staff/tickets/:ticketId` keeps all existing fields, uppercase API `status` and priorities, requester/owner information, active attachments, Public Comments, Internal Notes and advisory timestamp. Add:

```json
{
  "workflowVersion": 3,
  "actionsTakenSummary": { "totalItems": 2, "pendingItems": 0, "completedItems": 1, "cancelledItems": 1, "followUpRequiredItems": 0 },
  "resolutionEligibility": { "eligible": true, "reasonCodes": [] }
}
```

These fields appear inside existing data, not a replacement. Summary counts all action states; followUpRequiredItems counts COMPLETED AND followUpRequired=true only. Eligibility is C≥1/P=0/F=0, independent of Ticket edge. Reason codes: NO_COMPLETED_ACTIONS, PENDING_ACTIONS, FOLLOW_UP_REQUIRED (all applicable codes returned). All-cancelled/zero-action work gives NO_COMPLETED_ACTIONS; cancelled follow-up never counts F. Read in one snapshot; separate bounded history unchanged. Requester existing detail remains unchanged and loads shared actions separately.

`PATCH /api/staff/tickets/:ticketId/status` retains path, roles and [the full matrix](specification.md#7-ticket-workflow-and-resolution). Proposed request:

```json
{ "status": "RESOLVED", "expectedWorkflowVersion": 3 }
```

P-05 requires integer version ≥0; unknown enum/missing token returns 400. Success:

```json
{ "data": { "status": "RESOLVED", "workflowVersion": 4 } }
```

Transaction locks parent, compares version, validates current matrix and BR-11 gate, then conditionally updates status/version/updatedAt. Order: authorization → body validation → ticket existence → stale comparison → matrix → gate → commit. Stale/invalid edges return 409 CONFLICT. Gate failure returns 409 RESOLUTION_REQUIREMENTS_NOT_MET with safe staff reason codes, never action/private text. Parent locking for action/status writes prevents a gate race. Database serialization/deadlock failures must roll back and return safe conflict or server error; no partial action/status changes.

The required token and project gate are explicit documented differences from Lab 3. Status-only old callers receive 400 because a tokenless fallback would lose stale-screen protection; deploy backend/client together and keep all existing edges/other APIs. Apply gate on RESOLVED entry and RESOLVED→CLOSED when actions exist; legacy zero-action resolved Ticket may close with token. Cancellation never automatically cancels child actions. Requester indication remains timestamp-only; no action/status/version change, repeat CONFLICT and no resolution shortcut. Optional create-assignee default and additive DTO/filter changes preserve compatibility wherever safely feasible.

## 8. Dashboards — new

Both GET endpoints have no body or supported filter/identity/time-range query; unknown query fields fail 400 INVALID_QUERY_PARAMS. Exact meanings/predicates are [specification §8](specification.md#8-dashboard-definitions), P-09. UTC `meta.generatedAt` is response generation time, not a calendar boundary. Use one repeatable-read database snapshot for counts and concise rows. Counts are nonnegative integers, not null; no denominator-based KPI exists.

Staff GET `/api/staff/dashboard`, roles IT_STAFF/ADMINISTRATOR. Example empty response:

```json
{
  "data": {
    "totalTickets": 0,
    "activeTickets": 0,
    "unassignedActiveTickets": 0,
    "myActiveTickets": 0,
    "byStatus": { "NEW": 0, "OPEN": 0, "IN_PROGRESS": 0, "WAITING_FOR_REQUESTER": 0, "RESOLVED": 0, "CLOSED": 0, "REOPENED": 0, "CANCELLED": 0 },
    "activeByItPriority": { "LOW": 0, "MEDIUM": 0, "HIGH": 0, "URGENT": 0 },
    "recentTickets": [],
    "myActions": { "totalItems": 0, "items": [] }
  },
  "meta": { "generatedAt": "2026-10-09T03:00:00.000Z" }
}
```

Recent ticket rows remain {id,ticketNumber,summary,status,itPriority,owner,updatedAt}, owner null or safe id/name, max five ordered updatedAt DESC/ticketNumber ASC. Current-user action rows are {id,ticketId,ticketNumber,actionDateTime,actionDescription,followUpRequired,status,assignee} (safe id/name/role/isActive); max five createdAt DESC/id DESC. Existing metric calculation is unchanged: original performedById=session user, ALL action states/parent statuses, including reassigned/cancelled work; totalItems counts actions, not assignment/operation events. Label as originally recorded by you, not assigned-to-you work. No new action KPI/count/window is introduced.

Requester GET `/api/requester/dashboard`, REQUESTER only:

```json
{
  "data": {
    "totalTickets": 0,
    "activeTickets": 0,
    "waitingForRequesterTickets": 0,
    "resolvedTickets": 0,
    "byStatus": { "NEW": 0, "OPEN": 0, "IN_PROGRESS": 0, "WAITING_FOR_REQUESTER": 0, "RESOLVED": 0, "CLOSED": 0, "REOPENED": 0, "CANCELLED": 0 },
    "recentTickets": [],
    "resolvedTicketsRecent": []
  },
  "meta": { "generatedAt": "2026-10-09T03:00:00.000Z" }
}
```

Both lists are bounded at five and contain `{id,ticketNumber,summary,status,updatedAt}` only; status uses uppercase API values for these new DTOs. Every query scopes `requesterId` from session, including list joins/counts. No client requesterId accepted. Resolved summaries filter RESOLVED and sort updatedAt DESC, ticketNumber ASC; they do not claim actual resolution date. Errors are safe 401/403/400/500, never a fabricated empty success. Refresh is GET/manual retry; no automatic polling period invented.

## 9. Drilldowns and list compatibility

No duplicate list endpoints. Existing staff Queue query supports search, one status, priorities, owner, sort/order, page/pageSize; defaults page 1, size 20, updatedAt DESC with ticketNumber ASC tie-breaker. Add `statusGroup=active` matching A. A supplied single status and group intersect; unsupported group fails 400. Existing filters remain.

Existing requester list accepts `q`, categoryId, relatedSystemId, requestedPriority, `currentStatus`, sortBy/page/pageSize; defaults page 1, size 10, newest. Extend `currentStatus` from New-only to all Prisma-labelled values (`New`, `Open`, `InProgress`, `WaitingForRequester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), retaining `New`. Add `statusGroup=active`, same intersection rule. Keep requester `pagination` with totalItems/totalPages/hasNextPage/hasPreviousPage, existing DTO fields and priorities. Map dashboard uppercase values explicitly rather than sending WAITING_FOR_REQUESTER to this legacy filter.

Card destinations/query parameters are exhaustively listed in specification §8 and [UI §4](ui-spec.md#4-dashboard-drilldowns). UI must parse URL query state (currently App tracks pathname only), initialize existing list controls and fetch the full server-filtered collection, not filter a single loaded page. Reset page to 1 on new drilldown/filter; maintain sort/filter through pagination/back. Recent row links go to existing role detail; staff my-action links use `#action-<id>` and request history with `focusActionId` to load its page (§6), without loading unbounded history. Then highlight/focus the actual target; a dead anchor is not acceptable. Target failure shows safe unavailable feedback with a retry/back action.

Snapshot counts and later drilldowns may differ after writes; show latest list totals and allow refresh. Compatibility is additive except documented gate/token safety changes in §7; new action rules are specified before implementation, so do not break an already deployed action API. No code/API tests changed for this document.
