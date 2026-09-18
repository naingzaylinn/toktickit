# Lab 3 Test Plan and Traceability

## 1. Purpose

This document defines the planned test coverage for TokTickIT Sprint 3.

The test plan is created before or alongside implementation and maps important Lab 3 requirements and Acceptance Criteria to planned automated and manual verification.

Coverage includes:

- unit testing;
- API/integration testing;
- authentication testing;
- authorization/security testing;
- migration testing;
- Lab 2 regression testing;
- UI component testing;
- UI style and feedback-state testing;
- responsive verification;
- accessibility checks; and
- end-to-end testing.

---

# 2. Test Status Values

Each planned test uses one of the following final statuses:

- `Planned`
- `In Progress`
- `Pass`
- `Fail`
- `Blocked`
- `Not Applicable`

During implementation, this document will be updated with the actual automated test file path and final status.

---

# 3. Traceability Rules

Each Acceptance Criterion in `specification.md` must map to at least one planned test.

Important Functional Requirements and Business Rules may also be referenced where useful.

Primary traceability is based on:

- `AC-01` through `AC-18`
- Functional Requirements `FR-xx`
- Business Rules `BR-xx`

---

# 4. Authentication API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login with active account and correct credentials | Authenticated response returns safe user identity and role | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | FR-02 | Login with incorrect password | Login rejected with safe authentication failure | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | FR-02 | Login with unknown email | Login rejected without exposing unnecessary account information | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | AC-05 | Login using inactive account | Authenticated application access denied | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | FR-01 | Login with missing email | Validation failure returned | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | API | FR-01 | Login with missing password | Validation failure returned | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-07 | API | FR-06 | Retrieve current authenticated user | Safe current-user identity and role returned | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-08 | API | FR-06 | Retrieve current user without session | `401 Unauthorized` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-09 | API | FR-05 | Logout authenticated user | Session invalidated successfully | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-10 | API | FR-05 | Access protected API after logout | Request rejected as unauthenticated | `server/tests/lab-03/auth.api.test.ts` | Planned |

---

# 5. Mandatory Password Change Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| API-11 | API | AC-02 | Login with user marked `mustChangePassword` | Login succeeds but normal application access remains restricted | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-12 | API | AC-02 | Valid initial-password replacement | Password updated and `mustChangePassword` cleared | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-13 | API | FR-04 | New password and confirmation mismatch | Validation failure | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-14 | API | FR-04 | Invalid new password boundary | Validation failure | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-15 | API | FR-04 | Incorrect current password | Password change rejected safely | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-16 | API | AC-02 | Access normal protected endpoint before required password change | 403 Forbidden with PASSWORD_CHANGE_REQUIRED; normal protected application access remains blocked | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-17 | API | BR-24 | More than 5 failed login attempts within 15 minutes | Additional attempt is rejected with `429 Too Many Requests` | `server/tests/lab-03/auth.api.test.ts` | Planned |

---

# 6. Password Storage Unit Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-07 | Password hashing helper | Plaintext password produces secure hash | `server/tests/lab-03/auth.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-07 | Password verification helper with correct password | Verification succeeds | `server/tests/lab-03/auth.unit.test.ts` | Planned |
| UNIT-03 | Unit | BR-07 | Password verification helper with incorrect password | Verification fails | `server/tests/lab-03/auth.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-07 | Stored password value | Plaintext password is not stored | `server/tests/lab-03/auth.unit.test.ts` | Planned |

---

# 7. Authorization Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| AUTH-01 | Authorization | FR-07 | Unauthenticated access to protected Requester endpoint | `401 Unauthorized` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-02 | Authorization | FR-07 | Requester accesses IT Staff Queue API | `403 Forbidden` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-03 | Authorization | AC-04 | Requester accesses Internal Notes endpoint | Forbidden; no Internal Note content returned | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-04 | Authorization | FR-28 | IT Staff accesses Administrator user list | `403 Forbidden` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-05 | Authorization | FR-28 | Requester accesses Administrator user list | `403 Forbidden` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-06 | Authorization | FR-28 | Administrator accesses permitted User Management endpoint | Access allowed | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-07 | Authorization | AC-03 | Requester sends another Requester's `requesterId` | Backend ignores supplied identity and uses authenticated Requester | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-08 | Authorization | AC-06 | Requester requests another user's Ticket | Protected Ticket data not exposed | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTH-09 | Authorization | FR-11 | Requester requests Attachment from another user's Ticket | Protected Attachment not exposed | `server/tests/lab-03/authorization.api.test.ts` | Planned |

---

# 8. Requester Regression API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| REG-01 | Regression/API | AC-18 | Authenticated Requester creates Ticket | Ticket created using authenticated Requester identity | Existing Lab 2 tests / Lab 3 regression test | Planned |
| REG-02 | Regression/API | AC-18 | My Tickets after authentication migration | Only authenticated Requester's Tickets returned | Existing Lab 2 tests / Lab 3 regression test | Planned |
| REG-03 | Regression/API | AC-18 | Requester Ticket Detail | Owned Ticket remains accessible | Existing Lab 2 tests / Lab 3 regression test | Planned |
| REG-04 | Regression/API | AC-18 | Requester Attachment upload | Existing permitted upload behavior continues | Existing Lab 2 tests / Lab 3 regression test | Planned |
| REG-05 | Regression/API | AC-18 | Requester Attachment retrieval | Existing ownership protection continues | Existing Lab 2 tests / Lab 3 regression test | Planned |
| REG-06 | Regression/API | AC-18 | Category/reference-data APIs | Existing Lab 2 behavior remains valid | Existing Lab 2 tests | Planned |

---

# 9. IT Staff Queue API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| QUEUE-01 | API | AC-07 | IT Staff retrieves Ticket Queue | Queue records returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-02 | API | AC-07 | Queue search | Matching Tickets returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-03 | API | AC-07 | Queue status filter | Only matching statuses returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-04 | API | AC-07 | Queue Requested Priority filter | Correct filtered results returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-05 | API | AC-07 | Queue IT Priority filter | Correct filtered results returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-06 | API | AC-07 | Assigned/unassigned ownership filter | Correct records returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-07 | API | AC-07 | Queue sorting | Records returned in requested valid order | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-08 | API | AC-07 | Queue default ordering | updatedAt descending ordering applied | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-09 | API | AC-07 | Queue pagination | Correct page and metadata returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-10 | API | AC-07 | Invalid page/pageSize | `400 Bad Request` | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-11 | API | AC-07 | Invalid sort/filter value | Safe validation failure | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-12 | Authorization | FR-15 | Requester requests Queue endpoint | `403 Forbidden` | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |

---

# 10. IT Staff Ticket Detail Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| DETAIL-01 | API | FR-20 | Retrieve Ticket Detail as IT Staff | Permitted Ticket detail returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-02 | API | AC-08 | Claim unassigned Ticket | Authenticated permitted staff becomes owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-03 | API | FR-22 | Reassign Ticket to active permitted staff user | Ticket Owner updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-04 | API | BR-11 | Assign Ticket to inactive user | Request rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-05 | Authorization | FR-22 | Requester attempts ownership update | `403 Forbidden` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-06 | API | AC-09 | Update valid IT Priority | IT Priority stored and returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-07 | API | BR-14 | Requester attempts IT Priority update | Request rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-08 | API | AC-10 | Perform valid status transition | Status successfully updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-09 | API | AC-10 | Perform invalid status transition | Transition rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| DETAIL-10 | Authorization | BR-06 | Requester formally sets Resolved/Closed | Request rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |

---

# 11. Problem Appears Resolved Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| RESOLVE-01 | API | FR-13 | Requester indicates owned problem appears resolved | Resolution indication recorded according to contract | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| RESOLVE-02 | Authorization | FR-13 | Requester uses action on another Requester's Ticket | Request rejected without protected data leakage | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| RESOLVE-03 | API | BR-06 | Problem Appears Resolved action | Ticket is not automatically formally Closed by Requester | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |

---

# 12. Public Comments API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| COMMENT-01 | API | AC-11 | Requester posts valid Public Comment on owned Ticket | Comment created | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-02 | API | AC-11 | IT Staff posts valid Public Comment | Comment created | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-03 | API | BR-18 | Empty Public Comment | Validation failure | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-04 | API | BR-18 | Whitespace-only Public Comment | Validation failure | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-05 | API | AC-11 | Public Comment authorship | Backend records authenticated author | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-06 | API | AC-11 | Public Comment creation time | Backend records creation time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-07 | Authorization | FR-12 | Requester posts comment to another Requester's Ticket | Request rejected | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| COMMENT-08 | API | BR-16 | Edit/delete Public Comment attempt | Not supported in Lab 3 | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |

---

# 13. Internal Notes API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| NOTE-01 | API | AC-12 | IT Staff creates valid Internal Note | Note created | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-02 | API | AC-12 | IT Staff retrieves Internal Notes | Note content returned | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-03 | Authorization | AC-04 | Requester retrieves Internal Notes | Forbidden with no note content returned | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-04 | Authorization | AC-04 | Requester creates Internal Note | `403 Forbidden` | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-05 | API | BR-18 | Empty Internal Note | Validation failure | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-06 | API | BR-18 | Whitespace-only Internal Note | Validation failure | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-07 | API | AC-12 | Internal Note author | Backend records authenticated author | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-08 | API | AC-12 | Internal Note creation time | Backend records creation time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| NOTE-09 | API | BR-17 | Edit/delete Internal Note attempt | Not supported in Lab 3 | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |

---

# 14. Administrator User Management API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| ADMIN-01 | API | FR-28 | Administrator retrieves user list | User list returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-02 | API | FR-29 | Search users by name | Matching users returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-03 | API | FR-29 | Search users by email | Matching users returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-04 | API | FR-30 | Optional role filter | Only matching role returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-05 | API | AC-13 | Create valid user | User created with exactly one role | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-06 | API | AC-14 | Create duplicate email | 409 Conflict | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-07 | API | FR-36 | Create/update invalid role | Request rejected | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-08 | API | FR-32 | Edit user name | Updated value stored | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-09 | API | FR-32 | Edit user email | Updated unique email stored | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-10 | API | FR-32 | Change user role | Exactly one permitted role stored | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-11 | API | FR-32 | Deactivate valid target user | Account becomes inactive | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-12 | API | FR-32 | Reactivate inactive user | Account becomes active | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-13 | API | AC-15 | Administrator deactivates own account | Operation rejected | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-14 | API | AC-16 | Deactivate last active Administrator | Operation rejected | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-15 | API | AC-17 | Administrator sets new initial password | Password updated securely and `mustChangePassword = true` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-16 | Authorization | FR-28 | Requester accesses Administrator API | `403 Forbidden` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| ADMIN-17 | Authorization | FR-28 | IT Staff accesses Administrator API | `403 Forbidden` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |

---

# 15. Database Migration Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| MIG-01 | Migration | AC-18 | Existing Development Requesters migrate/evolve into Users | User records remain associated with correct existing Tickets | Migration verification script/test | Planned |
| MIG-02 | Migration | AC-18 | Existing Ticket records after migration | Existing Tickets remain present | Migration verification script/test | Planned |
| MIG-03 | Migration | AC-18 | Existing Attachment records after migration | Existing Attachments remain valid | Migration verification script/test | Planned |
| MIG-04 | Migration | BR-13 | Existing/new Tickets receive valid IT Priority initialization | IT Priority correctly initialized from Requested Priority where required | Migration verification script/test | Planned |
| MIG-05 | Migration | FR-04 | Migrated Requester initial credentials | Migrated test users can authenticate with documented local credentials and are required to change initial password where specified | Migration verification script/test | Planned |
| MIG-06 | Migration | FR-09 | Development Requester selector dependency removed | Authenticated User identity replaces temporary selector identity | Regression/E2E verification | Planned |

---

# 16. Seed Data Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| SEED-01 | Integration | Seed requirement | Seed is safe to run repeatedly | Re-running seed does not create invalid duplicate data | Seed/integration test | Planned |
| SEED-02 | Integration | Seed requirement | Active Requester count | At least four active Requesters exist | Seed/integration test | Planned |
| SEED-03 | Integration | Seed requirement | Inactive Requester | At least one inactive Requester exists | Seed/integration test | Planned |
| SEED-04 | Integration | Seed requirement | Active IT Staff count | At least three active IT Staff exist | Seed/integration test | Planned |
| SEED-05 | Integration | Seed requirement | Inactive IT Staff | At least one inactive IT Staff exists | Seed/integration test | Planned |
| SEED-06 | Integration | Seed requirement | Administrator availability | At least one active Administrator exists | Seed/integration test | Planned |
| SEED-07 | Integration | Seed requirement | Realistic Tickets | Tickets cover multiple statuses, priorities, and ownership states | Seed/integration test | Planned |
| SEED-08 | Integration | Seed requirement | Comments and Notes | Example Public Comments and Internal Notes exist without sensitive content | Seed/integration test | Planned |

---

# 17. Login UI Component Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-01 | UI Component | AC-01 | Login form renders | Email, password, and Login controls visible | `client/.../lab-03/Login.test.tsx` | Planned |
| UI-02 | UI Component | FR-01 | Empty login submission | Client validation displayed | `client/.../lab-03/Login.test.tsx` | Planned |
| UI-03 | UI Component | FR-02 | Invalid login response | Safe error feedback displayed | `client/.../lab-03/Login.test.tsx` | Planned |
| UI-04 | UI Component | AC-05 | Inactive account response | Safe inactive-account feedback displayed | `client/.../lab-03/Login.test.tsx` | Planned |
| UI-05 | UI Component | FR-01 | Login busy state | Duplicate submission prevented and loading state shown | `client/.../lab-03/Login.test.tsx` | Planned |

---

# 18. Change Password UI Component Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-06 | UI Component | AC-02 | Mandatory Change Password screen renders | Required controls visible | `client/.../lab-03/ChangePassword.test.tsx` | Planned |
| UI-07 | UI Component | AC-02 | Password confirmation mismatch | Validation shown | `client/.../lab-03/ChangePassword.test.tsx` | Planned |
| UI-08 | UI Component | FR-04 | Invalid password | Validation shown | `client/.../lab-03/ChangePassword.test.tsx` | Planned |
| UI-09 | UI Component | AC-02 | Successful password change | User allowed to continue to normal app | `client/.../lab-03/ChangePassword.test.tsx` | Planned |
| UI-10 | UI Component | FR-04 | Change-password busy state | Duplicate submission prevented | `client/.../lab-03/ChangePassword.test.tsx` | Planned |

---

# 19. Role Navigation UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-11 | UI Component | FR-08 | Requester navigation | Only Requester-permitted destinations shown | Application shell test | Planned |
| UI-12 | UI Component | FR-08 | IT Staff navigation | Ticket Queue visible; unauthorized Admin destination hidden | Application shell test | Planned |
| UI-13 | UI Component | FR-08 | Administrator navigation | User Management visible | Application shell test | Planned |
| UI-14 | UI Component | FR-06 | Authenticated user display | User name and role visible | Application shell test | Planned |
| UI-15 | UI Component | FR-05 | Logout UI behavior | Authenticated shell removed after successful logout | Application shell test | Planned |

---

# 20. IT Staff Queue UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-16 | UI Component | AC-07 | Queue renders realistic Ticket data | Ticket information displayed | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-17 | UI Component | AC-07 | Queue loading state | Loading feedback visible | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-18 | UI Component | AC-07 | Queue search control | Search input updates query behavior | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-19 | UI Component | AC-07 | Queue filter control | Selected filter affects query behavior | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-20 | UI Component | AC-07 | Queue sorting | Sort selection affects query behavior | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-21 | UI Component | AC-07 | Queue pagination | Page controls work | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-22 | UI Component | AC-07 | Queue empty state | Meaningful empty message shown | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-23 | UI Component | AC-07 | Queue no-results state | Search/filter no-results feedback shown | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-24 | UI Component | FR-15 | Queue forbidden response | Protected data hidden and forbidden feedback displayed | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-25 | UI Component | FR-15 | Queue API failure | Safe failure feedback shown | `client/.../lab-03/StaffTicketQueue.test.tsx` | Planned |

---

# 21. IT Staff Ticket Detail UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-26 | UI Component | FR-20 | Ticket Detail renders | Ticket data grouped clearly | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-27 | UI Component | AC-08 | Claim Ticket action | Claim request sent and owner updated after success | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-28 | UI Component | FR-22 | Reassign Ticket | Valid owner selection and update supported | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-29 | UI Component | AC-09 | IT Priority update | Editable IT Priority updates correctly | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-30 | UI Component | AC-10 | Status transition | Permitted status selection/update works | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-31 | UI Component | AC-11 | Public Comments | Comment list/form visible and functional | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-32 | UI Component | AC-12 | Internal Notes | Notes list/form visible to permitted role | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-33 | UI Style | AC-12 | Public Comments vs Internal Notes distinction | Sections clearly distinguish public/private communication | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-34 | Regression/UI | AC-18 | Existing Attachments on staff Ticket Detail | Attachment continuity preserved | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-35 | UI Component | FR-20 | Ticket Detail failure states | Loading/not-found/forbidden/failure feedback displayed appropriately | `client/.../lab-03/StaffTicketDetail.test.tsx` | Planned |

---

# 22. Requester Ticket Detail UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-36 | Regression/UI | AC-18 | Development Requester selector removed | Selector and Change Requester action absent | Requester regression test | Planned |
| UI-37 | UI Component | AC-11 | Requester Public Comments | Comment list and form available on owned Ticket | Requester Ticket Detail test | Planned |
| UI-38 | UI Component | FR-13 | Problem Appears Resolved action | Action visible and submits permitted request | Requester Ticket Detail test | Planned |
| UI-39 | UI Component | BR-06 | Requester formal resolve/close controls | Formal Resolved/Closed actions not available | Requester Ticket Detail test | Planned |
| UI-40 | Authorization/UI | AC-04 | Internal Notes on Requester screen | Internal Notes not displayed | Requester Ticket Detail test | Planned |

---

# 23. Administrator UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| UI-41 | UI Component | FR-28 | User Management list | Name, Email, Role, Status, Edit displayed | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-42 | UI Component | FR-29 | Search by name/email | User list updates correctly | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-43 | UI Component | FR-30 | Optional role filter | Matching roles displayed if filter implemented | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-44 | UI Component | AC-13 | Create User form | Required fields and one-role selection available | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-45 | UI Component | AC-14 | Duplicate email API response | Clear conflict feedback displayed | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-46 | UI Component | FR-32 | Edit user | Name/email/role/activation controls work | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-47 | UI Component | AC-15 | Self-deactivation rejection | Clear safe feedback displayed | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-48 | UI Component | AC-16 | Last Administrator rejection | Clear safe feedback displayed | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-49 | UI Component | AC-17 | Set new initial password | Action works and success feedback shown | `client/.../lab-03/UserManagement.test.tsx` | Planned |
| UI-50 | Authorization/UI | FR-28 | Non-Administrator accesses User Management | Forbidden UI shown; protected user data not displayed | `client/.../lab-03/UserManagement.test.tsx` | Planned |

---

# 24. Responsive and Visual Tests

These checks apply to:

- Login
- Change Password
- Requester Ticket Detail
- IT Staff Ticket Queue
- IT Staff Ticket Detail
- User Management

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Evidence | Final Status |
|---|---|---|---|---|---|---|
| VIS-01 | Responsive | UI Spec | Desktop layout | No clipping, overlap, or unreadable controls | Screenshot/manual checklist | Planned |
| VIS-02 | Responsive | UI Spec | Tablet layout | Layout remains usable | Screenshot/manual checklist | Planned |
| VIS-03 | Responsive | UI Spec | Mobile layout | Layout adapts without horizontal page overflow | Screenshot/manual checklist | Planned |
| VIS-04 | UI Style | UI Spec | Zen Green consistency | Existing design language preserved | Screenshot/manual checklist | Planned |
| VIS-05 | UI Style | UI Spec | Status/Priority/Role badges | Badges are consistent and readable | Screenshot/manual checklist | Planned |
| VIS-06 | UI Style | UI Spec | Editable vs read-only fields | Visual distinction is clear | Screenshot/manual checklist | Planned |
| VIS-07 | UI Style | UI Spec | Public Comments vs Internal Notes | Private/public distinction is clear | Screenshot/manual checklist | Planned |
| VIS-08 | UI Style | UI Spec | Validation placement | Validation appears near relevant controls | Screenshot/manual checklist | Planned |
| VIS-09 | Accessibility | UI Spec | Visible focus | Keyboard-focused controls show focus | Manual/component test | Planned |
| VIS-10 | Accessibility | UI Spec | Color independence | Important meaning is not communicated by color alone | Manual/component test | Planned |

---

# 25. End-to-End Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01 | Valid login | User reaches correct authenticated role shell | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-02 | Initial-password login and change | Normal app opens only after valid password change | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-03 | E2E | FR-02 | Invalid login | Safe failure shown and app remains protected | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-04 | E2E | AC-05 | Inactive account login | Access denied with safe feedback | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-05 | E2E | FR-05 | Login then logout | Protected app unavailable after logout | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-06 | E2E | AC-07 | IT Staff Queue workflow | Staff logs in, searches/filters Queue, opens Ticket Detail | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-07 | E2E | AC-08 | Claim Ticket flow | Staff claims an unassigned Ticket successfully | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-08 | E2E | AC-09 | IT Priority workflow | Staff updates IT Priority successfully | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-09 | E2E | AC-10 | Status workflow | Valid transition succeeds and invalid transition is blocked | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-10 | E2E | AC-11 | Public Comment workflow | Staff/Requester can post and view Public Comment | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-11 | E2E | AC-12 | Internal Note workflow | Staff creates Internal Note and Requester cannot see it | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-12 | E2E | FR-13 | Requester Problem Appears Resolved | Requester submits indication without formal Ticket closure | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-13 | E2E | AC-13 | Administrator creates user | New account appears with exactly one role | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-14 | E2E | FR-32 | Administrator edits user | Updated account information displayed | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-15 | E2E | AC-15 | Self-deactivation prevention | Administrator cannot deactivate own account | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-16 | E2E | AC-16 | Last Administrator protection | Final active Administrator cannot be deactivated | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-17 | E2E | AC-17 | Administrator sets initial password | User must change new initial password on next login | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-18 | E2E | AC-18 | Requester Lab 2 regression flow | Existing Requester Ticket/Attachment workflow remains functional | Appropriate Lab 3 E2E file | Planned |

---

# 26. Safe Failure Tests

The following failure categories must be exercised where meaningful:

- unauthenticated request;
- authenticated but forbidden request;
- validation error;
- missing resource;
- conflict;
- unexpected API failure.

Expected behavior:

- no stack trace is displayed;
- no password hash is exposed;
- no session/authentication secret is exposed;
- protected Ticket information is not leaked;
- protected Attachment information is not leaked;
- Internal Note content is not leaked to Requesters.

---

# 27. Acceptance Criteria Traceability Summary

| Acceptance Criterion | Planned Tests |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | API-11, API-12, API-16, UI-06, UI-09, E2E-02 |
| AC-03 | AUTH-07 |
| AC-04 | AUTH-03, NOTE-03, NOTE-04, UI-40 |
| AC-05 | API-04, UI-04, E2E-04 |
| AC-06 | AUTH-08, REG-02 |
| AC-07 | QUEUE-01 through QUEUE-11, UI-16 through UI-25, E2E-06 |
| AC-08 | DETAIL-02, UI-27, E2E-07 |
| AC-09 | DETAIL-06, UI-29, E2E-08 |
| AC-10 | DETAIL-08, DETAIL-09, UI-30, E2E-09 |
| AC-11 | COMMENT-01 through COMMENT-06, UI-31, UI-37, E2E-10 |
| AC-12 | NOTE-01 through NOTE-08, UI-32, UI-33, E2E-11 |
| AC-13 | ADMIN-05, UI-44, E2E-13 |
| AC-14 | ADMIN-06, UI-45 |
| AC-15 | ADMIN-13, UI-47, E2E-15 |
| AC-16 | ADMIN-14, UI-48, E2E-16 |
| AC-17 | ADMIN-15, UI-49, E2E-17 |
| AC-18 | REG-01 through REG-06, MIG-01 through MIG-06, UI-34, UI-36, E2E-18 |

Every Acceptance Criterion has at least one planned test.

---

# 28. Expected Lab 3 Test Structure

Planned backend test files:

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts
```

Additional unit or migration-specific test files may be added when needed to cover a defined requirement, acceptance criterion, migration rule, or regression case.

Planned frontend test files:

```text
client/.../lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx
```

Planned E2E files:

```text
e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

---

# 29. Final Verification

Before Sprint 3 is considered complete:

1. Run all backend unit tests.
2. Run all API/integration tests.
3. Run authorization/security tests.
4. Run Lab 2 regression tests.
5. Run frontend component tests.
6. Run E2E tests.
7. Verify migration behavior.
8. Verify seeded data.
9. Verify desktop responsive behavior.
10. Verify tablet responsive behavior.
11. Verify mobile responsive behavior.
12. Complete the visual checklist.
13. Update every planned test with its actual automated test path.
14. Update every test status to the final result.
15. Run the complete test suite from the final `main` branch.

The final submission evidence must show passing results from the final `main` branch.