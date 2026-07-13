import { expect, test, type Page } from "@playwright/test";

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

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

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
    await expect(page.getByRole("alert")).toHaveCount(0);
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
    await expect(page.getByRole("alert")).toHaveCount(0);
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
    const banner = page.getByRole("alert");
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

  test("the weekend is NOT staleness — a Saturday reader sees the quiet line", async ({ page }) => {
    // The case that decides whether the strip is worth having at all. The market is shut, no session
    // was missed, the pipeline is behaving perfectly. Amber here would be a lie — and a lamp that
    // glows amber every Saturday is a lamp nobody reads by Tuesday, which means it is not there on
    // the night it matters.
    await signIn(page);
    await page.goto("/");
    const session = await seededSession(page);

    // Walk forward to the next Saturday after the seeded session.
    const saturday = new Date(session);
    do {
      saturday.setUTCDate(saturday.getUTCDate() + 1);
    } while (saturday.getUTCDay() !== 6);
    saturday.setUTCHours(14, 0, 0, 0); // 10am ET on the Saturday

    await page.clock.setFixedTime(saturday);
    await page.reload();

    // Quiet, still. No alert, no amber, no "stale".
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("stale", { exact: true })).toHaveCount(0);
  });
});
