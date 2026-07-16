import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { VRT_ROOMS } from "../lib/routes";
import { signIn } from "./session";
import { THEME_COOKIE } from "../lib/theme";
import { VRT_RESET_SECRET } from "../playwright.config";
import { SEEDED_EVENING, SEEDED_MORNING } from "./seeded-clock";
import { applyThinNight } from "./thin-night";

/**
 * vrt.spec.ts — visual regression. The styling counterpart of TDD (UI-REDESIGN Part 9).
 *
 * Unit tests prove the numbers; nothing else proves the *look* stayed right, and a design system this
 * large would drift within a week without pixel locks. So every surface gets a baseline and an
 * unexplained diff is a build failure (§9.3): an intentional restyle updates its baselines in the same
 * commit with a one-line note; a reflexive update to make CI green turns the oracle into a chore.
 *
 * Determinism, in the order flakiness would bite: reduced motion forced (kills route fades); fonts
 * awaited INSIDE the page (`document.fonts.ready` serialises to junk out of evaluate()); timestamps
 * masked; seeded data. The pixel oracle is CI (Linux) — locally use `--ignore-snapshots`.
 */

/**
 * THE LAYOUT-ONLY PROJECTS — `wide` (1536) and `mbp16` (1512), the two viewports that lock a GRID, not a
 * palette. Both shoot rooms in the light theme only: the colours are already pinned at 1366 and 390 in
 * both themes, so dark baselines here would be pure cost; and neither re-shoots the styleguide, login, or
 * the table's interactive states. This used to be eleven scattered `project.name === "wide"` checks —
 * adding `mbp16` would have meant finding all eleven, and the one missed would have shot silently.
 */
const LAYOUT_ONLY = new Set(["wide", "mbp16"]);
const locksLayoutOnly = (testInfo: { project: { name: string } }) =>
  LAYOUT_ONLY.has(testInfo.project.name);

test.use({ contextOptions: { reducedMotion: "reduce" } });

/**
 * Wait until the page's real fonts are on screen — not merely until the browser says idle. `await
 * document.fonts.ready` is NOT sufficient: it settles against the loads PENDING when awaited, so run
 * before the fetch begins it resolves against an empty set and the shot catches the fallback sans (a
 * baseline of a bug — caught at F0, a track-record shot in fallback font, re-wrapped two lines to three).
 * So we force it: ask for each family the page uses, wait for those loads (`document.fonts.load()`
 * resolves when the face is usable), then wait for the set to settle.
 */
async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    const families = new Set<string>();
    for (const el of document.querySelectorAll("body, h1, h2, h3, p, li, td, th, span, a, button")) {
      const family = getComputedStyle(el).fontFamily;
      if (family) families.add(family);
    }
    await Promise.all(
      [...families].map((family) => document.fonts.load(`1rem ${family}`).catch(() => undefined)),
    );
    await document.fonts.ready;
  });
}

/**
 * Take one baseline shot. Timestamps and as-of stamps are masked: honest, load-bearing content, but they
 * encode wall-clock time and would make every baseline a false positive. Masking the clock is what lets
 * the pixels mean something.
 */
async function shoot(page: Page, path: string, name: string, options: { allowSkeletons?: boolean } = {}) {
  await page.goto(path);

  /*
   * NEVER PHOTOGRAPH A LOADING STATE. It happened: the scan-table baselines failed on a tag run with
   * "expected 1876px, received 768px" — one viewport tall, because the shot caught `loading.tsx`'s
   * skeleton, and it would bite a different route each time the suite got slower. Waiting for the bones to
   * be GONE is the honest signal that content arrived. The styleguide is the one exception (section 9
   * pixel-locks the skeleton specimens): it passes allowSkeletons.
   */
  if (!options.allowSkeletons) {
    await expect(page.locator(".skeleton-bone"), `${name}: the page was still loading when it was photographed`).toHaveCount(0);
  }

  await waitForFonts(page);

  /*
   * PARK THE MOUSE BEFORE SHOOTING (PD4) — a bug fix, not a nicety. `signIn()` CLICKS the button and
   * Chromium leaves the pointer where it landed. On `/ticker/AAPL` the candle chart sits under that
   * cursor, lightweight-charts thinks it is hovered, and draws a CROSSHAIR into the baseline — so the
   * ticker's picture encoded WHERE THE LOGIN BUTTON WAS. PD4 moved the button (the phone login gained its
   * mark), the crosshair slid down the price axis, and its pill went 214.54 → 213.02 on a page PD4 never
   * touched — byte-identical on a re-run, so never flake. PD3's law again: a baseline proves the page did
   * not change, never that it was right. (0, 0) is outside every chart, so the page shows the arrival state.
   */
  await page.mouse.move(0, 0);

  const masks = page.locator('[data-vrt="mask"], time');
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [masks] });
}

/** Set the theme cookie before navigating — the same mechanism the theme spec uses. */
async function useTheme(page: Page, theme: "light" | "dark") {
  await page.context().addCookies([
    { name: THEME_COOKIE, value: theme, url: "http://127.0.0.1:3210" },
  ]);
}

/**
 * A pixel baseline must photograph a KNOWN state — never whatever the previous test left behind. THE BUG:
 * `academy.spec.ts` opens a lesson, which marks it read (a `lesson_progress` row the page renders as a
 * checkmark); specs run alphabetically on one worker, so `academy` runs before `vrt` and the Academy shot
 * caught that checkmark. But the baselines are born from a job running ONLY vrt.spec.ts, where the lesson
 * was never opened — two different worlds, and it "passed" for months only because ~1,960 pixels fit the
 * old 1% tolerance. The fix is not to run more tests (that couples every baseline to suite ordering) but
 * to establish the state: clear the progress rows so the Academy renders its seeded state.
 */
async function resetMutableStateThePixelsWouldOtherwiseCatch(request: APIRequestContext) {
  if (!process.env.MSM_SEEDED) return; // unseeded runs have no database to reset

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    await db.lessonProgress.deleteMany({});
  } finally {
    await db.$disconnect();
  }

  // DELETING THE ROW IS NOT ENOUGH: /academy is ISR, and the earlier spec's mark-read revalidated it, so
  // the cache holds a render WITH the checkmark. Emptying the table changes the next render, not the
  // cached one. So the reset finishes the job — clear the state, then bust the cache still showing it.
  await request.post(`/api/revalidate?secret=${VRT_RESET_SECRET}`);
}

/*
 * THE CLOCK IS PINNED, AND THE FIRST BASELINE RUN IS WHY — see e2e/seeded-clock.ts, which owns
 * SEEDED_EVENING and is the only browser-suite file allowed to write a date (drift rule 21). The pipeline
 * strip grades freshness in the BROWSER against the reader's clock, so the Desk depends on WHEN IT IS;
 * pinning to the seeded evening keeps the strip FRESH, and the desk shots assert that before shooting, so
 * a drifted seed fails loudly instead of photographing the wrong rung.
 */

test.describe("visual regression — the design system", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMutableStateThePixelsWouldOtherwiseCatch(request);
    // Before anything navigates: the strip reads this on mount.
    await page.clock.setFixedTime(SEEDED_EVENING);
    await signIn(page);
  });

  // ── the styleguide: the anchor ───────────────────────────────────────────────────────────
  // Every token and primitive renders here, so this is the highest-value baseline: a silently changed
  // token shows up here before anywhere else.

  test("styleguide — Morning", async ({ page }, testInfo) => {
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
    await useTheme(page, "light");
    await shoot(page, "/styleguide", "styleguide-light", { allowSkeletons: true });
  });

  test("styleguide — Midnight", async ({ page }, testInfo) => {
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
    await useTheme(page, "dark");
    await shoot(page, "/styleguide", "styleguide-dark", { allowSkeletons: true });
  });

  // ── the rooms ────────────────────────────────────────────────────────────────────────────
  // Seeded data only (MSM_SEEDED), so numbers are fixed by prisma/seed.mjs and a diff means a STYLE
  // change. Without the seed these would fail every night for the most boring reason.

  /*
   * The rooms with a generated baseline, read from lib/routes-manifest.json — the ONE list of rooms (G3).
   * Every entry with a `vrtRoom` slug is shot light and dark at every matrix viewport; the list used to be
   * hand-kept here (how a room could ship with no lock), and routes-manifest.test.ts now reds if a page.tsx
   * has no entry. WHAT STAYED HERE deliberately: the per-shot quirks and the arguments for locking
   * particular rooms — the oracle's business, not the manifest's:
   *   · /news + /news/nc-fda-nonopioid — the room is TEXT-FIRST (CC5/R4). The lead and the shot story
   *     carry a real stored fixture photo (fed-decision / fda-approval); every no-photo card is its
   *     headline and words, with no generated frame. "The headline leads, a photo only supports" is
   *     true or false only in a picture, which no DOM test can hold.
   *   · /scans/unusual-volume — the match table (F3): recipe card, named order, lottery chip, pagination.
   *   · /settings — THE CONTROL ROOM (CC7), now a TABLE of the Desk's three schedules (was N6's flat
   *     panel). Worth locking because its Cadence and Next-run columns are a DST-honest cron→ET
   *     computation whose failure mode is typographic — a wrong weekday, a dropped season — and invisible
   *     to a DOM assertion. The pinned clock makes the client-computed Next run deterministic (as it did
   *     the old panel's `full` state). The run-now controls and `full`'s C5 sentence now live in the
   *     per-row detail sheet — opened on demand, its sections asserted in control-room.spec, its chrome
   *     the same DetailOverlay the story/ticker sheets already pixel-lock.
   * The ticker room is written by hand below, against /ticker/AAPL, because the Range Ladder needs seeded
   * vol bands (the sweeps open /ticker/SPY, which needs no seed).
   */
  const SEEDED_ROOMS = VRT_ROOMS;

  for (const room of SEEDED_ROOMS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${room.name} — ${theme === "light" ? "Morning" : "Midnight"}`, async ({ page }, testInfo) => {
        test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
        /*
         * The layout-only projects lock the GRID, not the palette (Appendix F: "every room at 1536, light
         * only"). Colours are pinned at 1366 and 390 in both themes; another dark set here is pure cost.
         * What 1536 answers, and nothing else can, is whether the wide column maps hold.
         */
        test.skip(locksLayoutOnly(testInfo) && theme === "dark", "this project locks layout, not palette");

        /*
         * THE 16-INCH LOCK IS SELECTIVE, AND THE MANIFEST DECIDES — not this file (PD3, §6.3). 1512 sits
         * INSIDE the `desk:` band and the container caps at 1360px, so a breakpoint-composed room renders
         * the same content box at 1512 as at 1366 (more margin), and shooting every room here re-answers an
         * answered question forever. The rooms worth 1512 are the ones where CONTENT HEIGHT decides layout —
         * where Law 1 lives and the dead gap opened; the manifest's `mbp16` flag names them and defends each
         * in its note. This loop obeys it: one list of rooms, and a second hiding in a spec is how /news went
         * two tagged phases with no sweep.
         */
        test.skip(
          testInfo.project.name === "mbp16" && !room.mbp16,
          "not a 16-inch lock — see the mbp16 field in lib/routes-manifest.json",
        );

        await useTheme(page, theme);

        /*
         * The Desk carries the pipeline strip, the one thing here whose appearance depends on WHEN IT IS.
         * The clock is pinned to the seeded evening (SEEDED_EVENING), putting the strip in its FRESH state.
         * This asserts that before shooting: if the seed's day moves and the pin does not, the strip
         * escalates and the baseline photographs a state nobody chose. Better to fail here than hand back a
         * picture of a bug.
         */
        if (room.path === "/") {
          await page.goto("/");
          await expect(
            // Since CC3 the FRESH strip speaks in provenance voice — "…next edition {day} ~{time}".
            page.getByRole("status").filter({ hasText: "next edition" }),
            "the strip is not FRESH — the pinned clock and the seed's session have drifted apart",
          ).toBeVisible();
        }

        await shoot(page, room.path, `${room.name}-${theme}`);
      });
    }
  }

  /**
   * The table's INTERACTIVE states. A sorted table and a second page are different pictures, and the ones
   * that matter most are the ones nobody would think to check by hand. Deterministic by construction: fixed
   * seed, page 1 is page 1, and the sort is instant (a FLIP-animated sort of money figures is banned).
   */
  test("scans table sorted by RVOL — the header state", async ({ page, isMobile }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    test.skip(!!isMobile, "the desktop table is the thing being locked here");
    await useTheme(page, "light");
    await page.goto("/scans/unusual-volume");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);
    await page.getByRole("button", { name: /RVOL/ }).click();
    await expect(page.getByRole("columnheader", { name: /RVOL/ })).toHaveAttribute("aria-sort", /ascending|descending/);
    await expect(page).toHaveScreenshot("scans-preset-sorted.png", {
      fullPage: true,
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  });

  test("scans table page 2 — the pagination footer", async ({ page, isMobile }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    test.skip(!!isMobile, "one shot is enough for the footer state");
    await useTheme(page, "light");
    await page.goto("/scans/unusual-volume");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 2 · 32 rows")).toBeVisible();
    await expect(page).toHaveScreenshot("scans-preset-page2.png", {
      fullPage: true,
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  });

  /**
   * The Front Page's INTERACTIVE states (Appendix F): filtered, empty, and the week window. The zero-state
   * shot earns its keep: "No FDA catalysts today — that is information, not an error" lands as information
   * or as an apology depending entirely on how it is SET, which no DOM assertion can see.
   */
  test("the front page, filtered — the count line restates the filter", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    await useTheme(page, "light");
    await page.goto("/news");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);

    await page.getByRole("button", { name: "FDA", exact: true }).click();
    await expect(page.getByTestId("news-count")).toHaveText("1 catalyst · FDA");

    await expect(page).toHaveScreenshot("news-filtered.png", {
      fullPage: true,
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  });

  test("the front page, empty — an empty state is information, not an apology", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    await useTheme(page, "light");
    await page.goto("/news");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);

    // No FDA story in Technology tonight — a true fact about the night, not a failure of the app.
    await page.getByRole("button", { name: "FDA", exact: true }).click();
    await page.getByRole("button", { name: "Technology", exact: true }).click();
    await expect(page.getByTestId("news-count")).toHaveText("0 catalysts · FDA · Technology");

    await expect(page).toHaveScreenshot("news-zero-state.png", {
      fullPage: true,
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  });

  test("the front page, this week — the window says how deep it goes", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    await useTheme(page, "light");
    await page.goto("/news");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);

    await page.getByRole("radio", { name: "This week" }).click();
    await expect(page.getByTestId("news-count")).toHaveText("14 catalysts");

    await expect(page).toHaveScreenshot("news-week.png", {
      fullPage: true,
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  });

  test("ticker with the Range Ladder — Morning", async ({ page }) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    await useTheme(page, "light");
    await shoot(page, "/ticker/AAPL", "ticker-light");
  });

  test("ticker with the Range Ladder — Midnight", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks layout, not palette");
    await useTheme(page, "dark");
    await shoot(page, "/ticker/AAPL", "ticker-dark");
  });

  /*
   * PD8 VRT — the story page v2 and ticker page v2 (Appendix D). The full story anatomy and the served
   * ticker are shot by the main loop and the ticker tests above, both themes; these shots are the CONTENT
   * variants (a gate-dropped context, a pre-PD7 sparse row, a non-served name) — new pictures, so each gets
   * eyes before its baseline is committed (the law that has bitten this repo four times: an EXACT baseline
   * can still be wrong). 9.8 asks the dropped variant both themes; sparse/thin are light-only extra coverage.
   */
  for (const theme of ["light", "dark"] as const) {
    test(`story — a gate-dropped context and a record block — ${theme === "light" ? "Morning" : "Midnight"}`, async ({
      page,
    }, testInfo) => {
      test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
      test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
      test.skip(theme === "dark" && locksLayoutOnly(testInfo), "layout-only project");
      await useTheme(page, theme);
      await shoot(page, "/news/nc-smci-earnings", `news-story-dropped-${theme}`);
    });
  }

  test("story — a pre-PD7 sparse row renders every absence", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
    await useTheme(page, "light");
    await shoot(page, "/news/nc-uber-expansion", "news-story-sparse");
  });

  test("ticker — a non-served name, the honest subset (no chart, but a record)", async ({ page }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
    await useTheme(page, "light");
    await shoot(page, "/ticker/SMCI", "ticker-thin");
  });

  /*
   * PD9 VRT — the detail sheet, OPEN (Appendix D). The sheet renders the SAME body the standalone pages do
   * (pinned above, both themes), so these six shots lock the CHROME only the overlay has: the scrim, the
   * bottom sheet's grabber and top corners, the ✕, the L4 glass, the centred max-720 desktop overlay. New
   * pictures, so each gets eyes first. Two differences from every other shot: the sheet must be MOUNTED (it
   * exists only after an in-app tap intercepts a route), so each opens it as a reader does; and they shoot
   * the VIEWPORT, not the full page (the sheet is `position: fixed`). reducedMotion is forced, so the fade
   * has settled when the camera fires.
   */
  async function shootOpenSheet(page: Page, name: string) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await waitForFonts(page);
    // Park the pointer at (0,0): off every chart (no crosshair) and a hover not a click, so it does not
    // dismiss the sheet it is about to photograph.
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      mask: [page.locator('[data-vrt="mask"], time')],
    });
  }

  /** Open the SMCI story sheet from the feed — the story launcher used across the overlay suite. */
  async function openStorySheet(page: Page) {
    await page.goto("/news");
    await expect(page.locator(".skeleton-bone")).toHaveCount(0);
    await page
      .getByTestId("news-row")
      .filter({ hasText: "Super Micro" })
      .first()
      .getByRole("link")
      .first()
      .click();
  }

  for (const theme of ["light", "dark"] as const) {
    const label = theme === "light" ? "Morning" : "Midnight";

    test(`detail sheet — a story, on a phone — ${label}`, async ({ page }, testInfo) => {
      test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
      test.skip(testInfo.project.name !== "phone", "the bottom sheet is the phone presentation");
      await useTheme(page, theme);
      await openStorySheet(page);
      await shootOpenSheet(page, `sheet-story-phone-${theme}`);
    });

    test(`detail sheet — a ticker, on a phone — ${label}`, async ({ page }, testInfo) => {
      test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
      test.skip(testInfo.project.name !== "phone", "the bottom sheet is the phone presentation");
      await useTheme(page, theme);
      // A real TickerChip door: the standalone story's affected-names table. The tap intercepts into
      // a ticker sheet over the story page.
      await page.goto("/news/nc-fda-nonopioid");
      await page.locator('a[href^="/ticker/"]').first().click();
      await shootOpenSheet(page, `sheet-ticker-phone-${theme}`);
    });

    test(`detail sheet — a centred overlay, on a desktop — ${label}`, async ({ page }, testInfo) => {
      test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
      test.skip(testInfo.project.name !== "desktop", "the centred overlay is the ≥md presentation");
      await useTheme(page, theme);
      await openStorySheet(page);
      await shootOpenSheet(page, `sheet-overlay-desktop-${theme}`);
    });
  }


  // ── login: the first thing anyone sees ───────────────────────────────────────────────────

  test("login", async ({ page }, testInfo) => {
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");
    // Signed in already, so sign out by clearing cookies to see the wall itself.
    await page.context().clearCookies();
    await shoot(page, "/login", "login");
  });

  /**
   * THE DESK ON A THIN NIGHT — the shot that would have caught the defect before a human did (PD3). Every
   * other Desk baseline photographs the SEEDED morning, a FULL night where the dead hole cannot appear — so
   * the suite has been taking a careful picture of the one night the bug does not happen, and a person found
   * it on his own screen. This is the other night: brief HELD, three movers, no setups — a short Brief beside
   * a tall open Calendar, the exact shape that dug the hole. Law 1 closes it, grid.spec.ts measures the gap,
   * and this pins what it looks like. IT RUNS LAST (the only test that mutates the database it photographs —
   * snapshots, thins, shoots, restores; see thin-night.ts) AND ONLY AT 1512 (one picture is enough, and
   * 1512×982 is the screen it was reported on).
   */
  test("the Desk on a THIN night — a short brief beside a tall calendar, and no hole", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    test.skip(
      testInfo.project.name !== "mbp16",
      "one picture of a thin night is enough, and 1512 is the screen it was reported on",
    );

    const restore = await applyThinNight(request);
    try {
      await useTheme(page, "light");

      // Prove the night is thin before photographing it. A baseline of a FULL night filed under "thin"
      // would be the most expensive wrong: it would pass forever, a picture of the state that never had the bug.
      await page.goto("/");
      await expect(
        page.getByText(/Briefing unavailable tonight/),
        "the brief is not held — this would have baselined a full night under the thin night's name",
      ).toBeVisible();

      await shoot(page, "/", "desk-thin-night");
    } finally {
      await restore();
    }
  });

  /**
   * THE DESK GREETS THE MORNING (CC9, Appendix C). The same seeded database, a different reader's clock:
   * pinned to the Friday morning after the seeded run, the edition-state machine greets the Morning Edition
   * — the morning masthead (dated today), module 02 as the Morning Plan (today's calendar with timing, where
   * things closed, the collapsed brief), and the today-first calendar. The server seeds Evening against the
   * real machine clock, so the CLIENT swaps on mount; this asserts the swap landed BEFORE the camera fires —
   * a baseline of the evening masthead filed under "morning" would be PD3's law all over again (an exact
   * baseline of the wrong state). BRAND-NEW SURFACE: its first baseline gets eyes before it is committed.
   */
  for (const theme of ["light", "dark"] as const) {
    test(`the Desk greets the MORNING — masthead + Morning Plan — ${theme === "light" ? "Morning" : "Midnight"} (CC9)`, async ({
      page,
    }, testInfo) => {
      test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
      // The layout legs (wide, mbp16) shoot light only, like every room — the palette is pinned at 1366/390.
      test.skip(locksLayoutOnly(testInfo) && theme === "dark", "this project locks layout, not palette");

      await useTheme(page, theme);
      // Override the beforeEach's SEEDED_EVENING — the morning is the point of this shot.
      await page.clock.setFixedTime(SEEDED_MORNING);
      await page.goto("/");

      // The masthead swaps to Morning on mount; prove it before shooting (PD3: never photograph the wrong state).
      await expect(
        page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }),
        "the masthead did not swap to Morning — the pinned clock and the seeded dawn have drifted apart",
      ).toContainText(/MORNING EDITION/i);

      await expect(page.locator(".skeleton-bone")).toHaveCount(0);
      await waitForFonts(page);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`desk-morning-${theme}.png`, {
        fullPage: true,
        mask: [page.locator('[data-vrt="mask"], time')],
      });
    });
  }

});

/**
 * The fallback-metrics lock (§7.4). Every other shot waits for the fonts, so every other shot is blind to
 * the pre-swap frame — and Playfair loads with `display: swap`, so that frame is real on a slow connection.
 * This one blocks the fonts and looks. It lives in its OWN describe block with no sign-in, and that is the
 * test working at all: signing in first loads the fonts into cache, the later navigation makes no request,
 * the interception never fires, and the "fonts-blocked" shot is quietly an ordinary one. The assertion below
 * caught exactly that — a guard that cannot fail proves nothing.
 */
test.describe("visual regression — the pre-swap fallback", () => {
  test("login with the fonts blocked — the fallback layout still holds", async ({ page, context }, testInfo) => {
    // The layout-only projects lock ROOM GRIDS (Appendix F). This shot is not a room grid — it is
    // already pinned at 1366, and a copy of it at another width answers nothing new.
    test.skip(locksLayoutOnly(testInfo), "this project locks room layouts only");

    let blocked = 0;
    await context.route("**/*.woff2", (route) => {
      blocked += 1;
      return route.abort();
    });

    await page.goto("/login");

    expect(
      blocked,
      "no woff2 request was intercepted — the fallback layout was never actually exercised",
    ).toBeGreaterThan(0);

    const masks = page.locator('[data-vrt="mask"], time');
    await expect(page).toHaveScreenshot("login-fonts-blocked.png", { fullPage: true, mask: [masks] });
  });
});
