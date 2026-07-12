import { expect, test, type Page } from "@playwright/test";
import { THEME_COOKIE } from "../lib/theme";

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
 * Take one baseline shot.
 *
 * Timestamps and as-of stamps are masked: they are honest, load-bearing content — this product puts
 * a stamp on everything — but they encode wall-clock time, so they would differ on every run and
 * make every baseline a false positive. Masking the clock is what lets the pixels mean something.
 */
async function shoot(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const masks = page.locator('[data-vrt="mask"], time');
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [masks] });
}

/** Set the theme cookie before navigating — the same mechanism the theme spec uses. */
async function useTheme(page: Page, theme: "light" | "dark") {
  await page.context().addCookies([
    { name: THEME_COOKIE, value: theme, url: "http://127.0.0.1:3210" },
  ]);
}

test.describe("visual regression — the design system", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // ── the styleguide: the anchor ───────────────────────────────────────────────────────────
  //
  // Every token and primitive renders here, so this one page is the highest-value baseline in the
  // suite: a token that silently changes value shows up here before it shows up anywhere else.

  test("styleguide — Morning", async ({ page }) => {
    await useTheme(page, "light");
    await shoot(page, "/styleguide", "styleguide-light");
  });

  /**
   * The Midnight shots arrive in R2, not here.
   *
   * Dark is not app-wide yet: `data-theme` still sits on the Desk shell, so a dark cookie changes
   * nothing on this route, and a "Midnight" baseline captured today would be a light screenshot
   * wearing a dark filename. A baseline that lies is worse than a baseline that is missing — the
   * missing one fails loudly; the lying one passes forever. R2 moves the attribute to <html> and
   * the Midnight rows of the shot list open then.
   */


  // ── login: the first thing anyone sees ───────────────────────────────────────────────────

  test("login", async ({ page }) => {
    // Signed in already, so sign out by clearing cookies to see the wall itself.
    await page.context().clearCookies();
    await shoot(page, "/login", "login");
  });

  /**
   * The fallback-metrics lock (§7.4).
   *
   * Every other shot waits for the fonts, which means every other shot is blind to what the page
   * looks like BEFORE they land — and Playfair loads with `display: swap`, so that pre-swap frame
   * is real and a slow connection shows it. If the fallback's metrics overflow the login panel at
   * 375px, no font-loaded screenshot would ever reveal it. This one blocks the fonts and looks.
   */
  test("login with the fonts blocked — the pre-swap layout still holds", async ({ page, context }) => {
    await context.route("**/*.woff2", (route) => route.abort());
    await page.context().clearCookies();
    await page.goto("/login");
    const masks = page.locator('[data-vrt="mask"], time');
    await expect(page).toHaveScreenshot("login-fonts-blocked.png", { fullPage: true, mask: [masks] });
  });
});
