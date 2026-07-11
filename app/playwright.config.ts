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
    },
  },
});
