# TokTickIT — IT Service Desk

TokTickIT is a full-stack IT service desk management application built with a modern web architecture:
- **Frontend**: React 18, TypeScript, Vite, and Bootstrap 5.
- **Backend**: Node.js, Express, TypeScript, and Prisma ORM.
- **Database**: PostgreSQL.
- **Testing**: Vitest, React Testing Library, and Supertest.

---

## Project Structure

```text
toktickit/
├── client/                 # Frontend React + TypeScript + Vite application
│   ├── src/
│   │   ├── App.tsx         # Main UI component with Bootstrap styling
│   │   ├── api.ts          # API client for backend communication
│   │   └── main.tsx        # React root entry point
│   ├── tests/              # Frontend unit tests with Vitest & Testing Library
│   ├── .env.example        # Frontend environment template
│   └── package.json        # Frontend scripts and dependencies
│
├── server/                 # Backend Express + TypeScript application
│   ├── prisma/             # Prisma schema and database seeds
│   │   ├── schema.prisma   # Data models and PostgreSQL datasource
│   │   └── seed.ts         # Database seed script
│   ├── src/
│   │   ├── app.ts          # Express app configuration and routes
│   │   ├── index.ts        # Server entry point listening on PORT
│   │   └── prisma.ts       # Lazy Prisma client instance
│   ├── tests/              # Backend integration tests with Supertest & Vitest
│   ├── .env.example        # Backend environment template
│   └── package.json        # Backend scripts and dependencies
│
├── docs/                   # Course documentation and lab reports
│   └── lab-01/
│       ├── ai_use.md       # AI use and prompt reflections
│       ├── reviewer.md     # Peer review records
│       └── tests.md        # Test execution evidence and plan
│
├── .gitignore              # Ignores node_modules, .env files, build artifacts
└── README.md               # Project setup and documentation
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher (includes `npm`)
- **PostgreSQL**: `v14` or higher running on `localhost:5432` (or via Docker)

---

## Getting Started

### 1. Backend Setup

1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Copy the environment variables template to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Configure your PostgreSQL connection string in `.env` if different from default:
   ```env
   DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
   PORT=3000
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. (When models are configured in Issue 3) Run migrations and seed data:
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```
   The backend API will start on [http://localhost:3000](http://localhost:3000).

7. Run backend tests:
   ```bash
   npm test
   ```

---

### 2. Frontend Setup

1. Open another terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Copy the environment variables template to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Ensure `VITE_API_URL` points to your backend:
   ```env
   VITE_API_URL="http://localhost:3000"
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be accessible at [http://localhost:5173](http://localhost:5173).

6. Run frontend tests:
   ```bash
   npm test
   ```

7. Build for production:
   ```bash
   npm run build
   ```

---

## Verification & Acceptance Criteria (Issue 1)

- [x] **React + TypeScript + Vite**: Configured in `client/`, builds cleanly and dev server starts.
- [x] **Bootstrap**: Included in `client/package.json` (`bootstrap@^5.3.3`) and imported in `client/src/main.tsx`.
- [x] **Node.js + Express + TypeScript**: Configured in `server/`, compiles with `tsc` and starts with `tsx watch`.
- [x] **PostgreSQL & Prisma**: Datasource configured in `server/prisma/schema.prisma` and client wrapper in `server/src/prisma.ts`.
- [x] **Vitest & Supertest**: Scripts configured in `package.json` for both client (`vitest run`) and server (`vitest run` with Supertest).
- [x] **Secrets & Dependencies Ignored**: `.gitignore` configured to ignore `node_modules`, `.env`, and build outputs; `.env.example` templates provided.
- [x] **Documentation**: Initial setup instructions provided in `README.md`.