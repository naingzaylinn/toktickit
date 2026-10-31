import { expect, test, type Page } from "@playwright/test";
import { signIn } from "../lab-03/helpers.js";

const viewports = [{ width: 320, height: 812 }, { width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const long = "UnbrokenContent".repeat(25);
const user = { id: "requester", name: long, email: `${long}@example.test`, role: "REQUESTER", isActive: true, mustChangePassword: false };
const date = "2026-10-14T00:00:00Z";
const attachment = { id: "file", ticketId: "ticket", originalFilename: `${long}.png`, mimeType: "image/png", sizeBytes: 10, createdAt: date, isRemoved: false };
const ticket = { id: "ticket", ticketNumber: "TKT-1", ticketDate: date, createdAt: date, updatedAt: date, summary: long, description: long, requester: user, category: { id: 1, name: long, isActive: true }, relatedSystem: { id: "system", name: long, isActive: true }, requestedPriority: "Medium", currentStatus: "New", activeAttachments: [attachment], removedAttachments: [] };
const staff = { ...user, id: "staff", role: "IT_STAFF" };
const action = { id: "action", ticketId: "ticket", actionDescription: long, actionResult: long, followUpRequired: false, followUpNote: long, attachmentNotes: long, actionDateTime: date, createdAt: date, updatedAt: date, version: 1, status: "PENDING", performedBy: staff, assignee: staff };

async function mock(page: Page) {
  let actor = user;
  let removed = false;
  const unexpected: string[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const data = (value: unknown) => route.fulfill({ json: { data: value } });
    if (path === "/api/auth/me") return data(actor);
    if (path === "/api/auth/login") { actor = { ...user, role: "IT_STAFF", id: "staff" }; return data({ user: actor }); }
    if (path === "/api/auth/logout") return data({});
    if (path.endsWith("/categories")) return data([ticket.category]);
    if (path.endsWith("/related-systems")) return data([ticket.relatedSystem]);
    if (path === "/api/tickets" && method === "POST") return data({ id: "ticket", ticketNumber: "TKT-1", currentStatus: "New" });
    if (path.endsWith("/attachments") && method === "POST") return data({ accepted: [], rejected: [{ filename: attachment.originalFilename, reason: long }] });
    if (path.endsWith("/download")) return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
    if (path === "/api/tickets/ticket") return data({ ...ticket, activeAttachments: removed ? [] : [attachment], removedAttachments: removed ? [{ ...attachment, isRemoved: true, removalReason: "Wrong file", removedAt: date }] : [] });
    if (path === "/api/tickets/ticket/attachments/file" && method === "DELETE") { removed = true; return data({ ...attachment, isRemoved: true, removalReason: "Wrong file", removedAt: date }); }
    if (path.endsWith("/comments")) return data([]);
    if (path === "/api/staff/tickets/owners") return data([staff]);
    if (path === "/api/staff/tickets") return route.fulfill({ json: { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } } });
    if (path === "/api/staff/tickets/ticket") return data({ ...ticket, requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "NEW", owner: staff, attachments: [], publicComments: [], internalNotes: [], workflowVersion: 1, actionsTakenSummary: { totalItems: 1, pendingItems: 1, completedItems: 0, cancelledItems: 0, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: false, reasonCodes: ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"] } });
    if (path.endsWith("/actions/action") && method === "PATCH") return route.fulfill({ status: 409, json: { error: { code: "CONFLICT", message: "Changed; reload for review." } } });
    if (path.endsWith("/actions/action")) return data({ ...action, version: 2 });
    if (path.endsWith("/actions")) return route.fulfill({ json: { data: path.startsWith("/api/staff") ? [action] : [], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } } });
    if (path === "/api/tickets") return route.fulfill({ json: { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } } });
    unexpected.push(`${method} ${path}`); return route.abort();
  });
  return unexpected;
}

async function contained(page: Page, name: string) {
  const measurement = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect.soft(measurement.document, name).toBeLessThanOrEqual(measurement.viewport + 1);
  for (const element of await page.locator("main button:visible, [role=dialog] button:visible, main input:visible, main select:visible, main textarea:visible").all()) {
    const bounds = await element.boundingBox();
    if (bounds) { expect.soft(bounds.x, `${name}: left control edge`).toBeGreaterThanOrEqual(-1); expect.soft(bounds.x + bounds.width, `${name}: right control edge`).toBeLessThanOrEqual(measurement.viewport + 1); }
  }
  const scope = await page.getByRole("dialog").count() ? page.getByRole("dialog") : page.locator("main");
  const boxes = await scope.locator("button:visible, input:not([type=radio]):not([type=checkbox]):visible, select:visible, textarea:visible").evaluateAll(elements => elements.filter(el => !el.classList.contains("visually-hidden") && !el.closest(".table-responsive")).map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; expect.soft(Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1, `${name}: controls overlap`).toBe(false);
  }
}

for (const viewport of viewports) test(`RP-01 six long-content risks at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport); const unexpected = await mock(page);
  await page.goto("/tickets/new"); await expect(page.getByLabel("Ticket Summary", { exact: false })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: attachment.originalFilename, mimeType: "image/png", buffer: Buffer.from("fixture") });
  await contained(page, "R-01 staged filename");
  await page.getByLabel("Category", { exact: false }).selectOption("1"); await page.getByLabel("Related System", { exact: false }).selectOption("system");
  await page.getByLabel("Ticket Summary", { exact: false }).fill("Recovery fixture"); await page.getByLabel("Description", { exact: false }).fill("Recovery fixture description");
  await page.getByRole("button", { name: "Submit Ticket", exact: true }).click(); await expect(page.getByRole("heading", { name: "Ticket TKT-1 created" })).toBeVisible();
  await contained(page, "R-01 recovery filenames/actions");
  await page.getByRole("button", { name: "Open Ticket to review and retry attachments" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Overview" })).toBeVisible(); await contained(page, "R-02 metadata");
  await expect(page.getByRole("heading", { name: "Public Comments", exact: true })).toHaveClass(/h5/);
  await page.getByRole("button", { name: "Preview", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await contained(page, "R-04 preview");
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click(); await contained(page, "R-04 removal"); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/tickets"); await expect(page.getByTestId("empty-state")).toBeVisible(); await contained(page, "R-06 EmptyState");
  await page.route("**/api/tickets?**", route => route.fulfill({ status: 500, json: { error: { code: "INTERNAL_SERVER_ERROR", message: "Unavailable" } } }));
  await page.reload(); await expect(page.getByRole("button", { name: /^Retry/ })).toBeVisible(); await contained(page, "R-06 ErrorAlert");
  await page.getByRole("button", { name: "Toggle navigation" }).count().then(async count => { if (count && viewport.width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click(); });
  await page.getByRole("button", { name: "Logout" }).click(); await page.getByRole("button", { name: "Login", exact: true }).waitFor();
  // Explicit login is mocked; native browser validation still requires fields.
  await page.getByLabel("Email").fill("staff@example.test"); await page.getByLabel("Password", { exact: true }).fill("Initial123"); await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.goto("/staff/tickets/ticket"); await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible(); await contained(page, "R-03 staff detail");
  await expect(page.getByRole("heading", { name: "Primary Ticket Owner", exact: true })).toBeVisible();
  await expect(page.getByLabel("Actions per page")).toHaveClass(/form-select/);
  await page.getByRole("button", { name: /^Edit Action:/ }).click(); await page.getByLabel("Result", { exact: false }).fill("Changed result"); await page.getByRole("button", { name: "Save Action", exact: true }).click();
  await page.getByRole("button", { name: "Reload for review" }).click(); await expect(page.getByRole("button", { name: "Use current version for explicit retry" })).toBeVisible(); await contained(page, "R-05 conflict review");
  expect(unexpected).toEqual([]);
});

test("AX-01 actual browser: preview/removal entry, trapping, Escape, Cancel and successful removal focus", async ({ page }) => {
  const unexpected = await mock(page); await page.goto("/tickets/ticket");
  await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveClass(/btn-outline-primary-green/);
  const preview = page.getByRole("button", { name: "Preview", exact: true }); await preview.click();
  const close = page.getByRole("button", { name: "Close preview" }); await expect(close).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused(); await page.keyboard.press("Shift+Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape"); await expect(preview).toBeFocused();
  const remove = page.getByRole("button", { name: "Remove", exact: true }); await remove.click();
  const reason = page.getByLabel("Removal reason", { exact: true }); await expect(reason).toBeFocused();
  await page.getByRole("button", { name: "Cancel removal" }).focus(); await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Cancel removal" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(remove).toBeFocused();
  await remove.click(); await reason.fill("Wrong file");
  await page.getByRole("button", { name: "Remove Attachment", exact: true }).focus(); await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Cancel removal" })).toBeFocused();
  await page.getByRole("button", { name: /Back to My Tickets/ }).focus(); await expect(reason).toBeFocused();
  await page.getByRole("button", { name: "Remove Attachment", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByRole("heading", { name: "Attachments", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("dialog")).toHaveCount(0); expect(unexpected).toEqual([]);
});

test("ZG-01/AX-03: real dashboard links use green; desktop Ticket links preserve table semantics", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await signIn(page, "alice@kmutt.ac.th");
  const link = page.getByRole("table").getByRole("link").first(); await expect(link).toBeVisible();
  await expect(link.locator("xpath=ancestor::tr")).not.toHaveAttribute("role", "button"); await page.keyboard.press("Tab"); await link.focus();
  expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { name: "Ticket Overview" })).toBeVisible();
  const download = page.getByRole("button", { name: "Download", exact: true });
  if (await download.count()) await expect(download.first()).toHaveClass(/btn-outline-primary-green/);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const drilldown = page.getByRole("link", { name: "View all recently updated Tickets", exact: true });
  await expect(drilldown).toHaveCSS("color", "rgb(11, 122, 70)"); await drilldown.hover(); await expect(drilldown).toHaveCSS("color", "rgb(0, 107, 60)");
});
