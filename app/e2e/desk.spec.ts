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

  test("the macro strip shows the S&P hero as a TRUE INDEX LEVEL, the FRED cells, and breadth", async ({ page }) => {
    const macro = page.getByRole("region", { name: "Macro pulse" });
    await expect(macro).toBeVisible();

    // The regression lock on the product's worst bug (redesign §6.1). The hero is the S&P 500's
    // real index level from FRED — the seeded 6,812.34 — NOT the SPY ETF's ~600 price, which the
    // Desk used to print under this exact label. The change is computed from the level and its
    // prior level (6,789.10 → 6,812.34 = +0.34%), never borrowed from the ETF.
    await expect(macro.getByText("6,812.34")).toBeVisible();
    await expect(macro.getByText("+0.34%")).toBeVisible();
    await expect(macro.getByText("Index levels · FRED · prior close")).toBeVisible();

    // The other true levels.
    await expect(macro.getByText("22,345.67")).toBeVisible(); // Nasdaq Composite
    await expect(macro.getByText("44,210.55")).toBeVisible(); // Dow

    // The Russell has no free FRED series, so its slot is an ETF — and says so, on the surface.
    await expect(macro.getByText("Russell 2000 · IWM (ETF proxy)")).toBeVisible();
    await expect(macro.getByText("ETF proxy")).toBeVisible();

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

  test("a mover with news shows a catalyst chip + source link; one without shows the noise line", async ({ page }) => {
    const movers = page.getByRole("region", { name: "Movers" });
    // SMCI has seeded earnings news → a catalyst chip, the headline, and a source link.
    await expect(movers.getByText("earnings")).toBeVisible();
    await expect(movers.getByText(/Super Micro beats Q3/)).toBeVisible();
    await expect(movers.getByRole("link", { name: "reuters.com" })).toBeVisible();
    // PLTR has no seeded news → the honest noise line (§1.5 rule 9).
    await expect(movers.getByText(/No news found/)).toBeVisible();
  });

  test("the session calendar shows curated catalysts with their chip codes and no noise", async ({ page }) => {
    const calendar = page.getByRole("region", { name: "Session calendar" });

    // The chip is the allowlist's CODE — the calendar's one vocabulary (redesign §6.2).
    await expect(calendar.getByText("EARNINGS").first()).toBeVisible();
    await expect(calendar.getByText(/AAPL earnings/)).toBeVisible();
    await expect(calendar.getByText(/cons\. 1\.28/)).toBeVisible();

    // The market-wide catalysts, each marked with the word "high" beside an ink dot.
    await expect(calendar.getByText("CPI")).toBeVisible();
    await expect(calendar.getByText("FOMC")).toBeVisible();
    await expect(calendar.getByText("JOBS")).toBeVisible();
    await expect(calendar.getByText("high").first()).toBeVisible();

    // And the firehose the allowlist exists to stop: none of FRED's daily non-catalyst releases
    // may ever appear here again.
    for (const noise of ["Coinbase", "Commercial Paper", "CBOE", "Dow Jones Averages"]) {
      await expect(calendar.getByText(new RegExp(noise, "i"))).toHaveCount(0);
    }
  });

  test("the source-status footer names a degraded source and shows the FRED attribution", async ({ page }) => {
    // The <footer> sits inside <main>, so it has no contentinfo landmark role; locate it by label.
    const footer = page.locator('footer[aria-label="Source status"]');
    await expect(footer.getByText(/marketaux unavailable tonight/)).toBeVisible();
    await expect(footer.getByText(/FRED® API/)).toBeVisible();
  });

  test("the focus watchlist shows each name, its reason, and the focus mark", async ({ page }) => {
    const watch = page.getByRole("region", { name: "Watchlist" });
    await expect(watch.getByText("AAPL")).toBeVisible();
    await expect(watch.getByText(/Earnings next week/)).toBeVisible();
    // Exact match: a bare "focus" would also hit the module masthead "Focus watchlist".
    await expect(watch.getByText("focus", { exact: true })).toBeVisible();
    await expect(watch.getByText("+2.10%")).toBeVisible();
    await expect(watch.getByText("2.4×")).toBeVisible();
    // The two non-focus names are present too.
    await expect(watch.getByText("NVDA")).toBeVisible();
    await expect(watch.getByText("MSFT")).toBeVisible();
  });
});
