import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { AuthUser } from "../../src/api.js";

// UI-only browser checks: intercept every API call; no server or database is used.
const widths = [375, 768, 1280];
const longName = "VeryLongUnbrokenAuthenticatedUserName".repeat(4);
const account: AuthUser = { id: "user", name: longName, email: "user@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false };
const managedUser = { ...account, id: "managed", name: "Alice", email: "alice@example.com" };
const ticket = {
  id: "ticket-1", ticketNumber: "TKT-1", summary: "Wi-Fi issue", description: "Cannot connect to the campus network.",
  category: { id: 1, name: "Network" }, relatedSystem: { id: "sys", name: "Campus Wi-Fi" },
  requester: managedUser, requestedPriority: "HIGH", itPriority: "MEDIUM", status: "NEW", owner: null,
  ticketDate: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z",
  problemAppearsResolvedAt: null, attachments: [], publicComments: [], internalNotes: [],
};

async function mockApi(page: Page, initial: AuthUser | null) {
  let current = initial;
  const unexpected: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const data = (value: unknown) => route.fulfill({ json: { data: value } });
    if (path === "/api/auth/me") return current ? data(current) : route.fulfill({ status: 401, json: { error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in." } } });
    if (path === "/api/auth/login") { current = { ...account, mustChangePassword: true }; return data({ user: current }); }
    if (path === "/api/auth/change-password") { current = { ...account }; return data({ message: "Password changed successfully." }); }
    if (path === "/api/auth/logout") { current = null; return data({}); }
    if (path === "/api/v1/categories") return data([{ id: 1, name: "Network", isActive: true }]);
    if (path === "/api/v1/related-systems") return data([{ id: "sys", name: "Campus Wi-Fi", isActive: true }]);
    if (path === "/api/tickets" && method === "GET") return route.fulfill({ json: { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } } });
    if (path === "/api/admin/users" && method === "GET") return data([managedUser]);
    if (path === "/api/staff/tickets/owners") return data([{ id: "user", name: "Staff", role: "IT_STAFF" }]);
    if (path === "/api/staff/tickets/ticket-1" && method === "GET") return data(ticket);
    // Never allow unhandled API traffic through to Vite's backend proxy.
    unexpected.push(`${method} ${path}`);
    return route.abort();
  });
  return unexpected;
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}
async function identity(page: Page, width: number, role: string) {
  const badge = page.getByTestId("requester-badge");
  await expect(badge).toHaveCount(1);
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(`${role}: ${longName}`);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  if (width < 992) await expect(page.getByRole("button", { name: "Toggle navigation" })).toHaveAttribute("aria-expanded", "false");
  expect(await badge.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await noOverflow(page);
}
async function openMenu(page: Page, width: number) {
  if (width < 992) await page.getByRole("button", { name: "Toggle navigation" }).click();
}

async function capture(page: Page, info: TestInfo, name: string) {
  if (process.env.UI_COMPLIANCE_SCREENSHOTS === "1") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  }
}

for (const width of widths) {
  test(`UI-only authentication and requester navigation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    const unexpected = await mockApi(page, null);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await noOverflow(page);
    await page.getByRole("textbox", { name: "Email" }).fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Initial123");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByLabel("New Password", { exact: true })).toHaveAccessibleDescription(/at least one letter and one number/);
    await page.getByRole("button", { name: "Change Password" }).click();
    for (const label of ["Current Password", "New Password", "Confirm New Password"]) await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("aria-invalid", "true");
    await noOverflow(page);
    await capture(page, info, "password-validation");
    await page.getByLabel("Current Password").fill("Initial123");
    await page.getByLabel("New Password", { exact: true }).fill("abcdefg1");
    await page.getByLabel("Confirm New Password").fill("abcdefg1");
    await page.getByRole("button", { name: "Change Password" }).click();
    await identity(page, width, "Requester");
    await capture(page, info, "mobile-identity");
    await openMenu(page, width);
    const create = page.getByRole("link", { name: "Create Ticket", exact: true });
    await expect(create).toHaveCSS("background-color", "rgb(0, 107, 60)");
    await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
    await create.click();
    await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
    await identity(page, width, "Requester");
    await openMenu(page, width);
    await expect(create).toHaveAttribute("aria-current", "page");
    await expect(create).toHaveCSS("color", "rgb(255, 255, 255)");
    await noOverflow(page);
    await capture(page, info, "requester-navigation");
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(unexpected).toEqual([]);
  });

  test(`UI-only administrator forms at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    const unexpected = await mockApi(page, { ...account, role: "ADMINISTRATOR" });
    await page.goto("/admin/users");
    await identity(page, width, "Administrator");
    await page.getByRole("button", { name: "Create User" }).click();
    await page.getByRole("button", { name: "Save User" }).click();
    for (const label of ["Name", "Email", "Initial Password"]) await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("aria-invalid", "true");
    await noOverflow(page);
    await capture(page, info, "administrator-form");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("");
    await page.getByRole("button", { name: "Save User" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveAccessibleDescription(/required/);
    await noOverflow(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Set initial password", exact: true }).click();
    await page.getByLabel("New initial password", { exact: true }).fill("short");
    await page.getByLabel("Confirm initial password", { exact: true }).fill("different");
    await page.getByRole("button", { name: "Set Password", exact: true }).click();
    await expect(page.getByLabel("New initial password", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Confirm initial password", { exact: true })).toHaveAccessibleDescription(/must match/);
    await noOverflow(page);
    await capture(page, info, "administrator-password");
    await openMenu(page, width);
    await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
    expect(unexpected).toEqual([]);
  });

  test(`UI-only staff validation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    const unexpected = await mockApi(page, { ...account, role: "IT_STAFF" });
    await page.goto("/staff/tickets/ticket-1");
    await identity(page, width, "IT Staff");
    await page.getByRole("button", { name: "Post Public Comment" }).click();
    await expect(page.getByLabel("Public Comment", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Public Comment", { exact: true })).toHaveAccessibleDescription(/must contain/);
    await page.getByRole("button", { name: "Add Internal Note" }).click();
    await expect(page.getByLabel("Internal Note", { exact: true })).toHaveAccessibleDescription(/must contain/);
    await noOverflow(page);
    await capture(page, info, "staff-validation");
    await openMenu(page, width);
    await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(unexpected).toEqual([]);
  });
}
