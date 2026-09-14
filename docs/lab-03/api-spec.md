# Lab 3 API Specification

## 1. Purpose

This document defines the REST API contract for TokTickIT Lab 3.

Lab 3 extends the Lab 2 ticketing system with:

- user authentication;
- mandatory initial-password change;
- role-based authorization;
- authenticated Requester ownership;
- IT Staff Ticket Queue and Ticket Detail operations;
- Public Comments;
- Internal Notes;
- Administrator User Management; and
- migration from the temporary Development Requester model.

The backend is responsible for enforcing authentication, authorization, validation, ownership, and safe failure behavior.

Frontend visibility alone is not considered authorization.

---

## 2. Authentication Approach

TokTickIT Lab 3 uses server-managed authenticated sessions.

After successful login:

1. the backend verifies the user's email and password;
2. the backend verifies that the user is active;
3. a server-side authenticated session is created;
4. the browser receives a session cookie;
5. subsequent protected API requests use that authenticated session.

The client must never decide the authenticated user's identity by sending a `requesterId`.

### Authentication Decisions

- Authentication uses email and password.
- Email comparison is case-insensitive after normalization.
- Passwords are never stored in plaintext.
- Passwords are securely hashed before storage.
- Only active users may establish normal authenticated access.
- Users marked `mustChangePassword = true` are restricted to authentication, current-user, logout, and password-change operations until they successfully change their password.
- The server determines user identity and role from the authenticated session.
- Logout invalidates the server-side session.
- Authentication secrets and password hashes must never be returned by the API.

### Password Rules

All new passwords and Administrator-assigned initial passwords must:

- contain at least 8 characters;
- contain no more than 72 characters;
- contain at least one letter; and
- contain at least one number.

Password confirmation must exactly match the new password.

Passwords are securely hashed before database storage and are never stored or logged in plaintext.

### Login Attempt Protection

Login attempts are limited to 5 failed attempts within a 15-minute window for the same normalized email address and client IP.

Additional attempts during the active limit window return:

`429 Too Many Requests`

A successful login clears the applicable failed-attempt counter.

The system does not permanently lock user accounts because account unlocking is outside Lab 3 scope.

### Session Rules

Authenticated sessions expire after 8 hours.

The session cookie shall use:

- `HttpOnly`;
- `SameSite=Lax`; and
- `Secure` in production.

Logout destroys the server-side session and clears the browser session cookie.

For Lab 3, the frontend and backend operate as the same application origin.

`SameSite=Lax` is used as the primary CSRF mitigation for the session cookie.

Cross-origin credentialed requests are not permitted by the application configuration.

---

## 3. Roles

Each user has exactly one Lab 3 role.

Supported role values are:

```text
REQUESTER
IT_STAFF
ADMINISTRATOR
```

### Role Responsibilities

#### Requester

A Requester may:

- create tickets using their authenticated identity;
- view their own tickets;
- access attachments belonging to their own tickets;
- view and post Public Comments on their own tickets; and
- indicate that their problem appears resolved.

A Requester may not:

- access another Requester's private ticket;
- use the IT Staff Ticket Queue;
- claim or reassign tickets;
- change IT Priority;
- formally change ticket status;
- view or create Internal Notes; or
- use Administrator User Management.

#### IT Staff

IT Staff may:

- use the shared Ticket Queue;
- access staff Ticket Detail;
- view Requester information required for ticket handling;
- claim tickets;
- assign or reassign ticket ownership;
- update IT Priority;
- perform permitted ticket status transitions;
- view and post Public Comments;
- view and create Internal Notes; and
- view ticket attachments.

IT Staff may not use Administrator User Management.

#### Administrator

Administrators may:

- access the staff Ticket Queue;
- access staff Ticket Detail;
- claim, assign, and reassign tickets;
- change IT Priority;
- perform permitted ticket status transitions;
- view and post Public Comments;
- view and create Internal Notes;
- view ticket attachments; and
- use Administrator User Management.

Administrator User Management includes:

- listing users;
- searching users;
- filtering users by role;
- creating users;
- editing permitted user fields;
- activating and deactivating accounts;
- assigning exactly one role; and
- setting a new initial password.

---

## 4. Common API Conventions

API responses use JSON unless an existing Lab 2 attachment endpoint requires binary/file content.

### Successful Response

A successful response may use:

```json
{
  "data": {}
}
```

Collection endpoints may additionally return metadata.

Example:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

### Error Response

Errors use a safe structure such as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": {
      "email": "A valid email address is required."
    }
  }
}
```

The API must not expose:

- stack traces;
- password hashes;
- session secrets;
- database connection details;
- Internal Note content to unauthorized users; or
- unnecessary information about protected resources.

---

## 5. HTTP Status Code Rules

The API uses the following status codes consistently.

| Status | Meaning |
|---|---|
| `200 OK` | Successful read or update |
| `201 Created` | Successful resource creation |
| `204 No Content` | Successful operation with no response body where appropriate |
| `400 Bad Request` | Invalid request or validation failure |
| `401 Unauthorized` | Authentication required or invalid authenticated session |
| `403 Forbidden` | Authenticated user is not permitted to perform the operation |
| `404 Not Found` | Resource does not exist or must not be exposed to the caller |
| `409 Conflict` | Resource state conflicts with the requested operation |
| `429 Too Many Requests` | Login-attempt limit exceeded |
| `500 Internal Server Error` | Unexpected server failure using a safe response |

---

# 6. Authentication API

## 6.1 Login

### `POST /api/auth/login`

Authenticates a user using email and password.

### Request

```json
{
  "email": "requester1@example.com",
  "password": "Initial123"
}
```

### Successful Response

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "name": "Requester One",
      "email": "requester1@example.com",
      "role": "REQUESTER",
      "isActive": true,
      "mustChangePassword": false
    }
  }
}
```

### Rules

- Email is required.
- Password is required.
- Email is normalized before lookup.
- Authentication fails if credentials are invalid.
- Inactive users cannot establish normal application access.
- Password hashes are never returned.
- A successful login creates an authenticated server-side session.
- A user with `mustChangePassword = true` may authenticate but remains restricted until password change succeeds.
- Five failed login attempts within 15 minutes for the same normalized email and client IP trigger temporary rate limiting.
- Further attempts during that window return `429 Too Many Requests`.
- Successful login clears the relevant failed-attempt counter.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `429 Too Many Requests`
- `500 Internal Server Error`

---

## 6.2 Logout

### `POST /api/auth/logout`

Ends the current authenticated session.

### Successful Response

```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```

### Rules

- The server-side session is invalidated.
- The browser session cookie is cleared.
- Protected requests after logout must fail authentication.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `500 Internal Server Error`

---

## 6.3 Current User

### `GET /api/auth/me`

Returns safe information about the authenticated user.

### Successful Response

```json
{
  "data": {
    "id": "user-id",
    "name": "Requester One",
    "email": "requester1@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": false
  }
}
```

### Rules

- Authentication is required.
- Password data is never returned.
- The returned role is the authoritative role for frontend navigation.
- A user requiring password change may still call this endpoint.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `500 Internal Server Error`

---

## 6.4 Change Password

### `POST /api/auth/change-password`

Changes the authenticated user's password.

### Request

```json
{
  "currentPassword": "Initial123",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

### Rules

- Authentication is required.
- The current password must be correct.
- `newPassword` and `confirmPassword` must match.
- The new password must contain 8 to 72 characters.
- The new password must include at least one letter.
- The new password must include at least one number.
- The new password must be securely hashed before storage.
- On success, `mustChangePassword` becomes `false`.
- Plaintext passwords must never be logged.
- The authenticated session remains valid after successful password change.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `500 Internal Server Error`

---

# 7. Requester Ticket API

Existing Lab 2 Requester ticket functionality remains available but now uses authenticated identity.

## 7.1 List Requester Tickets

### `GET /api/tickets`

Returns tickets belonging to the authenticated Requester.

### Rules

- Authentication is required.
- A Requester receives only tickets they own.
- Client-supplied requester identity is ignored.
- IT Staff and Administrators use the staff Ticket Queue for shared ticket access.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

---

## 7.2 Create Ticket

### `POST /api/tickets`

Creates a ticket using the authenticated Requester identity.

Existing Lab 2 request fields remain in use.

### Rules

- Authentication is required.
- Requester identity comes from the authenticated session.
- A client-supplied `requesterId` must not override authenticated identity.
- Requested Priority remains the Requester's submitted value.
- Initial IT Priority copies Requested Priority.
- Existing Lab 2 validation rules remain active unless explicitly changed by the Lab 3 contract.

### Possible Responses

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

---

## 7.3 Get Requester Ticket Detail

### `GET /api/tickets/:ticketId`

Returns Ticket Detail for the authenticated Requester.

### Requester Rule

A Requester may access only a ticket that belongs to their authenticated user account.

Unauthorized users must not receive protected ticket information.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 8. Attachment API Continuity

Existing Lab 2 attachment routes remain in use where possible.

### Rules

- Authentication is required.
- A Requester may access attachments only for their own tickets.
- IT Staff and Administrators may access attachments through permitted staff ticket access.
- Existing attachment validation remains active.
- Migration must preserve existing Ticket and Attachment relationships.
- Protected attachment information must not be leaked through authorization failures.

---

# 9. IT Staff Ticket Queue API

## 9.1 Retrieve Ticket Queue

### `GET /api/staff/tickets`

Returns the shared Ticket Queue.

### Authorized Roles

- `IT_STAFF`
- `ADMINISTRATOR`

### Supported Query Parameters

Example:

```text
/api/staff/tickets?search=printer&status=OPEN&itPriority=HIGH&page=1&pageSize=20&sort=updatedAt&order=desc
```

Supported parameters:

- `search`
- `status`
- `requestedPriority`
- `itPriority`
- `owner`
- `sort`
- `order`
- `page`
- `pageSize`

### Search

The `search` parameter performs a case-insensitive search across:

- Ticket Number;
- Summary;
- Requester Name; and
- Requester Email.

### Filters

Supported filters include:

- ticket status;
- Requested Priority;
- IT Priority; and
- ownership.

The ownership filter may support:

```text
assigned
unassigned
<user-id>
```

Invalid filter values return `400 Bad Request`.

### Sorting

Supported sort fields are:

- `ticketNumber`
- `createdAt`
- `updatedAt`
- `status`
- `requestedPriority`
- `itPriority`

Supported order values are:

- `asc`
- `desc`

Default sorting is:

```text
updatedAt desc
```

### Pagination

Default page:

```text
1
```

Default page size:

```text
20
```

Allowed page sizes are:

- `10`
- `20`
- `50`

`page` must be an integer greater than or equal to 1.

Unsupported page sizes or invalid page numbers return `400 Bad Request`.

### Successful Response

```json
{
  "data": [
    {
      "id": "ticket-id",
      "ticketNumber": "TKT-0001",
      "summary": "Cannot connect to Wi-Fi",
      "category": {
        "id": "category-id",
        "name": "Network"
      },
      "requester": {
        "id": "user-id",
        "name": "Requester One",
        "email": "requester1@example.com"
      },
      "requestedPriority": "HIGH",
      "itPriority": "HIGH",
      "status": "OPEN",
      "owner": null,
      "createdAt": "2026-09-14T10:00:00.000Z",
      "updatedAt": "2026-09-14T11:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### Rules

- Authentication is required.
- Requesters cannot access this endpoint.
- Search, filtering, sorting, and pagination are processed by the backend.
- Invalid query values return safe validation responses.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

---

# 10. IT Staff Ticket Detail API

## 10.1 Retrieve Ticket Detail

### `GET /api/staff/tickets/:ticketId`

Returns detailed information required by IT Staff or Administrator.

The response may include:

- Ticket Number;
- Summary;
- Description;
- Requester information;
- Category;
- System;
- Requested Priority;
- IT Priority;
- Status;
- current Ticket Owner;
- attachments;
- Public Comments;
- Internal Notes;
- `problemAppearsResolvedAt`;
- created time; and
- updated time.

### Authorized Roles

- `IT_STAFF`
- `ADMINISTRATOR`

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 11. Ticket Ownership API

## 11.1 Claim, Assign, or Reassign Ticket

### `PATCH /api/staff/tickets/:ticketId/owner`

Updates the primary Ticket Owner.

### Request

Assign or reassign:

```json
{
  "ownerId": "staff-user-id"
}
```

Unassign:

```json
{
  "ownerId": null
}
```

### Rules

- Authentication is required.
- Only IT Staff and Administrators may use this endpoint.
- A Ticket may have zero or one primary owner.
- A Ticket Owner must be an active `IT_STAFF` or `ADMINISTRATOR` user.
- Inactive users cannot be assigned.
- Requesters cannot update ownership.
- Setting the authenticated IT Staff or Administrator as owner constitutes claiming the ticket.
- Invalid owner IDs are rejected safely.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

---

# 12. IT Priority API

## 12.1 Update IT Priority

### `PATCH /api/staff/tickets/:ticketId/priority`

Updates IT Priority.

### Request

```json
{
  "itPriority": "HIGH"
}
```

### Rules

- Authentication is required.
- Only IT Staff and Administrators may update IT Priority.
- Requested Priority remains unchanged.
- IT Priority initially copies Requested Priority when the Ticket is created or migrated.
- The value must match the application's permitted Priority values.
- Requesters cannot modify IT Priority.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 13. Ticket Status API

## 13.1 Update Ticket Status

### `PATCH /api/staff/tickets/:ticketId/status`

Updates Ticket status.

### Request

```json
{
  "status": "IN_PROGRESS"
}
```

### Required Status Values

The API supports the following conceptual statuses:

- New
- Open
- In Progress
- Waiting for Requester
- Resolved
- Closed
- Reopened
- Cancelled

Implementation enum values may use:

```text
NEW
OPEN
IN_PROGRESS
WAITING_FOR_REQUESTER
RESOLVED
CLOSED
REOPENED
CANCELLED
```

### Status Transition Matrix

IT Staff and Administrators may perform these transitions:

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

### Rules

- Authentication is required.
- Only IT Staff and Administrators may formally update Ticket status.
- The requested transition must appear in the transition matrix.
- Invalid transitions return `409 Conflict`.
- Invalid status values return `400 Bad Request`.
- Requesters cannot directly set `RESOLVED`, `CLOSED`, or any other formal Ticket status.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

---

# 14. Problem Appears Resolved API

## 14.1 Requester Resolution Indication

### `POST /api/tickets/:ticketId/problem-appears-resolved`

Allows the owning Requester to indicate that the reported problem appears resolved.

### Successful Response

```json
{
  "data": {
    "ticketId": "ticket-id",
    "problemAppearsResolvedAt": "2026-09-14T12:00:00.000Z"
  }
}
```

### Rules

- Authentication is required.
- The authenticated user must be the Requester who owns the Ticket.
- The backend records the current time in `problemAppearsResolvedAt`.
- The action does not change the formal Ticket status.
- The action does not set the Ticket to `RESOLVED` or `CLOSED`.
- IT Staff or Administrator remains responsible for formal status transitions.
- If the indication has already been recorded, the API returns `409 Conflict`.
- Requesters cannot perform this action on another Requester's Ticket.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

---

# 15. Public Comments API

Public Comments are visible to permitted Requesters, IT Staff, and Administrators.

Public Comments are append-only.

## 15.1 Retrieve Public Comments

### `GET /api/tickets/:ticketId/comments`

Returns Public Comments in creation order.

### Rules

- Authentication is required.
- A Requester may retrieve comments only for their own Ticket.
- IT Staff and Administrators may retrieve comments for tickets they are permitted to access.
- Each comment includes backend-generated author information and creation time.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

## 15.2 Create Public Comment

### `POST /api/tickets/:ticketId/comments`

### Request

```json
{
  "content": "The issue is still happening after restarting."
}
```

### Rules

- Authentication is required.
- Requesters may comment only on their own tickets.
- IT Staff and Administrators may comment on staff-accessible tickets.
- Content is trimmed before validation.
- Content must contain between 1 and 2000 characters after trimming.
- Empty or whitespace-only content is rejected.
- Author identity is generated from the authenticated session.
- Creation time is generated by the backend.
- Public Comments are append-only.
- Edit and delete operations are outside Lab 3 scope.
- Content must be safely rendered by the client.

### Successful Response

```json
{
  "data": {
    "id": "comment-id",
    "ticketId": "ticket-id",
    "content": "The issue is still happening after restarting.",
    "author": {
      "id": "user-id",
      "name": "Requester One",
      "role": "REQUESTER"
    },
    "createdAt": "2026-09-14T12:30:00.000Z"
  }
}
```

### Possible Responses

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 16. Internal Notes API

Internal Notes are private staff communication.

Only IT Staff and Administrators may access them.

Internal Notes are append-only.

## 16.1 Retrieve Internal Notes

### `GET /api/staff/tickets/:ticketId/notes`

### Authorized Roles

- `IT_STAFF`
- `ADMINISTRATOR`

### Rules

- Authentication is required.
- Requesters must receive no Internal Note content.
- Each Note includes backend-generated author information and creation time.
- Notes are returned in creation order.

### Possible Responses

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

## 16.2 Create Internal Note

### `POST /api/staff/tickets/:ticketId/notes`

### Request

```json
{
  "content": "Checked the access point logs. No hardware failure detected."
}
```

### Rules

- Authentication is required.
- Only IT Staff and Administrators may create Internal Notes.
- Content is trimmed before validation.
- Content must contain between 1 and 2000 characters after trimming.
- Empty or whitespace-only content is rejected.
- Author identity is generated from the authenticated session.
- Creation time is generated by the backend.
- Internal Notes are append-only.
- Edit and delete operations are outside Lab 3 scope.
- Content must be safely rendered by the client.

### Successful Response

```json
{
  "data": {
    "id": "note-id",
    "ticketId": "ticket-id",
    "content": "Checked the access point logs. No hardware failure detected.",
    "author": {
      "id": "staff-user-id",
      "name": "IT Staff One",
      "role": "IT_STAFF"
    },
    "createdAt": "2026-09-14T12:45:00.000Z"
  }
}
```

### Possible Responses

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 17. Administrator User Management API

All endpoints in this section require the `ADMINISTRATOR` role.

## 17.1 Retrieve User List

### `GET /api/admin/users`

Returns users for the User Management screen.

### Supported Query Parameters

```text
search
role
```

Example:

```text
/api/admin/users?search=alice&role=REQUESTER
```

### Search Behavior

`search` performs a case-insensitive match against:

- user name; and
- email address.

### Role Filter

Accepted role values are:

```text
REQUESTER
IT_STAFF
ADMINISTRATOR
```

### Successful Response

```json
{
  "data": [
    {
      "id": "user-id",
      "name": "Alice Example",
      "email": "alice@example.com",
      "role": "REQUESTER",
      "isActive": true,
      "mustChangePassword": false
    }
  ]
}
```

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

---

## 17.2 Create User

### `POST /api/admin/users`

Creates a user with exactly one role.

### Request

```json
{
  "name": "New User",
  "email": "newuser@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "initialPassword": "Initial123"
}
```

### Rules

- Name is required.
- Email is required and must be valid.
- Email must be unique after normalization.
- Exactly one valid role is required.
- Supported roles are `REQUESTER`, `IT_STAFF`, and `ADMINISTRATOR`.
- `isActive` must be boolean.
- The initial password must contain 8 to 72 characters.
- The initial password must contain at least one letter and one number.
- The initial password is securely hashed.
- `mustChangePassword` is set to `true`.
- Password hashes and plaintext passwords are not returned.

### Successful Response

```json
{
  "data": {
    "id": "new-user-id",
    "name": "New User",
    "email": "newuser@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": true
  }
}
```

### Possible Responses

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `409 Conflict`
- `500 Internal Server Error`

Duplicate email returns:

`409 Conflict`

---

## 17.3 Update User

### `PATCH /api/admin/users/:userId`

Updates permitted user fields.

### Example Request

```json
{
  "name": "Updated User",
  "email": "updated@example.com",
  "role": "IT_STAFF",
  "isActive": true
}
```

### Editable Fields

- `name`
- `email`
- `role`
- `isActive`

### Rules

- Authentication and Administrator role are required.
- Email must remain unique.
- Exactly one permitted role must be stored.
- The current Administrator cannot deactivate their own account.
- An update must not result in zero active Administrators.
- User deactivation is used instead of deletion.
- User deletion is outside Lab 3 scope.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

---

## 17.4 Set New Initial Password

### `POST /api/admin/users/:userId/initial-password`

Allows an Administrator to set a new initial password for another user.

### Request

```json
{
  "initialPassword": "ResetPass123"
}
```

### Rules

- Authentication and Administrator role are required.
- The target user must exist.
- The initial password must contain 8 to 72 characters.
- The initial password must contain at least one letter and at least one number.
- The password is securely hashed before storage.
- `mustChangePassword` becomes `true`.
- The target user must change the password at their next successful login before entering the normal application.
- The plaintext password must not be logged.
- Email-based password reset or invitation workflows are outside Lab 3 scope.

### Possible Responses

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

---

# 18. Authorization Rules

Backend authorization is mandatory.

Hiding a button or navigation item in the frontend is not sufficient authorization.

## Requester

A Requester may:

- create tickets using authenticated identity;
- view their own tickets;
- access their own ticket attachments;
- view/post Public Comments on their own tickets; and
- indicate Problem Appears Resolved on their own tickets.

A Requester may not:

- access another Requester's ticket;
- use the staff Ticket Queue;
- claim/reassign tickets;
- change IT Priority;
- formally change status;
- access Internal Notes; or
- use User Management.

## IT Staff

IT Staff may:

- use the staff Ticket Queue;
- view staff Ticket Detail;
- claim/reassign ownership;
- change IT Priority;
- perform permitted status transitions;
- view/post Public Comments;
- view/create Internal Notes; and
- view attachments.

IT Staff may not access Administrator User Management.

## Administrator

Administrators may:

- perform permitted staff Ticket Queue and Ticket Detail operations;
- claim/reassign ownership;
- change IT Priority;
- perform permitted status transitions;
- view/post Public Comments;
- view/create Internal Notes;
- view attachments; and
- perform Administrator User Management operations.

Administrators remain subject to:

- self-deactivation prevention; and
- last-active-Administrator protection.

---

# 19. Safe Resource Handling

The API must avoid unnecessary information disclosure.

Examples:

- A Requester attempting to access another user's Ticket must not receive the protected Ticket body.
- A Requester attempting to access Internal Notes must not receive Note content.
- Attachment authorization failures must not expose protected attachment metadata.
- Authentication failures must not expose password hashes or implementation secrets.
- Unexpected errors must return safe generic messages rather than stack traces.

The implementation may use `403 Forbidden` or `404 Not Found` where appropriate to prevent protected resource disclosure, provided behavior is consistent and tested.

---

# 20. Validation Rules

General API validation includes:

- required fields;
- valid email format;
- normalized unique email;
- exactly one valid role;
- boolean activation values;
- valid ticket status values;
- valid status transitions;
- valid Priority values;
- valid ownership targets;
- valid pagination values;
- valid sort values;
- Public Comment length;
- Internal Note length;
- password rules; and
- password confirmation.

Invalid input returns `400 Bad Request`, except where a state conflict is more accurately represented by `409 Conflict`.

---

# 21. Public Comment and Internal Note Content

Public Comment and Internal Note content follows these rules:

- input is treated as plain text;
- content is trimmed before validation;
- content must contain at least 1 character after trimming;
- content must contain no more than 2000 characters after trimming;
- whitespace-only content is invalid;
- author is determined by the backend;
- creation time is generated by the backend;
- content is append-only;
- editing is not supported in Lab 3;
- deletion is not supported in Lab 3; and
- client rendering must not execute submitted content as HTML or script.

---

# 22. Queue Query Decisions

The Ticket Queue uses the following fixed decisions.

### Search Fields

- Ticket Number
- Summary
- Requester Name
- Requester Email

### Filters

- Status
- Requested Priority
- IT Priority
- Owner/assignment

### Sort Fields

- Ticket Number
- Created At
- Updated At
- Status
- Requested Priority
- IT Priority

### Default Sort

```text
updatedAt desc
```

### Pagination

Default:

```text
page = 1
pageSize = 20
```

Allowed page sizes:

```text
10
20
50
```

The response includes:

- current page;
- page size;
- total item count; and
- total page count.

---

# 23. Lab 2 Compatibility

Lab 3 must preserve functioning Lab 2 behavior unless explicitly changed by the Lab 3 contract.

This includes:

- Categories;
- Systems;
- Tickets;
- Attachments;
- Requester ticket creation;
- Requester ticket listing;
- Requester Ticket Detail;
- attachment upload/retrieval; and
- existing validated reference data.

The temporary Development Requester selector is removed.

Requester ownership now comes from the authenticated User.

Existing Lab 2 Ticket and Attachment records must survive migration.

---

# 24. Security Requirements

The Lab 3 API shall enforce the following:

- passwords are never stored in plaintext;
- password hashes are never sent to the client;
- authentication is enforced on protected endpoints;
- authorization is enforced by the backend;
- session cookies are `HttpOnly`;
- session cookies use `SameSite=Lax`;
- production session cookies use `Secure`;
- sessions expire after 8 hours;
- logout invalidates the server-side session;
- login attempts are rate-limited after 5 failed attempts in 15 minutes for the same normalized email and client IP;
- requester ownership comes from authenticated identity;
- users requiring initial password change cannot access normal application functions;
- Internal Notes are never exposed to Requesters;
- safe validation and failure responses are used;
- submitted Comment/Note content is rendered safely; and
- secrets are not stored in frontend source code.

---

# 25. Out-of-Scope API Features

Lab 3 does not implement:

- MFA;
- social login;
- SSO;
- self-registration;
- account unlocking workflow;
- email invitations;
- email password reset;
- Actions Taken;
- SLA management;
- escalation;
- notification systems;
- dashboards;
- KPI APIs;
- multi-tenant behavior;
- production deployment automation;
- multiple roles per user;
- user deletion;
- bulk user operations;
- import/export;
- user history/audit screens;
- extended user profiles; or
- advanced user-list features outside the defined Lab 3 contract.

---

# 26. API Definition of Done

The Lab 3 API contract is complete when:

- login works for valid active users;
- invalid credentials fail safely;
- inactive users cannot gain normal authenticated access;
- mandatory initial-password change is enforced;
- logout invalidates authenticated access;
- current-user identity and role are available;
- Requester ownership uses authenticated identity;
- Lab 2 Requester functionality continues to work;
- Ticket Queue search, filtering, sorting, and pagination work;
- IT Staff and Administrators can access permitted Ticket Detail operations;
- ownership rules are enforced;
- Requested Priority and IT Priority remain separate;
- permitted status transitions are enforced;
- Requesters cannot formally resolve or close tickets;
- Problem Appears Resolved records `problemAppearsResolvedAt` without changing formal status;
- Public Comments follow visibility and validation rules;
- Internal Notes remain private to IT Staff and Administrators;
- Administrator User Management works;
- duplicate emails are rejected with `409 Conflict`;
- self-deactivation is rejected;
- the last active Administrator is protected;
- Administrator-assigned initial passwords require next-login password change;
- migration preserves existing Lab 2 data;
- backend authorization tests pass;
- API/integration tests pass; and
- the final implementation remains consistent with `specification.md`, `ui-spec.md`, and `tests.md`.