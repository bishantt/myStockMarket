import { expect, test } from "@playwright/test";

/**
 * Navigation — the desktop top bar and the phone's bottom tab bar (D2).
 *
 * The phone used to navigate from a horizontal scroll strip in the top bar, which was a workaround
 * for a nav that did not fit. It fits now, because it moved to the bottom: five rooms, thumb-height,
 * always in the same place.
 *
 * The regression cover from the original iPhone bugs stays: the active room must track the route
 * (Scans used not to highlight), and no page may ever scroll sideways.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the current room is highlighted, and it moves with the route", async ({ page }) => {
    // Both bars are mounted at every width — one is display:none for the other's breakpoint — so
    // this asserts on the VISIBLE one. Desktop reads the top bar, the phone reads the tab bar; both
    // mark the active room with aria-current, and both compute it from the same pure function
    // (lib/nav.ts), which is exactly why the phone's nav could be swapped without touching the logic.
    const activeRoom = page.locator('[aria-current="page"]:visible');

    await page.goto("/");
    await expect(activeRoom).toContainText("Desk");

    await page.goto("/scans");
    await expect(activeRoom).toContainText("Scans");

    await page.goto("/paper");
    await expect(activeRoom).toContainText("Paper");
  });

  test("no page scrolls horizontally", async ({ page }) => {
    for (const path of ["/", "/scans", "/scans/unusual-volume", "/paper", "/track-record", "/academy"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // Allow a 1px rounding slack; anything more is a real horizontal overflow.
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("The phone's bottom tab bar (D2)", () => {
  // These assertions only mean anything at phone width — the bar is `md:hidden`.
  test.skip(({ isMobile }) => !isMobile, "phone project only");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("is visible, and carries all five rooms", async ({ page }) => {
    const bar = page.getByTestId("tab-bar");
    await expect(bar).toBeVisible();

    for (const room of ["Desk", "Scans", "Paper", "Track", "Academy"]) {
      await expect(bar.getByRole("link", { name: room })).toBeVisible();
    }
  });

  test("navigates, and the active tab tracks the route", async ({ page }) => {
    const bar = page.getByTestId("tab-bar");

    await bar.getByRole("link", { name: "Scans" }).click();
    await expect(page).toHaveURL("/scans");
    await expect(bar.locator('[aria-current="page"]')).toContainText("Scans");

    await bar.getByRole("link", { name: "Academy" }).click();
    await expect(page).toHaveURL("/academy");
    // The bar is mounted in BOTH room shells — crossing the doorway must not lose the navigation.
    await expect(page.getByTestId("tab-bar")).toBeVisible();
  });

  test("every tab is a real touch target (≥44px)", async ({ page }) => {
    const links = page.getByTestId("tab-bar").getByRole("link");
    await expect(links).toHaveCount(5);

    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box!.height, "a tab shorter than 44px is a tab you miss").toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("HIDES while the soft keyboard is up", async ({ page }) => {
    // The iOS bug this exists for: the layout viewport does NOT shrink when the keyboard opens, so
    // a `bottom: 0` fixed bar stays pinned to a viewport the keyboard is now covering — and floats
    // in the middle of the screen, on top of the very form being typed into. The bar watches
    // visualViewport (which DOES shrink) and gets out of the way.
    await page.goto("/paper");
    await expect(page.getByTestId("tab-bar")).toBeVisible();

    // Playwright cannot raise a real soft keyboard, so simulate what one does to visualViewport.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, "height", {
        value: window.innerHeight - 300,
        configurable: true,
      });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });

    await expect(page.getByTestId("tab-bar")).toBeHidden();
  });
});
