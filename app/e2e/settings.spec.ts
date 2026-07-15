import { expect, test } from "@playwright/test";

import { signIn } from "./session";

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

test.describe("Watchlist management", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
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

    // Locate the row by its REASON — a unique string. (The symbol is a poor filter: "DIA" is a
    // substring of "NVIDIA", and the symbol also appears inside the instrument name.)
    const row = page.getByRole("listitem").filter({ hasText: reason });
    await expect(row).toContainText(symbol);

    // It shows on the Desk's watchlist too — one tap down.
    //
    // A NEWLY ADDED NAME IS NOT A FOCUS NAME, and since F5 the Desk shows the focus names and folds
    // the rest behind a counted disclosure. So the name is not on the surface, and it should not be:
    // the module is called the FOCUS watchlist, and the whole point of the fold is that the three
    // names you chose to watch closely are not buried under the ones you merely added. Open the fold
    // and it is there — which is exactly the journey a reader makes.
    await page.goto("/");
    const watch = page.getByRole("region", { name: "Watchlist" });
    await watch.getByText(/Full watchlist/).click();
    await expect(watch.getByText(symbol, { exact: true })).toBeVisible();

    // Focus it, then unfocus it — the button reflects the state each way.
    await page.goto("/settings");
    const addedRow = page.getByRole("listitem").filter({ hasText: reason });
    await addedRow.getByRole("button", { name: "Focus", exact: true }).click();
    await expect(addedRow.getByRole("button", { name: "Unfocus" })).toBeVisible();
    await addedRow.getByRole("button", { name: "Unfocus" }).click();
    await expect(addedRow.getByRole("button", { name: "Focus", exact: true })).toBeVisible();

    // Remove it — and it is gone.
    await addedRow.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: reason })).toHaveCount(0);
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
