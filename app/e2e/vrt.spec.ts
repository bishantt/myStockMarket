import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { THEME_COOKIE } from "../lib/theme";
import { VRT_RESET_SECRET } from "../playwright.config";

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

test.describe("visual regression — the design system", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMutableStateThePixelsWouldOtherwiseCatch(request);
    await signIn(page);
  });

  // ── the styleguide: the anchor ───────────────────────────────────────────────────────────
  //
  // Every token and primitive renders here, so this one page is the highest-value baseline in the
  // suite: a token that silently changes value shows up here before it shows up anywhere else.

  test("styleguide — Morning", async ({ page }) => {
    await useTheme(page, "light");
    await shoot(page, "/styleguide", "styleguide-light", { allowSkeletons: true });
  });

  test("styleguide — Midnight", async ({ page }) => {
    await useTheme(page, "dark");
    await shoot(page, "/styleguide", "styleguide-dark", { allowSkeletons: true });
  });

  // ── the rooms ────────────────────────────────────────────────────────────────────────────
  //
  // Seeded data only (MSM_SEEDED), so the numbers are fixed by prisma/seed.mjs and a diff means a
  // STYLE change rather than a data change. Without the seed these shots would fail every night for
  // the most boring possible reason.

  const SEEDED_ROOMS = [
    { path: "/", name: "desk" },
    { path: "/scans", name: "scans" },
    // The match table (F3). This is the page that replaced the dead "+ N more", so its pixels are
    // worth locking: the recipe card, the named default order, the lottery chip, and the pagination
    // footer all live here.
    { path: "/scans/unusual-volume", name: "scans-preset" },
    { path: "/paper", name: "paper" },
    { path: "/track-record", name: "track-record" },
    { path: "/academy", name: "academy" },
    { path: "/academy/glossary", name: "academy-glossary" },
    { path: "/academy/review", name: "academy-review" },
  ];

  for (const room of SEEDED_ROOMS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${room.name} — ${theme === "light" ? "Morning" : "Midnight"}`, async ({ page }) => {
        test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
        await useTheme(page, theme);
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
  test("scans table sorted by RVOL — the header state", async ({ page, isMobile }) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
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

  test("scans table page 2 — the pagination footer", async ({ page, isMobile }) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
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

  test("ticker with the Range Ladder — Morning", async ({ page }) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    await useTheme(page, "light");
    await shoot(page, "/ticker/AAPL", "ticker-light");
  });

  test("ticker with the Range Ladder — Midnight", async ({ page }) => {
    test.skip(!process.env.MSM_SEEDED, "needs the seeded database");
    await useTheme(page, "dark");
    await shoot(page, "/ticker/AAPL", "ticker-dark");
  });


  // ── login: the first thing anyone sees ───────────────────────────────────────────────────

  test("login", async ({ page }) => {
    // Signed in already, so sign out by clearing cookies to see the wall itself.
    await page.context().clearCookies();
    await shoot(page, "/login", "login");
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
  test("login with the fonts blocked — the fallback layout still holds", async ({ page, context }) => {
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
