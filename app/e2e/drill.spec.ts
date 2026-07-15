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
    // The rail's HEADING, specifically — the exit link now reads "Full view: AAPL →" (10.2), so a
    // bare getByText("AAPL") matches two elements and trips strict mode.
    await expect(rail.getByRole("heading", { name: "AAPL" })).toBeVisible();
    // Level 2 is not a route: opening the rail did not navigate.
    await expect(page).toHaveURL("/");

    await page.keyboard.press("Escape");
    await expect(rail).not.toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("Open full view pushes the ticker route; Back returns to the Desk", async ({ page }) => {
    await page.getByRole("button", { name: "Open AAPL details" }).first().click();
    const rail = page.getByRole("dialog");
    await expect(rail).toBeVisible();
    const openFull = rail.getByRole("link", { name: /Full view/ });
    await expect(openFull).toBeVisible();
    // force: the link is on top and visible, but Radix's full-screen modal overlay technically
    // overlaps the click point on the phone bottom sheet — a known Radix+Playwright actionability
    // artifact. The link is genuinely the target, so dispatch the click to it directly.
    await openFull.click({ force: true });

    await expect(page).toHaveURL(/\/ticker\/AAPL$/);
    // The page is headed by the company NAME, with the symbol above it as a mono eyebrow (§5.5) —
    // a page about Apple should say "Apple", not only "AAPL". Both are on the page.
    await expect(page.getByRole("heading", { name: /Apple/ })).toBeVisible();
    await expect(page.getByText("AAPL", { exact: true })).toBeVisible();
    // The candles render from price_bar — the chart canvas mounts.
    await expect(page.getByRole("img", { name: "Price chart" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL("/");
  });

  test("a name with no served bars shows an honest no-chart note, not a blank grid", async ({ page }) => {
    // SMCI is a seeded mover (in scan_result) but not served (no price_bar rows).
    await page.goto("/ticker/SMCI");
    await expect(page.getByRole("heading", { name: /Super Micro/ })).toBeVisible();
    await expect(page.getByText(/No chart data/)).toBeVisible();
  });
});
