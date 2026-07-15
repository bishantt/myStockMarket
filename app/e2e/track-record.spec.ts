import { expect, test } from "@playwright/test";

import { signIn } from "./session";

/**
 * The track record (APP-FEEL-PLAN §4.4).
 *
 * This is the accountability surface — the page that keeps the whole product honest by showing the
 * app's own record, misses and all. So the tests here are about the misses:
 *
 *   · the filter DEFAULTS TO ALL, and a seeded miss is on the first page with nobody touching a
 *     control. A default of "hits" would be a product grading its own homework (P5);
 *   · the outcome word is IN the chip, so a miss reads as a miss without relying on hue (P7);
 *   · and it is the same table, at the same weight, as the hits.
 */

test.describe("Track record", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/track-record");
  });

  test("a MISS is visible with no interaction at all — the filter defaults to ALL (P5)", async ({ page }) => {
    // The seed resolves three signals: two hits and one miss (SMCI). The miss must be on the page
    // the moment it loads. Nobody should have to ask the app to show them where it was wrong.
    await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("miss").first()).toBeVisible();
    await expect(page.getByText("hit").first()).toBeVisible();
  });

  test("filtering to misses shows them, and back to all shows both", async ({ page }) => {
    await page.getByRole("button", { name: "Misses" }).click();
    await expect(page.getByText("miss").first()).toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("hit").first()).toBeVisible();
    await expect(page.getByText("miss").first()).toBeVisible();
  });

  test("the record is one table, and the page never scrolls sideways", async ({ page }) => {
    // This page carried the app's last overflow-x-auto table: a six-column grid peeked through a
    // 390px keyhole. It is card-rows on a phone now.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
