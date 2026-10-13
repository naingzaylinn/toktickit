import { expect, test } from "@playwright/test";
import { signIn } from "../lab-03/helpers.js";
test("dashboard keyboard links, focus styling, refresh and 200% text reflow", async ({ page }) => {
  await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).focus(); await page.keyboard.press("Enter");
  const total = page.getByRole("link", { name: /^Total Tickets/ }); await expect(total).toBeVisible(); await total.focus(); await expect(total).toBeFocused();
  expect(await total.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible(); await page.goBack();
  const refresh = page.getByRole("button", { name: "Refresh", exact: true }); await expect(refresh).toBeEnabled(); await refresh.focus(); await page.keyboard.press("Enter"); await expect(refresh).toBeEnabled(); await expect(refresh).toBeFocused();
  await page.setViewportSize({ width: 640, height: 850 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "node_modules/.cache/staff-dashboard-text-200.png", fullPage: true });
});

for (const previousData of [false, true]) test(`keyboard Retry retains focus after ${previousData ? "refresh" : "initial-load"} failure`, async ({ page }) => {
  await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  if (!previousData) await page.route("**/api/staff/dashboard", route => route.abort());
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  if (previousData) {
    await expect(page.getByRole("link", { name: /^Total Tickets/ })).toBeVisible();
    await page.route("**/api/staff/dashboard", route => route.abort());
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Retry: Error" })).toBeVisible();
  await page.unroute("**/api/staff/dashboard");
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("**/api/staff/dashboard", async route => { arrived(); await gate; await route.continue(); });
  await page.getByRole("button", { name: "Retry: Error" }).focus(); await page.keyboard.press("Enter");
  try {
    await reached;
    await expect(page.getByRole("button", { name: "Retry: Error" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: /^Total Tickets/ })).toBeVisible();
});

for (const previousData of [false, true]) test(`Requester keyboard Retry focus after ${previousData ? "refresh" : "initial"} failure`, async ({ page }) => {
 await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
 if (!previousData) await page.route("**/api/requester/dashboard", route => route.abort()); await page.goto("/dashboard");
 if (previousData) { await expect(page.getByRole("link", { name: /^Total My Tickets/ })).toBeVisible(); await page.route("**/api/requester/dashboard", route => route.abort()); await page.getByRole("button", { name: "Refresh", exact: true }).click(); }
 await expect(page.getByRole("button", { name: "Retry: Error" })).toBeVisible(); await page.unroute("**/api/requester/dashboard");
 let release!: () => void; const gate = new Promise<void>(r => { release = r; }); await page.route("**/api/requester/dashboard", async route => { await gate; await route.continue(); });
 await page.getByRole("button", { name: "Retry: Error" }).focus(); await page.keyboard.press("Enter");
 try { await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeFocused(); } finally { release(); }
 await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeFocused();
});
test("Requester keyboard links, Refresh focus and 200% text reflow", async ({ page }) => {
 await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
 await page.getByRole("link", { name: "Dashboard", exact: true }).focus(); await page.keyboard.press("Enter");
 const link = page.getByRole("link", { name: /^Active Tickets/ }); await expect(link).toBeVisible(); await link.focus(); expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none"); await page.keyboard.press("Enter"); await expect(page.getByLabel("Status group")).toHaveValue("active"); await page.goBack();
 const refresh = page.getByRole("button", { name: "Refresh", exact: true }); await expect(refresh).toBeEnabled(); await refresh.focus(); await page.keyboard.press("Enter"); await expect(refresh).toBeEnabled(); await expect(refresh).toBeFocused();
 await page.setViewportSize({ width: 640, height: 850 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true); await page.screenshot({ path: "node_modules/.cache/requester-dashboard-text-200.png", fullPage: true });
});
