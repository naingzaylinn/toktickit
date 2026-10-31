# Lab 4 — AI Use and Reflection

**LLM/agent used:** ChatGPT and OpenAI Codex AI assistant

## Selected Key Prompts

These are concise summaries of selected prompts and tasks, not verbatim historical prompts.

| # | Prompt / task summary | What I did with the result |
|---|---|---|
| 1 | Inspect the Lab 4 handout and prepare the Sprint 4 engineering contract, specifications, acceptance criteria, and test traceability. | I reviewed the contract and directed revisions, including clearer Actions Taken assignment and lifecycle requirements. |
| 2 | Resolve the Actions Taken assignment, lifecycle, eligibility, and audit-history requirements. | I checked the proposed rules against the handout and corrected decisions that did not match the required behavior. |
| 3 | Implement the Actions Taken database model and migration, including ActionTaken revisions and preserved audit history. | I reviewed the data model and migration work and used the reported tests and evidence to guide the database issue. |
| 4 | Implement Actions Taken backend routes, authorization, assignment, lifecycle, eligibility, and ownership rules. | I reviewed the implementation and used its tests and review feedback to validate the authorization and lifecycle behavior. |
| 5 | Integrate Actions Taken into Ticket Detail and implement the UI behavior and regression coverage. | I reviewed the UI changes, manually checked behavior, and used regression tests to guide corrections. |
| 6 | Implement ticket workflow and resolution rules while preserving the existing Ticket transitions. | I checked the resolution gates and preserved transition behavior against the specification and regression evidence. |
| 7 | Implement the IT Staff Dashboard metrics, queue drill-downs, and loading, empty, error, and responsive states. | I reviewed the dashboard behavior and used tests and evidence to check the metrics and navigation. |
| 8 | Implement the Requester Dashboard metrics, navigation, and authorization behavior. | I reviewed the requester-specific behavior and tests; later guidance text contrast was corrected during hardening. |
| 9 | Perform final regression and product hardening across the Lab 4 implementation. | I reviewed findings, directed changes, and used test results and reviewer feedback to validate the fixes. |
| 10 | Complete Zen Green release hardening and prepare release evidence. | I reviewed the release changes and focused validation results. Screen-reader testing and some visual/ownership checks remain unverified or partial. |

## Reflection

Using ChatGPT to turn the handout into concrete requirements, acceptance criteria, and test links helped me plan Lab 4. I then used Codex to implement the issues and update tests. I reviewed the results and changed or rejected some AI decisions during specification work; AI output still needed human judgment. Testing and reviewer feedback helped validate the implementation, while I handled Git staging, commits, pushes, branch switching, pulls, and PR creation myself. AI did not make Git or reviewer decisions for me. Remaining screen-reader, visual, and ownership limitations are reminders that passing tests do not replace human verification.
