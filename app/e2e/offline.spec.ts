import { expect, test, type Page } from "@playwright/test";

/**
 * Offline behaviour (plan §5.5.2, §5.2). These prove the two things that make offline SAFE and
 * HONEST: a Desk visited while connected renders from the service-worker cache when reloaded
 * offline, with the OfflineRibbon naming its vintage; and the expired-cookie guard means a stale
 * cookie can never replace the cached briefing with a login page.
 *
 * Chromium only — the one engine whose SW + offline emulation Playwright supports (noted in the
 * config). These run against the production build the config starts, because the worker only
 * exists in a real build.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/** Sign in and land on the Desk. */
async function signIn(page: Page) {
  await page.goto("/login");
  // Let the worker register and activate before we depend on it caching navigations.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/** Wait until the page is actually controlled by the worker (Serwist clientsClaim). */
async function waitForControl(page: Page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

test.describe("offline", () => {
  test("a Desk seen online reloads from cache offline, with the offline ribbon", async ({ page, context }) => {
    await signIn(page);
    await waitForControl(page);

    // Visit the Desk once more under worker control so the navigation is cached.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /01 — Macro pulse/i })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // Served from cache: the Desk shell renders, and the ribbon names the synced vintage.
    await expect(page.getByRole("heading", { name: /01 — Macro pulse/i })).toBeVisible();
    await expect(page.getByText(/Offline — showing the last synced briefing/)).toBeVisible();

    await context.setOffline(false);
  });

  test("expired-cookie drill: offline still shows the Desk, never a cached login page", async ({ page, context }) => {
    await signIn(page);
    await waitForControl(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /01 — Macro pulse/i })).toBeVisible();

    // The cookie expires. Online, the app correctly bounces to /login — and the guard refuses to
    // cache that redirect over the good Desk.
    await context.clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // Re-authenticate, then go offline and ask for the Desk.
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await context.setOffline(true);
    await page.reload();

    // The Desk renders from cache — NOT a cached login page.
    await expect(page.getByRole("heading", { name: /01 — Macro pulse/i })).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveCount(0);

    await context.setOffline(false);
  });
});
