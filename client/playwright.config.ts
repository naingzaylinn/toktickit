import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/lab-03",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  outputDir: "./node_modules/.cache/playwright-results",
});
