import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./session";

import { SEEDED_EVENING } from "./seeded-clock";

/**
 * Journey 1 (P1 variant) — the Desk renders the morning the pipeline published (plan §6.2, §9.2). The unit
 * tests prove the loader's maths and the components' markup in isolation; this proves the whole path end to
 * end: a real browser signs in, the server reads the serving database, and the macro strip, movers, and
 * watchlist show the exact seeded values. It runs ONLY against a seeded database (MSM_SEEDED=1, which CI
 * sets after loading prisma/seed.mjs into a throwaway Postgres) — never against production, where asserting
 * fixed synthetic numbers would be wrong. Every asserted number the seed fixes exactly; the compounding
 * price LEVELS are not asserted, only deltas and context, so a change to the seed's history length never
 * breaks this.
 */

test.describe("Desk — the seeded morning", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the macro strip shows the S&P hero as a TRUE INDEX LEVEL, the FRED cells, and breadth", async ({ page }) => {
    const macro = page.getByRole("region", { name: "Macro pulse" });
    await expect(macro).toBeVisible();

    // The regression lock on the product's worst bug (redesign §6.1): the hero is the S&P 500's real FRED
    // level (seeded 6,812.34), NOT the SPY ETF's ~600 price the Desk used to print under this label. The
    // change is computed from the level and its prior (6,789.10 → 6,812.34 = +0.34%), never borrowed.
    await expect(macro.getByText("6,812.34").filter({ visible: true })).toBeVisible();
    await expect(macro.getByText("+0.34%").filter({ visible: true })).toBeVisible();
    // Every delta states the window it covers (ruling C2). "+0.34%" is not a fact on its own.
    await expect(macro.getByText("· 1D").filter({ visible: true }).first()).toBeVisible();

    // THE PROVENANCE LINE IS COMPOSED FROM THESE VERY ROWS (ruling C6). It used to be a fixed string —
    // "Index levels · FRED · prior close" — printed no matter the rows, and the night FRED's series failed
    // it sat under four ETF prices declaring them FRED levels. Here all three levels exist, so it names all three.
    await expect(
      macro.getByText(/S&P 500, Nasdaq Composite, Dow: FRED, prior close/),
    ).toBeVisible();
    await expect(macro.getByText(/Small caps: IWM ETF close/)).toBeVisible();

    // The other true levels.
    await expect(macro.getByText("22,345.67").filter({ visible: true })).toBeVisible(); // Nasdaq Composite
    await expect(macro.getByText("44,210.55").filter({ visible: true })).toBeVisible(); // Dow

    // The small-caps slot is an ETF by design (FRED deleted every free Russell series in 2019), so it never
    // claims that index's name and carries exactly ONE mark saying what it is.
    await expect(macro.getByText("Small caps").filter({ visible: true }).first()).toBeVisible();
    await expect(macro.getByText("IWM · ETF price").filter({ visible: true }).first()).toBeVisible();
    // The old double belt is gone: the "(ETF proxy)" suffix AND a second "ETF proxy" chip said the same
    // words, which on screen read as noise.
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

  test("every rendered mover carries the liquid-floor marker, and the module names the floor (CC6, D6)", async ({ page }) => {
    const movers = page.getByRole("region", { name: "Movers" });
    // The marker the loader now exposes: every rendered mover has cleared the liquid floor. If the
    // floor were bypassed (raw top-8, junk and all), these rows would still render — but they would
    // not be the liquid names the loader vouched for, and this is what pins that they are.
    await expect(movers.locator("[data-liquid-floor]").first()).toBeVisible();
    expect(await movers.locator("[data-liquid-floor]").count()).toBeGreaterThan(0);
    // The footnote names the floor so the eight rows never read as the whole market.
    await expect(movers.getByText(/Liquid names only/)).toBeVisible();
  });

  test("a mover with news shows a catalyst chip + source link; one without shows the noise line", async ({ page }) => {
    const movers = page.getByRole("region", { name: "Movers" });
    // SMCI has seeded earnings news → a catalyst chip, the headline, and a source link.
    await expect(movers.getByText("earnings")).toBeVisible();
    await expect(movers.getByText(/Super Micro beats Q3/)).toBeVisible();
    await expect(movers.getByRole("link", { name: "reuters.com" })).toBeVisible();
    // PLTR has no seeded news → the honest noise line (§1.5 rule 9). Scoped to PLTR's own row: the seed now
    // publishes eight movers (F0), most with no news, so an unscoped match finds six rows and fails strict
    // mode. Say what the test meant — "the mover with no catalyst prints the noise line" — about a named row,
    // not paper over it with .first() (which would pass even if PLTR quietly acquired a catalyst).
    const pltrRow = movers.locator("li").filter({ hasText: "PLTR" });
    await expect(pltrRow.getByText(/No news found/)).toBeVisible();
  });

  test("the session calendar shows curated catalysts with their chip codes and no noise", async ({ page }) => {
    const calendar = page.getByRole("region", { name: "Session calendar" });

    // The chip is the allowlist's CODE — the calendar's one vocabulary (redesign §6.2).
    await expect(calendar.getByText("EARNINGS").first()).toBeVisible();
    // The symbol is spoken ONCE (CC6, D7): an earnings row is [EARNINGS] [AAPL], the redundant
    // "AAPL earnings" title gone. AAPL here is the calendar's forward earnings ticker (scoped to the
    // region, so it is not the watchlist's AAPL).
    await expect(calendar.getByText("AAPL", { exact: true })).toBeVisible();
    await expect(calendar.getByText(/AAPL earnings/)).toHaveCount(0);
    // Forward-first: today's reported bank earnings collapse into one retrospective line, below the
    // week ahead, rather than five rows leading the rail (D7).
    await expect(calendar.getByText(/Reported today/i)).toBeVisible();
    await expect(calendar.getByText(/BAC · C · GS · JPM · WFC/)).toBeVisible();

    // The consensus figure is deliberately ABSENT here: on the Desk the calendar renders in its compact rail
    // variant (§5.1), so consensus/prior drop to the row's drill. This asserts the design, not tolerates its absence.
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
 * The Desk, chunked (APP-FEEL §4.1). The Desk is a reading RITUAL, not a dashboard, so the cure for the
 * receipt was never to shuffle it into widgets: each station's body is bounded, its depth is one tap away,
 * and the ritual ORDER is untouchable. These tests keep that true.
 */
test.describe("The Desk, chunked", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * THE READING ORDER — what a screen reader hears, and what Tab walks (PD3, amendment 0.2.2). THIS TEST
   * USED TO ASSERT THE DOM ASCENDED 01 → 08, and PD3 changed the answer — the number below looks like a
   * regression and is not. The two columns must flow INDEPENDENTLY (Law 1, which kills the dead hole), which
   * means two wrapper elements, and CSS can only group children ADJACENT IN THE MARKUP; the ritual interleaves
   * the columns, so a ritual-order DOM and a column-grouped DOM are mutually exclusive. What gives is the DOM,
   * and the order amendment 0.2.2 chose on the merits: narrative first (02 brief, 04 movers, 06 setups,
   * 07/08 + scorecard), then the rail's reference matter (03 calendar, 05 watchlist) — a broadsheet is read
   * column-first, and a screen reader hears that same order at every width. WHAT A READER SEES is a different
   * question, asserted in e2e/grid.spec.ts (BOUNDING BOXES per viewport, phone held to the full ritual 01 →
   * 08). The two are halves of one contract; a DOM-only assertion passed through this rewrite while the screen changed.
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
     * MODULE 00 IS RETIRED (NEWS-AND-CONTROL Part 4.1), asserted rather than tolerated. The exact-sequence
     * check above implies it, but by accident, and a guard that works by accident is one refactor from not:
     * the ritual STARTS at 01, and if a future change reinstates a pipeline card in the grid, the strip and
     * the card would both be present, and this says so. The mastheads do not renumber (01 stays 01) — a
     * masthead is a name, and renumbering every module, test and baseline to close a cosmetic gap is churn.
     */
    expect(numbers, "module 00 was retired into the pipeline strip — it must not be back in the grid")
      .not.toContain(0);
  });

  test("the pipeline strip is page chrome — one quiet line, above the grid, and a doorway", async ({
    page,
  }) => {
    /*
     * THE CLOCK IS PINNED, AND THE TAG'S CI IS WHY. The strip grades freshness against the BROWSER's clock
     * (deliberately — a cached render must never photograph a dead pipeline as healthy). The seed publishes
     * one run for a fixed trading day and real time keeps moving, so this asserted the FRESH line while CI,
     * running days later, correctly showed the AGING one: the test was wrong, not the product. A test reading
     * time-dependent output must say WHEN it reads. The instant comes from e2e/seeded-clock.ts (G3) — it used
     * to be a second copy of the literal here, and two copies of one clock is how they drift; drift rule 21
     * now fails the build for a date anywhere in e2e/ but there.
     */
    await page.clock.setFixedTime(SEEDED_EVENING);
    await page.goto("/");

    // Now the strip is in its FRESH state: quiet, no colour, no card. Since CC3 (R3) it speaks in
    // provenance voice ONLY — how many sources reported, how many degraded, and when the next
    // edition lands. The data vintage it used to carry moved up to the masthead's line 3.
    const strip = page.getByRole("status").filter({ hasText: "next edition" });
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("sources");
    await expect(strip).toContainText("degraded");

    // And it is the doorway to the control room (Part 8, built in N6).
    await expect(strip.getByRole("link")).toHaveAttribute("href", /\/settings/);
  });

  test("BOTH seeded high-importance rows are visible while the calendar is still collapsed", async ({ page }) => {
    await page.goto("/");
    const calendar = page.getByRole("region", { name: "Session calendar" });

    // The seed places FOMC and the jobs report deliberately BELOW the routine cut. A calendar that warns you
    // about one and folds the other away implies a completeness it lacks — the whole of ruling M2, in the one
    // module whose job is warning.
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

    // Collapsed, it REPORTS ITS STATE — the whole of M2's count contract; either wording is correct, and what
    // may never happen is a disclosure that hides an unstated number. The number is not pinned: briefing.spec
    // writes a journal entry and runs before this file, so tonight's count is 1 there and 0 in isolation —
    // asserting "none saved tonight" would assert the test ORDER, not the product.
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
 * RULING C2 ON THE DESK — every number states its window, on the surface, where the number is. The plan's
 * Part 5.1 audit table is acceptance criteria, not documentation, and these are the rows on the Desk;
 * asserted against the RENDERED page, not the copy deck, because a token in copy.ts that never reaches the
 * screen is a rule written down and not obeyed. Why it matters: "+8.2%" is not a fact — over what? a day? a
 * week? since the position opened? — and every guess changes what the number means. The window is half the figure.
 */
test.describe("C2 — every number on the Desk carries its window", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
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

    // One caption for the module, because every row's spark covers the same 30 sessions — repeating it per
    // row would stutter without adding a fact, but a line with no period at all is a shape that means nothing.
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
 * The macro board (N3, Part 6) — against the seeded night, in a real browser. The unit tests prove the state
 * machine and the component tests the markup; this proves the ends are connected: a row the pipeline stored
 * arrives on the Desk with its window intact, its staleness graded, and — for the one number that is ours —
 * its entire derivation on the page beside it.
 */
/**
 * The one instance of some text the reader can ACTUALLY SEE. The macro board renders twice — once in the
 * phone shelf (`md:hidden`), once in the ≥md row — and exactly one is display:none at any width, so `.first()`
 * resolves to the SHELF's copy on desktop: in the DOM, correct, and invisible. The nc-3 tag caught this (three
 * tests failed "resolved to <span>… hidden"). jsdom has no CSS, so the component tests were blind to it by
 * construction; in a real browser the honest question is "can the reader see it", which this asks.
 */
function visible(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true }).first();
}

test.describe("The macro board", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
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

/**
 * THE PHONE'S MACRO GRIDS (PD4, §7.1) — the composition that replaced the two swipe-shelves. The Desk carried
 * the app's only two horizontal rails, hiding two figures each behind a swipe; PD4 replaced them with grids
 * that show everything at once (amendment 0.2.1). These pin the three claims that change makes, in the BROWSER
 * because the claim is about what is on the SCREEN — jsdom can prove which cell a figure sits in, only a real
 * layout proves the reader can see it.
 */
test.describe("The phone's macro grids", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
  test.skip(({ isMobile }) => !isMobile, "the grids only exist below md — phone project only");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("shows all five market figures and all four money stats — nothing behind a swipe", async ({ page }) => {
    // The count IS the change. Five macro figures (two risk gauges + three index slots) and four money
    // stats used to be nine cells of which four started off-screen behind a swipe.
    const risk = page.locator('[data-macro-group="risk"] > *');
    const tape = page.locator('[data-macro-group="tape"] > *');
    const money = page.locator('[data-macro-group="money"] > *');

    await expect(risk).toHaveCount(2);
    await expect(tape).toHaveCount(3);
    await expect(money).toHaveCount(4);

    /*
     * EVERY CELL LIES WITHIN THE WIDTH OF THE PHONE — what "nothing is hidden" means here, and narrower than
     * it looks. NOT `toBeInViewport`: the money grid sits below the fold, which is fine — vertical distance is
     * reading, sideways distance is hiding. NOT `toBeVisible`, which proves nothing: an item off the end of a
     * shelf is "visible" to Playwright exactly as it is invisible to a reader (the old shelf would have passed
     * that on the very figures it concealed). So the question is asked of the BOX: does this cell sit inside
     * the phone's width? A grid cell does; a card off the right end of a rail does not.
     */
    const offscreen = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const bad: string[] = [];
      for (const cell of document.querySelectorAll("[data-macro-group] > *")) {
        const box = cell.getBoundingClientRect();
        if (box.left < -1 || box.right > width + 1) {
          bad.push(`"${(cell.textContent ?? "").trim().slice(0, 20)}" at [${Math.round(box.left)}, ${Math.round(box.right)}] vs width ${width}`);
        }
      }
      return bad;
    });
    expect(offscreen, "a macro cell sits outside the width of the phone — is something back on a rail?").toEqual([]);

    // And no rail survives on this module — the shelves' accessible names are gone from the Desk.
    await expect(page.getByRole("group", { name: "Macro figures" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Money and mood" })).toHaveCount(0);
  });

  /**
   * NOTHING INSIDE A MACRO CELL REACHES OUTSIDE IT. THIS GUARD EXISTS BECAUSE PD4's HEADLINE GUARD IS BLIND TO
   * PD4's OWN BUG: the sideways-scroll sweep asks the DOCUMENT `scrollWidth === clientWidth`, but a cell that
   * overflows into the cell NEXT DOOR never touches the document's scrollWidth — the spill lands inside the
   * page, not past its edge. PD4's first 3-up tape did exactly this: at 360px the index levels overflowed by
   * 8px, the delta chips shattered into three lines, and the page sweep measured ZERO overflow and passed;
   * only a screenshot showed it. So the question is asked of the CELL: does anything inside this box reach past
   * its content edge? Bounding boxes, per PD3's law — never the DOM.
   */
  test("nothing inside a macro cell reaches outside it — the sweep cannot see this", async ({ page }) => {
    const spills = await page.evaluate(() => {
      const offenders: string[] = [];

      for (const group of document.querySelectorAll("[data-macro-group]")) {
        const name = group.getAttribute("data-macro-group");

        for (const cell of group.children) {
          const style = getComputedStyle(cell);
          const box = cell.getBoundingClientRect();
          // The CONTENT edge, not the border edge: a figure sitting in the card's own padding is
          // already touching the wall, and it is one character away from being outside it.
          const left = box.left + parseFloat(style.paddingLeft);
          const right = box.right - parseFloat(style.paddingRight);

          for (const el of cell.querySelectorAll("*")) {
            if (!el.textContent?.trim()) continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0) continue;

            const over = Math.max(b.right - right, left - b.left);
            // A 1px allowance for sub-pixel rounding — the same tolerance the page sweep uses.
            if (over > 1) {
              offenders.push(`[${name}] "${el.textContent.trim().slice(0, 24)}" spills ${Math.round(over)}px`);
            }
          }
        }
      }
      return offenders;
    });

    expect(spills, "content overflowing a macro cell — a figure under the edge of the card next door").toEqual([]);
  });

  test("keeps the Mood gauge OUT of the money grid — a grid row is as tall as its tallest cell", async ({ page }) => {
    // The gauge was briefly a fifth card on the money shelf, and a shelf stretches every card to the tallest:
    // the four stat cards gained ~200px of dead space each and the phone Desk grew 347px. A GRID ROW DOES THE
    // SAME, so the bug's mechanism survived the shelf's retirement and this guard must too. Asserted in BOUNDING
    // BOXES, not the DOM (PD3's law — a DOM-order test passed through a rewrite while the screen changed).
    const cells = page.locator('[data-macro-group="money"] > *');
    await expect(cells).toHaveCount(4);

    const heights = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));

    // THE THRESHOLD IS MEASURED, NOT GUESSED. The four stat cells measure 125–163px on the seeded night; the
    // Mood gauge (a score, a position strip, two unfoldable sentences, a disclosure) is past 400px. 280 sits in
    // the empty space between: above anything a real glance grows to, below what a gauge drags its row up to.
    for (const h of heights) {
      expect(h, `a money cell is ${Math.round(h)}px tall — has the gauge been put back in the grid?`).toBeLessThan(280);
    }

    // The gauge is still on the page, full width, below the grid — where it can be READ.
    await expect(visible(page, /not CNN's index/)).toBeVisible();
  });
});
