# TokTickIT - IT Service Desk

TokTickIT is a full-stack IT service desk application developed for CPE334 Software Engineering. Lab 3 is the current increment, adding authenticated, role-based workflows while retaining Lab 2 ticket and attachment functionality.

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Bootstrap 5
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Testing:** Vitest, React Testing Library, Supertest, Playwright

---

## Lab 3 Features

- Email/password authentication, logout, and mandatory first-login password change for initial-password users.
- Requester, IT Staff, and Administrator roles with role-specific navigation and backend authorization.
- Authenticated Requester ownership for Create Ticket, My Tickets, Ticket Detail, and attachments retained from Lab 2. My Tickets supports search, filtering, sorting, and pagination.
- Attachment upload (JPG, PNG, WEBP, PDF), preview/download, soft removal with a reason, and removed attachment history.
- Requester Public Comments and Problem Appears Resolved on owned tickets; the latter records an indication without changing the formal ticket status.
- IT Staff Ticket Queue with search, filters, sorting, and pagination; ticket claim/reassignment, IT Priority, and permitted status updates.
- Public Comments and role-restricted Internal Notes available to IT Staff and Administrators; Internal Notes are hidden from Requesters.
- Administrator User Management with user search/filtering, creation, editing, activation/deactivation, single-role assignment, and administrator-set initial passwords.
- Lab 2 regression compatibility for existing ticket and attachment workflows under authenticated identity.

---

## Project Structure

```text
toktickit/
|-- client/                     # React + TypeScript frontend
|   |-- src/
|   |   |-- components/         # Application screens and shared components
|   |   |-- App.tsx
|   |   |-- api.ts              # Backend API client
|   |   `-- main.tsx
|   |-- tests/
|   |   |-- lab-01/             # Regression tests
|   |   |-- lab-02/             # Requester regression tests
|   |   `-- lab-03/             # Authentication and role workflow tests
|   |-- e2e/lab-03/             # Playwright browser tests
|   |-- playwright.config.ts
|   |-- .env.example
|   `-- package.json
|-- server/                     # Express + TypeScript backend
|   |-- prisma/
|   |   |-- migrations/         # Database migrations
|   |   |-- schema.prisma       # Prisma data model
|   |   `-- seed.ts             # Reference/development seed data
|   |-- src/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- app.ts
|   |   |-- index.ts
|   |   `-- prisma.ts
|   |-- scripts/                # Isolated server and E2E test runners
|   |-- tests/
|   |   |-- lab-01/
|   |   |-- lab-02/
|   |   `-- lab-03/
|   |-- .env.example
|   `-- package.json
|-- docs/
|   |-- lab-01/
|   |-- lab-02/
|   `-- lab-03/
|       |-- specification.md
|       |-- api-spec.md
|       |-- ui-spec.md
|       |-- tests.md
|       |-- reviewer.md
|       |-- ai-use.md
|       |-- authentication.md
|       `-- release-evidence.md
|-- .gitignore
`-- README.md
```

---

## Prerequisites

Install:

- Node.js 20 or higher
- npm
- PostgreSQL 14 or higher

PostgreSQL must be running before starting the backend.

---

## Backend Setup

Open a terminal from the project root:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Copy the environment template:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

Check the PostgreSQL connection in `server/.env`.

Example:

```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
PORT=3000
```

Generate the Prisma client:

```bash
npx prisma generate
```

Apply the database migrations.

For a normal development database with the required PostgreSQL permissions:

```bash
npx prisma migrate dev
```

If the database user cannot create the Prisma shadow database but the committed migrations only need to be applied:

```bash
npx prisma migrate deploy
```

Seed the database:

```bash
npm run prisma:seed
```

Start the backend:

```bash
npm run dev
```

The API runs at:

```text
http://localhost:3000
```

---

## Frontend Setup

Open another terminal from the project root:

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Copy the environment template:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

The frontend uses same-origin `/api` requests. No API URL environment variable
is required; legacy `VITE_API_URL` settings are no longer used.

Start the frontend:

```bash
npm run dev
```

The Vite development server normally runs at:

```text
http://localhost:5173
```

Vite forwards `/api` to `http://localhost:3000`. Cross-origin credentialed API access
is not enabled. Production must serve the frontend and `/api` at one HTTPS origin.

For Lab 3 authentication endpoints, local seed credentials, and the migration
handoff, see [Authentication implementation notes](docs/lab-03/authentication.md).

---

## Running Tests

Run each command block from the project root after installing both server and client dependencies. Database-backed checks require PostgreSQL and `DATABASE_URL` in the environment or `server/.env`, with permission to create schemas.

### Backend

```bash
cd server
npm run build
npm run test:isolated
```

`test:isolated` creates a temporary PostgreSQL schema, applies migrations, checks Prisma schema consistency, seeds fixtures, runs the complete Vitest suite, and removes that schema afterward. Use `npm run test:lab3` for only the Lab 3 server tests. The isolated workflow accommodates Lab 2 regression tests that replace database fixtures.

### Frontend

```bash
cd client
npm test
npm run build
```

### Database-backed E2E

```bash
cd server
npm run test:e2e
```

The E2E runner applies migrations, verifies the schema, and seeds a disposable database schema. It starts the API and Vite, runs `client/e2e/lab-03`, and cleans up its services, schema, and temporary attachment storage. The current Playwright configuration requires Microsoft Edge (`msedge`) installed locally.

### Final verified results from main

| Check | Result |
|---|---|
| Server isolated suite | 20 test files, 209 tests passed |
| Server build | Passed |
| Client suite | 14 test files, 123 tests passed |
| Client production build | Passed |
| Database-backed E2E | 18 tests passed |
| Database migrations | All 10 applied successfully |
| Prisma migration/schema verification | No difference detected |
| Seed | Completed successfully |

These are the final Lab 3 results from `main`. [Test documentation](docs/lab-03/tests.md) and [integration evidence](docs/lab-03/release-evidence.md) provide traceability and earlier checkpoints; historical counts there are not the final results above.

---

## Lab 3 Documentation

Lab 3 engineering and delivery documentation is in [docs/lab-03](docs/lab-03/):

- [specification.md](docs/lab-03/specification.md) - Requirements, business rules, and acceptance criteria.
- [api-spec.md](docs/lab-03/api-spec.md) - API endpoints, authorization, validation, and response contracts.
- [ui-spec.md](docs/lab-03/ui-spec.md) - Role-specific screens, navigation, and UI requirements.
- [tests.md](docs/lab-03/tests.md) - Test design, requirement traceability, and execution evidence.
- [reviewer.md](docs/lab-03/reviewer.md) - Peer-review comments and merge outcomes.
- [ai-use.md](docs/lab-03/ai-use.md) - AI-use evidence and reflection.

---

## Authentication and Roles

Users sign in with email and password. The authenticated user determines identity and Requester ownership. Users with an administrator-set initial password must change it before normal application access, including after an Administrator sets a new initial password.

- **Requester:** Creates tickets and accesses only their own tickets and attachments, posts Public Comments, and indicates Problem Appears Resolved.
- **IT Staff:** Uses the shared Ticket Queue and Ticket Detail to manage assignment, IT Priority, permitted status changes, Public Comments, and Internal Notes.
- **Administrator:** Has staff ticket capabilities and manages user accounts, roles, activation, and initial passwords.

Each user has one role. Navigation reflects that role, and the backend enforces authorization, ownership boundaries, and password-change restrictions. Internal Notes are accessible only to IT Staff and Administrators.

---

## Final Release Verification

Lab 3 feature branches were peer-reviewed and integrated through `lab3-staging`, followed by final integration into `main`. Final verification on `main` passed the server and client builds, isolated server tests, client tests, database-backed E2E, migration/schema checks, and seed execution, with results summarized above.

[Peer-review evidence](docs/lab-03/reviewer.md) and the [Lab 3 documentation](docs/lab-03/) record the implemented requirements, testing, review outcomes, and AI use.
