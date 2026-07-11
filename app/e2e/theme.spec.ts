import { expect, test } from "@playwright/test";

/**
 * Dark mode is Desk-only (plan §7 P6 acceptance). Choosing Dark in settings darkens the Desk shell
 * via data-theme="dark"; the Academy never carries it, so the warm room stays light.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Dark Desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("Dark applies to the Desk but never to the Academy", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Dark" }).click();

    // The Desk shell now carries the dark theme.
    await page.goto("/");
    await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();

    // The Academy stays light — no dark theme anywhere in the warm room.
    await page.goto("/academy");
    await expect(page.locator('[data-theme="dark"]')).toHaveCount(0);
  });
});
