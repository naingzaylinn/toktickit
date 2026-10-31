import { expect, test } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";
import { captureRelease } from "./release-capture.js";
test.use({ timezoneId: "Asia/Bangkok" });

// Real UI/API on the runner's disposable seed. Never run on developer services.
for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) test(`Actions screenshot states and keyboard access at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport); await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  const categories = await (await page.request.get("/api/v1/categories")).json();
  const systems = await (await page.request.get("/api/v1/related-systems")).json();
  const response = await page.request.post("/api/tickets", { data: { categoryId: categories.data[0].id, relatedSystemId: systems.data[0].id, summary: "Issue 64 keyboard and visual evidence", description: "Disposable demonstration of shared Actions and separate assignment. No real personal information.", clientRequestId: crypto.randomUUID() } });
  expect(response.status()).toBe(201); const ticketId = (await response.json()).data.id;
  if (viewport.width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
  await signOut(page); await signIn(page, "staff1@example.com"); await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  for (const [description, status] of [["Investigate connection stability", "PENDING"], ["Verified configuration and connectivity", "COMPLETED"], ["Duplicate investigation retained for history", "CANCELLED"]]) {
    const created = await page.request.post(`/api/staff/tickets/${ticketId}/actions`, { data: { actionDescription: description, actionResult: "Observation recorded for review.", followUpRequired: false, followUpNote: null, attachmentNotes: "No files required for this demonstration.", clientRequestId: crypto.randomUUID() } });
    expect(created.status()).toBe(201); const saved = (await created.json()).data;
    if (status !== "PENDING") {
      const transition = await page.request.patch(`/api/staff/tickets/${ticketId}/actions/${saved.id}`, { data: { expectedVersion: saved.version, status, actionResult: status === "COMPLETED" ? "Connectivity verified; no outstanding follow-up." : "Duplicate work; retained rather than deleted." } }); expect(transition.status()).toBe(200);
    }
  }
  await page.goto(`/staff/tickets/${ticketId}`);
  const region = page.getByRole("region", { name: "Actions Taken" }); await expect(region.getByRole("button", { name: "Add Action" })).toBeEnabled();
  await expect(region.locator("article")).toHaveCount(3); await region.locator("summary").first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await captureRelease(page, `actions-staff-history-${viewport.width}`, "IT_STAFF", "Pending/completed/cancelled current records; first details expanded");
  await region.getByRole("button", { name: "Add Action" }).focus(); await page.keyboard.press("Enter");
  await expect(region.getByLabel("Action Description", { exact: false })).toBeFocused();
  await captureRelease(page, `actions-create-${viewport.width}`, "IT_STAFF", "New PENDING inline form, current performer and eligible assignee");
  page.once("dialog", dialog => dialog.accept()); await region.getByRole("button", { name: "Discard changes" }).click();
  await region.getByRole("button", { name: /^Edit Action:/ }).first().click(); await expect(region.getByLabel("Action Description", { exact: false })).toBeFocused();
  await captureRelease(page, `actions-edit-${viewport.width}`, "IT_STAFF", "Existing pending action editor with assignment/lifecycle controls");
  page.once("dialog", dialog => dialog.accept()); await region.getByRole("button", { name: "Discard changes" }).click();
  if (viewport.width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
  await signOut(page); await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible(); await page.goto(`/tickets/${ticketId}`);
  const readOnly = page.getByRole("region", { name: "Actions Taken" }); await expect(readOnly.locator("article")).toHaveCount(3);
  await expect(readOnly.getByRole("button", { name: "Add Action" })).toHaveCount(0); await readOnly.locator("summary").first().focus(); await page.keyboard.press("Enter");
  await expect(readOnly.locator("details").first()).toHaveAttribute("open", "");
  await captureRelease(page, `actions-requester-read-only-${viewport.width}`, "REQUESTER", "Own read-only three-state history; keyboard-expanded full details");
});
