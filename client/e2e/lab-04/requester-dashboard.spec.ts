import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";
async function dashboard(page: Page, email = "alice@kmutt.ac.th") {
  await signIn(page, email); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.goto("/dashboard"); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
}
const statuses = ["New", "Open", "InProgress", "WaitingForRequester", "Resolved", "Closed", "Reopened", "Cancelled"];
const keys = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
test("real metrics, every drilldown and browser back/forward", async ({ page }) => {
  await dashboard(page); const dto = await (await page.request.get("/api/requester/dashboard")).json(); const d = dto.data;
  const links: Array<[string, string, number]> = [[`Total My Tickets ${d.totalTickets}`, "", d.totalTickets], [`Active Tickets ${d.activeTickets}`, "statusGroup=active", d.activeTickets], [`Waiting for you ${d.waitingForRequesterTickets}`, "currentStatus=WaitingForRequester", d.waitingForRequesterTickets], [`Resolved Tickets ${d.resolvedTickets}`, "currentStatus=Resolved", d.resolvedTickets]];
  for (const [name, query, count] of links) {
    const api = await (await page.request.get("/api/tickets?" + query)).json(); expect(api.pagination.totalItems).toBe(count);
    await page.getByRole("link", { name, exact: true }).click(); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    for (const [key, value] of new URLSearchParams(query)) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    await page.goBack(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  }
  for (let i = 0; i < statuses.length; i++) {
    const api = await (await page.request.get("/api/tickets?currentStatus=" + statuses[i])).json(); expect(api.pagination.totalItems).toBe(d.byStatus[keys[i]]);
    await page.locator(`a[href="/tickets?currentStatus=${statuses[i]}"]`).last().click(); await expect(page.getByLabel("Status", { exact: true })).toHaveValue(statuses[i]);
    await page.goBack(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  }
  for (const [name, status] of [["View all recently updated Tickets", ""], ["View all recently updated resolved Tickets", "Resolved"]]) {
    await page.getByRole("link", { name, exact: true }).click(); await expect(page.getByLabel("Sort By")).toHaveValue("recentlyUpdated"); await expect(page.getByLabel("Status", { exact: true })).toHaveValue(status);
    await page.goBack(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  }
  await page.goForward(); await expect(page.getByLabel("Sort By")).toHaveValue("recentlyUpdated");
});
test("two Requesters have distinct personal rows and foreign detail is concealed", async ({ page }) => {
  await dashboard(page, "alice@kmutt.ac.th");
  const categories = (await (await page.request.get("/api/v1/categories")).json()).data; const systems = (await (await page.request.get("/api/v1/related-systems")).json()).data;
  const created = await page.request.post("/api/tickets", { data: { categoryId: categories[0].id, relatedSystemId: systems[0].id, summary: "Requester dashboard privacy " + crypto.randomUUID(), description: "Private owned ticket", clientRequestId: crypto.randomUUID() } }); expect(created.status()).toBe(201); const t = (await created.json()).data;
  await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByRole("link", { name: `${t.ticketNumber}: ${t.summary}`, exact: true })).toBeVisible();
  await signOut(page); await dashboard(page, "bob@kmutt.ac.th");
  const own = (await (await page.request.get("/api/requester/dashboard")).json()).data; const list = (await (await page.request.get("/api/tickets")).json()); expect(own.totalTickets).toBe(list.pagination.totalItems);
  expect(own.recentTickets.some((row: { id: string }) => row.id === t.id)).toBe(false); expect(own.resolvedTicketsRecent.some((row: { id: string }) => row.id === t.id)).toBe(false);
  await expect(page.getByText(t.summary, { exact: true })).toHaveCount(0); const foreign = await page.request.get("/api/tickets/" + t.id); expect(foreign.status()).toBe(404);
  await page.goto("/tickets/" + t.id); await expect(page.getByText("Ticket Not Found", { exact: true })).toBeVisible(); await expect(page.getByText(t.summary, { exact: true })).toHaveCount(0);
});
test("recent/resolved rows navigate detail; filtered list explicit Back preserves URL", async ({ page }) => {
  await dashboard(page); const d = (await (await page.request.get("/api/requester/dashboard")).json()).data;
  for (const [section, rows] of [["Recently Updated Tickets", d.recentTickets], ["Recently Updated Resolved Tickets", d.resolvedTicketsRecent]] as const) {
    expect(rows.length).toBeGreaterThan(0); const row = rows[0]; await page.getByRole("region", { name: section, exact: true }).getByRole("link", { name: row.ticketNumber + ": " + row.summary, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/tickets/" + row.id + "$")); await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible(); await page.goBack(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  }
  await page.getByRole("link", { name: "View all recently updated resolved Tickets", exact: true }).click(); await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Resolved");
  const url = page.url(); const summary = d.resolvedTicketsRecent[0].summary; await page.getByText(summary, { exact: true }).filter({ visible: true }).first().click(); await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Back to My Tickets/ }).click(); await expect(page).toHaveURL(url); await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Resolved");
});
test("initial loading, failure, refresh recovery, empty and forbidden clearing", async ({ page }) => {
  await signIn(page, "alice@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); await page.route("**/api/requester/dashboard", async route => { await gate; await route.abort(); });
  await page.goto("/dashboard"); await expect(page.getByRole("status").filter({ hasText: "Loading dashboard" })).toBeVisible(); await expect(page.getByRole("link", { name: /^Total My Tickets/ })).toHaveCount(0); release();
  await expect(page.getByRole("button", { name: "Retry: Error" })).toBeVisible(); await page.unroute("**/api/requester/dashboard"); await page.getByRole("button", { name: "Retry: Error" }).click(); await expect(page.getByRole("link", { name: /^Total My Tickets/ })).toBeVisible();
  const timestamp = await page.locator("time").first().getAttribute("datetime"); await page.route("**/api/requester/dashboard", route => route.abort()); await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByText(/Showing previously loaded data/)).toBeVisible(); expect(await page.locator("time").first().getAttribute("datetime")).toBe(timestamp);
  await page.unroute("**/api/requester/dashboard"); await page.getByRole("button", { name: "Retry: Error" }).click(); await expect(page.getByText(/Showing previously loaded data/)).toHaveCount(0);
  await page.route("**/api/requester/dashboard", route => route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN", message: "Unavailable" } } })); await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByRole("link", { name: /^Total My Tickets/ })).toHaveCount(0); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
  await page.unroute("**/api/requester/dashboard"); await page.goto("/tickets"); await signOut(page); await dashboard(page, "lab4-empty@example.com"); await expect(page.getByRole("link", { name: "Total My Tickets 0", exact: true })).toBeVisible(); await expect(page.getByRole("link", { name: "Create Ticket", exact: true }).last()).toBeVisible();
});
for (const email of ["staff1@example.com", "admin@example.com"]) test(`${email} denied Requester dashboard`, async ({ page }) => {
  await signIn(page, email); await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible(); expect((await page.request.get("/api/requester/dashboard")).status()).toBe(403);
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/staff/dashboard"); await page.goto("/dashboard"); await expect(page.getByText("This page is not available for your role.")).toBeVisible(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toHaveCount(0);
});

test("held previous-user refresh cannot restore data after logout/login", async ({ page }) => {
 await dashboard(page); let release!: () => void, arrive!: () => void; const gate = new Promise<void>(r => { release = r; }); const reached = new Promise<void>(r => { arrive = r; }); let first = true;
 let previousRows: Array<{ ticketNumber: string; summary: string }> = [];
 await page.route("**/api/requester/dashboard", async route => {
   if (!first) return route.continue(); first = false;
   const response = await route.fetch(); const dto = await response.json(); previousRows = dto.data.recentTickets; arrive(); await gate; await route.fulfill({ response, json: dto });
 });
 await page.getByRole("button", { name: "Refresh", exact: true }).click(); await reached;
 try {
   await signOut(page); await dashboard(page, "bob@kmutt.ac.th");
   for (const row of previousRows) await expect(page.getByRole("link", { name: row.ticketNumber + ": " + row.summary, exact: true })).toHaveCount(0);
 } finally { release(); }
 await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
 for (const row of previousRows) await expect(page.getByRole("link", { name: row.ticketNumber + ": " + row.summary, exact: true })).toHaveCount(0);
});

test("Detail browser restoration preserves its originating filtered list", async ({ page }) => {
 await dashboard(page);
 await page.getByRole("link", { name: "View all recently updated resolved Tickets", exact: true }).click();
 await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Resolved");
 const listUrl = page.url();
 const list = await (await page.request.get("/api/tickets?currentStatus=Resolved&sortBy=recentlyUpdated")).json();
 expect(list.data.length).toBeGreaterThan(0);
 await page.getByText(list.data[0].summary, { exact: true }).filter({ visible: true }).first().click();
 await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
 const detailUrl = page.url();
 await page.getByRole("link", { name: "Dashboard", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
 await page.goBack(); await expect(page).toHaveURL(detailUrl);
 await page.goForward(); await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
 await page.goBack(); await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
 await page.getByRole("button", { name: /Back to My Tickets/ }).click(); await expect(page).toHaveURL(listUrl);
});
test("out-of-range My Tickets page recovers with filters intact", async ({ page }) => {
 await dashboard(page); await page.goto("/tickets?currentStatus=Resolved&sortBy=recentlyUpdated&page=99");
 await expect(page.getByText("No Tickets on This Page", { exact: true })).toBeVisible();
 await expect(page.getByText("You have not submitted any IT support tickets yet.", { exact: true })).toHaveCount(0);
 await page.getByRole("button", { name: "Go to First Page" }).click();
 await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Resolved"); await expect(page.getByLabel("Sort By")).toHaveValue("recentlyUpdated");
 await expect(page).toHaveURL(/currentStatus=Resolved&sortBy=recentlyUpdated$/);
 await page.goBack(); await expect(page.getByText("No Tickets on This Page", { exact: true })).toBeVisible();
});
