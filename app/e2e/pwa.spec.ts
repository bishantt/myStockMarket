import { expect, test } from "@playwright/test";

/**
 * PWA installability — the §5.5.1 assertions, which are a named P0 exit criterion.
 *
 * Lighthouse dropped its PWA category in v12, so installability and service-worker behaviour are
 * asserted directly here rather than scored (plan §5.5). These run against the production build
 * that playwright.config.ts starts, because the service worker only exists in a real build.
 *
 * The deeper offline behaviour (reload-while-offline renders the last briefing, the
 * expired-cookie drill) is a P1 concern and lands with the morning payload it depends on. P0
 * proves the app is installable and the worker activates.
 */

test.describe("installability", () => {
  test("the manifest is served and has the members an install prompt needs", async ({
    request,
  }) => {
    // The manifest is public — the browser fetches it before any session exists.
    const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe("myStockMarket");
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    // At least the 192 and 512 icons, and a maskable one, must be present.
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose);
    expect(purposes).toContain("maskable");
  });

  test("every icon resolves without the auth cookie, so the app stays installable pre-login", async ({
    request,
  }) => {
    // If an icon 302'd to /login, the OS install prompt would fail. The proxy must let them
    // through unauthenticated (plan §4.4, §5.5.1).
    for (const path of [
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      "/icons/icon-monochrome-96.png",
      "/apple-touch-icon.png",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), `${path} should resolve without a cookie`).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });

  test("the precache manifest carries the two force-static routes", async ({ request }) => {
    // /sw.js is public so the browser can register it pre-auth. /offline and /login must be in
    // its precache so they are available offline (plan §5.2, §5.5.1).
    const sw = await (await request.get("/sw.js", { maxRedirects: 0 })).text();
    expect(sw).toContain("/offline");
    expect(sw).toContain("/login");
  });
});

test.describe("service worker", () => {
  test("registers and reaches 'activated' on the public login page, before any auth", async ({
    page,
  }) => {
    await page.goto("/login");

    // Serwist auto-registers on load. `serviceWorker.ready` resolves as soon as there is an
    // active worker, which can be a hair before its state flips from "activating" to
    // "activated" — so we wait for the terminal state rather than sampling once.
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) return "none";
      if (worker.state === "activated") return "activated";
      return await new Promise<string>((resolve) => {
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") resolve("activated");
        });
      });
    });
    expect(state).toBe("activated");
  });

  test("controls the Desk once the user is logged in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    // A reload lets the already-activated worker take control of the page. Claiming the client
    // is asynchronous, and on a slow CI runner it can lag a beat behind the reload — so we WAIT
    // for the controller rather than sampling it once (the earlier one-shot check flaked in CI).
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 10_000,
    });
    const controlled = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(controlled).toBe(true);
  });
});
