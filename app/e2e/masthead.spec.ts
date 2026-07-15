import { expect, test } from "@playwright/test";

import { signIn } from "./session";
import { SEEDED_EVENING } from "./seeded-clock";
import { THEME_COOKIE } from "../lib/theme";

/**
 * The masthead and the theme toggle (CLARITY-AND-CADENCE CC3, Part 4.2).
 *
 * Two guards live here. The first is ruling R3 — one truth per line — enforced the only way it can
 * be: by counting. The second is the one-tap theme toggle's journey, end to end, through the real
 * button a reader taps.
 */

/**
 * The header region — everything at the top of the page that could carry the market state or the
 * data vintage: the sticky top bar (which holds the pill), the masthead (the edition, the date, and
 * line 3), and the pipeline strip below it.
 */
function headerRegionText(page: import("@playwright/test").Page) {
  const topbar = page.locator("header").first();
  const masthead = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  const strip = page.getByRole("status").filter({ hasText: "next edition" });
  return Promise.all([topbar.innerText(), masthead.innerText(), strip.innerText()]).then((parts) =>
    parts.join("\n"),
  );
}

test.describe("R3 — one truth per line in the masthead", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test("the market state appears once, and the close/vintage appears once", async ({ page }) => {
    /*
     * Pinned to the seeded evening so the two clock-dependent members settle deterministically: the
     * market pill reads CLOSED (it is an evening) and the strip grades FRESH (the run has landed, no
     * further session is owed). Without the pin the pill's word and the strip's state wander with the
     * wall clock, and a counting test needs a fixed page to count.
     */
    await page.clock.setFixedTime(SEEDED_EVENING);
    await signIn(page);
    await page.goto("/");

    // Wait for both clock-dependent members before reading: the strip regrades on mount, the pill
    // mounts client-side. Counting before they arrive would count an incomplete header.
    const strip = page.getByRole("status").filter({ hasText: "next edition" });
    await expect(strip).toBeVisible();
    await expect(page.locator("header").first()).toContainText(/\b(open|closed)\b/i);

    const text = await headerRegionText(page);

    // The market's open/closed WORD — only the pill says it now; the masthead's line 3 gave it up.
    // "close" (the vintage, "Thursday's close") is a different token and a word boundary keeps it out
    // of this count: "closed" has no boundary after "close", so it is never miscounted as the vintage.
    const marketWords = text.match(/\b(open|closed)\b/gi) ?? [];
    expect(marketWords, `market-state word must appear exactly once (got ${JSON.stringify(marketWords)})`).toHaveLength(1);

    // The data vintage — only line 3's "{weekday}'s close" says it now; the strip gave it up (R3).
    const closeRefs = text.match(/\bclose\b/gi) ?? [];
    expect(closeRefs, `the close/vintage must appear exactly once (got ${JSON.stringify(closeRefs)})`).toHaveLength(1);
  });
});

test.describe("the theme toggle — one tap, and it persists (CC3)", () => {
  const toggleName = /^Switch to (light|dark) theme$/;

  test("flips Light ↔ Dark via the top-bar button, writes the cookie, survives a reload", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/");

    const html = page.locator("html");
    await expect(page.getByRole("button", { name: toggleName })).toBeVisible();

    // The pre-paint script has already stamped the preference on <html> (the default is "system").
    const before = await html.getAttribute("data-theme");

    // ONE TAP. The app themes immediately — data-theme is stamped in the click handler — and the
    // cookie is written client-side for the next full load's pre-paint script.
    await page.getByRole("button", { name: toggleName }).click();

    const after = await html.getAttribute("data-theme");
    expect(["light", "dark"], "one tap always lands on an explicit theme, never system").toContain(after);
    expect(after, "the tap must actually flip the theme").not.toBe(before);

    // The SAME cookie the pre-paint reads (lib/theme.ts) was written — that is what makes SSR honest.
    await expect
      .poll(async () => (await page.context().cookies()).find((c) => c.name === THEME_COOKIE)?.value)
      .toBe(after);

    // Reload → the pre-paint reads the cookie and stamps the same theme. No flash, no round trip.
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", after!);

    // And a second tap flips it back — the two-state cycle.
    await page.getByRole("button", { name: toggleName }).click();
    await expect(html).not.toHaveAttribute("data-theme", after!);
  });

  test("is present in BOTH zones — the Desk and the Academy", async ({ page }) => {
    await signIn(page);

    await page.goto("/");
    await expect(page.getByRole("button", { name: toggleName })).toBeVisible();

    await page.goto("/academy");
    await expect(page.getByRole("button", { name: toggleName })).toBeVisible();
  });
});
