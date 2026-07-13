import { expect, test } from "@playwright/test";

/**
 * The ticker's range control (NEWS-AND-CONTROL-PLAN Part 5.4).
 *
 * THE CLAIM THIS TEST EXISTS TO PROVE: switching the range makes NO NETWORK REQUEST.
 *
 * That is not an optimisation note; it is the reason the control has no loading state, no skeleton,
 * and no cache interplay to reason about. The page already serves the symbol's whole history in its
 * cached payload — the chart needs it anyway — so a range is a slice of data that is already in the
 * browser, and switching it is a synchronous re-render.
 *
 * A design that rests on "nothing got slow, so nothing needs to be kept fast" is only honest if
 * somebody checks that nothing got slow. So: route interception, and the assertion is zero.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("the ticker's range control", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("switching the range fetches NOTHING — the data is already here", async ({ page }) => {
    await page.goto("/ticker/AAPL");

    // The chart is code-split, so wait for the control it ships beside before counting anything.
    const range = page.getByRole("radiogroup", { name: "Range" });
    await expect(range).toBeVisible();
    await expect(page.getByRole("radio", { name: "6M" })).toBeChecked(); // the editorial default

    // Everything from here on is the thing under test. Count every request the page makes.
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));

    await page.getByRole("radio", { name: "1M" }).click();
    await expect(page.getByRole("radio", { name: "1M" })).toBeChecked();

    await page.getByRole("radio", { name: "1Y" }).click();
    await expect(page.getByRole("radio", { name: "1Y" })).toBeChecked();

    expect(
      requests,
      "a range switch hit the network — the whole design of this control assumes it does not",
    ).toEqual([]);
  });

  test("the chart states what it IS, and through when", async ({ page }) => {
    await page.goto("/ticker/AAPL");
    // Three unstated choices become stated ones: daily or intraday, adjusted or raw, and through
    // when. Every one of them changes what the picture means.
    await expect(page.getByText(/Daily bars · adjusted · through/)).toBeVisible();
  });

  test("no range control exists on the evidence surfaces — C3, on the real page", async ({ page }) => {
    // The Range Ladder lives on this same page, directly under the chart. Its horizons are
    // properties of the evidence, so the page must offer exactly ONE radiogroup: the chart's.
    await page.goto("/ticker/AAPL");
    await expect(page.getByRole("radiogroup", { name: "Range" })).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(1);

    // And the setup cards on the Desk — the app's flagship evidence surface — have none at all.
    await page.goto("/");
    const cards = page.getByRole("region", { name: "Setup cards" });
    await expect(cards.getByRole("radiogroup")).toHaveCount(0);
  });
});
