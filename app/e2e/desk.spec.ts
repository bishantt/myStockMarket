import { expect, test } from "@playwright/test";

/**
 * Journey 1 (P1 variant) — the Desk renders the morning the pipeline published (plan §6.2, §9.2).
 *
 * The unit tests prove the loader's maths and the components' markup in isolation; this proves the
 * whole path end to end: a real browser signs in, the server reads the serving database, and the
 * macro strip, the movers, and the focus watchlist show the exact values that were seeded.
 *
 * It runs ONLY against a seeded test database. Guarded by MSM_SEEDED=1, which CI sets after loading
 * prisma/seed.mjs into a throwaway Postgres — it never runs against the user's production data,
 * where asserting fixed synthetic numbers would be both wrong and dishonest. Locally, without the
 * flag, the whole group skips.
 *
 * Every asserted number is one the seed fixes exactly. The index and watchlist day-changes are
 * exact because the seed sets each symbol's final-day move directly; the macro context, movers, and
 * watchlist reasons are literal seed values. The compounding price LEVELS are deliberately not
 * asserted, only the deltas and context, so a change to the seed's history length never breaks this.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Desk — the seeded morning", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the macro strip shows the S&P hero, the FRED cells, and breadth", async ({ page }) => {
    const macro = page.getByRole("region", { name: "Macro pulse" });
    await expect(macro).toBeVisible();
    // The S&P 500 day change is exactly the seed's final-day move (+1.1%), rendered in ink.
    await expect(macro.getByText("+1.10%")).toBeVisible();
    // The two FRED context cells.
    await expect(macro.getByText("15.84")).toBeVisible();
    await expect(macro.getByText("4.54%")).toBeVisible();
    // Breadth — the seed's advancers/decliners and the % above the 50-day average.
    await expect(macro.getByText("3210 advancing · 1780 declining")).toBeVisible();
    await expect(macro.getByText("61% above the 50-day average")).toBeVisible();
  });

  test("movers shows the volume-confirmed moves with their change and RVOL", async ({ page }) => {
    const movers = page.getByRole("region", { name: "Movers" });
    await expect(movers.getByText("SMCI")).toBeVisible();
    await expect(movers.getByText("+18.40%")).toBeVisible();
    await expect(movers.getByText("4.7×")).toBeVisible();
    await expect(movers.getByText("GME")).toBeVisible();
    await expect(movers.getByText("−9.20%")).toBeVisible();
    await expect(movers.getByText("PLTR")).toBeVisible();
  });

  test("the focus watchlist shows each name, its reason, and the focus mark", async ({ page }) => {
    const watch = page.getByRole("region", { name: "Watchlist" });
    await expect(watch.getByText("AAPL")).toBeVisible();
    await expect(watch.getByText(/Earnings next week/)).toBeVisible();
    await expect(watch.getByText("focus")).toBeVisible();
    await expect(watch.getByText("+2.10%")).toBeVisible();
    await expect(watch.getByText("2.4×")).toBeVisible();
    // The two non-focus names are present too.
    await expect(watch.getByText("NVDA")).toBeVisible();
    await expect(watch.getByText("MSFT")).toBeVisible();
  });
});
