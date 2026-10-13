import { expect, test } from "@playwright/test";
import { signIn } from "../lab-03/helpers.js";
for (const width of [375, 768, 1280]) test(`staff dashboard reflows and navigates at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 }); await signIn(page, "staff1@example.com"); await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click(); await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.getByRole("heading", { name: "Actions originally recorded by you", exact: true })).toBeVisible();
  await page.screenshot({ path: `node_modules/.cache/staff-dashboard-${width}.png`, fullPage: true });
  if (width < 992) await expect(page.getByRole("button", { name: "Toggle navigation" })).toHaveAttribute("aria-expanded", "false");
  const next = page.getByRole("link", { name: /^Unassigned Active Tickets/ }); await next.click(); await expect(page.getByLabel("Status group")).toHaveValue("active");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
