# Lab 3 UI Specification

## 1. Purpose

This document defines the user-interface behavior for TokTickIT Sprint 3.

Sprint 3 extends the Zen Green design language from Lab 2 and introduces authenticated application behavior for three roles:

- Requester
- IT Staff
- Administrator

The new screens must look and behave like part of the existing TokTickIT application rather than a separate visual system.

---

## 2. Shared Application Shell

The application shell is visible after successful authentication and any required initial password change.

### Header / Navigation Requirements

The application shell shall:

- display the authenticated user's name;
- display the authenticated user's role;
- provide a Logout action;
- show only navigation destinations permitted for the current role;
- hide unauthorized navigation items;
- preserve the Zen Green visual style from Lab 2;
- remain responsive across desktop, tablet, and mobile sizes.

### Role-Based Navigation

#### Requester

Requester navigation may include:

- Create Ticket
- My Tickets
- permitted profile/password action
- Logout

Requester navigation must not display:

- IT Staff Ticket Queue
- Internal Notes
- Administrator User Management

#### IT Staff

IT Staff navigation may include:

- Ticket Queue
- permitted Ticket Detail navigation
- permitted profile/password action
- Logout

IT Staff navigation must not display Administrator User Management unless explicitly allowed by the approved authorization contract.

#### Administrator

#### Administrator

Administrator navigation includes:

- Ticket Queue
- User Management
- permitted profile/password action
- Logout

Administrator and IT Staff responsibilities remain conceptually separate.

The UI must not assume that Administrator users automatically receive all IT Staff navigation.

---

# 3. Shared Visual Rules

Sprint 3 reuses the Zen Green design language established in Lab 2.

The existing design should be reused for:

- typography;
- spacing;
- form controls;
- buttons;
- cards;
- badges;
- validation messages;
- loading states;
- empty states;
- success feedback;
- error feedback;
- responsive layout; and
- accessibility behavior.

New Lab 3 screens must use the same visual conventions.

---

## 4. Badge Rules

Consistent badges shall be used for:

- Ticket Status;
- Requested Priority;
- IT Priority; and
- User Role.

Badges should be easy to identify without relying only on color.

Text labels must always remain visible.

Example concepts:

- `New`
- `In Progress`
- `Resolved`
- `High`
- `Requester`
- `IT Staff`
- `Administrator`

The exact visual colors follow the existing Zen Green theme and approved design tokens.

---

## 5. Editable and Read-Only Fields

Editable fields must be visually distinguishable from read-only information.

Examples of read-only information include:

- Ticket Number;
- original Requested Priority when viewed by IT Staff;
- Requester identity where not editable;
- backend-generated creation time;
- comment author;
- note author.

Editable fields should use normal form controls and clear labels.

Disabled controls must not be used as a substitute for backend authorization.

---

# 6. Login Screen

## Purpose

The Login screen allows a user to authenticate using an email address and password.

## Required Controls

The screen shall contain:

- Email field
- Password field
- Login button

The screen may also contain:

- application title/logo;
- short login instruction.

## Validation

The UI shall validate:

- email is present;
- password is present;
- email format where appropriate.

Validation messages should appear close to the relevant field.

## Screen Modes

### Initial

- Form fields are empty.
- Login button is available.

### Busy

While login is being processed:

- the Login button shows a busy state;
- duplicate submission is prevented;
- the UI indicates that authentication is in progress.

### Invalid Input

If fields are invalid:

- field-level validation is shown;
- the API request should not be sent until basic client validation passes.

### Invalid Login

When authentication fails:

- a safe error message is shown;
- the message must not expose unnecessary account information;
- the password field may be cleared.

### Inactive Account

If access is denied because the account is inactive:

- the user receives clear but safe feedback;
- unnecessary account details are not exposed.

### Successful Login

After successful login:

- if `mustChangePassword` is false, the user enters the permitted application shell;
- if `mustChangePassword` is true, the user is redirected to the mandatory Change Password screen.

---

# 7. Mandatory Change Password Screen

## Purpose

Users with an initial password must choose a new password before accessing normal application screens.

## Required Controls

The screen shall contain:

- Current Password
- New Password
- Confirm New Password
- Save / Change Password button

## Rules

- normal application navigation is unavailable until password change succeeds;
- new password must satisfy 8–72 characters with at least one letter and one number;
- confirmation must match;
- errors are shown near the relevant controls;
- password values must not remain visible after successful submission.

## Screen Modes

### Initial

The user sees the password-change form and cannot enter normal application screens.

### Validation Error

Examples:

- missing current password;
- invalid new password;
- password confirmation mismatch.

### Busy

- save action is disabled or protected against duplicate submission;
- saving indicator is shown.

### Failure

- safe API failure feedback is shown;
- the user remains on the password-change screen.

### Success

After successful password change:

- success feedback is shown where meaningful;
- normal application access becomes available;
- the user enters the application shell for their role.

---

# 8. Logout Behavior

The authenticated application shell shall provide a visible Logout action.

When Logout succeeds:

- authenticated access is removed;
- the user returns to the Login screen;
- direct navigation to protected screens must no longer expose protected content.

If logout fails unexpectedly:

- safe failure feedback is shown.

Frontend navigation alone is not considered sufficient security.

---

# 9. Requester Screens

Lab 2 Requester functionality must continue to work using the authenticated Requester identity.

The Development Requester selector and Change Requester action must be removed.

Existing Requester screens include:

- Create Ticket
- My Tickets
- Ticket Detail
- Attachment behavior

Requester ownership is determined by the authenticated User.

---

## 10. Requester Ticket Detail Additions

The existing Requester Ticket Detail screen shall add:

- Public Comments;
- a `Problem Appears Resolved` action.

Existing Ticket information and Attachments remain available.

### Public Comments Section

The section shall show:

- comment content;
- author;
- creation time.

The Requester may create a new Public Comment.

The comment form shall include:

- comment text area;
- Submit Comment button.

### Comment Validation

The UI shall reject:

- empty content;
- whitespace-only content;
- content exceeding the 2000-character maximum after trimming.

### Comment States

- loading existing comments;
- no comments;
- posting comment;
- successful post;
- validation error;
- safe API failure.

---

## 11. Problem Appears Resolved Action

The Requester Ticket Detail screen shall provide a `Problem Appears Resolved` action.

When submitted successfully:

- the backend records `problemAppearsResolvedAt`;
- the formal Ticket status does not change;
- the Requester does not gain permission to set `RESOLVED` or `CLOSED`; and
- success feedback is displayed.

Where confirmation is required by the approved workflow, the UI shall show a clear confirmation before sending the action.

---

# 12. IT Staff Ticket Queue

## Purpose

The Ticket Queue helps IT Staff locate and prioritize support work.

The Queue must provide:

- search;
- suitable filters;
- sorting;
- pagination;
- Ticket ownership information;
- status information;
- priority information;
- action to open Ticket Detail.

---

## 13. Ticket Queue Desktop Layout

The desktop version should use a readable table.

The final set of displayed columns should avoid an unreadable mega-grid.

Recommended fields include:

- Ticket Number
- Created Date
- Summary
- Category
- Requested Priority
- IT Priority
- Current Status
- Ticket Owner
- Last Updated
- Open / Detail action

The exact set may be adjusted during implementation if necessary for readability.

---

## 14. Ticket Queue Search

The Queue shall provide a search control.

The search UI shall:

- clearly identify the search purpose;
- allow the user to enter supported Ticket search text;
- show updated results after search;
- provide a way to clear the search.

No-results feedback must be visually distinct from system failure feedback.

---

## 15. Ticket Queue Filters

Suitable filters may include:

- Ticket Status;
- Requested Priority;
- IT Priority;
- Ticket Owner / assigned state.

The final filters must match the API contract.

Filters shall:

- be clearly labeled;
- show current selections;
- allow the user to reset or clear filters where meaningful.

---

## 16. Ticket Queue Sorting

Sorting shall support the ticketNumber, createdAt, updatedAt, status, requestedPriority, and itPriority.

The UI shall make the active sort field and direction understandable.

The default ordering is based on the API contract.

---

## 17. Ticket Queue Pagination

The Queue shall provide pagination when multiple pages exist.

The UI shall provide:

- current page;
- next/previous actions or equivalent controls;
- disabled states where movement is unavailable.

Pagination state shall stay consistent with active search, filter, and sorting selections.

---

## 18. Ticket Queue States

### Loading

A visible loading state appears while Queue data is being retrieved.

### Normal

Ticket records are shown with clear actions.

### Empty

If no Ticket records exist, the UI displays a meaningful empty-state message.

### No Results

If search/filter conditions return no matches, the UI displays a no-results message and provides a practical way to change or clear the query.

### Forbidden

If the authenticated user lacks permission:

- protected queue content is not displayed;
- safe forbidden feedback is shown.

### Failure

Unexpected API failures show safe feedback without exposing server details.

---

# 19. Ticket Queue Responsive Behavior

## Desktop

- table layout may be used;
- primary Ticket information remains visible;
- controls are arranged efficiently.

## Tablet

- the table may reduce lower-priority columns;
- search and filter controls may wrap;
- important actions remain easy to access.

## Mobile

The Queue may use a card/list representation instead of a wide table.

Each mobile Ticket item should show the most important information, such as:

- Ticket Number;
- Summary;
- Status;
- IT Priority;
- Owner;
- Open Detail action.

Horizontal page overflow must be avoided.

---

# 20. IT Staff Ticket Detail

## Purpose

The IT Staff Ticket Detail screen extends the Ticket screen from Lab 2 with operational support controls.

The screen must provide:

- Ticket information;
- Ticket ownership;
- Requested Priority;
- IT Priority;
- permitted status changes;
- Public Comments;
- Internal Notes;
- existing Attachments;
- role-specific actions.

---

## 21. Ticket Detail Information Grouping

Ticket information shall be grouped clearly.

Suggested sections include:

### Ticket Summary

- Ticket Number
- Summary
- Description
- Category
- Related System
- Created Date
- Requester

### Priority and Status

- Requested Priority
- IT Priority
- Current Status

### Ownership

- current Ticket Owner
- claim/assign/reassign controls

### Attachments

Existing Lab 2 Attachment presentation is preserved.

### Public Comments

Shared communication visible to permitted users.

### Internal Notes

Private operational information visible only to permitted roles.

---

# 22. Ticket Ownership Controls

The IT Staff screen shall display current Ticket ownership.

Possible actions include:

- Claim Ticket
- Assign Ticket
- Reassign Ticket

Only eligible active staff users shall be selectable where assignment selection is shown.

The UI shall provide:

- current owner;
- unassigned state;
- saving feedback;
- validation errors;
- safe API failure feedback.

The frontend must not assume successful assignment until the backend confirms it.

---

# 23. IT Priority Control

The Ticket Detail screen shall display:

- Requested Priority as read-only information;
- IT Priority as editable only for permitted roles.

The controls must clearly distinguish Requested Priority from IT Priority.

Updating IT Priority shall provide:

- busy state;
- validation feedback;
- successful update feedback where meaningful;
- safe API failure feedback.

---

# 24. Ticket Status Control

Permitted IT Staff may change Ticket status according to the Ticket Status Transition Matrix defined in specification.md and api-spec.md.
Required statuses are:

- New
- Open
- In Progress
- Waiting for Requester
- Resolved
- Closed
- Reopened
- Cancelled

The UI should show only valid destination statuses when practical.

However, backend validation remains authoritative.

Where a transition requires confirmation, the UI shall request confirmation before submission.

Invalid or rejected transitions shall show safe feedback.

---

# 25. Public Comments on IT Staff Ticket Detail

IT Staff may:

- view Public Comments;
- post Public Comments.

Each comment shall show:

- author;
- creation time;
- comment text.

The Public Comments section must be visually distinct from Internal Notes.

The UI must reduce the risk of private information accidentally being posted as a Public Comment.

---

# 26. Internal Notes

The Internal Notes section is visible only to permitted roles.

It shall show:

- note content;
- author;
- creation time.

Permitted users may add a new Internal Note.

The Internal Note form shall include:

- note text area;
- Add Internal Note button.

The section must use clearly different labeling and visual treatment from Public Comments.

Examples of differentiation may include:

- explicit `Internal Note` label;
- private/role-restricted helper text;
- distinct container styling.

The distinction must not rely only on color.

---

## 27. Internal Note Validation

The UI shall reject:

- empty content;
- whitespace-only content;
- content exceeding the 2000-character maximum after trimming.

Internal Notes are append-only in Lab 3.

The UI shall not provide edit or delete actions.

---

# 28. IT Staff Ticket Detail States

The screen shall support:

### Loading

Ticket information is being retrieved.

### View

Ticket information is visible with permitted controls.

### Saving

An operational update is being submitted.

### Validation Failure

Input or transition is invalid.

### Forbidden

The user is authenticated but is not permitted to access the operation.

### Not Found

The requested accessible Ticket cannot be found.

### API Failure

Safe failure feedback is displayed.

---

# 29. Administrator User Management

## Purpose

The Administrator interface provides simple user-account management required for Lab 3.

The interface intentionally avoids advanced identity-management features.

Required functions include:

- list users;
- search by name or email;
- optionally filter by role;
- create user;
- edit basic user information;
- activate/deactivate user;
- set a new initial password.

---

# 30. User Management List

The User Management screen shall show:

- Name
- Email
- Role
- Status
- Edit action

### Search

Administrator may search by:

- name;
- email.

### Optional Role Filter

The UI may provide a single role filter.

Supported roles are:

- Requester
- IT Staff
- Administrator

Pagination is not required for the Lab 3 Administrator user list.

---

# 31. User Management States

### Loading

User data is being retrieved.

### Normal

Users are shown in the list.

### Empty

No users are available.

### No Results

Search/filter values return no matches.

### Forbidden

A non-Administrator attempts access.

### Failure

Safe API failure feedback is displayed.

---

# 32. Create User

The Administrator shall be able to create a user.

Required fields:

- Name
- Email
- Role
- Activation State
- Initial Password

### Role

Exactly one permitted role must be selected:

- Requester
- IT Staff
- Administrator

### Validation

The UI shall validate:

- required name;
- valid email;
- one permitted role;
- valid activation state;
- required initial password;
- password requirements.

Duplicate email errors returned by the backend must be displayed clearly.

### Success

After successful creation:

- success feedback is shown;
- the user list reflects the new account;
- plaintext password is not displayed afterward unless explicitly required by the approved local-lab behavior.

---

# 33. Edit User

The Administrator shall be able to edit:

- Name
- Email
- Role
- Activation State

The following are not part of the normal edit form:

- user deletion;
- multiple roles;
- departments;
- role history;
- account audit history.

### Safety Rules

The interface shall handle backend rejection when:

- an Administrator attempts to deactivate their own account;
- an operation would leave the system with no active Administrator;
- an email conflicts with another user;
- an invalid role is submitted.

The UI may prevent obviously invalid actions in advance, but backend enforcement remains authoritative.

---

# 34. Set New Initial Password

The Administrator shall have an action to set a new initial password for a user.

The action shall:

- clearly identify which user is affected;
- request the new initial password;
- validate the password;
- require confirmation where appropriate;
- submit to the backend;
- show success or safe failure feedback.

After the password is changed:

- the target user is marked as requiring password change at their next login.

The new password must not remain visibly exposed after the operation.

---

# 35. Administrator Responsive Behavior

## Desktop

The user list may use a table layout.

## Tablet

The layout may reduce column width or stack controls.

## Mobile

The user list may use card-style user entries.

Each user entry should still make the following easy to identify:

- Name
- Email
- Role
- Status
- Edit action

Horizontal overflow must be avoided.

---

# 36. Common Feedback Requirements

All major Lab 3 screens shall provide meaningful feedback for applicable states.

These include:

- loading;
- saving;
- success;
- validation error;
- empty;
- no results;
- forbidden;
- not found;
- conflict;
- safe API failure.

A separate formal UI state does not need to be invented for every possible error, but feedback must be clear and useful.

---

# 37. Validation Placement

Validation messages shall:

- appear near the relevant field when practical;
- clearly explain what the user needs to correct;
- remain readable on mobile;
- not cause controls to overlap;
- avoid relying only on color.

Server-side validation messages should be transformed into safe user-facing feedback.

---

# 38. Accessibility Requirements

Lab 3 follows the same accessibility expectations established in Lab 2.

At minimum:

- form controls have visible labels;
- keyboard navigation remains usable;
- interactive elements show visible focus;
- meaningful buttons have understandable text;
- status and priority meaning does not rely only on color;
- validation feedback is associated with the relevant field where practical;
- content remains readable at responsive sizes;
- controls remain usable without horizontal page overflow.

---

# 39. Responsive Requirements

All required screens must remain usable on:

- desktop;
- tablet;
- mobile.

Major screens requiring responsive verification include:

- Login
- Change Password
- Requester Ticket Detail
- IT Staff Ticket Queue
- IT Staff Ticket Detail
- Administrator User Management

Responsive verification must check:

- clipping;
- overlap;
- unreadable text;
- control alignment;
- horizontal overflow;
- table/card adaptation;
- badge readability;
- navigation behavior.

---

# 40. Security-Related UI Behavior

The UI shall:

- hide navigation destinations that the current role cannot use;
- hide or disable actions that the current role cannot perform;
- avoid displaying Internal Notes to Requesters;
- remove the Development Requester selector;
- display authenticated identity instead;
- remove authenticated content after logout.

These UI behaviors improve usability but are not treated as security controls.

All protected operations must still be enforced by the backend.

---

# 41. Out-of-Scope UI Features

Sprint 3 does not require interfaces for:

- self-registration;
- forgot-password email;
- password-reset email;
- MFA;
- social login;
- single sign-on;
- multiple user roles;
- user deletion;
- bulk user management;
- import/export;
- departments;
- organizations;
- profile photos;
- user account history;
- advanced account recovery;
- dashboards;
- KPI analytics;
- SLA management;
- escalation rules;
- Actions Taken.

---

# 42. Visual Verification Checklist

Before Sprint 3 is considered visually complete, verify:

- Zen Green design remains consistent;
- authenticated user name is visible;
- role is visible;
- role-specific navigation is correct;
- status badges are consistent;
- Requested Priority and IT Priority are clearly distinguishable;
- role badges are consistent;
- editable and read-only fields are visually distinct;
- validation messages are positioned correctly;
- loading states are visible;
- saving states are visible;
- empty states are understandable;
- no-results states are understandable;
- forbidden feedback is safe;
- Public Comments and Internal Notes are clearly different;
- keyboard focus is visible;
- no important content is clipped;
- controls do not overlap;
- desktop layout works;
- tablet layout works;
- mobile layout works;
- horizontal page overflow is avoided.

---

# 43. UI Definition of Done

The Lab 3 UI is complete when:

- Login works with valid and invalid states;
- inactive-account feedback works;
- mandatory password change works;
- authenticated user and role are displayed;
- Logout works;
- protected content is unavailable after logout;
- Requester Lab 2 screens continue to work;
- Development Requester selector is removed;
- Requester Public Comments work;
- Problem Appears Resolved action works;
- IT Staff Ticket Queue works;
- Queue search works;
- Queue filters work;
- Queue sorting works;
- Queue pagination works;
- Queue loading, empty, no-results, forbidden, and failure states work;
- IT Staff Ticket Detail works;
- claim/reassign works;
- IT Priority editing works;
- permitted status changes work;
- Public Comments work;
- Internal Notes work with correct visual separation;
- Attachment continuity works;
- Administrator User Management works;
- user search works;
- role filtering works for REQUESTER, IT_STAFF, and ADMINISTRATOR;
- create user works;
- edit user works;
- activation/deactivation works;
- new initial-password behavior works;
- Administrator safety-rule feedback works;
- non-Administrator User Management access is blocked;
- Zen Green styling is consistent;
- desktop presentation is verified;
- tablet presentation is verified;
- mobile presentation is verified;
- accessibility expectations are checked;
- no clipping, overlap, or horizontal overflow remains.