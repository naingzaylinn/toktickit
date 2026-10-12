import { expect, test } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";

test("staff and Administrator create, reassign, complete, cancel and correct; requester reads every state", async ({ page }) => {
  await signIn(page, "alice@kmutt.ac.th");
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  const categories = await (await page.request.get("/api/v1/categories")).json();
  const systems = await (await page.request.get("/api/v1/related-systems")).json();
  const response = await page.request.post("/api/tickets", { data: {
    categoryId: categories.data[0].id, relatedSystemId: systems.data[0].id,
    summary: "Issue 59 browser Actions integration", description: "Dedicated isolated browser fixture",
    clientRequestId: crypto.randomUUID(),
  } });
  expect(response.status()).toBe(201);
  const ticketId = (await response.json()).data.id;
  await signOut(page);
  await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
  await page.goto("/staff/tickets/" + ticketId);
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await expect(actions.getByText("No actions recorded for this ticket.")).toBeVisible();
  await actions.getByRole("button", { name: "Add Action" }).click();
  await expect(actions.getByLabel("Action Description", { exact: false })).toBeFocused();
  await actions.getByLabel("Action Description", { exact: false }).fill("Checked connection for browser test");
  await actions.getByLabel("Result", { exact: false }).fill("Awaiting verification");
  await actions.getByLabel("Attachment Notes").fill("Existing diagnostic file");
  await actions.getByRole("button", { name: "Save Action" }).click();
  await expect(actions.getByText("Action saved.")).toBeVisible();
  const owners = await (await page.request.get("/api/staff/tickets/owners")).json();
  const admin = owners.data.find((u: { role: string }) => u.role === "ADMINISTRATOR");
  expect(admin).toBeTruthy();
  await actions.getByRole("button", { name: /Edit Action:/ }).click();
  await actions.getByLabel("Action Assignee", { exact: false }).selectOption(admin.id);
  await actions.getByRole("button", { name: "Save Action" }).click();
  await expect(actions.getByText("Action saved.")).toBeVisible();
  await actions.getByRole("button", { name: "Add Action" }).click();
  await actions.getByLabel("Action Description", { exact: false }).fill("Duplicate diagnostic work");
  await actions.getByLabel("Result", { exact: false }).fill("Pending");
  await actions.getByRole("button", { name: "Save Action" }).click(); await expect(actions.getByText("Action saved.")).toBeVisible();
  await actions.getByRole("button", { name: "Edit Action: Duplicate diagnostic work" }).click();
  await actions.getByRole("button", { name: "Cancel action" }).click();
  await actions.getByLabel("Result", { exact: false }).fill("Cancelled duplicate task");
  page.once("dialog", d => d.accept()); await actions.getByRole("button", { name: "Cancel action" }).click();
  await expect(actions.getByText("Action cancelled.")).toBeVisible();
  await signOut(page); await signIn(page, "admin@example.com"); await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  await page.goto("/staff/tickets/" + ticketId);
  await actions.getByRole("button", { name: "Edit Action: Checked connection for browser test" }).click();
  await actions.getByLabel("Result", { exact: false }).fill("Connection restored and tested");
  page.once("dialog", async d => { expect(d.message()).toContain("Completing as"); await d.accept(); });
  await actions.getByRole("button", { name: "Complete action" }).click();
  await expect(actions.getByText("Action completed.")).toBeVisible();
  await actions.getByRole("button", { name: "Edit Action: Checked connection for browser test" }).click();
  await expect(actions.getByRole("button", { name: "Complete action" })).toHaveCount(0);
  await expect(actions.getByLabel("Action Assignee", { exact: false })).toHaveCount(0);
  await actions.getByLabel("Attachment Notes").fill("Corrected shared file reference");
  await actions.getByRole("button", { name: "Save Action" }).click(); await expect(actions.getByText("Action saved.")).toBeVisible();
  await signOut(page); await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await page.goto("/tickets/" + ticketId);
  await expect(actions.getByText("COMPLETED", { exact: true })).toBeVisible();
  await expect(actions.getByText("CANCELLED", { exact: true })).toBeVisible();
  await actions.getByText("View Action details").first().click();
  await expect(actions.getByText("Connection restored and tested")).toBeVisible();
  await expect(actions.getByText("Corrected shared file reference")).toBeVisible();
  await expect(actions.getByRole("button", { name: /Add Action|Edit Action|Complete action|Cancel action/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Internal Notes" })).toHaveCount(0);
  expect((await page.request.post(`/api/staff/tickets/${ticketId}/actions`, { data: {} })).status()).toBe(403);
});

for (const width of [375, 768, 1280]) {
  test(`Actions inline form keyboard and reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "staff1@example.com"); await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    const list = await (await page.request.get("/api/staff/tickets?status=NEW&pageSize=20")).json();
    expect(list.data.length).toBeGreaterThan(0);
    await page.goto("/staff/tickets/" + list.data[0].id);
    const actions = page.getByRole("region", { name: "Actions Taken" });
    const add = actions.getByRole("button", { name: "Add Action" }); await expect(add).toBeEnabled();
    await add.focus(); await page.keyboard.press("Enter");
    await expect(actions.getByLabel("Action Description", { exact: false })).toBeFocused();
    await actions.getByLabel("Action Description", { exact: false }).fill("Long shared text ".repeat(100));
    await actions.getByRole("button", { name: "Save Action" }).click();
    await expect(actions.getByLabel("Result", { exact: false })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    page.once("dialog", d => d.accept()); await actions.getByRole("button", { name: "Discard changes" }).click();
    await expect(add).toBeFocused();
  });
}

test("uncertain committed create survives parent refresh failure and inactive-assignee replay; workflow recovery preserves the next draft", async ({ page, browser }) => {
  await signIn(page, "alice@kmutt.ac.th");
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  const categories = await (await page.request.get("/api/v1/categories")).json();
  const systems = await (await page.request.get("/api/v1/related-systems")).json();
  const created = await page.request.post("/api/tickets", { data: { categoryId: categories.data[0].id, relatedSystemId: systems.data[0].id, summary: "Issue 59 retry recovery fixture", description: "Disposable browser fixture", clientRequestId: crypto.randomUUID() } });
  expect(created.status()).toBe(201); const ticketId = (await created.json()).data.id;
  await signOut(page); await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
  const adminContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const adminPage = await adminContext.newPage(); await signIn(adminPage, "admin@example.com");
    await expect(adminPage.getByRole("link", { name: "User Management" })).toBeVisible();
    const target = await adminPage.request.post("/api/admin/users", { data: { name: "Issue 59 retry assignee", email: `retry-${crypto.randomUUID()}@example.test`, role: "IT_STAFF", isActive: true, initialPassword: "Initial123" } });
    expect(target.status()).toBe(201); const assignee = (await target.json()).data;
    await page.goto("/staff/tickets/" + ticketId);
    const actions = page.getByRole("region", { name: "Actions Taken" });
    await actions.getByRole("button", { name: "Add Action" }).click();
    await actions.getByLabel("Action Description", { exact: false }).fill("  Retained committed work  ");
    await actions.getByLabel("Result", { exact: false }).fill("  Awaiting verification  ");
    await actions.getByLabel("Action Assignee", { exact: false }).selectOption(assignee.id);
    const writes: Record<string, unknown>[] = [];
    let committedId = "";
    await page.route(`**/api/staff/tickets/${ticketId}/actions`, async route => {
      if (route.request().method() !== "POST") return route.continue();
      writes.push(route.request().postDataJSON());
      if (writes.length === 1) {
        // Let the real backend commit; drop only the browser's response.
        const committed = await route.fetch(); expect(committed.status()).toBe(201);
        committedId = (await committed.json()).data.id;
        return route.abort("failed");
      }
      return route.continue();
    });
    await actions.getByRole("button", { name: "Save Action" }).click();
    await expect(actions.getByText(/Check your connection/)).toBeVisible();
    let failRefresh = true;
    await page.route(`**/api/staff/tickets/${ticketId}`, async route => {
      if (failRefresh && route.request().method() === "GET") {
        failRefresh = false; return route.fulfill({ status: 500, json: { error: { code: "INTERNAL_SERVER_ERROR", message: "Unavailable" } } });
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "Refresh Ticket detail", exact: true }).click();
    await expect(page.getByText(/Ticket refresh failed/)).toBeVisible();
    await expect(actions.getByLabel("Result", { exact: false })).toHaveValue("  Awaiting verification  ");
    expect((await adminPage.request.patch("/api/admin/users/" + assignee.id, { data: { isActive: false } })).status()).toBe(200);
    await actions.getByLabel("Actions per page").selectOption("50");
    await expect(actions.getByRole("option", { name: "Issue 59 retry assignee (IT_STAFF)" })).toHaveCount(0);
    await expect(actions.getByText("Loading eligible assignees...")).toHaveCount(0);
    const replayResponse = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/staff/tickets/${ticketId}/actions`);
    await actions.getByRole("button", { name: "Save Action" }).click();
    const replay = await replayResponse;
    expect(replay.status()).toBe(200); expect(replay.headers()["idempotent-replay"]).toBe("true");
    expect((await replay.json()).data.id).toBe(committedId);
    await expect(actions.getByText("Action saved.")).toBeVisible();
    expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
    const saved = await (await page.request.get(`/api/staff/tickets/${ticketId}/actions`)).json();
    expect(saved.meta.totalItems).toBe(1); expect(saved.data).toHaveLength(1);
    expect(saved.data[0].id).toBe(committedId); expect(saved.data[0].version).toBe(1);
    expect(saved.data[0].assignee.isActive).toBe(false);
    await actions.getByRole("button", { name: "Add Action" }).click();
    await actions.getByLabel("Action Description", { exact: false }).fill("Next work draft");
    await actions.getByLabel("Result", { exact: false }).fill("Retained next outcome");
    expect((await adminPage.request.patch(`/api/staff/tickets/${ticketId}/status`, { data: { status: "CANCELLED" } })).status()).toBe(200);
    await actions.getByRole("button", { name: "Save Action" }).click();
    await expect(actions.getByText(/requires the Ticket to be reopened/)).toBeVisible();
    expect(writes).toHaveLength(3);
    await actions.getByRole("button", { name: "Refresh Ticket and Actions for review" }).click();
    await expect(actions.getByText(/Current Ticket status: CANCELLED/)).toBeVisible();
    await expect(page.getByLabel("Next Status")).toContainText("Reopened");
    await expect(actions.getByLabel("Result", { exact: false })).toHaveValue("Retained next outcome");
    await expect(actions.getByRole("button", { name: "Save Action" })).toBeDisabled();
    expect(writes).toHaveLength(3);
  } finally { await adminContext.close(); }
});
