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
    await expect(macro.getByText("6,812.34").filter({ visible: true })).toBeVisible();
    await expect(macro.getByText("+0.34%").filter({ visible: true })).toBeVisible();
    await expect(macro.getByText("Index levels · FRED · prior close")).toBeVisible();

    // The other true levels.
    await expect(macro.getByText("22,345.67").filter({ visible: true })).toBeVisible(); // Nasdaq Composite
    await expect(macro.getByText("44,210.55").filter({ visible: true })).toBeVisible(); // Dow

    // The Russell has no free FRED series, so its slot is an ETF — and says so, on the surface.
    await expect(macro.getByText("Russell 2000 · IWM (ETF proxy)").filter({ visible: true })).toBeVisible();
    // The chip itself, exactly — the label above also contains the words "ETF proxy", and it should.
    await expect(macro.getByText("ETF proxy", { exact: true }).filter({ visible: true })).toBeVisible();

    // The two FRED context cells.
    await expect(macro.getByText("15.84").filter({ visible: true })).toBeVisible();
    await expect(macro.getByText("4.54%").filter({ visible: true })).toBeVisible();
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
    //
    // Scoped to PLTR's own row, deliberately. The seed now publishes eight movers (F0), and most of
    // them have no news, so an unscoped match for the noise line finds six rows and fails strict
    // mode. The fix is to say what the test always meant — "the mover with no catalyst prints the
    // noise line" — about a named row, rather than to paper over it with .first(), which would pass
    // even if PLTR had quietly acquired a catalyst.
    const pltrRow = movers.locator("li").filter({ hasText: "PLTR" });
    await expect(pltrRow.getByText(/No news found/)).toBeVisible();
  });

  test("the session calendar shows curated catalysts with their chip codes and no noise", async ({ page }) => {
    const calendar = page.getByRole("region", { name: "Session calendar" });

    // The chip is the allowlist's CODE — the calendar's one vocabulary (redesign §6.2).
    await expect(calendar.getByText("EARNINGS").first()).toBeVisible();
    await expect(calendar.getByText(/AAPL earnings/)).toBeVisible();

    // The consensus figure is deliberately ABSENT here. On the Desk the calendar renders in its
    // compact rail variant (§5.1): a reader glances at the rail to see what is coming, they do not
    // study it, so consensus/prior drop to the row's drill. This asserts the design rather than
    // tolerating its absence.
    await expect(calendar.getByText(/cons\./)).toHaveCount(0);

    // The market-wide catalysts, each marked with the word "high" beside an ink dot.
    // Exact: the chip says "FOMC" and the title says "FOMC decision", and both should.
    await expect(calendar.getByText("CPI", { exact: true })).toBeVisible();
    await expect(calendar.getByText("FOMC", { exact: true })).toBeVisible();
    await expect(calendar.getByText("JOBS", { exact: true })).toBeVisible();
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

    // The FOCUS names are always visible — that is the whole point of the module. Since F5 the rest
    // fold away behind a counted disclosure, so the non-focus names (NVDA, MSFT) are one tap down;
    // the test opens it below rather than pretending they are still on the surface.
    await expect(watch.getByText("AAPL")).toBeVisible();
    await expect(watch.getByText(/Earnings next week/)).toBeVisible();
    // Exact match: a bare "focus" would also hit the module masthead "Focus watchlist".
    await expect(watch.getByText("focus", { exact: true })).toBeVisible();

    // And the folded names are reachable, with the disclosure stating how many it holds (M2).
    await watch.getByText(/Full watchlist/).click();
    await expect(watch.getByText("+2.10%")).toBeVisible();
    // The row is sparkline + PRICE + delta chip (§5.1). RelVol is not on it: the watchlist answers
    // "how are my names doing", and the volume question belongs to Movers, which is where it lives.
    await expect(watch.getByText("221.27")).toBeVisible();
    // The two non-focus names are present too.
    await expect(watch.getByText("NVDA")).toBeVisible();
    await expect(watch.getByText("MSFT")).toBeVisible();
  });
});

/**
 * The Desk, chunked (APP-FEEL-PLAN §4.1).
 *
 * The Desk is a reading RITUAL, not a dashboard, so the cure for the receipt was never to shuffle it
 * into widgets. Each station's body is bounded and its depth is one tap away — and the ritual ORDER
 * is untouchable. These tests are what keep that true.
 */
test.describe("The Desk, chunked", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the ritual order is intact — the modules still mount 00 → 07 in the DOM", async ({ page }) => {
    await page.goto("/");
    // The order is the invariant: it mirrors the documented professional pre-market sequence, so the
    // layout itself teaches the routine. Modules are placed into the desktop spread by CSS grid,
    // never by reordering the markup, which is why this assertion is on the DOM and not the pixels.
    const mastheads = await page.locator("h2").allTextContents();
    const indexed = mastheads.filter((m) => /^0\d —/.test(m));
    const numbers = indexed.map((m) => Number(m.slice(0, 2)));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  test("BOTH seeded high-importance rows are visible while the calendar is still collapsed", async ({ page }) => {
    await page.goto("/");
    const calendar = page.getByRole("region", { name: "Session calendar" });

    // The seed places FOMC and the jobs report deliberately BELOW the routine cut. A calendar that
    // warns you about one and folds the other away has implied a completeness it does not have —
    // this is the whole of ruling M2, in the one module whose job is warning.
    await expect(calendar.getByText("FOMC decision")).toBeVisible();
    await expect(calendar.getByText("Jobs report")).toBeVisible();
  });

  test("module 07 reads as a glance — a figure, not a paragraph", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/\d+ matches across \d+ scans/)).toBeVisible();
  });

  test("the journal is one labelled tap away, and its collapsed row states tonight's count", async ({ page }) => {
    await page.goto("/");
    const scorecard = page.getByRole("region", { name: "Evening scorecard" });

    // Collapsed, it REPORTS ITS STATE — which is the whole of M2's count contract. Either wording is
    // correct; what may never happen is a disclosure that hides an unstated number of things.
    //
    // The number is deliberately not pinned: briefing.spec writes a journal entry, and it runs before
    // this file, so tonight's count is 1 there and 0 in isolation. Asserting "none saved tonight"
    // would be asserting the test ORDER, not the product.
    await expect(scorecard.getByText(/(none|1) saved tonight/)).toBeVisible();

    // And it is exactly one tap to write.
    await scorecard.getByText(/What did today/).first().click();
    await expect(scorecard.getByRole("textbox")).toBeVisible();
  });

  test("a degraded source CANNOT be folded away (M2's sharpest case)", async ({ page }) => {
    await page.goto("/");
    // The <footer> sits inside <main>, so it carries no contentinfo landmark — locate it by label.
    const sources = page.locator('footer[aria-label="Source status"]');

    // The seed marks marketaux degraded. With any provider degraded the disclosure is forceOpen —
    // there is no toggle at all, because a summary reading "all reporting" with its own refutation
    // folded away underneath is the exact lie the rule exists to forbid.
    await expect(sources.getByText(/marketaux unavailable tonight/)).toBeVisible();
    await expect(sources.locator("details")).toHaveCount(0);
    // And the summary never claims "all reporting" when it is not true.
    await expect(sources.getByText(/all reporting/)).toHaveCount(0);
  });
});
