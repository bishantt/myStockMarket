import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { VRT_ROOMS } from "../lib/routes";
import { THEME_COOKIE } from "../lib/theme";
import { VRT_RESET_SECRET } from "../playwright.config";
import { SEEDED_EVENING } from "./seeded-clock";
import { applyThinNight } from "./thin-night";

/**
 * vrt.spec.ts — visual regression. The styling counterpart of TDD (UI-REDESIGN-PLAN Part 9).
 *
 * Unit tests prove the numbers are right. Nothing, until now, proved the *look* stayed right — and
 * a design system this large, restyled across five phases, would drift within a week without pixel
 * locks. So every surface gets a baseline, and an unexplained diff is a build failure.
 *
 * The discipline that makes this work (§9.3): an intentional restyle updates its baselines in the
 * same commit, with a one-line note in the commit body — "VRT: N baselines updated — <reason>". An
 * UNEXPLAINED diff is never waved through. The moment baselines get updated reflexively to make CI
 * green, the suite stops being an oracle and becomes a chore.
 *
 * Determinism, in the order the flakiness would otherwise bite:
 *   · reduced motion, forced — kills route fades and entrance transitions
 *   · fonts awaited INSIDE the page — `document.fonts.ready` returns a FontFaceSet, which
 *     serialises to junk if you return it from evaluate(); the await has to happen in the page
 *   · timestamps masked — they encode wall-clock time and would differ on every run
 *   · seeded data — the numbers are fixed by prisma/seed.mjs
 *
 * The pixel oracle is CI (Linux). Local macOS runs render fonts differently; use
 * `npx playwright test --ignore-snapshots` locally, or regenerate a local set knowingly.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/**
 * THE LAYOUT-ONLY PROJECTS — `wide` (1536) and `mbp16` (1512), the two viewports that exist to lock
 * a GRID rather than a palette.
 *
 * Both shoot rooms, in the light theme, and nothing else. The colours are already pinned at 1366 and
 * 390 in BOTH themes, so a third and fourth set of dark baselines up here would be pure cost — twice
 * the pictures to regenerate on every restyle, to answer a question that is already answered. And
 * neither of them re-shoots the styleguide, the login wall, or the table's interactive states: those
 * are pinned at 1366 and a copy of them at another width is a second picture of the same answer.
 *
 * This used to be eleven copies of `testInfo.project.name === "wide"` scattered down the file. Adding
 * `mbp16` would have meant finding all eleven and getting all eleven right — and the one that got
 * missed would not have failed. It would have quietly taken a screenshot nobody asked for.
 */
const LAYOUT_ONLY = new Set(["wide", "mbp16"]);
const locksLayoutOnly = (testInfo: { project: { name: string } }) =>
  LAYOUT_ONLY.has(testInfo.project.name);

test.use({ contextOptions: { reducedMotion: "reduce" } });

/** Sign in. Every surface in this app is behind the login wall, including the styleguide. */
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Wait until the page's real fonts are on screen — not merely until the browser says it is idle.
 *
 * `await document.fonts.ready` is NOT sufficient on its own, and this cost us a baseline. That
 * promise settles against the font loads that are PENDING at the moment it is awaited, so if it runs
 * before the browser has begun fetching the faces, it resolves immediately against an empty set. The
 * screenshot then catches the page mid-swap, in its fallback sans, and the resulting baseline is a
 * picture of a bug. (Caught at F0: a regenerated track-record baseline came back with its body prose
 * in a fallback font — visibly re-wrapped from two lines to three — while its own dark-theme twin,
 * shot in the same run, was correct. Committing it would have made the pixel oracle lie.)
 *
 * So we force the issue: ask for each family the page actually uses, wait for those loads to finish,
 * and only then wait for the set to settle. `document.fonts.load()` resolves when the face is
 * genuinely usable, which is the thing we actually care about.
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
 * Take one baseline shot.
 *
 * Timestamps and as-of stamps are masked: they are honest, load-bearing content — this product puts
 * a stamp on everything — but they encode wall-clock time, so they would differ on every run and
 * make every baseline a false positive. Masking the clock is what lets the pixels mean something.
 */
async function shoot(page: Page, path: string, name: string, options: { allowSkeletons?: boolean } = {}) {
  await page.goto(path);

  /*
   * NEVER PHOTOGRAPH A LOADING STATE.
   *
   * This is not hypothetical: it happened. The scan-table baselines failed on the tag run with
   * "expected an image 1366px by 1876px, received 1366px by 768px" — a page exactly one viewport
   * tall, because the shot had caught the room's `loading.tsx` skeleton instead of the room. It only
   * bit the newest route, and it would have bitten a different one each time the suite got slower.
   *
   * Skeletons exist everywhere now (F1), so every room can render one, and a screenshot that races a
   * page is a baseline that photographs a bug. Waiting for the bones to be GONE is the honest signal
   * that the content has actually arrived.
   *
   * The styleguide is the exception, and the only one: section 9 renders the skeleton specimens
   * deliberately, because that is where they are pixel-locked. It passes allowSkeletons.
   */
  if (!options.allowSkeletons) {
    await expect(page.locator(".skeleton-bone"), `${name}: the page was still loading when it was photographed`).toHaveCount(0);
  }

  await waitForFonts(page);
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
 * A pixel baseline must photograph a KNOWN state — never whatever the previous test left behind.
 *
 * THE BUG THIS FIXES. `academy.spec.ts` opens the lesson "Reading a base-rate sentence", and opening
 * a lesson marks it read — a row in `lesson_progress`, which is user state the Academy page renders
 * as a checkmark. Specs run alphabetically on CI's single worker, so `academy` runs before `vrt`,
 * and the Academy VRT shot was photographing that checkmark.
 *
 * The baselines, meanwhile, are generated by a job that runs ONLY `vrt.spec.ts` — a world where that
 * lesson was never opened, and the checkmark is not there. So the baselines were born in a different
 * world than the one they are verified in, and the Academy shot could never legitimately match. It
 * "passed" for months purely because ~1,960 pixels of checkmark fitted inside the old 1%-of-pixels
 * tolerance; tightening that tolerance is what finally surfaced it.
 *
 * The fix is not to make the baseline job run more tests — that would make every baseline depend on
 * the side effects and ordering of the whole suite. It is to make the VRT suite establish the state
 * it intends to photograph. It clears the progress rows first, so the Academy renders its seeded
 * state whether or not anything else has touched it, and the two worlds are the same world.
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

  // DELETING THE ROW IS NOT ENOUGH, and this is the part that took a second attempt to see.
  //
  // /academy is an ISR route. When the earlier spec opened the lesson, the server action that marked
  // it read ALSO revalidated /academy — so the cache now holds a rendering of the page WITH the
  // checkmark. Emptying the table changes what the next render would produce; it does not touch the
  // render that is already cached. The page kept its checkmark and the shot kept failing.
  //
  // So the reset finishes the job: clear the state, then bust the cache that is still showing it.
  await request.post(`/api/revalidate?secret=${VRT_RESET_SECRET}`);
}

/*
 * THE CLOCK IS PINNED, AND THE FIRST BASELINE RUN IS WHY — see e2e/seeded-clock.ts, which now owns
 * SEEDED_EVENING and is the only file in the browser suite allowed to write a date (drift rule 21).
 *
 * The short version: the pipeline strip grades freshness in the BROWSER, against the reader's clock,
 * so the Desk renders something that depends on WHEN IT IS. Pinning the clock to the seeded session's
 * evening keeps the strip permanently FRESH. The desk shots assert that state before photographing
 * it, so if the seed's date ever moves, this fails loudly instead of quietly photographing the wrong
 * rung of the ladder.
 */

test.describe("visual regression — the design system", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMutableStateThePixelsWouldOtherwiseCatch(request);
    // Before anything navigates: the strip reads this on mount.
    await page.clock.setFixedTime(SEEDED_EVENING);
    await signIn(page);
  });

  // ── the styleguide: the anchor ───────────────────────────────────────────────────────────
  //
  // Every token and primitive renders here, so this one page is the highest-value baseline in the
  // suite: a token that silently changes value shows up here before it shows up anywhere else.

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
  //
  // Seeded data only (MSM_SEEDED), so the numbers are fixed by prisma/seed.mjs and a diff means a
  // STYLE change rather than a data change. Without the seed these shots would fail every night for
  // the most boring possible reason.

  /*
   * The rooms with a generated baseline, read from lib/routes-manifest.json — the ONE list of rooms
   * (G3). Every manifest entry that carries a `vrtRoom` slug is shot here, light and dark, at every
   * viewport the project matrix asks for. The list used to be hand-kept in this file, which is how a
   * room could ship with no pixel lock and nobody notice; lib/routes-manifest.test.ts now reds the
   * unit suite if a `page.tsx` exists with no manifest entry behind it.
   *
   * WHAT STAYED IN THIS FILE, deliberately: the per-shot quirks below (which project skips which
   * theme, the Desk's freshness assertion) and the arguments for why particular rooms are worth
   * locking at all. Those are the oracle's business, not the manifest's:
   *
   *   · /news and /news/nc-fed-hold — worth locking above almost anything else, because the room is
   *     carried today by GENERATED imagery: the media bucket does not exist (P-1), so every card
   *     renders its designed catalyst card rather than a photograph. The claim those rungs make is
   *     "this reads as an editorial choice, not as a failure", and that claim is only ever true or
   *     false in a picture. No test can hold it. The oracle can.
   *
   *   · /scans/unusual-volume — the match table (F3), the page that replaced the dead "+ N more".
   *     The recipe card, the named default order, the lottery chip and the pagination footer all
   *     live here.
   *
   *   · /settings — THE CONTROL ROOM (N6), worth locking for one reason above all the others: on
   *     this page, the most important thing the product says is a SENTENCE, not a control. Plan 8.1
   *     found that on a normal weeknight the pipeline has already run and a manual re-run would
   *     recompute identical data — so the honest control for that case is the EXPLANATION. The
   *     pinned VRT clock (SEEDED_EVENING, 11pm on the seeded session) lands `full` in exactly that
   *     state, so the baseline photographs the flagship C5 line:
   *
   *         "Tonight's run already succeeded at 18:41 ET — there is nothing newer to fetch."
   *
   *     A row whose whole job is to be READ is a row whose failure mode is typographic, and no DOM
   *     assertion can see that. This is the oracle's question, not a test's. (/settings had NO
   *     baseline at all before N6 — the one room in the app that is a writer, and the pixel oracle
   *     had never looked at it.)
   *
   * The ticker room is NOT here, and the manifest says why: its shots are written by hand further
   * down, against /ticker/AAPL, because the Range Ladder only renders with seeded vol bands behind
   * it — while the sweeps and the nav budget open /ticker/SPY, which needs no seed.
   */
  const SEEDED_ROOMS = VRT_ROOMS;

  for (const room of SEEDED_ROOMS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${room.name} — ${theme === "light" ? "Morning" : "Midnight"}`, async ({ page }, testInfo) => {
        test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
        /*
         * The layout-only projects lock the GRID, not the palette (Appendix F: "every room at 1536,
         * light only"). The colours are already pinned at 1366 and 390 in both themes; another set
         * of dark baselines up here would be pure cost — more pictures to regenerate on every
         * restyle, for no question that is not already answered.
         *
         * What 1536 answers, and nothing else can, is whether the wide column maps hold.
         */
        test.skip(locksLayoutOnly(testInfo) && theme === "dark", "this project locks layout, not palette");

        /*
         * THE 16-INCH LOCK IS SELECTIVE, AND THE MANIFEST DECIDES — not this file (PD3, §6.3).
         *
         * 1512 sits INSIDE the `desk:` band (1366–1535) and the container caps at 1360px, so a room
         * whose composition is decided by the BREAKPOINT renders the same content box at 1512 as at
         * 1366 — the same layout, with more margin. Shooting every room here would buy a pile of
         * baselines that re-answer an answered question and have to be regenerated forever.
         *
         * The rooms worth 1512 are the ones where CONTENT HEIGHT decides the layout: that is where
         * Law 1 lives, that is where the dead gap opened, and a wide empty screen is where it is
         * worst. The manifest's `mbp16` flag names them and defends each choice in its note. This
         * loop just obeys it — there is ONE list of rooms, and a second one hiding in a spec file is
         * how /news went two tagged phases without a single sweep looking at it.
         */
        test.skip(
          testInfo.project.name === "mbp16" && !room.mbp16,
          "not a 16-inch lock — see the mbp16 field in lib/routes-manifest.json",
        );

        await useTheme(page, theme);

        /*
         * The Desk carries the pipeline strip, and the strip is the one thing on this page whose
         * appearance depends on WHEN IT IS. The clock is pinned to the seeded session's evening (see
         * SEEDED_EVENING), which puts the strip in its FRESH state.
         *
         * This asserts that before shooting. If the seed's trading day ever moves and the pin is not
         * moved with it, the strip escalates to amber or to the red banner and the baseline becomes
         * a photograph of a state nobody chose — which is precisely how a pixel oracle stops being
         * one. Better to fail here, saying what happened, than to hand back a picture of a bug.
         */
        if (room.path === "/") {
          await page.goto("/");
          await expect(
            page.getByRole("status").filter({ hasText: "Data through" }),
            "the strip is not FRESH — the pinned clock and the seed's session have drifted apart",
          ).toBeVisible();
        }

        await shoot(page, room.path, `${room.name}-${theme}`);
      });
    }
  }

  /**
   * The table's INTERACTIVE states. A sorted table and a second page are different pictures, and the
   * baselines that matter most are the ones nobody would think to look at by hand.
   *
   * Deterministic by construction: the seeded values are fixed, page 1 is always page 1, and the
   * sort is instant (a FLIP-animated sort would be a screenful of money figures in motion, which is
   * banned — so there is no animation to wait out).
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
   * The Front Page's INTERACTIVE states (Appendix F): filtered, empty, and the week window.
   *
   * The zero-state shot is the one that earns its keep. "No FDA catalysts today — that is
   * information, not an error" is a sentence the whole product's posture rests on, and whether it
   * lands as information or as an apology is decided entirely by how it is SET — its size, its
   * weight, how much air is around it. That is not something a DOM assertion can see.
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
   * THE DESK ON A THIN NIGHT — the shot that would have caught the defect before a human did (PD3).
   *
   * Every other Desk baseline in this suite photographs the SEEDED morning, and the seeded morning
   * is a FULL night: every module fat with data, every row track comfortably filled. The dead hole
   * under the Brief cannot appear on a night like that. So for as long as this suite has existed, it
   * has been taking a beautiful, careful, high-resolution picture of the one night the bug does not
   * happen — and the bug was found by a person looking at his own screen.
   *
   * This is the other night. The briefing is HELD, three movers instead of eight, no setup cards: a
   * short Brief beside a tall open Calendar, which is the exact shape that used to dig the hole. Law
   * 1 is what closes it, e2e/grid.spec.ts measures the gap mechanically, and this pins what it looks
   * like — because "does this page have a dead acre in the middle of it" is, in the end, a question
   * you answer by looking.
   *
   * IT RUNS LAST, AND ONLY AT 1512. Last, because it is the only test in the suite that changes the
   * database it photographs (it snapshots, thins, shoots, and puts the night back — see
   * e2e/thin-night.ts for the whole safety argument). Only at 1512, because one picture of a thin
   * night is enough, and 1512×982 is the screen the user was looking at when he reported it.
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

      // Prove the night is thin before photographing it. A baseline of a FULL night, filed under the
      // name "thin", would be the most expensive kind of wrong: it would pass forever, and it would
      // be a picture of the state that never had the bug.
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

});

/**
 * The fallback-metrics lock (§7.4).
 *
 * Every other shot waits for the fonts, which means every other shot is blind to what the page looks
 * like BEFORE they land — and Playfair loads with `display: swap`, so that pre-swap frame is real,
 * and a slow connection shows it. If the fallback's metrics overflowed the login panel at 375px, no
 * font-loaded screenshot would ever reveal it. This one blocks the fonts and looks.
 *
 * It lives in its OWN describe block, with no sign-in, and that is not tidiness — it is the test
 * working at all. Signing in first navigates the page, which loads the fonts, which puts them in the
 * browser's memory cache; the later navigation then never makes a network request, the route
 * interception never fires, and the "fonts-blocked" screenshot is quietly an ordinary one. The
 * assertion below caught exactly that, which is why it is there: a guard that cannot fail proves
 * nothing, and this one had been proving nothing.
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
