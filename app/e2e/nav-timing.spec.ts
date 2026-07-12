import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * nav-timing.spec.ts — budgets B3 (soft-navigation speed) and B5 (soft-navigation layout shift).
 * APP-FEEL-PLAN §5.4, §5.5, Appendix D.
 *
 * The disease this measures is the one the reader actually felt: tap a tab, and the OLD room sits
 * frozen on screen for 400–1240ms while the server renders the new one, then everything appears at
 * once. The framework's own docs name the cause — a dynamic page with no loading boundary has
 * nothing local to paint, so the browser simply keeps showing the page you are trying to leave.
 *
 * So this measures the thing the reader experiences: from the moment the tab is tapped to the moment
 * the destination's heading is on screen. Not TTFB (check-nav.mjs owns that), not a Lighthouse lab
 * score — the felt gap.
 *
 * Why the gate is set where it is (Appendix E-21). The ceiling is CATASTROPHIC-ONLY: median ≤ 400ms
 * and no single sample over 1000ms. The healthy numbers are expected around 30–150ms, so this
 * ceiling is nowhere near them — it can only trip if the frozen-navigation disease comes back. That
 * is deliberate. A tight assert on a shared CI runner flakes, and a gate that fails randomly teaches
 * its executor to ignore it, which is worse than having no gate at all. The REAL medians are written
 * to docs/feel-evidence/nav-timing.md on every run, so drift shows up as a trend long before the
 * ceiling ever fires.
 *
 * `retries: 0`, deliberately: a timing gate that passes on its second attempt is a gate that has
 * taught you to ignore it.
 */

test.describe.configure({ retries: 0, mode: "serial" });

/**
 * ARMED as of F1. F0 ran this in report mode — it measured the disease (Scans 1342ms, Paper 824ms)
 * and asserted nothing, because a budget armed before the cure exists is a red gate you learn to
 * walk past. The speed layer now exists, so the gate has something to protect.
 */
const ARMED = true;

const MEDIAN_CEILING_MS = 400;
const SAMPLE_CEILING_MS = 1000;
const SOFT_NAV_CLS_BUDGET = 0.05;

/**
 * Tab label → a heading that only exists once the destination has actually rendered.
 *
 * `exact` is not a detail here, it is the whole measurement. Playwright matches an accessible name
 * by SUBSTRING by default, and the Desk carries a module masthead reading "07 — Sectors & scans" —
 * so a loose locator for the heading "Scans" resolves on the Desk, before the tap, and the timer
 * stops at ~14ms having measured nothing at all. That is precisely how this instrument was first
 * written, and it cheerfully reported the app's slowest room as its fastest.
 *
 * The `assertNotAlreadyVisible` step below makes the mistake structurally impossible rather than
 * merely fixed: every run proves the destination is absent BEFORE the tap, so a locator that
 * silently starts matching the origin page fails the test instead of flattering it.
 */
const DESTINATIONS = [
  { tab: "Scans", heading: "Scans" },
  { tab: "Paper", heading: "Paper desk" },
  { tab: "Track", heading: "Track record" },
  { tab: "Academy", heading: "The Academy" },
] as const;

const SAMPLES = 8; // the first is discarded — it carries first-compile and warm-up noise

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Watch for layout shift during the navigation we are about to make (B5).
 *
 * Lighthouse cannot see this: it hard-loads exactly one URL, and skeletons only ever appear on SOFT
 * navigations. If a loading skeleton reserves the wrong height, the content jumps when it arrives —
 * and the only instrument that can catch it is one that is watching at the moment of the tap.
 */
async function installLayoutShiftObserver(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __msmShift: number };
    w.__msmShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) w.__msmShift += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

const readLayoutShift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __msmShift: number }).__msmShift ?? 0);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** Append one destination's samples to the running evidence file. Whole milliseconds: sub-millisecond
 *  precision on a navigation timing is noise dressed up as rigour. */
function report(tab: string, samples: number[], shift: number) {
  const dir = join(process.cwd(), "..", "docs", "feel-evidence");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const ms = (n: number) => `${Math.round(n)}ms`;
  const line =
    `| ${stamp} | Desk → ${tab} | **${ms(median(samples))}** | ${ms(Math.min(...samples))} | ` +
    `${ms(Math.max(...samples))} | ${samples.map((s) => Math.round(s)).join(", ")} | ${shift.toFixed(3)} |\n`;
  appendFileSync(join(dir, "nav-timing.md"), line);
}

// The phone is where the tab bar lives and where the reader actually taps. On desktop the rooms are
// reached from the top bar and `.tap()` is not available at all — an earlier draft of this spec
// crashed on exactly that.
test.skip(({ isMobile }) => !isMobile, "the tab bar is the phone's navigation");

/**
 * Seeded databases only, and this is a correctness requirement rather than convenience.
 *
 * A navigation timing is only meaningful against known data. In CI this runs against the seeded
 * Postgres in the same container: 32 scan matches, a handful of trades, everything local. On a
 * developer's laptop there is no local database at all (there is no way to run Postgres on this
 * machine — LESSONS 2026-07-12), so `next start` reads the PRODUCTION Supabase, three time zones
 * away, holding 1,825 live scan matches. Timing a tap into /scans there measures a cross-country
 * round trip against a table 57× larger than the fixture — it is a measurement of Supabase, not of
 * this app's navigation, and it swings between 40ms and 815ms depending on whether the router's
 * prefetch beat the tap.
 *
 * So the gate lives where its data is deterministic. The same rule the seeded Desk journeys already
 * follow, for the same reason.
 */
test.skip(
  process.env.MSM_SEEDED !== "1",
  "a navigation timing needs a seeded database — CI has one, this laptop does not",
);

for (const { tab, heading } of DESTINATIONS) {
  test(`soft-nav timing — Desk → ${tab}`, async ({ page }) => {
    await signIn(page);

    // Scope to the tab bar. "Scans" also matches the Desk's own module-07 link and "Track" matches
    // the scorecard's link, so an unscoped locator resolves to two elements and fails strict mode.
    const link = page.getByTestId("tab-bar").getByRole("link", { name: tab });
    const destination = page.getByRole("heading", { name: heading, exact: true });

    /** The clock only means something if the thing we are waiting for is genuinely not here yet. */
    const assertNotAlreadyVisible = async () => {
      await expect(
        destination,
        `"${heading}" is already on the Desk before the tap — this locator would measure nothing`,
      ).toHaveCount(0);
    };

    // Warm the destination once, explicitly. The first visit to any route pays costs the reader only
    // ever pays once (compile in dev, a fresh regeneration after a publish), and averaging that into
    // a steady-state number would slander the steady state.
    await assertNotAlreadyVisible();
    await link.tap();
    await expect(destination).toBeVisible();

    // Resolve the tab's box ONCE, then tap by coordinates. Playwright's normal .tap() waits for
    // actionability first, and that wait would land inside the interval we are trying to measure.
    await page.goto("/");
    const box = await link.boundingBox();
    expect(box, "the tab bar must be on screen to tap it").not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    const samples: number[] = [];
    let worstShift = 0;

    for (let i = 0; i < SAMPLES; i++) {
      await page.goto("/");
      await expect(page.getByTestId("tab-bar")).toBeVisible();
      await assertNotAlreadyVisible();
      await installLayoutShiftObserver(page);

      const started = await page.evaluate(() => performance.now());
      await page.touchscreen.tap(x, y);
      await expect(destination).toBeVisible();
      const finished = await page.evaluate(() => performance.now());

      worstShift = Math.max(worstShift, await readLayoutShift(page));
      if (i > 0) samples.push(finished - started); // discard sample 1
    }

    report(tab, samples, worstShift);

    const m = median(samples);
    const worst = Math.max(...samples);
    console.log(
      `  ${tab.padEnd(8)} median ${Math.round(m)}ms · worst ${Math.round(worst)}ms · soft-nav CLS ${worstShift.toFixed(3)} ` +
        `· samples [${samples.map((s) => Math.round(s)).join(", ")}]`,
    );

    if (!ARMED) return; // F0: measure the disease. F1: arm the gate.

    expect(m, `median soft-nav to ${tab} must stay under the catastrophic ceiling`).toBeLessThanOrEqual(MEDIAN_CEILING_MS);
    expect(worst, `no single soft-nav to ${tab} may freeze the page`).toBeLessThanOrEqual(SAMPLE_CEILING_MS);
    expect(worstShift, `soft-nav layout shift into ${tab} (B5)`).toBeLessThan(SOFT_NAV_CLS_BUDGET);
  });
}
