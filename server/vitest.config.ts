import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],

    // Server integration tests share the same PostgreSQL test database.
    // Run test files sequentially to prevent cross-file database interference.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});