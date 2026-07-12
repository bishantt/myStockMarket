import { expect, test } from "@playwright/test";
import { PAPER_DARK } from "../lib/tokens";
import { THEME_COOKIE } from "../lib/theme";

/**
 * One theme governs the whole app (D1).
 *
 * This spec used to assert the opposite — "Dark applies to the Desk but never to the Academy" — and
 * that assertion has been DELETED, not weakened. The user repealed the Academy-stays-light rule on
 * 2026-07-12, knowingly superseding the positive-polarity reading rationale behind it (RR §9.7).
 * Dark now means dark everywhere.
 *
 * What replaces it is the pair of claims the new rule actually makes:
 *
 *   1. one theme, every room — the Academy included, and the static login page included
 *   2. the rooms still feel different, but STRUCTURALLY: the Academy's cards are solid paper where
 *      the Desk's are glass. That distinction has to survive in both themes, or the room switch is
 *      simply gone.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Midnight — one theme, every room", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/settings");
    await page.getByRole("button", { name: "Dark" }).click();
  });

  test("dark themes the Desk AND the Academy — the room no longer opts out", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // The Academy is the whole point of this test. It used to be exempt; it is not any more.
    await page.goto("/academy");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/academy/glossary");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("the theme is stamped on <html>, not on a room's shell", async ({ page }) => {
    // The mechanism matters as much as the rule. `data-theme` lives on <html>, set by the root
    // layout's inline pre-paint script. A server cookie read would have turned every route dynamic
    // and quietly broken the force-static login/offline pages the service worker precaches.
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // And no room shell carries a competing data-theme of its own any more.
    await expect(page.locator("body [data-theme]")).toHaveCount(0);
  });

  test("the status bar follows the CHOSEN theme, not the operating system", async ({ page }) => {
    // A reader who picks Midnight on a light-mode phone must not get a bone-white status bar
    // sitting over a dark app. The pre-paint script replaces the OS-following media pair with the
    // chosen paper (§7.3).
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    const themeColor = await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content");
    expect(themeColor).toBe(PAPER_DARK);
  });

  test("the static login page themes too, without ceasing to be static", async ({ page, baseURL }) => {
    await page.context().clearCookies();
    // Only the theme cookie: no session, so this is the logged-out, precacheable page.
    await page.context().addCookies([
      { name: THEME_COOKIE, value: "dark", url: baseURL! },
    ]);
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("the rooms stay distinct through STRUCTURE, in BOTH themes", async ({ page }) => {
    /*
     * The other half of D1, and the claim the whole one-palette decision rests on.
     *
     * The Academy used to be a different colour. It is not any more — same wash, same tokens, same
     * theme. So the room switch has to be carried entirely by the furniture, and this is the test
     * that it actually is:
     *
     *   the Desk's modules are GLASS (.surface)      — an instrument
     *   the Academy's are SOLID PAPER (.surface-solid) — a book
     *
     * If that ever stops being true, the two rooms have quietly become one room, and the reader has
     * lost the doorway. It has to hold in Midnight as well as in Morning, which is exactly where a
     * "just make the Academy lighter" shortcut would have failed.
     */
    for (const theme of ["Light", "Dark"]) {
      await page.goto("/settings");
      await page.getByRole("button", { name: theme, exact: true }).click();

      await page.goto("/academy");
      await expect(page.locator(".surface-solid").first()).toBeVisible();
      // And no glass anywhere in the reading room.
      await expect(page.locator("main .surface")).toHaveCount(0);

      await page.goto("/");
      await expect(page.locator("main .surface").first()).toBeVisible();
    }
  });
});
