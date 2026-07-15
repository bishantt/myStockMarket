import { expect, type Page } from "@playwright/test";

/**
 * The seeded login, shared by every spec behind the wall. Credentials come from playwright.config.ts,
 * which boots a production build with this fixture user and its bcrypt hash.
 */
export const USER = "testuser";
export const PASSWORD = "correct horse battery staple";

/** Sign in and land on the Desk. The closing URL assert doubles as the wait for the post-login redirect. */
export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}
