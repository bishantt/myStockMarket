import { expect, test } from "@playwright/test";

/**
 * The identity kit, asserted where it actually has to work (PD2, plan 5.4 and 5.7).
 *
 * THE TRAP THIS EXISTS TO CATCH. Every brand asset is fetched by a browser or an operating system
 * BEFORE anyone has signed in — the tab icon, the install prompt's icons, the home-screen icon, and
 * the link-preview card that Slack fetches with no cookie at all. proxy.ts lets them through the
 * login wall by an explicit allowlist. Rename one path, or move one file out of `public/icons/`,
 * and the wall answers a 307 to /login instead: the tab goes blank, the install prompt fails, and
 * the unfurl shows nothing. Nothing throws. No unit test notices. The app looks completely fine to
 * anyone who is already logged in — which is everyone who would ever look.
 *
 * That is not hypothetical. `/favicon.ico` was allowlisted in proxy.ts from the very first phase,
 * and the file it named did not exist until PD2 — the old generator wrote `favicon.png`, nothing
 * ever linked it, and the app shipped with a blank tab for the entire build. A test that fetched
 * the path would have said so on day one.
 */

/**
 * Every path from the artifact table (plan 5.2), with the content type it must answer.
 * If a row is added to the generator, it is added here — that is the whole contract.
 */
const BRAND_PATHS: ReadonlyArray<{ path: string; type: RegExp; why: string }> = [
  // An ICO has two blessed content types and the answer depends on WHO is serving it: `next start`
  // says image/x-icon, the Vercel CDN in front of production says image/vnd.microsoft.icon. Both are
  // correct and every browser accepts either. Pinning the one CI happens to see would be pinning the
  // server, not the contract — and it would red the day anyone pointed this suite at production.
  { path: "/favicon.ico", type: /image\/(x-icon|vnd\.microsoft\.icon)/, why: "the browser tab" },
  { path: "/apple-touch-icon.png", type: /image\/png/, why: "the iOS home screen" },
  { path: "/icons/icon-192.png", type: /image\/png/, why: "manifest — any" },
  { path: "/icons/icon-512.png", type: /image\/png/, why: "manifest — any / splash" },
  { path: "/icons/icon-maskable-192.png", type: /image\/png/, why: "manifest — maskable" },
  { path: "/icons/icon-maskable-512.png", type: /image\/png/, why: "manifest — maskable" },
  { path: "/icons/icon-monochrome-96.png", type: /image\/png/, why: "manifest — monochrome" },
  { path: "/icons/brandmark-64.webp", type: /image\/webp/, why: "the top bar's mark" },
  { path: "/icons/brandmark-192.webp", type: /image\/webp/, why: "the login panel's mark" },
  { path: "/icons/og-card.png", type: /image\/png/, why: "the link preview" },
];

test.describe("the brand assets are reachable without a session", () => {
  for (const { path, type, why } of BRAND_PATHS) {
    test(`${path} answers 200 ${type.source} — ${why}`, async ({ request }) => {
      // maxRedirects: 0 is the assertion. Following a redirect would turn the login wall's 307
      // into a cheerful 200 for the login PAGE, and the test would pass while the icon was gone.
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), `${path} must not be behind the login wall`).toBe(200);
      expect(response.headers()["content-type"]).toMatch(type);
      // A zero-byte file would satisfy everything above it and show nothing at all.
      expect((await response.body()).byteLength).toBeGreaterThan(200);
    });
  }
});

test.describe("the mark on the page", () => {
  /**
   * The brand panel is `hidden lg:flex` — a 375px screen has room for a headline and a form, and
   * that is all it needs — so the mark it carries is a DESKTOP lockup and the phone login has none.
   * The test asserts that contract in both directions rather than asserting the easy half of it: an
   * assertion that only ran where the mark exists would go green on the day the panel stopped
   * rendering it anywhere at all.
   */
  test("the login panel shows the mark above lg, and correctly does not below it", async ({
    page,
  }) => {
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;

    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/login");

      const mark = page.locator('img[src="/icons/brandmark-192.webp"]');

      if (!wide) {
        // The panel collapses, and the mark goes with it. This is the design, not a regression.
        await expect(mark).toBeHidden();
        continue;
      }

      // The panel's mark is the 96px lockup. /login is `force-static` and the asset is served from
      // public/, so if it resolves here it resolves for a logged-out reader on a cold cache — which
      // is the only reader who ever sees this page.
      await expect(mark).toBeVisible();

      // It must arrive with its box already reserved, or it shifts the headline under the reader.
      await expect(mark).toHaveAttribute("width", "96");
      await expect(mark).toHaveAttribute("height", "96");

      // And it must actually have decoded — a broken image is still "visible" to the DOM.
      const decoded = await mark.evaluate((img) => (img as HTMLImageElement).naturalWidth > 0);
      expect(decoded, "the mark rendered as a broken image").toBe(true);
    }
  });

  test("the head links the favicon and the apple-touch icon", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  /**
   * The link preview. An unfurler will not follow a relative image URL — it refuses it — so
   * `metadataBase` has to resolve the OG image to an absolute origin at build time. Getting this
   * wrong produces a card that is blank everywhere except in this app's own tests.
   */
  test("the OG card is advertised with an absolute URL", async ({ page }) => {
    await page.goto("/login");
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveCount(1);
    const url = await image.getAttribute("content");
    expect(url).toMatch(/^https?:\/\/.+\/icons\/og-card\.png$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
});
