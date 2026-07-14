import { expect, test, type Page } from "@playwright/test";

/**
 * voice.spec.ts — the richness kit, proven in a real browser (PD5, plan §8.6).
 *
 * The unit tests prove each piece of the kit in isolation. This proves the two things a jsdom render
 * structurally CANNOT see, and both of them are the interesting half of the rule:
 *
 *  1. THE GLOSSARY DOORWAY ACTUALLY OPENS. `Term` is a server component wrapping a client island;
 *     the popover only exists after hydration, and only on a page the server actually rendered.
 *
 *  2. FIRST OCCURRENCE PER VIEW. The registry is `React.cache`d to the request, and `cache` memoises
 *     ONLY inside a Server Component render — under vitest's client render it hands back a fresh
 *     registry every call, so a unit test asserting "one doorway per page" would be asserting
 *     something about React's request scoping rather than about our rule. Here the rule is real,
 *     because here there IS a request. (components/Term.test.tsx says so, and points at this file.)
 *
 * And one navigation guarantee: a TickerChip is a DOOR, and going back through it must return the
 * reader to where they were reading — the bfcache sanity check that Part 11's overlay will lean on.
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

test.describe("the voice — glossary doorways on the Desk", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a Term in the brief opens its definition, and offers the lesson behind it", async ({ page }) => {
    const brief = page.getByRole("region", { name: "Daily brief" });
    await expect(brief).toBeVisible();

    // The doorways are buttons — reachable by keyboard, which an underline alone would not be.
    const doorways = brief.getByRole("button");
    const count = await doorways.count();
    test.skip(count === 0, "the seeded brief's prose names no glossary term");

    await doorways.first().click();

    // A popover, not a tooltip: it has a role, a name, and a body the reader can actually read.
    const popover = brief.getByRole("dialog");
    await expect(popover).toBeVisible();

    // And it is never a trap — Escape closes it.
    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible();
  });

  test("FIRST OCCURRENCE PER VIEW — a term is dotted once on the page, however often it is written", async ({
    page,
  }) => {
    const brief = page.getByRole("region", { name: "Daily brief" });
    await expect(brief).toBeVisible();

    const names = await brief.getByRole("button").allInnerTexts();
    test.skip(names.length === 0, "the seeded brief's prose names no glossary term");

    // The registry's whole job. Two doorways for the same word would mean it had failed.
    const normalized = names.map((name) => name.trim().toLowerCase());
    expect(new Set(normalized).size, `a term was dotted twice: ${names.join(", ")}`).toBe(
      normalized.length,
    );
  });
});

test.describe("the voice — a TickerChip is a door", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test("a symbol chip on a story navigates to the ticker, and BACK returns the reader where they were", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/news");

    /*
     * INTO A STORY THAT ACTUALLY NAMES A TICKER, and neither the lead nor "the first row" is
     * reliably that.
     *
     * The seeded night's lead is a Fed statement that moved no single stock, so its card prints the
     * honest "No direct listing in our universe" line and its story page has no affected table at
     * all (ruling C9). Several rows are the same. A first draft of this test clicked the lead, found
     * no chip, and clicked whatever link happened to be first in the DOM instead; a second clicked
     * the first row and silently SKIPPED on desktop while passing on a phone — which is the worst of
     * both, because a skip is a green tick that tested nothing.
     *
     * So the card is chosen by the property the test actually needs: it CARRIES a ticker chip. A
     * card that names a symbol is a card whose story has an affected table, and that is the story
     * with a door in it. The seed is teaching the test something true about the product — not every
     * story has a symbol — and the test now listens instead of guessing.
     */
    const withTicker = page
      .getByTestId("news-row")
      .filter({ has: page.getByTestId("card-tickers") })
      .first();
    await expect(withTicker, "the seeded feed must have at least one story naming a ticker").toBeVisible();

    // Open the story by its own id rather than by clicking the card. What this test is about is the
    // CHIP — that a symbol is a door, and that coming back through it restores the reader's place —
    // and routing that claim through a card click would make it depend on a second, unrelated
    // navigation as well.
    const cluster = await withTicker.getAttribute("data-cluster");
    expect(cluster, "a news card must name the cluster it opens").toBeTruthy();
    await page.goto(`/news/${cluster}`);

    const story = page.url();

    /*
     * The door itself, located by the thing that MAKES it a door: drift rule 26 guarantees the
     * /ticker/ route has one minter, so an href is the honest selector.
     *
     * `:visible` IS LOAD-BEARING. DataTable renders BOTH layouts into the DOM — the desktop table
     * and the phone's card list — and hides one with CSS. So `.first()` on its own picks whichever
     * copy happens to come first in the document, which on a desktop is the HIDDEN one: the locator
     * resolves, the click waits for a box that will never arrive, and the test dies after thirty
     * seconds pointing at a chip that is on screen right in front of you. It passed on the phone,
     * where the visible copy happens to be first, which is the most misleading possible outcome.
     */
    const chip = page.locator('a[href^="/ticker/"]:visible');
    test.skip((await chip.count()) === 0, "this story lists no affected tickers");

    // Scroll down first: "back preserves position" is only a claim if there was a position to lose.
    // The story page is not always taller than the viewport — a short story on a 1366×768 desktop
    // fits whole — so the scroll half of this test is CONDITIONAL, and says so rather than skipping
    // the navigation half it does not depend on.
    await page.mouse.wheel(0, 600);
    const before = await page.evaluate(() => window.scrollY);

    await chip.first().click();
    await expect(page).toHaveURL(/\/ticker\/.+/);

    await page.goBack();
    await expect(page).toHaveURL(story);

    if (before > 0) {
      // The reader comes back to the paragraph they left, not to the top of the page. Polled, not
      // sampled once: the browser can restore the position a frame after the URL settles.
      await expect
        .poll(async () => page.evaluate(() => window.scrollY), {
          message: "going back from a ticker must restore the reader's scroll position",
        })
        .toBeGreaterThan(before / 2);
    }
  });
});
