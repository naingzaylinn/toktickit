import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers.js";

test("E2E-01/05: valid Requester login and logout remove protected access", async ({ page }) => {
  await signIn(page, "alice@kmutt.ac.th");
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
  await signOut(page);
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("E2E-02: initial password blocks the shell until changed", async ({ page }) => {
  await signIn(page, "charlie@kmutt.ac.th");
  await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
  await page.getByLabel("Current Password").fill("Initial123");
  await page.getByLabel("New Password", { exact: true }).fill("Changed123");
  await page.getByLabel("Confirm New Password").fill("Changed123");
  await page.getByRole("button", { name: "Change Password" }).click();
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
});

test("E2E-03/04: invalid and inactive credentials show safe failures", async ({ page }) => {
  await signIn(page, "alice@kmutt.ac.th", "Wrong123");
  await expect(page.getByRole("alert")).toContainText("Unable to sign in");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Email" }).fill("evan@kmutt.ac.th");
  await page.getByLabel("Password", { exact: true }).fill("Initial123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to sign in");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});
