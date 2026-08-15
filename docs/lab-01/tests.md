# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | PASS |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | PASS |
| 3 | Vitest | Heading renders | PASS |
| 4 | Vitest | Success state shows Online + category list | PASS |
| 5 | Vitest | Error state shows Offline + message | PASS |

## Test Evidence

Backend:
- `npm test`: 2 test files passed, 2 tests passed.
- `npm run build`: passed successfully.

Frontend:
- `npm test`: 1 test file passed, 3 tests passed.
- `npm run build`: passed successfully.

Manual verification:
- With the backend running, Check System displayed Online and the four seeded categories.
- With the backend stopped, Check System displayed Offline with an error message.

Terminal screenshots of the passing tests are included in the final Lab 1 evidence PDF.