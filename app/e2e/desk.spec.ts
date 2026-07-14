import { expect, test, type Page } from "@playwright/test";

import { SEEDED_EVENING } from "./seeded-clock";

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
    // Every delta states the window it covers (ruling C2). "+0.34%" is not a fact on its own.
    await expect(macro.getByText("· 1D").filter({ visible: true }).first()).toBeVisible();

    // THE PROVENANCE LINE IS COMPOSED FROM THESE VERY ROWS (ruling C6). It used to be a fixed
    // string — "Index levels · FRED · prior close" — printed no matter what the rows showed, and on
    // the night FRED's index series failed it sat under four ETF prices declaring them FRED index
    // levels. Here the seeded night has all three levels, so the line names all three.
    await expect(
      macro.getByText(/S&P 500, Nasdaq Composite, Dow: FRED, prior close/),
    ).toBeVisible();
    await expect(macro.getByText(/Small caps: IWM ETF close/)).toBeVisible();

    // The other true levels.
    await expect(macro.getByText("22,345.67").filter({ visible: true })).toBeVisible(); // Nasdaq Composite
    await expect(macro.getByText("44,210.55").filter({ visible: true })).toBeVisible(); // Dow

    // The small-caps slot is an ETF by design — FRED deleted every free Russell series in 2019 — so
    // it never claims that index's name, and it carries exactly ONE mark saying what it is.
    await expect(macro.getByText("Small caps").filter({ visible: true }).first()).toBeVisible();
    await expect(macro.getByText("IWM · ETF price").filter({ visible: true }).first()).toBeVisible();
    // The old double belt is gone: the label suffix "(ETF proxy)" AND a second chip reading "ETF
    // proxy" both said the same words, and on screen that read as noise.
    await expect(macro.getByText("Russell 2000")).toHaveCount(0);
    await expect(macro.getByText("ETF proxy", { exact: true })).toHaveCount(0);

    // The two FRED context cells.
    await expect(macro.getByText("15.84").filter({ visible: true })).toBeVisible();
    await expect(macro.getByText("4.54%").filter({ visible: true })).toBeVisible();
    // Breadth — the seed's advancers/decliners and the % above the 50-day average.
    await expect(macro.getByText("3210 advancing · 1780 declining")).toBeVisible();
    // Breadth's window (C2) — the one claim about the WHOLE market, and until N1 it carried none.
    await expect(macro.getByText(/at Thu's close/)).toBeVisible();
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

  /**
   * THE READING ORDER — what a screen reader hears, and what the Tab key walks (PD3, amendment 0.2.2).
   *
   * THIS TEST USED TO ASSERT THAT THE DOM ASCENDED 01 → 08, and PD3 changed the answer. It is worth
   * being exact about why, because the number below looks like a regression and is not.
   *
   * The Desk's two columns must flow INDEPENDENTLY — that is Law 1, and it is what kills the dead
   * hole a short module used to dig beside a tall one. Two independent columns means two wrapper
   * elements, and CSS can only group children that are ADJACENT IN THE MARKUP. The ritual interleaves
   * the columns (brief, calendar, movers, watchlist…), so a DOM in ritual order and a DOM grouped
   * into columns are mutually exclusive. There is no CSS that gives you both. Something had to give.
   *
   * What gives is the DOM, and the reading order it produces is the one amendment 0.2.2 chose on the
   * merits: the narrative first (02 brief, 04 movers, 06 setups, 07/08 + scorecard), then the rail's
   * reference matter (03 calendar, 05 watchlist). A broadsheet is read column-first — nobody reads a
   * newspaper row-by-row across the columns — and the rail is reference matter by the app's own
   * definition. A screen reader now hears that same order at EVERY width, which is at least one
   * consistent story rather than two.
   *
   * WHAT A READER SEES is a different question, and it is asserted where it belongs: e2e/grid.spec.ts
   * measures the BOUNDING BOXES per viewport, and holds the phone to the full ritual 01 → 08. This
   * test and that one are the two halves of the same contract, and neither is sufficient alone — a
   * DOM-only assertion would have passed happily through this entire rewrite while the screen showed
   * something else.
   */
  test("the reading order is narrative first, then the rail (the 0.2.2 amendment)", async ({ page }) => {
    await page.goto("/");
    const mastheads = await page.locator("main h2").allTextContents();
    const numbers = mastheads
      .filter((m) => /^\d\d —/.test(m))
      .map((m) => Number(m.slice(0, 2)));

    expect(
      numbers,
      "the DOM reads: pulse, then the main column's stations, then the rail's reference matter",
    ).toEqual([1, 2, 4, 6, 7, 8, 3, 5]);

    /*
     * MODULE 00 IS RETIRED (NEWS-AND-CONTROL-PLAN Part 4.1), and this asserts the retirement rather
     * than merely tolerating it.
     *
     * The exact-sequence check above already implies this — but it implies it by accident, and a
     * guard that only works by accident is one refactor away from not working. The ritual STARTS at
     * 01. If a future change reinstates a pipeline card in the grid, the strip and the card would
     * both be on the page, and this says so out loud.
     *
     * The mastheads do not renumber: 01 stays 01. A masthead is a name, not an index that has to
     * start at zero, and renumbering every module, test and VRT baseline to close a cosmetic gap is
     * churn with regression risk and no reader value.
     */
    expect(numbers, "module 00 was retired into the pipeline strip — it must not be back in the grid")
      .not.toContain(0);
  });

  test("the pipeline strip is page chrome — one quiet line, above the grid, and a doorway", async ({
    page,
  }) => {
    /*
     * THE CLOCK IS PINNED, AND THE TAG'S CI IS WHY.
     *
     * The strip grades freshness against the BROWSER's clock (deliberately — a cached render must
     * never photograph a dead pipeline as a healthy one). The seed publishes one run for a fixed
     * trading day, and real time keeps moving. So this test asserted the FRESH line while CI, running
     * days after the seeded session, was correctly showing the AGING one.
     *
     * The test was wrong, not the product. A test that reads time-dependent output has to say WHEN it
     * is reading, or it passes this week and fails next week for a reason nobody can reconstruct.
     *
     * The instant itself comes from e2e/seeded-clock.ts (G3). It used to be a second copy of the same
     * literal, written out here by hand — and two copies of one clock is exactly how the two drift
     * apart. Drift rule 21 now fails the build for a date written anywhere in e2e/ but there.
     */
    await page.clock.setFixedTime(SEEDED_EVENING);
    await page.goto("/");

    // Now the strip is in its FRESH state: quiet, no colour, no card, no masthead. It states the
    // three facts module 00's whole card never managed — the session on screen, when the pipeline
    // wrote it, and when the next edition lands.
    const strip = page.getByRole("status").filter({ hasText: "Data through" });
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("next:");

    // And it is the doorway to the control room (Part 8, built in N6).
    await expect(strip.getByRole("link")).toHaveAttribute("href", /\/settings/);
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

/**
 * RULING C2 ON THE DESK — every number states its window, on the surface, where the number is.
 *
 * The plan's Part 5.1 audit table is not documentation. Each of its rows is an acceptance criterion,
 * and these are the rows that live on the Desk. They are asserted against the RENDERED page rather
 * than against the copy deck, because a token that exists in copy.ts and never reaches the screen is
 * a rule that was written down and not obeyed.
 *
 * Why this matters more than it sounds: "+8.2%" is not a fact. Over what? A day? A week? Since the
 * position was opened? A beginner cannot tell, and will guess — and every one of those guesses
 * changes what the number means. The window is not decoration on the figure. It is half the figure.
 */
test.describe("C2 — every number on the Desk carries its window", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/");
  });

  test("a mover's delta says it is a ONE-DAY move, and its RVOL says what it is relative to", async ({
    page,
  }) => {
    const movers = page.getByRole("region", { name: "Movers" });

    // The window rides inside the chip, beside the number — not in a footnote, not in the module
    // footer. Both are in the same visual unit as the figure they qualify.
    await expect(movers.getByText(/· 1D/).first()).toBeVisible();
    await expect(movers.getByText(/· 20d avg/).first()).toBeVisible();
  });

  test("a watchlist delta says 1D, and the sparklines state their window ONCE", async ({ page }) => {
    const watch = page.getByRole("region", { name: "Watchlist" });
    await expect(watch.getByText(/· 1D/).first()).toBeVisible();

    // One caption for the module, because every row's spark covers the same 30 sessions. Repeating
    // it per row would stutter without adding a fact — but a line with no period at all is a shape
    // that means nothing, and that is what it was.
    await expect(watch.getByText("Sparklines: 30 sessions, close only")).toBeVisible();
  });

  test("breadth says WHEN it was measured, not just what it measures", async ({ page }) => {
    // It named its indicator's lookback (the 50-day average) and never said as of when — the one
    // figure on the macro module making a claim about the entire market with no as-of on it.
    const pulse = page.getByRole("region", { name: "Macro pulse" });
    await expect(pulse.getByText(/above the 50-day average/)).toBeVisible();
  });
});

/**
 * The macro board (N3, Part 6) — against the seeded night, in a real browser.
 *
 * The unit tests prove the state machine; the component tests prove the markup. This proves the two
 * ends of the system are actually connected: that a row the pipeline stored arrives on the Desk with
 * its window intact, its staleness graded, and — for the one number here that is ours — its entire
 * derivation on the page beside it.
 */
/**
 * The one instance of some text that the reader can ACTUALLY SEE.
 *
 * The macro board renders twice — once in the phone shelf (`md:hidden`), once in the ≥md row — and
 * exactly one of the two is display:none at any given width. `.first()` therefore resolves to the
 * SHELF's copy on the desktop project, which is present in the DOM, correct in every particular, and
 * invisible. The nc-3 tag caught this: three tests failed with "13 × locator resolved to <span>…
 * unexpected value: hidden".
 *
 * jsdom has no CSS, so the component tests could never have seen it — they were right to use
 * getAllByText, and they were blind to this by construction. In a real browser the honest question is
 * not "is this in the DOM" but "can the reader see it", and this is how the rest of this file already
 * asked it. I should have read the file before writing new tests into it.
 */
function visible(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true }).first();
}

test.describe("The macro board", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("every cell states the window its own source published for", async ({ page }) => {
    // The seeded night: a Thursday mortgage rate, a June CPI print, a gold price a week stale, and
    // Thursday's rupee. Four sources, four different cadences, four different as-of labels — which is
    // the entire reason these live in macro_stat instead of as four more market_context columns.
    await expect(visible(page, "wk of Jul 9")).toBeVisible();
    await expect(visible(page, "Jun 2026")).toBeVisible();
    await expect(visible(page, "6.72%")).toBeVisible();
  });

  test("the stale gold cell is amber AND says the word (C7 rung 5)", async ({ page }) => {
    // Gold's seeded row is a week old against a daily cadence — past three sessions, so the cell is
    // loud. The WORD is what makes the colour redundant rather than load-bearing.
    const note = visible(page, "stale — last Jul 2");
    await expect(note).toBeVisible();

    // Staleness is data, not absence: the number is still there, still readable, just no longer
    // wearing a claim to be current.
    await expect(visible(page, "4,085.20")).toBeVisible();
  });

  test("the Mood gauge never shows its number without showing its work (C8)", async ({ page }) => {
    // The score, the band word, and — non-negotiably — the two sentences that make a home-built
    // sentiment number legitimate to print at all.
    await expect(visible(page, "42")).toBeVisible();
    await expect(visible(page, "leaning fearful")).toBeVisible();
    await expect(visible(page, /not CNN's index/)).toBeVisible();
    await expect(visible(page, /Context, not a signal/)).toBeVisible();

    // And the breakdown is genuinely reachable — every input, with the window it measured over.
    await visible(page, "How this is computed").click();
    await expect(visible(page, "Credit spreads")).toBeVisible();
    await expect(visible(page, /ICE BofA US High Yield OAS/)).toBeVisible();
  });

  test("the rupee shows a pair, names its source, and admits it is not a remittance rate", async ({ page }) => {
    await expect(visible(page, "151.66 buy · 152.26 sell")).toBeVisible();
    await expect(visible(page, "NRB reference")).toBeVisible();
    // We quote no remittance app, because none publishes a legitimate rate API — so rather than
    // inventing one, the cell says plainly that this is not the number the reader will be given.
    await expect(visible(page, "Remittance apps may differ.")).toBeVisible();
  });
});
