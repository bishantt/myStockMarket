import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { signIn } from "./session";

import { sweptBy } from "../lib/routes";
import { THEME_COOKIE } from "../lib/theme";

/**
 * The accessibility sweep (APP-FEEL F7). The suite already checks the two things this app gets wrong most
 * on a phone — a 44px target and a 16px input — because those a machine can measure; this is the other
 * half: the WCAG rules a linter cannot see, run against every room by axe. Scoped to serious and critical
 * violations: axe's "minor"/"moderate" buckets are full of arguable advisories, and a gate that fires on
 * those trains its reader to skim past it (a lesson this codebase learned three times).
 *
 * COLOUR CONTRAST IS IN THE GATE, and the story of getting it back is a trap anyone re-running axe hits:
 * the first run reported 58 failing nodes in every colour the app owns, which looked like a broken palette.
 * It was not — every page fades in (`.route-fade`, opacity 0→1) and axe was measuring DURING the fade,
 * compositing the foreground through the ancestor opacity (`text-muted` at 55% really is 2.23:1, a colour
 * no reader ever reads). Wait for the fade and the 58 collapse to ONE real finding, now fixed: `--color-
 * muted` was verified 4.83:1 against PAPER, but muted text lives on a Surface (white 72% over the wash =
 * #f0effe), where the old #6e6c80 measured 4.48:1. It is #676577 now (4.99:1 on glass) — approved by the
 * user as a readability floor, 2026-07-12.
 *
 * THE LESSON: never measure a colour, size, or position while the page is still animating — you will
 * measure the animation. Any test reading a computed style waits first for the thing to finish arriving
 * (`settle()` below). Run in BOTH themes: a two-theme app whose gate checks one theme checks half its colours.
 */

/** Both themes. Colour is half of what axe checks, and this app has two palettes. */
const THEMES = ["light", "dark"] as const;

/**
 * Every room a reader can reach — read from lib/routes-manifest.json, the ONE list of rooms (G3). The
 * sweep is only as honest as this list, and until G3 it was hand-kept here — how /news, the densest room
 * for exactly these rules, shipped in N5 and went two tagged phases without axe opening it. The manifest is
 * the single source now, and routes-manifest.test.ts reds the unit suite if a page.tsx has no entry: a room
 * can no longer arrive unswept. These exist whatever is in the database — an empty room renders its empty
 * state, which is markup.
 */
const SWEPT = sweptBy("axe");
const ROUTES = SWEPT.filter((room) => !room.seeded).map((room) => room.path);

/**
 * Rooms that only EXIST when the database is seeded (N7). A story page is addressed by a cluster id; ask
 * for one that is not there and the route calls `notFound()`, so an unseeded sweep measured the framework's
 * 404 page, found nothing wrong, and reported the story page clean (verified against `/news/nc-fed-hold` on
 * a database that never contained it) — this build's oldest hazard in accessibility clothes. The manifest's
 * `seeded` flag draws the line, so a new seeded room cannot join the always-there list by accident.
 */
const SEEDED_ROUTES = SWEPT.filter((room) => room.seeded).map((room) => room.path);

/**
 * Open a room, and PROVE it is the room — not an error page, not the login wall (N7). A sweep measures
 * whatever is on screen: a missing route gives the 404 page, a lapsed session the login form — both
 * accessible, both pass, and the room the gate protects was never looked at. AND THE STATUS CODE IS NOT THE
 * WITNESS: a `notFound()` inside a statically-generated route answers 200 WITH the 404 page in the body
 * (only an unmatchable path gets a real 404), so a status check certifies exactly the page it was written to
 * refuse. The honest witness is the BODY, which is what this asserts.
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
 * Wait until the page has finished arriving. Axe composites a foreground through every ancestor's opacity,
 * so a page caught mid-fade reports colours no reader sees — measuring the animation, not the palette. See
 * the header.
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

    // Name the offending node, not just the rule: the first version printed "nested-interactive (1 nodes)"
    // and left the reader to find where. A gate that fires without saying where is half a gate. For a
    // contrast failure the summary carries the measured foreground, background and ratio — the whole diagnosis.
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
   * The detail sheet, OPEN (PD10, Part 12 · item 2). The room sweep never opens the overlay (the sheet is
   * not a room — routes-manifest skips @-slot pages, PD9). A Radix Dialog SHOULD be clean, but "should" is
   * not "is": a dialog owes an accessible name, the sr-only <Dialog.Title> gives it one, and
   * `aria-describedby={undefined}` is deliberate (no description, valid, like RailDialog). So we OPEN the
   * sheet and axe-scan it, scoped to the dialog, for a story and a ticker body, both themes. Phone only: the
   * sheet is one component (DetailOverlay) whose a11y does not change between bottom sheet and centred
   * overlay (only CSS position, which axe does not read; the overlay's look is pinned by VRT). Seeded,
   * because a story and a ticker only exist seeded.
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

    // Never measure a fade (see the header). The sheet arrives via `.sheet-fade` (opacity 0→1) and axe
    // composites through ancestor opacity, so wait for it to land — the discipline `settle()` gives the rooms.
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
   * Open a ticker sheet from a story page that carries a real TickerChip DOOR (its affected-names table).
   * The tap is a soft nav the @modal slot intercepts into a sheet over the story.
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
