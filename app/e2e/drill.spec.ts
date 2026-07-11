import { expect, test } from "@playwright/test";

/**
 * Journey 2 — drill & return (plan §6.3, §3.6). A watchlist row opens the rail WITHOUT a route
 * change; Esc closes it and leaves you where you were; "Open full view" pushes the ticker route and
 * Back returns to the Desk. Gated to the seeded test database (MSM_SEEDED), never production.
 *
 * The seed puts AAPL on the watchlist and gives it served bars, so its rail opens and its ticker
 * page draws a real chart. Read-only, so the two projects (desktop rail, phone sheet) run in
 * parallel safely.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Drill & return", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("a watchlist row opens the rail without a route change, and Esc closes it", async ({ page }) => {
    await page.getByRole("button", { name: "Open AAPL details" }).first().click();

    const rail = page.getByRole("dialog");
    await expect(rail).toBeVisible();
    await expect(rail.getByText("AAPL")).toBeVisible();
    // Level 2 is not a route: opening the rail did not navigate.
    await expect(page).toHaveURL("/");

    await page.keyboard.press("Escape");
    await expect(rail).not.toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("Open full view pushes the ticker route; Back returns to the Desk", async ({ page }) => {
    await page.getByRole("button", { name: "Open AAPL details" }).first().click();
    await page.getByRole("dialog").getByRole("link", { name: /Open full view/ }).click();

    await expect(page).toHaveURL(/\/ticker\/AAPL$/);
    await expect(page.getByRole("heading", { name: "AAPL" })).toBeVisible();
    // The candles render from price_bar — the chart canvas mounts.
    await expect(page.getByRole("img", { name: "Price chart" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL("/");
  });

  test("a name with no served bars shows an honest no-chart note, not a blank grid", async ({ page }) => {
    // SMCI is a seeded mover (in scan_result) but not served (no price_bar rows).
    await page.goto("/ticker/SMCI");
    await expect(page.getByRole("heading", { name: "SMCI" })).toBeVisible();
    await expect(page.getByText(/No chart data/)).toBeVisible();
  });
});
