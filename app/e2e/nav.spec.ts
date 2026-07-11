import { expect, test } from "@playwright/test";

/**
 * Mobile nav — the top bar keeps the selection in sync with the route, and no page scrolls sideways
 * (plan §3.8, mobile fix). Regression cover for the reported iPhone bugs: Scans not highlighting, and
 * the whole page drifting off-axis.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Mobile navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the current room is highlighted, and it moves with the route", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[aria-current="page"]')).toHaveText("Desk");

    await page.goto("/scans");
    await expect(page.locator('[aria-current="page"]')).toHaveText("Scans");

    await page.goto("/paper");
    await expect(page.locator('[aria-current="page"]')).toHaveText("Paper");
  });

  test("no page scrolls horizontally on a phone", async ({ page }) => {
    for (const path of ["/", "/scans", "/paper", "/track-record"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // Allow a 1px rounding slack; anything more is a real horizontal overflow.
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
