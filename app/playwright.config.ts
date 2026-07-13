import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — the browser-level suite (plan §6.1).
 *
 * It runs against a real production build (`next build && next start`), not the dev server,
 * because three of the things it has to assert only exist in a production build: the service
 * worker, the precache manifest, and the static /login and /offline documents.
 *
 * Chromium only, deliberately. It is the one engine whose service-worker and offline emulation
 * Playwright supports, and the PWA assertions in §5.5.2 depend on `context.setOffline()`. The
 * iOS and Android checks are a manual device matrix, logged in PROGRESS.md once per phase.
 *
 * The auth credentials below are fixtures for the test run only. The real ones live in Vercel.
 */

const PORT = 3210;

/**
 * The secret the VRT suite uses to bust the ISR cache before it photographs a page.
 *
 * It is a test-only value handed to a test-only server (see webServer.env below); the real
 * CRON_SECRET lives in GitHub and Vercel and never appears here.
 */
export const VRT_RESET_SECRET = "vrt-reset-secret-not-a-real-one";
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** bcrypt(cost 12) of "correct horse battery staple" — the same fixture the unit tests use. */
const TEST_PASS_HASH =
  "$2b$12$7Tg8XWUVRBhEzHK6ZGKhke0LLIIxCLB5Pp8aX8r4NeifFRklIzZvW";

export default defineConfig({
  testDir: "./e2e",
  // The web server below authenticates with the fixture credentials in `env`. Those survive
  // because the developer's real login lives in app/.env.development.local (loaded by `next dev`,
  // never by the `next start` this server runs), so root .env carries no AUTH_PASS_HASH to make
  // dotenv-expand mangle the fixture hash. CI has neither file, so the fixtures win there too.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One worker in CI. The seeded-database journeys (watchlist writes) mutate shared state, so
  // running specs concurrently would let a write in one spec change what another spec reads. Serial
  // execution keeps each journey seeing the seed it expects; the suite is small, so the cost is low.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  /**
   * Visual regression (UI-REDESIGN-PLAN Part 9). Styling at this scale without pixel locks drifts
   * within a week, so the redesign is exactly when the VRT becomes real.
   *
   * THE TOLERANCE IS AN ABSOLUTE PIXEL COUNT, NOT A RATIO, AND THAT IS A BUG FIX (2026-07-12, N1).
   *
   * It used to be `maxDiffPixelRatio: 0.01` — "1% of pixels may differ", which sounds strict and is
   * not. These are FULL-PAGE screenshots of long pages: the desktop Desk is 1366×2763, which is 3.77
   * MILLION pixels, so one percent of it is a budget of **37,742 pixels**. That is enough to hide a
   * great deal.
   *
   * It did. N1 rewrote the macro row — reordered it, relabelled "Russell 2000 · IWM (ETF proxy)" to
   * "Small caps", deleted a chip, and replaced the provenance sentence — and the desktop baseline
   * PASSED unchanged, because all that text came to fewer than 37,742 differing pixels on a page
   * that tall. The phone shot (412×4366 = 1.8M pixels, so a 17,988-pixel budget) caught the very
   * same change. One viewport reported the truth and the other quietly did not, and the baseline
   * that stayed behind was a picture of a bug.
   *
   * A ratio makes the gate WEAKER the longer the page gets, which is exactly backwards: a longer
   * page has more to hide. An absolute count does not care how tall the page is. 600 pixels is
   * roughly a few dozen antialiased glyph edges — enough to absorb rasterisation noise between
   * otherwise identical runs, nowhere near enough to hide a word.
   *
   * Animations are disabled and the caret is hidden, because a blinking cursor is a flaky test with
   * extra steps.
   *
   * The pixel oracle is CI (Linux). Font rasterisation differs from macOS, so a baseline generated
   * on a developer's Mac would fail in CI and vice versa; maintaining two sets for one developer is
   * pure cost. Local runs pass `--ignore-snapshots` (see `npm run e2e:local`).
   */
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 600,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: "npm run build && npm run start -- --port " + PORT,
    url: BASE_URL + "/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AUTH_USER: "testuser",
      AUTH_PASS_HASH: TEST_PASS_HASH,
      AUTH_COOKIE_SECRET: "a".repeat(64),
      NODE_ENV: "production",
      // The VRT suite needs this to bust the ISR cache after it resets the state it is about to
      // photograph. Deleting the rows is not enough on a cached route: the Academy page had already
      // been re-rendered (and cached) WITH a lesson marked read by an earlier spec, so the stale
      // HTML kept the checkmark no matter what the database said. See e2e/vrt.spec.ts.
      CRON_SECRET: VRT_RESET_SECRET,
    },
  },
});
