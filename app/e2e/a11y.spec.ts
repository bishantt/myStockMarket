import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { sweptBy } from "../lib/routes";
import { THEME_COOKIE } from "../lib/theme";

/**
 * The accessibility sweep (APP-FEEL-PLAN F7).
 *
 * The suite already checks the two things this app gets wrong most easily on a phone — a 44px touch
 * target and a 16px input — because those are rules a machine can measure and a human forgets. This
 * is the other half: the WCAG rules that a linter cannot see and a designer cannot feel, run against
 * every room by axe.
 *
 * Scoped to serious and critical violations, deliberately. Axe's "minor" and "moderate" buckets are
 * full of advisory findings that are genuinely arguable (a landmark preference here, a heading-order
 * opinion there); a gate that fires on those trains its reader to skim past it, and this codebase has
 * already learned that lesson three separate times. Serious and critical are the ones that actually
 * lock somebody out.
 *
 * COLOUR CONTRAST IS IN THE GATE. Nothing is excluded. It was excluded for one day, and the story
 * of getting it back in is worth the paragraph, because it is a trap anybody re-running axe will
 * fall into:
 *
 * The first run reported 58 failing nodes across the app, in every colour the app owns — muted, ink,
 * the accent, the up/down chips. That looked like a broken palette. It was not. Every page in this
 * app fades in (`.route-fade`, opacity 0 → 1), and axe was measuring DURING the fade: it composites
 * a foreground through any ancestor's opacity, so it was faithfully reporting the colours of a page
 * that was still arriving. `text-muted` at 55% opacity really is 2.23:1. It is also not a colour any
 * reader ever reads.
 *
 * Wait for the fade to land and the 58 collapse to ONE real finding, which is now fixed:
 * `--color-muted` was verified at 4.83:1 against the PAPER, but muted text lives on a Surface, and a
 * Surface is white at 72% over the lavender wash — which composites to #f0effe. Against the thing a
 * reader is actually looking at, the old #6e6c80 measured 4.48:1 and missed the floor. It is #676577
 * now (4.99:1 on glass) — approved by the user as a readability floor, 2026-07-12.
 *
 * THE LESSON, because it will happen again: never measure a colour, a size or a position while the
 * page is still animating. You will measure the animation. Any test that reads a computed style must
 * first wait for the thing to be finished arriving — which is what `settle()` below does.
 *
 * Scoped to serious and critical, and run in BOTH themes: a two-theme app whose gate only checks one
 * theme is checking half its colours.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/** Both themes. Colour is half of what axe checks, and this app has two palettes. */
const THEMES = ["light", "dark"] as const;

/**
 * Every room a reader can reach — read from lib/routes-manifest.json, the ONE list of rooms (G3).
 *
 * The sweep is only as honest as this list, and until G3 the list was hand-kept right here. That is
 * how /news — the densest room in the app for exactly the rules this file checks — shipped in N5 and
 * went through two tagged phases without axe ever opening it. Nothing failed, because nothing was
 * asked to look.
 *
 * The manifest is now the single source, and lib/routes-manifest.test.ts fails the unit suite if a
 * `page.tsx` exists with no entry in it. A room can no longer arrive unswept: it reds at the next
 * `npm test`, seconds after it is written, rather than two phases later.
 *
 * These exist whatever is in the database — an empty room still renders its empty state, and an
 * empty state is a room with markup in it.
 */
const SWEPT = sweptBy("axe");
const ROUTES = SWEPT.filter((room) => !room.seeded).map((room) => room.path);

/**
 * Rooms that only EXIST when the database is seeded, and the reason they are separated (N7).
 *
 * A story page is addressed by a cluster id. Ask for one that is not there and the route calls
 * `notFound()` — so an unseeded run of this sweep did not measure the story page at all. It
 * measured the framework's 404 page, found nothing wrong with it, and reported the story page
 * clean. Verified: this sweep passed against `/news/nc-fed-hold` on a database that has never
 * contained it.
 *
 * That is this build's oldest hazard wearing an accessibility gate's clothes — a guard that passes
 * because the thing it measures is ABSENT rather than correct. The `open()` helper below now makes
 * that impossible to do quietly, so these routes must state the condition they need instead.
 *
 * The manifest's `seeded` flag is what draws this line now, so a new seeded room cannot be added to
 * the always-there list by accident.
 */
const SEEDED_ROUTES = SWEPT.filter((room) => room.seeded).map((room) => room.path);

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Open a room, and PROVE it is the room — not an error page, and not the login wall (N7).
 *
 * A sweep measures whatever is on the screen. If the route is missing, it measures the 404 page; if
 * the session lapsed, it measures the login form. Both are perfectly accessible, both pass, and the
 * room the gate exists to protect was never looked at. Measured before this was written: the axe
 * sweep passed `/news/nc-fed-hold` against a database that has never contained that cluster. It was
 * sweeping the 404 page and calling the story page clean.
 *
 * AND THE STATUS CODE IS NOT THE WITNESS — this is the part that will catch the next person, because
 * it caught me. The first version of this guard asserted `status === 200`, and it still passed on the
 * missing story page. Recorded, on this tree:
 *
 *     /news/nc-fed-hold        status=200   body: "404 — This page could not be found."
 *     /ticker/NOTAREALTICKER   status=200   body: "404 — This page could not be found."
 *     /scans/not-a-preset      status=404
 *     /no-such-room-at-all     status=404
 *
 * A `notFound()` raised INSIDE a statically-generated route answers **200 with the 404 page in the
 * body**; only a path the router cannot match at all gets a real 404. So a status check certifies
 * exactly the page it was written to refuse. The honest witness is what the reader can actually see,
 * which is the BODY — so that is what this asserts.
 */
async function open(page: Page, route: string) {
  await page.goto(route);

  // The framework's not-found page, named by the words a reader would see on it.
  const missing = await page.getByText("This page could not be found").count();
  expect(
    missing,
    `${route} rendered the 404 PAGE — the sweep would have measured an error page and passed. ` +
      `(Note: it answers HTTP 200, so no status check can see this.)`,
  ).toBe(0);

  expect(
    new URL(page.url()).pathname,
    `${route} redirected — the sweep would have measured a DIFFERENT ROOM and passed`,
  ).toBe(route);
}

/**
 * Wait until the page has finished arriving.
 *
 * Axe composites a foreground colour through every ancestor's opacity, so a page caught mid-fade
 * reports colours that no reader ever sees — and reports them as failures. This is the difference
 * between measuring the palette and measuring the animation. See the header.
 */
async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".route-fade, .content-fade")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
}

test.describe("accessibility", () => {
  test("the login wall itself is clean — it is the one page a reader meets first", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  /**
   * Sweep one room in one theme. Shared by the always-there rooms and the seeded ones, so both get
   * the same `open()` proof that the room actually arrived.
   */
  async function sweepRoom(page: Page, context: BrowserContext, theme: string, route: string) {
    await signIn(page);
    await context.addCookies([{ name: THEME_COOKIE, value: theme, url: "http://127.0.0.1:3210" }]);
    await open(page, route);
    await settle(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Name the offending node, not just the rule. The first version of this gate printed
    // "nested-interactive (1 nodes)" and nothing else, which tells the reader that something,
    // somewhere on a page of a hundred elements, is wrong — and leaves them to find it. A gate
    // that fires without saying where is only half a gate. For a contrast failure the summary
    // carries the measured foreground, background and ratio, which is the whole diagnosis.
    expect(
      serious.map(
        (v) =>
          `${v.id} (${v.nodes.length} nodes): ${v.help}\n${v.nodes
            .map((n) => `      at ${n.target.join(" ")}\n      ${n.html}\n      ${(n.failureSummary ?? "").replace(/\s+/g, " ").trim()}`)
            .join("\n")}`,
      ),
      `serious/critical accessibility violations on ${route} (${theme})`,
    ).toEqual([]);
  }

  const label = (theme: string) => (theme === "light" ? "Morning" : "Midnight");

  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`${route} has no serious or critical violations — ${label(theme)}`, async ({
        page,
        context,
      }) => {
        await sweepRoom(page, context, theme, route);
      });
    }

    for (const route of SEEDED_ROUTES) {
      test(`${route} has no serious or critical violations — ${label(theme)} (seeded)`, async ({
        page,
        context,
      }) => {
        test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
        await sweepRoom(page, context, theme, route);
      });
    }
  }

  /**
   * The detail sheet, OPEN (PD10, Part 12 · PD10 item 2).
   *
   * The room sweep above never opens the overlay — the sheet is not a room (routes-manifest skips
   * @-slot pages, PD9). A Radix Dialog is the house pattern and SHOULD be clean, but "should" is not
   * "is". A dialog owes an accessible name, and the sr-only <Dialog.Title> is the only thing that
   * gives it one; `aria-describedby={undefined}` is deliberate — no description, which is valid, the
   * same choice RailDialog makes. So we OPEN the sheet and axe-scan it, scoped to the dialog, for a
   * story body and a ticker body, in both themes.
   *
   * Phone project only, and that is a decision with a reason: the sheet is one component
   * (DetailOverlay) whose accessibility — its name, roles and contrast tokens — does not change
   * between the bottom sheet (<md) and the centred overlay (≥md). Only CSS position differs, and axe
   * does not read position; the centred overlay's LOOK is pinned by its two VRT shots. Seeded,
   * because a story and a ticker only exist in a seeded database.
   */
  async function scanOpenSheet(
    page: Page,
    context: BrowserContext,
    theme: string,
    open: (page: Page) => Promise<void>,
    where: string,
  ) {
    await signIn(page);
    await context.addCookies([{ name: THEME_COOKIE, value: theme, url: "http://127.0.0.1:3210" }]);
    await open(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Never measure a fade (see the header). The sheet arrives via `.sheet-fade` (opacity 0→1), and
    // axe composites the foreground through any ancestor opacity — a sheet caught mid-fade reports
    // colours no reader sees. Wait for it to land, the same discipline `settle()` gives the rooms.
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="dialog"]');
      return !!el && getComputedStyle(el).opacity === "1";
    });

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map(
        (v) =>
          `${v.id} (${v.nodes.length} nodes): ${v.help}\n${v.nodes
            .map((n) => `      at ${n.target.join(" ")}\n      ${n.html}\n      ${(n.failureSummary ?? "").replace(/\s+/g, " ").trim()}`)
            .join("\n")}`,
      ),
      `serious/critical accessibility violations on the ${where} sheet (${theme})`,
    ).toEqual([]);
  }

  /** Open the SMCI story sheet from the feed — the same launcher the overlay suite uses. */
  async function openStorySheet(page: Page) {
    await page.goto("/news");
    const link = page
      .getByTestId("news-row")
      .filter({ hasText: "Super Micro" })
      .first()
      .getByRole("link")
      .first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
  }

  /**
   * Open a ticker sheet from a story page that carries a real TickerChip DOOR (its affected-names
   * table). The tap is a soft nav the @modal slot intercepts into a sheet over the story.
   */
  async function openTickerSheet(page: Page) {
    await page.goto("/news/nc-fda-nonopioid");
    const chip = page.locator('a[href^="/ticker/"]').first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
  }

  for (const theme of THEMES) {
    test(`the story detail sheet has no serious or critical violations — ${label(theme)} (seeded)`, async ({
      page,
      context,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "the sheet's a11y is one component; scanned on phone");
      test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
      await scanOpenSheet(page, context, theme, openStorySheet, "story");
    });

    test(`the ticker detail sheet has no serious or critical violations — ${label(theme)} (seeded)`, async ({
      page,
      context,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "the sheet's a11y is one component; scanned on phone");
      test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
      await scanOpenSheet(page, context, theme, openTickerSheet, "ticker");
    });
  }
});
