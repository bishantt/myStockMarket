import { expect, test } from "@playwright/test";

/**
 * Journey — the Academy room opens, a lesson reads, and the return rail leads home (plan §9.3, P5).
 * Behind the same login wall as the Desk; no seeded database needed (lessons are files).
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("The Academy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the curriculum map lists the M0 lessons and a lesson reads", async ({ page }) => {
    await page.goto("/academy");
    await expect(page.getByRole("heading", { name: "The Academy" })).toBeVisible();
    await page.getByRole("link", { name: "Reading a base-rate sentence" }).click();
    await expect(page).toHaveURL(/\/academy\/reading-a-base-rate-sentence/);
    await expect(page.getByRole("heading", { name: "Reading a base-rate sentence" })).toBeVisible();
    // The frontmatter retrieval questions close the lesson.
    await expect(page.getByRole("heading", { name: "Check yourself" })).toBeVisible();
  });

  test("the return rail leads back to the Desk", async ({ page }) => {
    await page.goto("/academy");
    await page.getByRole("link", { name: "← Back to Desk" }).click();
    await expect(page).toHaveURL("/");
  });
});
