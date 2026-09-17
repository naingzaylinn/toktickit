# Lab 3 Specification

## 1. Sprint Goal

Sprint 3 replaces the temporary Development Requester selector with real authentication and role-based access. The system will support Requester, IT Staff, and Administrator roles while preserving the completed Lab 2 Requester ticket and attachment functions.

## 2. Stakeholder Request

Users must sign in using an email address and password. Users with an initial password must change it before entering the normal application. Requesters continue to manage only their own tickets. IT Staff can manage operational ticket work through a shared queue and ticket detail screen. Administrators can manage user accounts through a simple User Management screen.

## 3. Scope

### Included
- Login and logout
- Current authenticated user retrieval
- Mandatory first-login password change
- Role-based navigation and server-side authorization
- Migration from Development Requester records to real User accounts
- Existing Requester ticket and attachment functions
- Requester Public Comments
- Requester “Problem Appears Resolved” action
- IT Staff Ticket Queue
- IT Staff Ticket Detail
- Ticket claiming and reassignment
- IT Priority updates
- Permitted ticket status changes
- Public Comments
- Internal Notes
- Administrator user listing
- User creation
- User editing
- One-role assignment
- Account activation and deactivation
- Setting a new initial password
- Regression testing for Lab 2 features

### Excluded
- Self-registration
- Email invitations
- Password-reset email
- Multi-factor authentication
- Social login
- Single sign-on
- Multiple roles per user
- User deletion
- Bulk user operations
- User import/export
- Departments or organizations
- Advanced account recovery
- SLA calculation
- Escalation rules
- Notification services
- Dashboards and KPI analytics
- Production cloud deployment
- Actions Taken by IT Staff

## 4. Functional Requirements

### Authentication and Authorization

- FR-01 The system shall allow an active user to log in using a valid email address and password.
- FR-02 The system shall reject invalid credentials using safe failure messages.
- FR-03 The system shall prevent inactive users from accessing the application.
- FR-04 The system shall require users with an initial password to change it before accessing normal application screens.
- FR-05 The system shall provide logout functionality that removes authenticated access.
- FR-06 The system shall provide the current authenticated user identity and role.
- FR-07 The backend shall enforce role-based authorization for all protected operations.
- FR-08 The frontend shall show navigation and actions appropriate to the authenticated role.

### Requester

- FR-09 A Requester shall create tickets using the authenticated user identity.
- FR-10 A Requester shall view and manage only tickets that they own.
- FR-11 A Requester shall access only attachments belonging to their own tickets.
- FR-12 A Requester shall post Public Comments on their own tickets.
- FR-13 A Requester shall indicate that a reported problem appears resolved.
- FR-14 A Requester shall not formally set a ticket to Resolved or Closed.

### IT Staff

- FR-15 IT Staff shall view the shared Ticket Queue.
- FR-16 The Ticket Queue shall support search.
- FR-17 The Ticket Queue shall support suitable filters.
- FR-18 The Ticket Queue shall support sorting.
- FR-19 The Ticket Queue shall support pagination.
- FR-20 IT Staff shall open Ticket Detail for permitted tickets.
- FR-21 IT Staff shall claim an unassigned ticket.
- FR-22 IT Staff shall assign or reassign ticket ownership.
- FR-23 IT Staff shall update IT Priority.
- FR-24 IT Staff shall perform permitted ticket status transitions.
- FR-25 IT Staff shall post Public Comments.
- FR-26 IT Staff shall create Internal Notes.
- FR-27 IT Staff shall view existing attachments.

### Administrator

- FR-28 An Administrator shall view the user list.
- FR-29 An Administrator shall search users by name or email.
- FR-30 An Administrator may filter users by role.
- FR-31 An Administrator shall create a user with one permitted role.
- FR-32 An Administrator shall edit a user's name, email, role, and activation state.
- FR-33 An Administrator shall set a new initial password for a user.
- FR-34 The system shall require a user to change a newly assigned initial password at the next login.
- FR-35 The system shall prevent duplicate user email addresses.
- FR-36 The system shall reject invalid role values.
- FR-37 The system shall prevent an Administrator from deactivating their own account.
- FR-38 The system shall prevent removal or deactivation of the last active Administrator.

## 5. Business Rules

- BR-01 Only an active user with valid credentials may authenticate.
- BR-02 A user marked as requiring a password change cannot enter the normal application until a valid new password is saved.
- BR-03 The authenticated user identity determines Requester ownership; a client-supplied requesterId must not override it.
- BR-04 Public Comments are visible to Requester, IT Staff, and Administrator.
- BR-05 Internal Notes are visible only to IT Staff and Administrator.
- BR-06 Requesters may indicate that a problem appears resolved but cannot formally set a ticket to Resolved or Closed.
- BR-07 Passwords must never be stored in plaintext.
- BR-08 Email addresses must be unique.
- BR-09 One user may have only one permitted role in Lab 3.
- BR-10 A Ticket may have zero or one primary Ticket Owner.
- BR-11 A Ticket Owner must be an active IT Staff or Administrator user.
- BR-12 Requested Priority remains the value submitted by the Requester.
- BR-13 IT Priority initially copies Requested Priority.
- BR-14 IT Priority may be changed only by IT Staff or Administrator.
- BR-15 Required ticket statuses are New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.
- BR-16 Public Comments are append-only.
- BR-17 Internal Notes are append-only.
- BR-18 Empty or whitespace-only Public Comments or Internal Notes shall be rejected.
- BR-19 Comment and Note authorship and creation time shall be generated by the backend.
- BR-20 The system shall use account deactivation instead of user deletion.
- BR-21 An Administrator shall not deactivate their own account.
- BR-22 The system shall always retain at least one active Administrator.
- BR-23 Passwords must contain 8 to 72 characters and include at least one letter and at least one number.
- BR-24 After 5 failed login attempts within 15 minutes for the same normalized email and client IP, further login attempts shall be temporarily rejected with HTTP 429 until the window expires.
- BR-25 Public Comments and Internal Notes are trimmed before validation and must contain between 1 and 2000 characters after trimming.
- BR-26 Authenticated sessions expire after 8 hours. Logout invalidates the server session and clears the session cookie.
- BR-27 The session cookie shall be HttpOnly and SameSite=Lax, and shall use Secure in production.
- BR-28 Administrators are permitted to access the staff Ticket Queue and Ticket Detail and may perform ownership, IT Priority, status, Public Comment, and Internal Note operations in addition to Administrator User Management.
- BR-29 The Requester Problem Appears Resolved action records problemAppearsResolvedAt and does not directly change Ticket status.

## 6. Authorization Summary

| Action | Requester | IT Staff | Administrator |
|---|---|---|---|
| Create requester ticket | Yes, own identity | No | No |
| View own requester tickets | Yes | No | No |
| Access another Requester's ticket | No | Yes | Yes |
| Access Staff Ticket Queue | No | Yes | Yes |
| Claim/reassign ticket | No | Yes | Yes |
| Change IT Priority | No | Yes | Yes |
| Perform permitted status transition | No | Yes | Yes |
| View/post Public Comments | Own tickets only | Yes | Yes |
| View/create Internal Notes | No | Yes | Yes |
| Indicate Problem Appears Resolved | Own tickets only | No | No |
| Manage users | No | No | Yes |

### Ticket Status Transition Matrix

The following transitions are permitted for IT Staff and Administrators:

| Current Status | Allowed Next Status |
|---|---|
| New | Open, In Progress, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Cancelled | Reopened |

Requesters cannot directly perform these status transitions.

The `Problem Appears Resolved` Requester action is separate from the formal status workflow and records `problemAppearsResolvedAt` without automatically changing Ticket status.

## 7. Data Changes

Sprint 3 will extend the Lab 2 PostgreSQL and Prisma model without deleting existing Ticket or Attachment data.

Required concepts:
- User
- Role
- activation state
- password hash
- password-change-required state
- Ticket Owner
- IT Priority
- Public Comment
- Internal Note
- additional ticket workflow fields

Existing Development Requester records will be migrated or evolved into User records while preserving existing ticket ownership.

Seed data shall include:
- at least four active Requesters
- at least one inactive Requester
- at least three active IT Staff
- at least one inactive IT Staff
- at least one active Administrator
- realistic tickets
- example Public Comments
- example Internal Notes

## 8. API Contract Summary

The REST API shall support:
- login
- logout
- current authenticated user
- mandatory password change
- existing authenticated Requester ticket and attachment functions
- IT Staff Ticket Queue
- Ticket Detail retrieval
- ticket claim/assign/reassign
- IT Priority update
- permitted ticket status update
- Public Comment create/retrieve
- Internal Note create/retrieve for permitted roles
- Administrator user list
- user search
- optional role filtering
- user creation
- user editing
- setting a new initial password

Exact endpoints, methods, request/response shapes, status codes, session/token behavior, validation, authorization, and safe error handling are defined in `api-spec.md`.

## 9. Acceptance Criteria

- AC-01 Given an active user with valid credentials, when login succeeds, then authenticated access is established and safe user identity and role data are returned.
- AC-02 Given a user who must change an initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.
- AC-03 Given an authenticated Requester, when the client sends another requesterId, then the backend continues to use the authenticated user identity.
- AC-04 Given a Requester, when an Internal Note endpoint is requested, then the request is rejected without exposing note content.
- AC-05 Given an inactive user, when valid credentials are submitted, then normal authenticated access is denied.
- AC-06 Given an authenticated Requester, when viewing tickets, then only owned tickets are available.
- AC-07 Given an IT Staff user, when viewing the Ticket Queue, then search, filters, sorting, and pagination work as specified.
- AC-08 Given an IT Staff user, when a ticket is unassigned, then the user may claim the ticket.
- AC-09 Given an IT Staff user, when updating IT Priority, then the new valid value is stored and displayed.
- AC-10 Given an unauthorized status transition, when submitted, then the backend rejects it.
- AC-11 Given valid Public Comment content, when submitted, then the backend records author and creation time.
- AC-12 Given valid Internal Note content from IT Staff, when submitted, then it is visible only to permitted roles.
- AC-13 Given an Administrator, when creating a valid user, then the account is created with exactly one permitted role.
- AC-14 Given an existing email address, when an Administrator attempts to create another user with the same email, then the request is rejected.
- AC-15 Given an Administrator editing their own account, when they attempt to deactivate themselves, then the operation is rejected.
- AC-16 Given only one active Administrator remains, when an operation would deactivate that account, then the operation is rejected.
- AC-17 Given a user receives a new initial password, when they next log in, then password change is required before normal access.
- AC-18 Given Lab 2 Requester functionality, when Sprint 3 is complete, then ticket and attachment regression tests continue to pass.

## 10. Product Definition of Done

Sprint 3 is complete only when:
- all Functional Requirements defined in this specification are implemented;
- all Business Rules defined in this specification are enforced;
- authentication and authorization are enforced by the backend
- Lab 2 Requester behavior remains functional
- migration preserves existing ticket and attachment data
- all required Lab 3 APIs are implemented
- all required Lab 3 screens are implemented
- Zen Green design remains consistent
- desktop, tablet, and mobile layouts are verified
- planned unit tests pass
- API/integration tests pass
- authorization/security tests pass
- UI tests pass
- regression tests pass
- E2E tests pass
- migration verification passes
- final evidence is captured from the main branch

## 11. Assumptions and Decisions

- A user has exactly one role in Lab 3.
- Existing Lab 2 Requester records will be migrated into the User model.
- Passwords will be securely hashed.
- Authentication/session implementation details will be finalized in `api-spec.md`.
- Public Comments and Internal Notes are append-only for Lab 3.
- User deletion is not supported; accounts are deactivated instead.
- Administrator and IT Staff responsibilities remain separate unless explicitly permitted in the authorization matrix.