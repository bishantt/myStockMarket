import { expect, test, type Page } from "@playwright/test";

/**
 * The Front Page (NEWS-AND-CONTROL-PLAN Part 7.7, 7.8).
 *
 * THE TEST THIS FILE EXISTS FOR is "the lead is a position, not a prize". The seeded night was built
 * to make that falsifiable: SMCI rose 18.4% — the largest move on the tape — and it ranks THIRD,
 * behind a Fed statement that moved nothing at all and an FDA approval. If a future change ever lets
 * the big number float to the top, the assertion below goes red. A feed ranked by size of move is a
 * leaderboard; this is a newspaper (ruling C1/C4).
 *
 * The rest are the room's other promises, each one a rule with a scar behind it:
 *   - a filtered page states what it is hiding (the count line restates the filters);
 *   - an empty result is information, not an apology;
 *   - a gate-dropped context line prints NOTHING on the card, and EXPLAINS ITSELF on the story page;
 *   - "5 sources" can be opened — the articles are named, timed, and linked;
 *   - a doorway to evidence appears only where the evidence exists.
 *
 * Seeded-only: 14 clusters across 7 catalyst types, 45 articles, one cluster with a gate-dropped
 * narrative, and one cluster from the prior session (so Today and This week actually differ).
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

test.describe("The Front Page", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/news");
  });

  test("THE LEAD IS A POSITION, NOT A PRIZE — the biggest move does not lead", async ({ page }) => {
    // The Fed hold moved nothing and leads. SMCI moved 18.4% and does not.
    const lead = page.getByTestId("news-lead");
    await expect(lead).toContainText("Fed holds rates steady");

    // And the largest move on the tape is on the page, just not at the top of it.
    await expect(lead).not.toContainText("Super Micro");
    await expect(page.getByTestId("news-row").filter({ hasText: "Super Micro" })).toBeVisible();
  });

  test("the room explains its own ordering, and does not overclaim it", async ({ page }) => {
    // Ruling C1: a page that ranks without explaining how is asking to be trusted rather than
    // checked. And the sentence must admit the ties, because the real feed is full of them.
    await expect(page.getByText("Ordered by catalyst significance")).toBeVisible();
    await expect(page.getByText("Stories that score the same tie", { exact: false })).toBeVisible();
  });

  test("the press time and the cadence are both stated (C10)", async ({ page }) => {
    await expect(page.getByTestId("news-press-time")).toContainText("Assembled");
    await expect(page.getByTestId("news-press-time")).toContainText("14 catalysts");
    // The room is a newspaper and says so. No live badge, nothing pretending to update.
    await expect(
      page.getByText("Assembled nightly after the US close. This page does not update during the day."),
    ).toBeVisible();
  });

  test("a filter narrows the page AND restates itself in the count", async ({ page }) => {
    await expect(page.getByTestId("news-count")).toHaveText("13 catalysts");

    await page.getByRole("button", { name: "FDA", exact: true }).click();

    // The count line names the filter, so a filtered page can never read as a complete one.
    await expect(page.getByTestId("news-count")).toHaveText("1 catalyst · FDA");
    await expect(page.getByTestId("news-lead")).toContainText("FDA approves first non-opioid");
  });

  test("two filters AND together, and the zero state is information rather than an apology", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "FDA", exact: true }).click();
    await page.getByRole("button", { name: "Technology", exact: true }).click();

    // There is no FDA story in Technology tonight. That is a fact about the night.
    await expect(page.getByText("that is information, not an error")).toBeVisible();
    await expect(page.getByTestId("news-count")).toHaveText("0 catalysts · FDA · Technology");
  });

  test("the filters can be cleared, and the whole page comes back", async ({ page }) => {
    await page.getByRole("button", { name: "FDA", exact: true }).click();
    await expect(page.getByTestId("news-count")).toHaveText("1 catalyst · FDA");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("news-count")).toHaveText("13 catalysts");
  });

  test("every story on the page is reachable by some chip — including the ones the plan forgot", async ({
    page,
  }) => {
    // A filter row that cannot reach a story sitting on the page is a cut nobody stated. The
    // classifier's `other` escape hatch has no chip in the plan's list; it has one here.
    const total = 13; // the Today window; the 14th story broke on the prior session
    const chips = page.getByLabel("Catalyst filters").getByRole("button");

    // `.all()` IS THE ONE LOCATOR CALL THAT DOES NOT AUTO-WAIT. It hands back whatever is in the
    // DOM at that instant — and the filter row is rendered by NewsFeed, a "use client" component,
    // inside a streamed Suspense boundary. `page.goto("/news")` resolves before that chunk lands,
    // so enumerating the chips straight away can return an EMPTY list. The loop then sweeps nothing,
    // reports 0 stories reachable, and the failure reads as "the filter row is broken" when what
    // actually happened is that the test measured a page that had not arrived yet. Every other test
    // in this file is safe by luck: they locate a chip by name and click it, and clicking auto-waits.
    //
    // This is the house rule in its third costume — a sweep that swept nothing is a failure, not a
    // pass. So: wait for the row, then state how many chips we are about to sweep, and let the
    // count fail loudly on its own if it is ever zero.
    await expect(chips.first()).toBeVisible();
    const row = await chips.all();
    expect(row.length, "the filter row rendered no chips — this sweep would have measured nothing").toBeGreaterThan(0);

    let reachable = 0;
    for (const chip of row) {
      await chip.click();
      const line = await page.getByTestId("news-count").textContent();
      reachable += Number(line?.match(/^(\d+)/)?.[1] ?? 0);
      await chip.click(); // toggle back off
    }

    expect(reachable).toBe(total);
  });

  test("Today and This week are different windows over the same archive", async ({ page }) => {
    // Nvidia's guidance broke on the PRIOR session. Today does not show it; the week does.
    await expect(page.getByTestId("news-count")).toHaveText("13 catalysts");
    await expect(page.getByText("Nvidia guides above consensus")).toBeHidden();

    await page.getByRole("radio", { name: "This week" }).click();

    await expect(page.getByTestId("news-count")).toHaveText("14 catalysts");
    await expect(page.getByText("Nvidia guides above consensus")).toBeVisible();

    // …and the week says how deep it actually goes, rather than implying seven days of coverage.
    await expect(page.getByTestId("news-week-note")).toContainText("less than a week of coverage");
  });

  test("a story whose context line the gate DROPPED prints nothing where the line would be", async ({
    page,
  }) => {
    // P9, on the card: never a placeholder. The JPMorgan card publishes its facts and simply says
    // nothing where the sentence would have gone.
    const jpm = page.getByTestId("news-row").filter({ hasText: "JPMorgan tops estimates" });

    await expect(jpm).toBeVisible();
    await expect(jpm).toContainText("JPM");
    await expect(jpm).not.toContainText("unavailable");
    await expect(jpm).not.toContainText("No summary");
  });

  test("moved without a story — the page's caveat about itself (C9)", async ({ page }) => {
    const aside = page.getByRole("complementary").filter({ hasText: "Moved without a story" });

    await expect(aside).toBeVisible();
    // The standing noise line travels with them: a mover with no story is the easiest thing in this
    // app to mistake for a signal.
    await expect(aside).toContainText("likely noise");
  });

  test("a macro story that names no company says so, rather than showing an empty slot", async ({
    page,
  }) => {
    await expect(page.getByTestId("news-lead")).toContainText("No direct listing in our universe.");
  });

  test("the photograph actually LOADS — a broken image is invisible to every other assertion", async ({
    page,
  }) => {
    /*
     * The bug this exists for, found by the pixel oracle and by nothing else: the login wall was
     * redirecting /fixtures/, and the image optimizer does not proxy the reader's request — it makes
     * its OWN server-side fetch, with no session cookie. So it followed a 307 to the login page,
     * decided the source was not an image, and served a 400. EVERY photograph in the room rendered
     * as a broken-image icon, while the generated fallback cards — which need no optimizer —
     * rendered perfectly, so the page still looked plausible.
     *
     * Every DOM assertion passed throughout. The <img> was present, visible, correctly sized (the
     * width and height come from the row, which is exactly what makes the layout shift zero), and
     * carrying the right src. `naturalWidth` is the only thing in the browser that knows the
     * difference between an image and a broken one.
     */
    const image = page.getByTestId("news-lead").locator("img");
    await expect(image).toBeVisible();

    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  });
});

test.describe("A story page", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the corroboration count can be OPENED — every source is named, timed, and linked", async ({
    page,
  }) => {
    // The feed whispers "5 sources". This is where those five are. A count the reader cannot check
    // is a claim they simply have to believe, and the second-heaviest term in the whole ranking
    // formula was exactly that until this page existed.
    await page.goto("/news/nc-fed-hold");

    await expect(page.getByRole("heading", { name: "Fed holds rates steady", level: 1 })).toBeVisible();
    await expect(page.getByText("5 sources").first()).toBeVisible();

    for (const outlet of ["Reuters", "Bloomberg", "CNBC", "Associated Press", "Financial Times"]) {
      await expect(page.getByRole("link", { name: outlet, exact: true })).toBeVisible();
    }
  });

  test("the numbers, the tickers, and the mechanism doorway", async ({ page }) => {
    await page.goto("/news/nc-smci-earnings");

    await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Affected tickers" })).toBeVisible();

    // The setup-card doorway renders only where evidence exists. SMCI is the only seeded symbol
    // with a card, so it is the only row that offers the link.
    await expect(page.getByRole("link", { name: "Setup card →" })).toBeVisible();

    // The Academy doorway teaches the mechanism, never the story.
    await expect(page.getByRole("heading", { name: "Learn the mechanism" })).toBeVisible();
  });

  test("a DROPPED context line explains itself here, because silence on this page is a hole", async ({
    page,
  }) => {
    // On a card, a missing line prints nothing — silence there is restraint. A reader who opened
    // THIS page came to find out why the story matters, so the absence has to speak, and it has to
    // say WHICH absence it is: a sentence the gate deleted is not a sentence nobody wrote.
    await page.goto("/news/nc-jpm-earnings");

    await expect(page.getByTestId("news-note-absent")).toContainText("failed the number check");
  });

  test("the way back to the front page is always there", async ({ page }) => {
    await page.goto("/news/nc-fed-hold");
    await page.getByRole("link", { name: "← Back to the front page" }).click();
    await expect(page).toHaveURL("/news");
  });
});

test.describe("The Desk's front-page module", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test("module 08 is a glance and a doorway, and it states its own cut (M8)", async ({ page }) => {
    await signIn(page);

    // An unlabelled slice of a ranked list cannot be told apart from the whole list.
    await expect(page.getByText("First 3 of 14 by significance")).toBeVisible();
    await expect(page.getByRole("link", { name: "The full front page →" })).toBeVisible();

    // It shows the same lead the room does — two places that decide the day's biggest story would
    // eventually disagree, and then the app would have two front pages.
    await expect(page.getByRole("link", { name: "Fed holds rates steady, signals patience on cuts" })).toBeVisible();
  });

  test("the News room is one tap from anywhere", async ({ page }) => {
    await signIn(page);

    // Both navs carry it and only one of them is on screen: the phone's tab bar below `md`, the
    // desktop's room strip above it. Clicking "whichever one the reader can actually see" is the
    // assertion that holds for both, and it is the one a reader would make.
    await page.getByRole("link", { name: "News", exact: true }).filter({ visible: true }).first().click();

    await expect(page).toHaveURL("/news");
  });
});
