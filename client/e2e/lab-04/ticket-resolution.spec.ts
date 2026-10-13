import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";

test.setTimeout(90000);
async function fixture(page: Page, name: string) {
  await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  const categories = await (await page.request.get("/api/v1/categories")).json();
  const systems = await (await page.request.get("/api/v1/related-systems")).json();
  const response = await page.request.post("/api/tickets", { data: { categoryId: categories.data[0].id, relatedSystemId: systems.data[0].id, summary: name, description: "Disposable Issue 60 workflow fixture", clientRequestId: crypto.randomUUID() } });
  expect(response.status()).toBe(201); return (await response.json()).data.id as string;
}
async function staffDetail(page: Page, id: string) {
  await signOut(page); await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
  await page.goto(`/staff/tickets/${id}`); await expect(page.getByLabel("Next Status")).toBeEnabled();
}
async function change(page: Page, destination: string, text: string) {
  await page.getByLabel("Next Status").selectOption(destination);
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText("Current Status:").locator("xpath=..")).toContainText(text);
  await expect(page.getByLabel("Next Status")).toBeEnabled();
}
test("reviewed Actions qualify resolution/closing; reopen preserves history and advisory requester indication", async ({ page }) => {
  const id = await fixture(page, "Issue 60 complete resolution journey");
  const indication = await page.request.post(`/api/tickets/${id}/problem-appears-resolved`); expect(indication.status()).toBe(200);
  await staffDetail(page, id);
  await expect(page.getByText(/At least one completed Action/)).toBeVisible();
  const detail = (await (await page.request.get(`/api/staff/tickets/${id}`)).json()).data;
  expect(detail.workflowVersion).toBe(0); expect(detail.status).toBe("NEW");
  await page.getByLabel("Next Status").focus(); await page.getByLabel("Next Status").selectOption("OPEN");
  let statusWrites = 0;
  page.on("request", req => { if (req.method() === "PATCH" && new URL(req.url()).pathname === `/api/staff/tickets/${id}/status`) statusWrites++; });
  page.once("dialog", async d => { expect(d.message()).toContain(detail.ticketNumber); expect(d.message()).toContain("New to Open"); await d.dismiss(); });
  await page.getByRole("button", { name: "Update Status" }).focus(); await page.keyboard.press("Enter");
  expect(statusWrites).toBe(0); await change(page, "OPEN", "Open");
  await page.getByLabel("Next Status").selectOption("RESOLVED"); page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Resolution requirements" })).toBeVisible();
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await actions.getByRole("button", { name: "Add Action" }).click();
  await actions.getByLabel("Action Description", { exact: false }).fill("Verified network repair");
  await actions.getByLabel("Result", { exact: false }).fill("Repair applied; requester verification pending");
  await actions.getByLabel("Follow-up Required?").check();
  await actions.getByLabel("Follow-up Note", { exact: false }).fill("Ask requester to retest");
  await actions.getByRole("button", { name: "Save Action" }).click(); await expect(actions.getByText("Action saved.")).toBeVisible();
  await expect(page.getByText(/Pending Actions must/)).toBeVisible();
  await actions.getByRole("button", { name: "Edit Action: Verified network repair" }).click();
  page.once("dialog", d => d.accept()); await actions.getByRole("button", { name: "Complete action" }).click(); await expect(actions.getByText("Action completed.")).toBeVisible();
  await expect(page.getByText(/Completed Actions still require/)).toBeVisible();
  await actions.getByRole("button", { name: "Edit Action: Verified network repair" }).click();
  await actions.getByLabel("Follow-up Required?").uncheck();
  await actions.getByLabel("Follow-up Note", { exact: false }).fill("Requester retested successfully; verification complete");
  await actions.getByRole("button", { name: "Save Action" }).click(); await expect(page.getByText("Resolution requirements met. Staff review is required.")).toBeVisible();
  const history = (await (await page.request.get(`/api/staff/tickets/${id}/actions`)).json()).data;
  await change(page, "RESOLVED", "Resolved"); await expect(actions.getByRole("button", { name: "Add Action" })).toBeDisabled();
  await change(page, "CLOSED", "Closed"); await change(page, "REOPENED", "Reopened");
  expect((await (await page.request.get(`/api/staff/tickets/${id}/actions`)).json()).data).toEqual(history);
  await expect(actions.getByText("COMPLETED", { exact: true })).toBeVisible();
  const reopened = (await (await page.request.get(`/api/staff/tickets/${id}`)).json()).data;
  expect((await page.request.patch(`/api/staff/tickets/${id}/status`, { data: { status: "CLOSED", expectedWorkflowVersion: reopened.workflowVersion } })).status()).toBe(409);
  expect((await page.request.patch(`/api/staff/tickets/${id}/status`, { data: { status: "RESOLVED", expectedWorkflowVersion: 0 } })).status()).toBe(409);
  await page.getByRole("button", { name: "Refresh Ticket detail", exact: true }).click(); await expect(page.getByLabel("Next Status")).toBeEnabled();
  await change(page, "CANCELLED", "Cancelled"); await change(page, "REOPENED", "Reopened");
  await signOut(page); await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await page.goto(`/tickets/${id}`); await expect(page.getByText(/Problem Appears Resolved recorded at/)).toBeVisible();
  await expect(page.getByLabel("Next Status")).toHaveCount(0); await expect(actions.getByRole("button", { name: /Edit Action|Add Action/ })).toHaveCount(0);
  expect((await page.request.post(`/api/tickets/${id}/problem-appears-resolved`)).status()).toBe(409);
  expect((await page.request.patch(`/api/staff/tickets/${id}/status`, { data: { status: "RESOLVED", expectedWorkflowVersion: reopened.workflowVersion } })).status()).toBe(403);
  await staffDetail(page, id); await change(page, "RESOLVED", "Resolved");
});

test("confirmed status save survives GET failure and preserves original uncertain Action create/replay", async ({ page }) => {
  const id = await fixture(page, "Issue 60 confirmed save recovery"); await staffDetail(page, id);
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await actions.getByRole("button", { name: "Add Action" }).click();
  await actions.getByLabel("Action Description", { exact: false }).fill("Retained uncertain Action"); await actions.getByLabel("Result", { exact: false }).fill("Pending verification");
  const writes: unknown[] = []; let savedId = "";
  await page.route(`**/api/staff/tickets/${id}/actions`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) { const committed = await route.fetch(); expect(committed.status()).toBe(201); savedId = (await committed.json()).data.id; return route.abort("failed"); }
    return route.continue();
  });
  await actions.getByRole("button", { name: "Save Action" }).click(); await expect(actions.getByText(/Check your connection/)).toBeVisible();
  // Refresh the version after the uncertain create, preserving its in-memory key.
  await page.getByRole("button", { name: "Refresh Ticket detail", exact: true }).click(); await expect(page.getByText("Workflow version: 1")).toBeVisible();
  let fail = true;
  await page.route(`**/api/staff/tickets/${id}`, async route => {
    if (fail && route.request().method() === "GET") { fail = false; return route.fulfill({ status: 500, json: { error: { code: "INTERNAL_SERVER_ERROR", message: "Unavailable" } } }); }
    return route.continue();
  });
  const patches: unknown[] = [];
  page.on("request", req => { if (req.method() === "PATCH" && new URL(req.url()).pathname.endsWith(`/${id}/status`)) patches.push(req.postDataJSON()); });
  await page.getByLabel("Next Status").selectOption("CANCELLED"); page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Status updated/)).toBeVisible(); await expect(page.getByText(/Ticket refresh failed/)).toBeVisible();
  await expect(page.getByLabel("Next Status")).toBeDisabled(); await expect(actions.getByLabel("Result", { exact: false })).toHaveValue("Pending verification");
  await page.getByRole("button", { name: "Refresh Ticket detail", exact: true }).click(); await expect(page.getByLabel("Next Status")).toBeEnabled();
  await expect(page.getByText("Current Status:").locator("xpath=..")).toContainText("Cancelled"); expect(patches).toHaveLength(1);
  const response = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/staff/tickets/${id}/actions`);
  await actions.getByRole("button", { name: "Save Action" }).click(); const replay = await response;
  expect(replay.status()).toBe(200); expect(replay.headers()["idempotent-replay"]).toBe("true"); expect((await replay.json()).data.id).toBe(savedId);
  await expect(actions.getByText("Action saved.")).toBeVisible(); expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  const current = (await (await page.request.get(`/api/staff/tickets/${id}`)).json()).data;
  expect(current.workflowVersion).toBe(2); expect(current.actionsTakenSummary.totalItems).toBe(1);
});

test("stale workflow requires explicit refresh/new confirmation and retains the mounted Action draft", async ({ page }) => {
  const id = await fixture(page, "Issue 60 stale workflow recovery"); await staffDetail(page, id);
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await actions.getByRole("button", { name: "Add Action" }).click(); await actions.getByLabel("Action Description", { exact: false }).fill("Retained draft during stale status");
  await actions.getByLabel("Result", { exact: false }).fill("Unsubmitted outcome");
  await actions.getByLabel("Result", { exact: false }).evaluate(element => element.setAttribute("data-retained-node", "original"));
  expect((await page.request.patch(`/api/staff/tickets/${id}/status`, { data: { status: "CANCELLED", expectedWorkflowVersion: 0 } })).status()).toBe(200);
  await page.getByLabel("Next Status").selectOption("OPEN"); page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Ticket state changed/)).toBeVisible(); await expect(page.getByRole("button", { name: "Update Status" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh Ticket detail", exact: true }).click(); await expect(page.getByLabel("Next Status")).toBeEnabled();
  await expect(page.getByLabel("Next Status")).toHaveValue(""); await expect(page.getByLabel("Next Status").locator("option[value='REOPENED']")).toHaveCount(1);
  await expect(actions.getByLabel("Result", { exact: false })).toHaveValue("Unsubmitted outcome"); await expect(actions.getByLabel("Result", { exact: false })).toHaveAttribute("data-retained-node", "original");
  await change(page, "REOPENED", "Reopened"); await expect(actions.getByRole("button", { name: "Save Action" })).toBeEnabled();
  expect((await (await page.request.get(`/api/staff/tickets/${id}/actions`)).json()).meta.totalItems).toBe(0);
});

for (const width of [375, 768, 1280]) {
  test(`workflow keyboard labels and reflow at ${width}px`, async ({ page }) => {
    const id = await fixture(page, `Issue 60 workflow ${width}px`); await staffDetail(page, id);
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel("Next Status").focus(); await expect(page.getByLabel("Next Status")).toBeFocused();
    await page.getByLabel("Next Status").selectOption("OPEN");
    page.once("dialog", d => d.dismiss()); await page.getByRole("button", { name: "Update Status" }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Update Status" })).toBeFocused();
    await page.getByRole("link", { name: "Review Actions Taken" }).focus(); await page.keyboard.press("Enter"); await expect(actionsHeading(page)).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
const actionsHeading = (page: Page) => page.getByRole("heading", { name: "Actions Taken" });
