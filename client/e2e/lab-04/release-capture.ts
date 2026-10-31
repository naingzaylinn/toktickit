import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Opt-in evidence is kept outside source. Never read excluded references or env.
export async function captureRelease(page: Page, name: string, role: string, state: string) {
  if (process.env.ZEN_GREEN_SCREENSHOTS !== "1") return;
  const root = path.resolve("..");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const source = new Set(git("ls-files", "--", "client/src").split(/\r?\n/).filter(Boolean));
  source.add("client/src/components/common/useDialogFocus.ts");
  source.add("client/src/components/common/useMutationContext.ts");
  const sourceHashes = Object.fromEntries([...source].sort().map(file => [file, createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex")]));
  const destination = path.resolve("node_modules/.cache/issue-64-evidence"); mkdirSync(destination, { recursive: true });
  const originalScroll = await page.evaluate(() => document.documentElement.style.scrollBehavior);
  const originalFocus = await page.evaluateHandle(() => document.activeElement);
  try {
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Bootstrap smooth focus scrolling can continue after a form receives focus.
      // Suppress motion only for capture, preserving all rendered layout/content.
      document.documentElement.style.scrollBehavior = "auto";
      // A focused offscreen textarea can restore caret visibility after scrolling.
      // Capture the normal reading state; keyboard focus is asserted separately.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: path.join(destination, `${name}.png`), fullPage: true });
    writeFileSync(path.join(destination, `${name}.json`), JSON.stringify({ head: git("rev-parse", "HEAD"), branch: git("branch", "--show-current"), provenance: "Issue #64 uncommitted working tree; disposable E2E schema and temporary storage", role, state, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), displayTimezone: "Asia/Bangkok", captureScrollBehavior: "auto; original inline setting restored after capture", captureFocus: "Normal reading state; original control restored with preventScroll after capture. Keyboard/focus assertions are separate.", sourceHashes }, null, 2) + "\n");
  } finally {
    await originalFocus.evaluate(element => { if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true }); });
    await originalFocus.dispose();
    await page.evaluate(value => { document.documentElement.style.scrollBehavior = value; }, originalScroll);
  }
}
