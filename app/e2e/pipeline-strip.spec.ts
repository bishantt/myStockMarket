import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./session";

/**
 * The pipeline strip's three states, driven by a fake clock (NEWS-AND-CONTROL-PLAN Part 4.4).
 *
 * WHY A CLOCK AND NOT A TEST-ONLY SEARCH PARAM.
 *
 * The plan proposed driving these states through a `?now=` param that the Desk would read under
 * MSM_SEEDED. Two things are wrong with that, and the second is fatal:
 *
 *   1. It puts test-only code into the product. The Desk would carry a branch that exists for no
 *      reader, on the app's most important page.
 *   2. Reading `searchParams` in a page forces that route to render DYNAMICALLY. The Desk is a
 *      cached route — that is budget B1, and it is the single change that took a tab tap from
 *      1342ms to 280ms. The test would have quietly cost the app the thing the last plan bought.
 *
 * The clock is better on its own merits anyway, because of how the strip actually works. It grades
 * freshness in the BROWSER, against the reader's clock, precisely so a cached render cannot
 * photograph a dead pipeline as a healthy one. So the honest way to test "what does a reader see on
 * Tuesday night" is to be a reader whose clock says Tuesday night. This drives the real code path
 * with no product changes at all.
 *
 * The seeded database has ONE completed run, for the seeded session. Every state below is that same
 * run, read at a different moment — which is exactly the argument the strip makes: the same data is
 * fresh, stale, or an emergency depending on nothing but how many sessions have passed without an
 * edition.
 */

/**
 * The app's OWN alert, and not the framework's.
 *
 * Next.js renders `<div role="alert" aria-live="assertive" id="__next-route-announcer__">` on every
 * page — an empty live region it uses to announce client-side navigations to screen readers. So a
 * bare `getByRole("alert")` matches on EVERY page, always, and `toHaveCount(0)` can never pass.
 *
 * The tag's CI found this: four of these tests failed asserting "no alert on a healthy night" while
 * the healthy night was rendering no alert at all. The assertion was measuring the framework.
 */
const appAlert = (page: Page) =>
  page.locator('[role="alert"]:not([id="__next-route-announcer__"])');

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The seeded run's trading day, read from the page itself rather than hardcoded.
 *
 * Hardcoding the seed's date here would give a test that breaks every time the seed moves, for a
 * reason with nothing to do with the strip. So we read the edition's own masthead — "Friday, July
 * 10, 2026" — which is the one place on the Desk that carries the full date INCLUDING the year, and
 * reason forward from it.
 *
 * Parsed from its parts rather than handed to `new Date(string)`: parsing a human date string is
 * implementation-defined, and a date test that depends on the engine's goodwill is a date test that
 * will fail on a Tuesday for no reason anybody can reconstruct.
 */
async function seededSession(page: Page): Promise<Date> {
  const heading = (await page.getByRole("heading", { level: 1 }).first().textContent()) ?? "";
  const match = heading.match(/(\w+) (\d{1,2}), (\d{4})/);
  expect(match, `could not read the edition date from the Desk masthead: "${heading}"`).not.toBeNull();

  const [, monthName, day, year] = match!;
  const month = MONTHS.indexOf(monthName);
  expect(month, `unrecognised month in "${heading}"`).toBeGreaterThanOrEqual(0);

  return new Date(Date.UTC(Number(year), month, Number(day)));
}

/**
 * Set the browser's clock to the night of the Nth TRADING SESSION after a given day.
 *
 * Sessions, not calendar days — because that is the only unit the strip counts in, and it is the
 * whole reason the strip is usable. Advancing two calendar days from a Thursday lands on a Saturday
 * and misses exactly ONE session, so a test that walked calendar days would be asserting "dead"
 * against a state that is correctly "aging", and the failure would look like a bug in the product.
 */
async function readAt(page: Page, session: Date, sessionsLater: number) {
  const day = new Date(session);
  let advanced = 0;
  while (advanced < sessionsLater) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) advanced += 1;
  }

  // 10pm ET on that session — comfortably past the 9pm promise hour, so an owed edition is genuinely
  // owed rather than merely not-yet-due. 10pm EDT is 02:00 UTC the following calendar day.
  const at = new Date(day);
  at.setUTCDate(at.getUTCDate() + 1);
  at.setUTCHours(2, 0, 0, 0);

  await page.clock.setFixedTime(at);
}

test.describe("the pipeline strip — the escalation, on the real page", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test("FRESH — the seeded night: one quiet line, no alarm, and a doorway", async ({ page }) => {
    await signIn(page);
    await page.goto("/");
    const session = await seededSession(page);

    /*
     * Read on the night of the seeded session itself — which is the ONLY moment this data is fresh.
     *
     * Without pinning the clock, this test would depend on how long ago the seed's trading day was,
     * which is to say it would pass today and fail next week for no reason anybody could reconstruct.
     * The seeded run is a fixed point; "now" is not. So we say when we are reading.
     */
    await readAt(page, session, 0);
    await page.reload();

    const strip = page.getByRole("status").filter({ hasText: "Data through" });
    await expect(strip).toBeVisible();

    // The three facts module 00's entire card never managed: what am I looking at, was it written,
    // and when does the next edition land.
    await expect(strip).toContainText("Data through");
    await expect(strip).toContainText("pipeline ran");
    await expect(strip).toContainText("next:");

    // Quiet. No banner, no alert role, nothing shouting on a night when nothing is wrong.
    await expect(appAlert(page)).toHaveCount(0);
    await expect(strip.getByRole("link")).toHaveAttribute("href", /\/settings/);
  });

  test("AGING — one session missed: amber, the WORD 'stale', and both halves of the news", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/");
    const session = await seededSession(page);

    // Read it on the next trading session's night. That session's edition is owed and never landed.
    await readAt(page, session, 1);
    await page.reload();

    const strip = page.getByRole("status");
    await expect(strip).toContainText("check the pipeline");

    // The word, never the colour alone (P11's redundant encoding). A reader who cannot distinguish
    // the amber must still be able to READ that something is stale.
    await expect(page.getByText("stale", { exact: true })).toBeVisible();

    // And it names BOTH the missing session and the data actually on screen. The second half is the
    // one that changes what the reader does next.
    await expect(strip).toContainText("showing");

    // Aging is not an emergency. It is still role=status — polite.
    await expect(appAlert(page)).toHaveCount(0);
  });

  test("DEAD — two sessions missed: the loudest surface in the app, and it cannot be dismissed", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/");
    const session = await seededSession(page);

    // Two trading sessions later. Both editions are owed; neither landed.
    await readAt(page, session, 2);
    await page.reload();

    // role=alert, not role=status. If the escalation lived only in the colour, a screen-reader user
    // would get the app's calmest voice on its worst night.
    const banner = appAlert(page);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("has not run since");

    // Not "an error occurred" — what every number on the page ACTUALLY IS. A dead pipeline serving
    // stale data silently is the catastrophic failure mode: the app keeps looking authoritative and
    // keeps being wrong.
    await expect(banner).toContainText("Every number on this page is from that night");
    await expect(page.getByText("pipeline down")).toBeVisible();

    // It cannot be dismissed. A dismissible catastrophe notice is one that gets dismissed, once, and
    // then never seen again on any of the nights that follow.
    await expect(banner.getByRole("button")).toHaveCount(0);

    // And it is still a doorway to the control room — the reader is told what to DO, not just that
    // something is wrong.
    await expect(banner.getByRole("link")).toHaveAttribute("href", /\/settings/);
  });

  test("a WEEKEND adds no staleness — Saturday and Sunday do not escalate the strip", async ({
    page,
  }) => {
    /*
     * THE CASE THAT DECIDES WHETHER THE STRIP IS WORTH HAVING AT ALL — and the tag's CI made me
     * state it properly.
     *
     * My first version of this test asserted that a Saturday reader sees the QUIET line. It failed,
     * and the product was right: the seed's run is a THURSDAY, so by Saturday, Friday's edition is
     * genuinely owed and genuinely absent. The strip says "stale" because it IS stale. There is no
     * way to construct "the weekend immediately after the last session" from a Thursday seed —
     * Friday is always in the way.
     *
     * So this asserts the rule that actually matters, and that this seed CAN prove: **the weekend
     * itself adds nothing.** From Thursday's run, Saturday is one session behind (Friday). Sunday is
     * still one session behind. The two days of the weekend passed and the strip did not escalate,
     * because no session was OWED on either of them.
     *
     * That is the whole reason freshness counts in sessions rather than days. A strip that counted
     * days would read "3 days stale" on Sunday and show the red banner — and a lamp that turns red
     * every Sunday is a lamp nobody looks at by Tuesday, which means it is not there on the night it
     * matters. (The pure "Friday's run, read on Saturday, is FRESH" case is covered exhaustively in
     * lib/freshness.test.ts, where the clock and the run are both free variables.)
     */
    await signIn(page);
    await page.goto("/");
    const session = await seededSession(page);

    /** 10am ET on the Nth calendar day after the seeded session. */
    const morningOf = (daysAfter: number) => {
      const d = new Date(session);
      d.setUTCDate(d.getUTCDate() + daysAfter);
      d.setUTCHours(14, 0, 0, 0); // 10am EDT
      return d;
    };

    // Walk to the Saturday and the Sunday that follow the seeded session.
    let saturdayOffset = 1;
    while (morningOf(saturdayOffset).getUTCDay() !== 6) saturdayOffset += 1;

    // SATURDAY — one session behind (Friday's edition never landed). Amber, and NOT the red banner.
    await page.clock.setFixedTime(morningOf(saturdayOffset));
    await page.reload();
    await expect(page.getByText("stale", { exact: true })).toBeVisible();
    await expect(appAlert(page), "Saturday must not escalate to the dead banner").toHaveCount(0);

    // SUNDAY — a whole day later, and STILL only one session behind. The weekend cost nothing.
    await page.clock.setFixedTime(morningOf(saturdayOffset + 1));
    await page.reload();
    await expect(page.getByText("stale", { exact: true })).toBeVisible();
    await expect(
      appAlert(page),
      "Sunday escalated the strip — the weekend is being counted as missed sessions",
    ).toHaveCount(0);
  });
});
