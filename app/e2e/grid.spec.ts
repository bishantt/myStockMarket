import { expect, test, type Page } from "@playwright/test";

import { applyThinNight } from "./thin-night";

/**
 * grid.spec.ts — the desktop grid contract (PD3, Part 6).
 *
 * Two laws, and the tests that make them real.
 *
 *   LAW 1  At ≥lg the Desk's main column and rail are two independently-flowing stacks. A short main
 *          module is followed IMMEDIATELY by the next one; the columns never trade row heights.
 *   LAW 2  A short or empty module takes only the height it earns. Nothing reserves height.
 *
 * WHY THESE ASSERTIONS ARE ABOUT PIXELS AND NOT ABOUT THE DOM, which is the whole reason this file
 * exists rather than an extra `expect` in desk.spec.ts. The old ritual test read the DOM order of
 * the module mastheads and checked that it ascended — and it would have gone on passing through this
 * entire rewrite, because PD3 deliberately CHANGES the DOM order. (CSS can only group children that
 * are adjacent in the markup, and the ritual interleaves the two columns, so the columns are grouped
 * in the DOM and the phone's ritual is restored visually. The Desk's own comment argues it in full.)
 * A test that read the DOM would have declared the ritual intact on a page that no longer showed it.
 *
 * So these tests measure BOUNDING BOXES — where things actually ARE on the screen. That is the only
 * thing a reader ever experiences, and it is the only thing worth asserting about a layout.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/** The width at which the spread engages (`lg`). Below it: one column, and the full ritual. */
const SPREAD_AT = 1024;

/**
 * The largest vertical gap allowed between two consecutive modules in the main column.
 *
 * The designed rhythm is 24px (`gap-6`). 48px is two of those — generous enough that sub-pixel
 * rounding or a margin somebody adds on purpose will not red the build, and nowhere near enough to
 * hide the defect this phase exists for: the hole under the Brief was HUNDREDS of pixels tall.
 */
const MAX_GAP = 48;

/**
 * The plan's budget for an empty module's slim band (~112px), with a little air for font rendering.
 *
 * If this ever fails, the honest question is not "raise the number". It is: what did somebody add to
 * the empty state, and does a reader on a night with nothing to show actually need it?
 */
const EMPTY_BAND_MAX = 120;

/** A top-level module box — the thing the layout positions — and where it sits on the page. */
type Station = { index: number; top: number; bottom: number; left: number };

/**
 * The two column stacks, selected by their CHILDREN.
 *
 * Below `lg` the stacks are `display: contents` — they dissolve, and have no box of their own to
 * measure. Their children still do, which is exactly why these select the children and never the
 * stack itself. (The macro pulse is in neither: it is a direct child of the grid, because it spans
 * both columns and belongs to neither.)
 */
const MAIN_STATIONS = '[data-column="main"] > *';
const RAIL_STATIONS = '[data-column="rail"] > *';

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Measure the stations a selector names.
 *
 * A station is identified by the masthead INSIDE it ("02 — Daily brief") — that number is the
 * module's place in the ritual, and it is rendered by the filled state and the empty state alike, so
 * this keeps working on a night a module has nothing to say.
 *
 * The closing block (07 Sectors & scans + 08 Front page + the scorecard) is ONE station: it is a
 * single wrapper that the main column positions, and the three cards inside it have their own little
 * grid. It takes its index from the first masthead in it, which is 07.
 */
/**
 * WAIT FOR THE PAGE TO BE STYLED BEFORE MEASURING IT (PD4) — this is a bug fix, not a precaution.
 *
 * Every assertion in this file is a BOUNDING BOX, and a bounding box read before the stylesheet lands
 * is a measurement of unstyled HTML: every block element starts at x = 0, so both columns report
 * `left: 0` and the rail is, technically, not to the right of the main column.
 *
 * That is exactly how this file failed in CI — `mainRight: 0`, `railLeft: 0`, on a Desk that was
 * perfectly fine. It reproduced on the retry and not at all locally, because it is a RACE and CI is a
 * slower machine. `page.goto()` resolves on `load`, which does not guarantee that the CSSOM has been
 * applied to a layout this test then forces.
 *
 * The tokens are the honest signal: `--color-paper` is defined in globals.css and is an empty string
 * until that stylesheet is in effect. Fonts come next, because every height in this file (the dead
 * gap, the empty band) depends on text having its real metrics.
 *
 * PD3's law says layout is asserted in bounding boxes. PD4's corollary: **a bounding box is only
 * evidence once the thing that decides it has arrived.**
 */
async function waitForLayout(page: Page) {
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim() !== "",
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => document.fonts.ready);
}

async function stations(page: Page, selector: string): Promise<Station[]> {
  await waitForLayout(page);

  return page.evaluate((sel) => {
    const found: Station[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const masthead = el.querySelector("h2");
      const match = /^(\d\d) —/.exec(masthead?.textContent?.trim() ?? "");
      if (match === null) continue;
      const box = el.getBoundingClientRect();
      found.push({
        index: Number(match[1]),
        top: box.top + window.scrollY,
        bottom: box.bottom + window.scrollY,
        left: box.left,
      });
    }
    return found;
  }, selector);
}

/** The stations a reader SEES, in the order they see them — top to bottom. */
function seenTopToBottom(found: Station[]): number[] {
  return [...found].sort((a, b) => a.top - b.top).map((s) => s.index);
}

test.describe("The Desk's grid contract", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * THE RITUAL, AS A READER ACTUALLY SEES IT — the assertion this file exists for.
   *
   * Below `lg` there is one column and the ritual runs down it, exactly as it always has. The phone
   * ritual is untouchable: it is the evening read, it mirrors the documented pre-market sequence,
   * and PD3 was explicitly forbidden from moving it. Because this measures the SCREEN, it catches
   * the ritual breaking however it broke — a wrong `order` utility, a wrapper that failed to
   * dissolve, a module quietly moved in the markup.
   *
   * Every numbered masthead is checked, not just the top-level stations, so 08 (which lives inside
   * the closing block) is held to the ritual too. That is safe here and only here: below `lg`
   * everything is one column, so no two mastheads can share a Y and the sort is unambiguous.
   */
  test("below lg the reader sees the full ritual, 01 → 08, down one column", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= SPREAD_AT,
      "this is the single-column contract — the spread has its own test",
    );
    await page.goto("/");

    const mastheads = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main h2")]
        .map((h) => ({
          match: /^(\d\d) —/.exec(h.textContent?.trim() ?? ""),
          top: h.getBoundingClientRect().top + window.scrollY,
        }))
        .filter((m): m is { match: RegExpExecArray; top: number } => m.match !== null)
        .sort((a, b) => a.top - b.top)
        .map((m) => Number(m.match[1])),
    );

    expect(mastheads, "the ritual a reader sees, top to bottom").toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  /**
   * LAW 1 — the two columns, and the proof that they are genuinely two.
   *
   * The main column carries the narrative in ritual order (02 brief, 04 movers, 06 setups, then the
   * closing block at 07). The rail carries the reference matter (03 calendar, 05 watchlist). Each
   * column reads top-down in its own order, and the rail sits to the RIGHT of the main column —
   * which is what makes them columns rather than one stack that happens to be indented.
   */
  test("at ≥lg the spread is two columns: narrative on the left, reference matter on the right", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) < SPREAD_AT, "the spread engages at lg and above");
    await page.goto("/");

    const main = await stations(page, MAIN_STATIONS);
    const rail = await stations(page, RAIL_STATIONS);

    expect(seenTopToBottom(main), "the main column, top to bottom").toEqual([2, 4, 6, 7]);
    expect(seenTopToBottom(rail), "the rail, top to bottom").toEqual([3, 5]);

    // The rail is genuinely BESIDE the main column, not under it. Without this, a rail that had
    // collapsed into the main column would still pass the two assertions above.
    const mainRight = Math.max(...main.map((s) => s.left));
    const railLeft = Math.min(...rail.map((s) => s.left));

    // The numbers go IN the message. When this failed in CI it said only "expected > 0, received 0",
    // and the two zeros were the whole diagnosis — an unstyled page, not a collapsed grid (see
    // waitForLayout). A failure that does not report what it measured makes the next reader guess.
    expect(
      railLeft,
      `the rail should sit to the right of the main column — main's left edge is ${mainRight}px, ` +
        `the rail's is ${railLeft}px. If BOTH are 0, the page was measured before its stylesheet ` +
        `applied and the Desk is fine.`,
    ).toBeGreaterThan(mainRight);
  });

  /**
   * THE THIN-NIGHT TESTS RUN SERIALLY, AND THIS IS NOT BOILERPLATE — it is a bug I caught by running
   * them.
   *
   * Both tests below THIN THE DATABASE and put it back (e2e/thin-night.ts). CI runs `workers: 1`, so
   * everything in the suite is already strictly serial there and they could never have collided. But
   * locally `workers` is undefined and `fullyParallel` is true — so on the first real run these two
   * landed in different workers, thinned the same database at the same time, and the second restore
   * died on a duplicate primary key. The failure looked exactly like a broken layout, and it was not.
   *
   * Depending on `workers: 1` for correctness would have been depending on a setting in another file
   * that nothing here states — which is the shape of the journal-entry bug that hid a 387-pixel error
   * in the Desk's baseline for months. So the requirement is declared where it lives: these two tests
   * share one database, and they take turns.
   */
  test.describe.configure({ mode: "serial" });

  /**
   * THE DEAD GAP — the defect itself, encoded mechanically, on the night it actually happens.
   *
   * This is the direct translation of the user's complaint into an assertion. On a thin night the
   * Brief is short (held) while the Calendar beside it is tall (a full session, open by default on
   * desktop). Under the OLD shared grid, 04 Movers was pinned to the next row and could not begin
   * until the Calendar's row track ended — so a hole of several hundred pixels opened under the
   * Brief. Under Law 1 the columns share no tracks at all, so the distance between consecutive main
   * modules is the designed 24px and there is no mechanism left that could put anything there.
   *
   * It runs at every width ≥lg the suite has, INCLUDING 1512 — the screen the gap was reported on.
   */
  test("on a THIN night no dead gap opens between the main column's modules", async ({
    page,
    request,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < SPREAD_AT,
      "the gap was a two-column defect — there are no columns to decouple below lg",
    );

    const restore = await applyThinNight(request);
    try {
      await page.goto("/");

      // PROVE THE NIGHT IS REALLY THIN before drawing any conclusion from it. A test that silently
      // measured a FULL night would pass forever and prove nothing — the full night never had a gap
      // in the first place, which is precisely why this defect survived so long unseen.
      await expect(
        page.getByText(/Briefing unavailable tonight/),
        "the brief is not held — this is not a thin night, and the test would be measuring nothing",
      ).toBeVisible();

      const main = await stations(page, MAIN_STATIONS);
      const ordered = [...main].sort((a, b) => a.top - b.top);
      expect(ordered.length, "the main column should hold four stations").toBe(4);

      for (let i = 1; i < ordered.length; i += 1) {
        const gap = Math.round(ordered[i].top - ordered[i - 1].bottom);
        expect(
          gap,
          `a dead gap of ${gap}px opened between modules ${ordered[i - 1].index} and ` +
            `${ordered[i].index} — the columns are trading row heights again, which is the exact ` +
            `defect PD3 was built to kill`,
        ).toBeLessThanOrEqual(MAX_GAP);
      }
    } finally {
      await restore();
    }
  });

  /**
   * LAW 2 — an empty module is a slim band, not a reserved acre.
   *
   * On a thin night no setup cards fire, so module 06 renders EmptyModule. The unit tests prove it
   * reserves no height in its CLASSES; only a real browser can say what that comes to in pixels, and
   * pixels are what the reader scrolls past.
   */
  test("on a THIN night an empty module renders as a slim band, not a reserved acre", async ({
    page,
    request,
  }) => {
    const restore = await applyThinNight(request);
    try {
      await page.goto("/");

      const main = await stations(page, MAIN_STATIONS);
      const setups = main.find((s) => s.index === 6);
      expect(setups, "module 06 should still be on the page — absence is a state to SHOW").toBeDefined();

      const height = Math.round(setups!.bottom - setups!.top);
      expect(
        height,
        `the empty setup-cards module is ${height}px tall — a slim information band, not an acre (Law 2)`,
      ).toBeLessThanOrEqual(EMPTY_BAND_MAX);
    } finally {
      await restore();
    }
  });
});
