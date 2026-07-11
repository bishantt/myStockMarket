import { expect, test } from "@playwright/test";

/**
 * Watchlist writes, end to end (plan §9.2 — the watchlist is the one thing the app itself writes).
 *
 * The unit tests pin the pure rules (reason required, focus cap); this proves the whole write path
 * in a real browser: add a name on /settings, see it appear on the Desk, focus and unfocus it,
 * then remove it — against the seeded test database, never production (guarded by MSM_SEEDED).
 *
 * The two Playwright projects (desktop, phone) run in parallel against ONE test database, so each
 * picks a DIFFERENT seeded instrument to add — otherwise the two workers would race on the same
 * row. The test cleans up after itself (it removes what it added), leaving the seed as it found it.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Watchlist management", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("add a name, see it on the Desk, focus it, then remove it", async ({ page }, testInfo) => {
    // A seeded instrument that is NOT already on the watchlist, distinct per project.
    const symbol = testInfo.project.name === "phone" ? "DIA" : "QQQ";
    const reason = `e2e ${symbol} — watching the reaction`;

    await page.goto("/settings");

    // Add it.
    await page.getByLabel("Symbol").fill(symbol);
    await page.getByLabel("Why you are watching it").fill(reason);
    await page.getByRole("button", { name: "Add" }).click();

    const row = page.getByRole("listitem").filter({ hasText: symbol });
    await expect(row).toContainText(reason);

    // It shows on the Desk's focus watchlist too.
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Watchlist" }).getByText(symbol)).toBeVisible();

    // Focus it, then unfocus it — the button reflects the state each way.
    await page.goto("/settings");
    const addedRow = page.getByRole("listitem").filter({ hasText: symbol });
    await addedRow.getByRole("button", { name: "Focus", exact: true }).click();
    await expect(addedRow.getByRole("button", { name: "Unfocus" })).toBeVisible();
    await addedRow.getByRole("button", { name: "Unfocus" }).click();
    await expect(addedRow.getByRole("button", { name: "Focus", exact: true })).toBeVisible();

    // Remove it — and it is gone.
    await addedRow.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: symbol })).toHaveCount(0);
  });

  test("a duplicate name is refused with a plain message", async ({ page }) => {
    // AAPL is already on the seeded watchlist; adding it again is refused, not duplicated.
    await page.goto("/settings");
    await page.getByLabel("Symbol").fill("AAPL");
    await page.getByLabel("Why you are watching it").fill("trying to add a duplicate");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByTestId("add-error")).toContainText("already on your watchlist");
  });
});
