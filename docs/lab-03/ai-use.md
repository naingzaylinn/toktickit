# Lab 3 — AI Use and Reflection

**LLM/agent used:** ChatGPT and Codex / AI coding assistance

## Selected Key Prompts / Tasks

These are task summaries, not verbatim historical prompts.

| # | Prompt / task summary | What I did with the result |
|---|---|---|
| 1 | Interpret the Sprint 3 requirements and prepare the engineering contract, API, UI, and test specifications. | I reviewed the scope and acceptance criteria before the implementation issues began. |
| 2 | Implement authentication, sessions, first-login password change, and migration from Development Requesters to users. | I reviewed the schema and migration, checked the tests, and verified the database migration path without discarding existing data. |
| 3 | Enforce role authorization and authenticated Requester ownership while preserving Lab 2 ticket and attachment behavior. | I checked role boundaries, protected-resource responses, and Requester regression coverage. |
| 4 | Implement the shared Staff Ticket Queue with search, filters, sorting, pagination, and responsive states. | I reviewed the route and screen changes and checked automated and browser behavior. |
| 5 | Implement IT Staff ticket detail and operations: ownership, IT Priority, status, Public Comments, and Internal Notes. | I reviewed the transition and visibility rules and used API and UI tests to check them. |
| 6 | Implement Administrator User Management and its account safety rules. | I checked list/search, create/edit, role and active-state changes, initial passwords, and authorization tests. |
| 7 | Add automated, cross-role, migration, seed, and browser end-to-end coverage. | I used the test results to verify integrated workflows and investigated failures rather than accepting an AI completion report alone. |
| 8 | Verify the Zen Green screens at desktop, tablet, and mobile sizes. | I inspected the browser layouts manually, found a Ticket Queue wrapping problem, and checked the correction again at the required responsive sizes. |
| 9 | Audit integration and prepare release evidence. | I reviewed requirement traceability and final commands. The full server run exposed a Lab 2/Lab 3 seed test-fixture interaction, which was corrected and then passed on rerun. |
| 10 | Prepare final submission evidence and documentation. | I checked the existing Lab records and Git history before writing this AI-use reflection and peer-review record; screenshot capture and final `main` verification remain separate submission steps. |

## Reflection

ChatGPT helped me interpret the Lab 3 requirements, plan the issues, prepare scoped Codex tasks, review implementation reports, troubleshoot problems, and work through testing and Git/PR steps. Giving AI the exact scope and acceptance criteria helped keep each change focused on one issue. Codex inspected and changed repository files for those scoped tasks, but I reviewed changes before committing. I handled staging, commits, pushes, PR creation, and the student-side workflow manually. My human reviewer performed peer review and PR merges.

I learned to check AI-assisted work with automated tests and manual browser inspection. Integration testing found a fixture interaction that individual feature tests had not exposed. Local database verification also showed pending Lab 3 migrations; deploying them before reseeding preserved existing data. That was an environment/database state problem to diagnose separately from an application defect. The Ticket Queue layout issue required human visual inspection as well as responsive checks. Human review and manual verification still mattered throughout the sprint. `docs/references/` was deliberately kept outside this work.
