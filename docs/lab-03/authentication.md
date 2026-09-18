# Issue 2 authentication implementation

The API contract remains `api-spec.md`. Issue 2 implements `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`, and `POST /api/auth/change-password`.
It does not implement the role shell or requester identity conversion.

## Local development / test accounts

After applying committed migrations with `npx prisma migrate deploy`, run
`npm run prisma:seed` from `server`. Newly created accounts use **Initial123** and
`mustChangePassword = true`. These are public local lab fixtures, never production
credentials. Password changes are preserved when the seed runs again.

| Accounts | Role | Active |
|---|---|---|
| alice@kmutt.ac.th, bob@kmutt.ac.th, charlie@kmutt.ac.th, diana@kmutt.ac.th | REQUESTER | Yes |
| evan@kmutt.ac.th | REQUESTER | No |
| staff1@example.com, staff2@example.com, staff3@example.com | IT_STAFF | Yes |
| staff-inactive@example.com | IT_STAFF | No |
| admin@example.com | ADMINISTRATOR | Yes |

The original five requester identities are preserved. Other existing Development
Requesters are copied with their persisted IDs when missing from User. Existing
User credentials, roles, and activation state are not reset by the seed.
Four repeatable ticket examples span four requester identities and all current
Requested Priority values. Staff assignment, expanded ticket statuses, Comments,
and Notes await their feature migrations; this issue does not add those models.

## Migration preservation

`20260918000000_add_user_auth` remains unchanged. It copies requester IDs into User
without modifying Ticket, Attachment, or reference records. Its placeholder
bcrypt hash does not verify against `Initial123`.

`20260919000000_complete_authentication` replaces only that exact placeholder on
users still requiring password change, using a verified local initial-password
hash. It also adds LoginAttempt storage. Changed credentials are never overwritten.
No database reset is required. The automated migration test applies the original
and corrective migrations to populated Lab 2 fixtures and compares every existing
ticket, attachment, event, reference, requester, and sequence field afterward.

The existing case-sensitive DevelopmentRequester email uniqueness does not rule
out collisions after normalization. The original migration safely refuses such
collisions instead of merging identities or deleting ownership. Resolving an
actual duplicate identity needs an explicit data decision; no automatic merge is
introduced here.

## Authentication design

- The browser receives an opaque random 256-bit `toktickit_session` cookie.
  Session.token stores only its SHA-256 digest. Responses never contain the
  bearer token or password hash.
- Cookies have Path=/, HttpOnly, SameSite=Lax, and an eight-hour maximum age.
  NODE_ENV=production also enables Secure. Server expiration is fixed at eight
  hours, with no sliding extension. Logout deletes the session and clears the
  same cookie. API specification section 6.4 explicitly keeps the authenticated
  session valid after password change: its token and original expiry are neither
  rotated nor extended. The contract does not require revoking other sessions,
  and this implementation does not add that policy.
- Session lookup reads current User state on every request. Deactivated users,
  expired sessions, and invalid tokens receive 401. Auth responses use no-store.
- Wrong passwords, unknown emails, and inactive users receive the same safe 401
  login response. Required password changes produce 403 PASSWORD_CHANGE_REQUIRED
  at the reusable normal-access middleware.
- New hashes use versioned bcrypt(SHA-256(password)), cost 12, so the documented
  8–72 character policy accepts Unicode without bcrypt silently truncating at 72
  bytes. Existing ordinary bcrypt hashes remain verifiable. Passwords are never
  trimmed, stored as plaintext, or logged.
- LoginAttempt stores a sliding fifteen-minute failure window keyed by a digest
  of normalized email and client IP. Five failures are allowed; the next attempt
  returns 429, including correct credentials until the window expires. Successful
  login clears the matching counter. PostgreSQL transaction advisory locks prevent
  concurrent requests or multiple processes from bypassing the counter.
- Express does not trust forwarded IP headers. Vite proxies /api for same-origin
  local access; production requires one HTTPS origin. No credentialed CORS is
  enabled. Proxy trust must not be broadly enabled without a deployment decision.

## Issue 3 integration boundary

`requireAuthentication` establishes `req.auth` from the session;
`requirePasswordChanged` blocks normal access until a password is changed. Apply
both to future protected routes, then enforce role and ownership there.

The existing `/api/v1` routes still use requesterContext when no session cookie
is supplied. When a session is supplied it must be valid, active, and past the
required password change. A supplied Development Requester header is rejected
unless it matches that authenticated user and the user's current role is
REQUESTER. This rejects conflicting identity rather than converting legacy
handlers to session-based ownership. Invalid/restricted sessions never fall
through to the cookie-less branch in the same request.

This is a transitional compatibility guard, not the
completed Lab 3 requester authorization layer. Issue 3 must remove the cookie-less
identity path, replace header-selected ownership, and integrate the authenticated
requester UI/navigation. No production protection claim is made for the legacy
cookie-less endpoints in this intermediate branch.

## Verification

From `server`:

```text
npx prisma validate
npx prisma generate
npm run build
npm run test:isolated -- tests/lab-03
npm run test:isolated
```

The isolated runner creates a unique test schema, applies migrations, checks
schema drift, seeds, runs Vitest, and removes only its own schema. Existing Lab 2
tests remain unchanged. Do not point the original destructive fixture tests at
valuable data. On Windows with restricted PowerShell script execution, use
`npm.cmd` and `npx.cmd`.

## Scope review

The client changes are limited to same-origin transport: relative API URLs,
Vite's local proxy, and an accurate environment example. They implement the
session contract without adding login screens, role navigation, or requester
identity conversion. The README documents this transport and safe verification;
the server environment example documents Secure cookies in production.
`package.json` exposes the isolated test runner, and `tsconfig.json` includes that
runner in typechecking. Test infrastructure does not change production
authentication behavior or add a test-only authentication bypass.
