# TokTickIT — IT Service Desk

TokTickIT is a full-stack IT service desk application developed for CPE334 Software Engineering.

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Bootstrap 5
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Testing:** Vitest, React Testing Library, Supertest

---

## Lab 2 Features

The Lab 2 requester workflow includes:

- Development Requester selection and switching
- Create Ticket
- Ticket reference data for Category and Related System
- My Tickets with search, filtering, sorting, and pagination
- Ticket Detail
- Requester ownership protection
- Attachment upload
- JPG, PNG, WEBP, and PDF attachment support
- Attachment preview/download
- Attachment soft removal with removal reason
- Removed attachment history
- Lab 1 regression compatibility

---

## Project Structure

```text
toktickit/
├── client/                     # React + TypeScript frontend
│   ├── src/
│   │   ├── components/         # Application screens and shared components
│   │   ├── App.tsx
│   │   ├── api.ts              # Backend API client
│   │   └── main.tsx
│   ├── tests/
│   │   ├── lab-01/             # Lab 1 regression tests
│   │   └── lab-02/             # Lab 2 frontend tests
│   ├── .env.example
│   └── package.json
│
├── server/                     # Express + TypeScript backend
│   ├── prisma/
│   │   ├── migrations/         # Database migrations
│   │   ├── schema.prisma       # Prisma data model
│   │   └── seed.ts             # Reference/development seed data
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   └── prisma.ts
│   ├── tests/
│   │   ├── lab-01/
│   │   └── lab-02/
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── lab-01/
│   └── lab-02/
│       ├── specification.md
│       ├── api-spec.md
│       ├── ui-spec.md
│       ├── tests.md
│       ├── reviewer.md
│       └── ai-use.md
│
├── .gitignore
└── README.md
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

Ensure the frontend points to the backend:

```env
VITE_API_URL="http://localhost:3000"
```

Start the frontend:

```bash
npm run dev
```

The Vite development server normally runs at:

```text
http://localhost:5173
```

---

## Running Tests

### Backend

```bash
cd server
npm run build
npm test
```

At the Lab 2 integration checkpoint:

```text
Test Files  10 passed (10)
Tests       70 passed (70)
```

### Frontend

```bash
cd client
npm run build
npm test
```

At the Lab 2 integration checkpoint:

```text
Test Files  8 passed (8)
Tests       50 passed (50)
```

Final test evidence is recorded in:

```text
docs/lab-02/tests.md
```

The complete test suites must be run again from the final `main` branch after the Lab 2 release merge.

---

## Lab 2 Documentation

Lab 2 engineering and delivery evidence is stored under `docs/lab-02/`:

- `specification.md` — Software requirements and engineering contract
- `api-spec.md` — REST API specification
- `ui-spec.md` — UI specification
- `tests.md` — Test design and execution evidence
- `reviewer.md` — Peer-review evidence
- `ai-use.md` — AI-use evidence and reflection

---

## Development Requester Context

Lab 2 uses a **Development Requester** context for demonstrating requester-specific behavior.

It is not production authentication.

The selected requester is used to test:

- requester-owned ticket creation
- My Tickets visibility
- Ticket Detail ownership
- attachment ownership
- requester switching

The backend remains responsible for enforcing requester ownership boundaries.

---

## Final Release Verification

Before considering Lab 2 complete:

1. Merge reviewed feature work into `lab2-staging`.
2. Run the complete backend and frontend build/test suites.
3. Perform the manual integrated requester workflow.
4. Complete peer-review and AI-use evidence.
5. Open and review the `lab2-staging -> main` release Pull Request.
6. Merge the release into `main`.
7. Run the complete build/test suites again from `main`.
8. Record the final passing evidence in `docs/lab-02/tests.md`.