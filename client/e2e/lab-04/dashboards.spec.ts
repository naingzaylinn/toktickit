import { expect, test } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";

for (const email of ["staff1@example.com", "admin@example.com"]) {
  test(`${email}: real metrics, Queue predicate navigation and recoverable refresh`, async ({ page }) => {
    await signIn(page, email); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    const dto = (await (await page.request.get("/api/staff/dashboard")).json()).data;
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("link", { name: `Total Tickets ${dto.totalTickets}`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `My Active Tickets ${dto.myActiveTickets}`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
    await page.route("**/api/staff/dashboard", route => route.abort());
    await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByText(/Showing previously loaded data/)).toBeVisible();
    await expect(page.getByRole("link", { name: `Total Tickets ${dto.totalTickets}`, exact: true })).toBeVisible();
    await page.unroute("**/api/staff/dashboard"); await page.getByRole("button", { name: "Retry: Error" }).click(); await expect(page.getByText(/Showing previously loaded data/)).toHaveCount(0);
    await page.getByRole("link", { name: `Unassigned Active Tickets ${dto.unassignedActiveTickets}`, exact: true }).click();
    await expect(page.getByLabel("Status group")).toHaveValue("active"); await expect(page.getByLabel("Ownership")).toHaveValue("unassigned");
    const queue = (await (await page.request.get("/api/staff/tickets?statusGroup=active&owner=unassigned")).json()); expect(queue.meta.totalItems).toBe(dto.unassignedActiveTickets);
    await page.goBack(); await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await page.goForward(); await expect(page.getByLabel("Ownership")).toHaveValue("unassigned");
  });
}
test("requester cannot view staff dashboard through navigation, direct URL or API", async ({ page }) => {
  await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("link", { name: "My Tickets", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
  expect((await page.request.get("/api/staff/dashboard")).status()).toBe(403);
  await page.goto("/staff/dashboard"); await expect(page.getByText("This page is not available for your role.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Total Tickets/ })).toHaveCount(0);
});
test("original Action links load their bounded history page and focus actual target", async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("link", { name: "My Tickets", exact: true })).toBeVisible();
  const categories = (await (await page.request.get("/api/v1/categories")).json()).data;
  const systems = (await (await page.request.get("/api/v1/related-systems")).json()).data;
  const created = await page.request.post("/api/tickets", { data: { categoryId: categories[0].id, relatedSystemId: systems[0].id, summary: "Dashboard deep-link fixture", description: "Issue 61 disposable fixture", clientRequestId: crypto.randomUUID() } }); expect(created.status()).toBe(201);
  const ticket = (await created.json()).data; await signOut(page); await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Ticket Queue", exact: true })).toBeVisible();
  let actionId = "";
  for (let i = 0; i < 23; i++) {
    const r = await page.request.post(`/api/staff/tickets/${ticket.id}/actions`, { data: { clientRequestId: crypto.randomUUID(), actionDescription: `Dashboard recorded work ${i}`, actionResult: "Awaiting verification", followUpRequired: false } }); expect(r.status()).toBe(201); actionId = (await r.json()).data.id;
  }
  await page.goto("/staff/dashboard"); const actionLink = page.getByRole("link", { name: `${ticket.ticketNumber}: Dashboard recorded work 22`, exact: true }); await expect(actionLink).toBeVisible();
  const history = page.waitForResponse(r => new URL(r.url()).pathname === `/api/staff/tickets/${ticket.id}/actions` && new URL(r.url()).searchParams.get("focusActionId") === actionId);
  await actionLink.click(); const dto = await (await history).json(); expect(dto.meta.page).toBe(2); expect(dto.data.length).toBeLessThanOrEqual(20);
  const target = page.locator(`[id="action-${actionId}"]`); await expect(target).toBeVisible(); await expect(target).toBeFocused();
  expect(new URL(page.url()).pathname).toBe(`/staff/tickets/${ticket.id}`);
  await signOut(page); await signIn(page, "admin@example.com"); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click(); await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: `${ticket.ticketNumber}: Dashboard recorded work 22`, exact: true })).toHaveCount(0);
});
test("empty response retains zero links; forbidden refresh clears cached operations", async ({ page }) => {
  await signIn(page, "staff1@example.com"); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  const dto = await (await page.request.get("/api/staff/dashboard")).json();
  for (const key of ["totalTickets", "activeTickets", "unassignedActiveTickets", "myActiveTickets"]) dto.data[key] = 0;
  for (const key of Object.keys(dto.data.byStatus)) dto.data.byStatus[key] = 0;
  for (const key of Object.keys(dto.data.activeByItPriority)) dto.data.activeByItPriority[key] = 0;
  dto.data.recentTickets = []; dto.data.myActions = { totalItems: 0, items: [] };
  await page.route("**/api/staff/dashboard", route => route.fulfill({ json: dto })); await page.goto("/staff/dashboard");
  await expect(page.getByRole("link", { name: "Total Tickets 0", exact: true })).toBeVisible(); await expect(page.getByText(/No recent Tickets/)).toBeVisible();
  await page.unroute("**/api/staff/dashboard"); await page.route("**/api/staff/dashboard", route => route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN", message: "Unavailable" } } }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByText(/dashboard is unavailable/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Total Tickets/ })).toHaveCount(0); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
});
