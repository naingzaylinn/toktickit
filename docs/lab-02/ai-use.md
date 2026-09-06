# Lab 2 — AI Use and Reflection

**LLM/agent used:** ChatGPT and AI coding assistance

## Selected Key Prompts

| # | Actual Prompt Text | What I did with the result |
|---|---|---|
| 1 | Help me inspect the Lab 2 requirements and plan the implementation feature by feature using the required GitHub workflow. | I used the plan to create the Lab 2 issues and work from lab2-staging using separate feature branches. |
| 2 | Help me implement the Development Requester context and test requester switching without treating it as real authentication. | I reviewed the requester flow, ran the tests, and manually verified that switching requester context changed the visible ticket data. |
| 3 | Help me implement Create Ticket using the required backend-generated ticket number, validation, requester ownership, and idempotency rules. | I ran the server and client builds and tests, then manually created tickets in the browser to verify the complete flow. |
| 4 | Help me implement My Tickets with requester ownership, search, filters, sorting, pagination, empty state, and no-results state. | I checked that tickets were requester-specific and manually verified search and navigation after automated tests passed. |
| 5 | Help me implement Ticket Detail so a requester can only open their own ticket and historical inactive Category or Related System values still display correctly. | I tested the API and UI, fixed regression-test setup problems, and manually opened newly created tickets from My Tickets. |
| 6 | Help me implement Attachment Management with JPG/PNG/WEBP/PDF validation, 5 MB file limit, maximum 5 active attachments, preview/download, soft removal, and ownership protection. | I reviewed the Prisma migration and attachment routes, ran 70 backend tests, and manually tested upload, preview, download, removal, and history. |
| 7 | Help me add frontend attachment management to Ticket Detail and create Feature-G UI tests for upload, preview, PDF behavior, removal reason, and removed attachment history. | I fixed TypeScript and test-query issues, then verified that all 48 frontend tests passed. |
| 8 | Help me integrate optional attachments into Create Ticket so the ticket is created first and attachment upload failure does not roll back the ticket. | I added staged attachment selection, ran the production build, added integration tests, and confirmed all 50 frontend tests passed. |
| 9 | Help me perform the final Lab 2 integration audit, including server/client builds, full regression tests, manual requester flow, attachment behavior, and ownership protection. | I ran the complete automated suites and manually tested the full Alice-to-Bob ownership flow before preparing the release. |
| 10 | Help me prepare the final Integration, Evidence and Release work, including reviewer evidence, AI-use reflection, test evidence, and the final staging-to-main workflow. | I used the checklist to prepare the required Lab 2 documentation and final release evidence rather than treating feature completion as sprint completion. |

## Reflection

My prompts improved when I included the exact feature scope, acceptance criteria, current Git branch, test results, and existing code before asking for changes. This reduced unnecessary changes and helped me keep each feature inside its intended scope.

I also learned that passing one feature by itself does not guarantee that the whole sprint works. During Lab 2, integration testing exposed issues such as database cleanup conflicts, outdated regression tests, and missing Create Ticket attachment integration. I reviewed the suggested changes, ran the commands myself, checked the application manually, and did not rely only on the AI saying that the work was complete.