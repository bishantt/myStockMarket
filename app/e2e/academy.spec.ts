import { expect, test } from "@playwright/test";

import { signIn } from "./session";

/**
 * Journey — the Academy room opens, a lesson reads, and the return rail leads home (plan §9.3, P5).
 * Behind the same login wall as the Desk; no seeded database needed (lessons are files).
 */

test.describe("The Academy", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the curriculum map lists the M0 lessons and a lesson reads", async ({ page }) => {
    await page.goto("/academy");
    await expect(page.getByRole("heading", { name: "The Academy" })).toBeVisible();
    await page.getByRole("link", { name: "Reading a base-rate sentence" }).click();
    await expect(page).toHaveURL(/\/academy\/reading-a-base-rate-sentence/);
    await expect(page.getByRole("heading", { name: "Reading a base-rate sentence" })).toBeVisible();
    // The frontmatter retrieval questions close the lesson.
    await expect(page.getByRole("heading", { name: "Check yourself" })).toBeVisible();
  });

  test("the return rail leads back to the Desk", async ({ page, isMobile }) => {
    await page.goto("/academy");

    // A doorway always has a way home — but on a phone the way home is the tab bar's Desk tab, not
    // a second link (§4.2). Two competing doorways on a 375px row is one doorway too many, so the
    // top-bar rail is desktop-only. The rule that matters — you can always get back — holds in both.
    if (isMobile) {
      await page.getByTestId("tab-bar").getByRole("link", { name: "Desk" }).click();
    } else {
      await page.getByRole("link", { name: "← Back to Desk" }).click();
    }

    await expect(page).toHaveURL("/");
  });

  test("no live prices anywhere under the Academy (journey 3 guard)", async ({ page }) => {
    // A live price reads as $123.45 — a dollar sign with decimals. Regulatory figures like the
    // $25,000 PDT threshold have no decimals, so this catches quotes without false-flagging facts.
    const pricePattern = /\$\d[\d,]*\.\d/;
    for (const path of [
      "/academy",
      "/academy/glossary",
      "/academy/gaps-what-the-data-says",
      "/academy/how-our-base-rates-are-computed",
    ]) {
      await page.goto(path);
      const body = (await page.locator("body").innerText()) ?? "";
      expect(body, `price leaked on ${path}`).not.toMatch(pricePattern);
    }
  });

  test("the glossary index lists terms with lesson doorways", async ({ page }) => {
    await page.goto("/academy");
    await page.getByRole("link", { name: "Glossary →" }).click();
    await expect(page).toHaveURL(/\/academy\/glossary/);
    await expect(page.getByRole("heading", { name: "Glossary" })).toBeVisible();
    await expect(page.getByText("RVOL", { exact: true })).toBeVisible();
  });

  test("the review queue opens (journey 6) and never overwhelms", async ({ page }) => {
    await page.goto("/academy/review");
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    // The cap message is always present; the queue never shows a wall of cards (cap = 5, unit-tested).
    await expect(page.getByText(/At most 5 a day/)).toBeVisible();
  });

  test("a pattern lesson shows the M3 soft gate before M3 is complete", async ({ page }) => {
    await page.goto("/academy/rsi-and-oscillators");
    // Soft, not a lock: the notice is present but the lesson body still renders.
    await expect(page.getByText("Risk before patterns")).toBeVisible();
    await expect(page.getByRole("heading", { name: "RSI and oscillators" })).toBeVisible();
  });
});
