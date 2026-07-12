import { expect, test, type Page } from "@playwright/test";

/**
 * The scans room (APP-FEEL-PLAN §4.2).
 *
 * The assertion this file exists for is "every match is reachable". /scans used to print a wall of
 * bare ticker chips capped at 24, ending in a "+ N more" that was a plain <li> — not a link, not a
 * button, not anything. On the first live pipeline night, 1,825 matches sat behind it, unreachable
 * from the page whose whole job is to show them. The test that pages to the end of the table and
 * finds the last seeded symbol is that dead end's grave.
 *
 * The rest of these are ruling M1: a sortable table of market data is one small step from a
 * leaderboard, and the step gets taken by accident. So the default order is the pipeline's own, the
 * header says so in words, the way back to it is always one control away, and the words "top" and
 * "best" appear nowhere on the page.
 *
 * Seeded-only, like the other data journeys: the fixture is 32 unusual-volume matches (two pages at
 * 25), with the lottery-risk and null-metric rows deliberately below the movers' cut.
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

test.describe("Scans", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the index shows every recipe, its grade, and a NAMED preview cut", async ({ page }) => {
    await page.goto("/scans");

    // The recipe is never hidden: it is the comparison content of this page.
    await expect(page.getByText("20-day relative volume ≥ 2.5")).toBeVisible();
    await expect(page.getByText("|1-day return| ≥ 2%")).toBeVisible();

    // The folklore preset says so, in the word.
    await expect(page.getByText("FOLKLORE", { exact: false }).first()).toBeVisible();

    // M8: the preview states its own cut. Not "highlights", not an unlabelled slice.
    await expect(page.getByText("First 3 of 32 by scan order")).toBeVisible();

    // The dead "+ N more" is now a link, and it says how many are behind it.
    await expect(page.getByRole("link", { name: "All 32 matches →" })).toBeVisible();
  });

  test("the index never ranks the presets against each other (M1)", async ({ page }) => {
    await page.goto("/scans");

    // The cards render in the fixed SCAN_PRESETS order — never by match count. Ordering the index by
    // how many names each filter caught would be a cross-preset ranking: a busy scan is not a better
    // scan. unusual-volume (32 matches) is FIRST because the list says so, and rsi-extreme (0) is
    // last for the same reason — not because of their counts.
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual([
      "Unusual volume",
      "Near the 52-week high",
      "Gap of 3% or more",
      "Fresh golden cross",
      "RSI extreme",
    ]);
  });

  test("a scan that matched nothing says so, and says it is information", async ({ page }) => {
    await page.goto("/scans");
    // rsi-extreme is seeded EMPTY on purpose. An empty state that is never seeded is an empty state
    // that is never honest.
    await expect(page.getByText("0 matches today — the filter ran and found nothing. That is information.")).toBeVisible();
  });

  test("the table names its own order, and never calls it 'top' (M1)", async ({ page }) => {
    await page.goto("/scans/unusual-volume");

    await expect(page.getByRole("heading", { name: "Unusual volume" })).toBeVisible();
    // The criteria and the grade ride the table route too, first in flow.
    await expect(page.getByText("20-day relative volume ≥ 2.5")).toBeVisible();

    // The default order is the pipeline's own, and the header says which order that is.
    await expect(page.getByRole("columnheader", { name: /#/ })).toContainText("scan order");

    // The footnote is M1's sentence, in its single home.
    await expect(page.getByText(/Matches are filter hits, not forecasts/)).toBeVisible();

    // No leaderboard vocabulary anywhere on the page.
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body).not.toMatch(/\b(top|best|hottest|winners)\b/i);
  });

  test("EVERY match is reachable — page to the end and the last seeded symbol is there", async ({ page }) => {
    // This is the grave of the dead "+ N more". 32 matches, 25 to a page: the 32nd row (AVGO, rank
    // 32) exists only on page 2, and it must be reachable by a control the reader can actually press.
    await page.goto("/scans/unusual-volume");

    await expect(page.getByText("Page 1 of 2 · 32 rows")).toBeVisible();
    await expect(page.getByText("AVGO")).toHaveCount(0);

    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Page 2 of 2 · 32 rows")).toBeVisible();
    await expect(page.getByText("AVGO").first()).toBeVisible();
  });

  test("sorting re-orders today's matches, and the honest order is one control away", async ({ page }) => {
    await page.goto("/scans/unusual-volume");

    const rvol = page.getByRole("button", { name: /RVOL/ });
    await rvol.click();
    await expect(page.getByRole("columnheader", { name: /RVOL/ })).toHaveAttribute("aria-sort", /ascending|descending/);

    // And back: the default order is still a header away, and still says what it is.
    await page.getByRole("button", { name: /#/ }).click();
    await expect(page.getByRole("columnheader", { name: /#/ })).toHaveAttribute("aria-sort", /ascending|descending/);
  });

  test("the lottery-risk flag finally has somewhere to appear", async ({ page }) => {
    // The pipeline has been setting this flag since P4 and nothing has ever rendered it. SNDL (rank
    // 9, sub-$5) carries it in the fixture.
    await page.goto("/scans/unusual-volume");
    await expect(page.getByText("lottery risk").first()).toBeVisible();
  });

  test("an unknown metric renders an em-dash, never an invented zero", async ({ page }) => {
    // CHPT's dollar volume is null in the fixture — the pipeline coerces a NaN to null, not to 0.
    await page.goto("/scans/unusual-volume");
    await expect(page.getByText("—").first()).toBeVisible();
  });

  test("a scan that does not exist 404s rather than inventing an empty one", async ({ page }) => {
    // dynamicParams = false. A polite "0 matches today" on /scans/garbage would claim a filter ran.
    const response = await page.goto("/scans/garbage");
    expect(response?.status()).toBe(404);
  });

  test("a row opens the rail, and the rail reaches the full page", async ({ page }) => {
    await page.goto("/scans/unusual-volume");

    await page.getByRole("row").filter({ hasText: "SMCI" }).first().click();
    const rail = page.getByRole("dialog");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("link", { name: /Open full view/ })).toBeVisible();

    // The drill ladder stays a ladder: glance → rail → route, and the exit is a real 44px target
    // sitting clear of the iPhone home-indicator band (the sheet's inset fix).
    const box = await rail.getByRole("link", { name: /Open full view/ }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Scans on a phone", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
  test.skip(({ isMobile }) => !isMobile, "the card-row rendering is the phone's table");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("renders card-rows, sorts from a native select, and never scrolls sideways", async ({ page }) => {
    await page.goto("/scans/unusual-volume");

    // The sort control is a native <select>, and its FIRST option is always the honest order: the way
    // back to "scan order" is never more than one flick away (M1).
    const sort = page.getByRole("combobox").first();
    await expect(sort).toBeVisible();
    const firstOption = await sort.locator("option").first().textContent();
    expect(firstOption).toBe("Scan order");

    // A 7-column grid peeked through a 390px keyhole is not a table. The page never scrolls sideways.
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflows).toBe(false);
  });
});
