import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers.js";

const widths = [375, 768, 1280];

async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )).toBe(true);
}

for (const width of widths) {
  test(`responsive authentication and role screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await noPageOverflow(page);

    await signIn(page, "alice@kmutt.ac.th");
    if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav[aria-label="Main navigation"] [aria-current="page"]')).toHaveCount(1);
    await page.getByRole("link", { name: "Create Ticket" }).click();
    if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav[aria-label="Main navigation"] [aria-current="page"]')).toHaveCount(1);
    await noPageOverflow(page);
    await page.getByRole("button", { name: "Logout" }).click();

    await signIn(page, "staff1@example.com");
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
    if (width === 1280) {
      const queueTable = page.getByRole("table");
      await expect(queueTable).toBeVisible();
      await expect(queueTable.getByRole("columnheader", { name: "Created" })).toHaveCSS("white-space", "nowrap");
      await expect(queueTable.getByRole("button", { name: "Open" }).first()).toHaveCSS("white-space", "nowrap");
      await expect(page.locator(".staff-ticket-queue-screen .table-responsive")).toHaveCSS("overflow-x", "auto");
    }
    if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    await noPageOverflow(page);
    await page.getByRole("button", { name: "Logout" }).click();

    await signIn(page, "admin@example.com");
    if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("link", { name: "User Management" }).click();
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav[aria-label="Main navigation"] [aria-current="page"]')).toHaveCount(1);
    await expect(page.getByLabel("Search by name or email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create User" })).toBeVisible();
    await noPageOverflow(page);
  });
}
