import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers.js";

test("E2E-18: Requester creates and views a ticket with an attachment", async ({ page }) => {
  await signIn(page, "bob@kmutt.ac.th");
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "Printing Service" });
  await page.getByLabel("Ticket Summary").fill("Browser attachment regression ticket");
  await page.getByLabel("Description").fill("Printer output needs inspection.");
  await page.getByLabel("Select files").setInputFiles({
    name: "evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
  });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByText("Browser attachment regression ticket")).toBeVisible();
  await expect(page.getByText("evidence.pdf")).toBeVisible();
  const ticketId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Comment").fill("Requester follow-up from browser");
  await page.getByRole("button", { name: "Submit Comment" }).click();
  await expect(page.getByText("Requester follow-up from browser")).toBeVisible();
  await signOut(page);

  await signIn(page, "alice@kmutt.ac.th");
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText("Browser attachment regression ticket")).toHaveCount(0);
  await expect(page.getByText("evidence.pdf")).toHaveCount(0);
});
