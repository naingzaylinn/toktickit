import { expect, test, type Page, type Request } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers.js";

function consoleGuard(page: Page, expected: Array<{ path: string; text: string }> = []) {
 const failures: Array<{ text: string; url: string }> = [];
 const pageErrors: string[] = [];
 const active = new Set<Request>();
 const expectedDenials = new Set<Request>();
 const denialCredits = new Map<string, number>();
 let phase: "signed-out" | "authenticated" | "logout" = "signed-out";
 const logoutReads = ["/api/auth/me", "/api/staff/tickets", "/api/tickets", "/api/v1/categories", "/api/v1/related-systems"];
 page.on("request", req => {
  active.add(req);
  if (req.method() === "GET" && ((phase === "signed-out" && new URL(req.url()).pathname === "/api/auth/me") || (phase === "logout" && logoutReads.includes(new URL(req.url()).pathname)))) expectedDenials.add(req);
 });
 page.on("requestfinished", req => active.delete(req));
 page.on("requestfailed", req => active.delete(req));
 page.on("response", response => {
  if (response.status() === 401 && expectedDenials.has(response.request())) denialCredits.set(response.url(), (denialCredits.get(response.url()) ?? 0) + 1);
 });
 page.on("pageerror", error => pageErrors.push(error.message));
 page.on("console", message => {
  if (message.type() !== "error") return;
  const location = message.location().url;
  failures.push({ text: message.text(), url: location });
 });
 return {
  check: () => {
   const credits = new Map(denialCredits);
   const unexpected = failures.filter(message => {
    // Match only actual 401 responses to signed-out probes or requests captured
    // at explicit logout. A delayed old response may arrive after the next login.
    // Consume one allowance per concrete response; current-session failures and
    // every pageerror remain failures regardless of the current UI phase.
    if (message.text === "Failed to load resource: the server responded with a status of 401 (Unauthorized)" && (credits.get(message.url) ?? 0) > 0) {
     credits.set(message.url, credits.get(message.url)! - 1); return false;
    }
    return !expected.some(rule => rule.path === (message.url ? new URL(message.url).pathname : "") && rule.text === message.text);
   });
   expect(pageErrors, "Unexpected page errors").toEqual([]);
   expect(unexpected, "Unexpected browser console errors").toEqual([]);
  },
  phase: (value: typeof phase) => {
   if (value === "logout") for (const req of active) if (req.method() === "GET" && logoutReads.includes(new URL(req.url()).pathname)) expectedDenials.add(req);
   phase = value;
  },
 };
}
async function form(page: Page, summary: string) {
 await page.getByRole("link", { name: "Create Ticket" }).click();
 await page.getByLabel("Category").selectOption({ label: "Hardware" });
 await page.getByLabel("Related System").selectOption({ label: "Printing Service" });
 await page.getByLabel("Ticket Summary").fill(summary);
 await page.getByLabel("Description").fill("Disposable Issue 63 regression Ticket.");
}
test("F-01/F-02: lost committed creation response retries one logical Ticket", async ({ page }) => {
 // Only this intentionally aborted creation response may emit this exact resource error.
 const assertConsole = consoleGuard(page, [{ path: "/api/tickets", text: "Failed to load resource: net::ERR_FAILED" }]);
 await signIn(page, "bob@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
 assertConsole.phase("authenticated");
 const summary = "Issue63 response-loss " + crypto.randomUUID(); await form(page, summary);
 const inputs: any[] = []; let createdId = "";
 await page.route("**/api/tickets", async route => {
  if (route.request().method() !== "POST") return route.continue();
  inputs.push(route.request().postDataJSON()); const response = await route.fetch();
  if (inputs.length === 1) { expect(response.status()).toBe(201); createdId = (await response.json()).data.id; return route.abort("failed"); }
  expect(response.status()).toBe(200); expect((await response.json()).data.id).toBe(createdId); await route.fulfill({ response });
 });
 await page.getByRole("button", { name: "Submit Ticket" }).click(); await expect(page.getByRole("alert")).toContainText("Unable to submit");
 await page.getByRole("button", { name: "Submit Ticket" }).click(); await expect(page).toHaveURL(new RegExp("/tickets/" + createdId + "$"));
 expect(inputs).toHaveLength(2); expect(inputs[0]).toEqual(inputs[1]);
 const list = await (await page.request.get("/api/tickets?q=" + encodeURIComponent(summary))).json(); expect(list.pagination.totalItems).toBe(1); expect(list.data[0].id).toBe(createdId);
 assertConsole.check();
});
test("F-06/F-07: mixed uploads report failures and retry on the existing Ticket", async ({ page }) => {
 const assertConsole = consoleGuard(page); await signIn(page, "bob@kmutt.ac.th"); await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
 assertConsole.phase("authenticated");
 const summary = "Issue63 partial-upload " + crypto.randomUUID(); await form(page, summary);
 const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
 await page.getByLabel("Select files").setInputFiles([{ name: "accepted.pdf", mimeType: "application/pdf", buffer: pdf }, { name: "rejected.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") }]);
 await page.getByRole("button", { name: "Submit Ticket" }).click();
 await expect(page.getByRole("heading", { name: /Ticket TKT-.* created/ })).toBeVisible();
 await expect(page.getByRole("heading", { name: /Ticket TKT-.* created/ })).toBeFocused();
 await expect(page.getByRole("status").filter({ hasText: "Ticket created successfully" })).toContainText("1 attachment(s) uploaded; 1 failed");
 await expect(page.getByText(/rejected.txt: Unsupported file format/)).toBeVisible();
 await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Open Ticket to review and retry attachments" })).toBeFocused(); await page.keyboard.press("Enter");
 await expect(page.getByText(summary)).toBeVisible(); const id = new URL(page.url()).pathname.split("/").at(-1)!;
 await page.getByLabel("+ Upload Attachment").setInputFiles({ name: "retry.pdf", mimeType: "application/pdf", buffer: pdf });
 await expect(page.getByText("retry.pdf")).toBeVisible();
 const detail = await (await page.request.get("/api/tickets/" + id)).json(); expect(detail.data.activeAttachments.map((a:any) => a.originalFilename).sort()).toEqual(["accepted.pdf", "retry.pdf"]);
 const list = await (await page.request.get("/api/tickets?q=" + encodeURIComponent(summary))).json(); expect(list.pagination.totalItems).toBe(1); expect(list.data[0].activeAttachmentCount).toBe(2);
 await page.getByRole("link", { name: "My Tickets", exact: true }).click();
 await page.getByLabel("Search").fill(summary); const row = page.locator("tbody tr").filter({ hasText: summary });
 const attachmentColumn = await page.getByRole("columnheader", { name: "Attachments", exact: true }).evaluate(el => (el as HTMLTableCellElement).cellIndex);
 await expect(row.getByRole("cell").nth(attachmentColumn)).toHaveText("2");
 assertConsole.check();
});
test("critical Requester, Staff and Administrator dashboard navigation is console clean", async ({ page }) => {
 const assertConsole = consoleGuard(page);
 for (const email of ["bob@kmutt.ac.th", "staff1@example.com", "admin@example.com"]) {
  await signIn(page, email); await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  assertConsole.phase("authenticated");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click(); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  assertConsole.phase("logout"); await signOut(page); assertConsole.phase("signed-out");
 }
 assertConsole.check();
});
