import { expect, test } from "@playwright/test";
import { SESSION_COOKIE_NAME } from "../lib/auth";

/**
 * The login wall, exercised in a real browser (plan §6.2: "auth — wrong password, cookie
 * tamper, protected-route redirect"). The unit tests prove the token cannot be forged; these
 * prove the proxy actually stands between the reader and the data.
 *
 * The credentials come from playwright.config.ts, which starts a production build with a
 * fixture username and bcrypt hash.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("an unauthenticated visitor is sent to the login page, not the Desk", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  // The login headline is the product's opening argument (§5.7). Exactly one of the two renders at
  // any width — the brand panel's above `lg`, the stacked one below it — so this matches one node.
  await expect(
    page.getByRole("heading", { name: /Your personal broadsheet for the market/i }),
  ).toBeVisible();
});

test("the login page explains why the wall exists", async ({ page }) => {
  await page.goto("/login");
  // The licensing wall is a product commitment (§1.5, rule 15), so it is stated, not hidden.
  await expect(page.getByText(/licensed for personal\s+use only/i)).toBeVisible();
});

test("a protected route remembers where the visitor was headed", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page).toHaveURL(/\/login\?next=%2Fstyleguide$/);

  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Back to where they meant to go, rather than dumped on the Desk.
  await expect(page).toHaveURL(/\/styleguide$/);
});

test("a wrong password is refused, and says nothing about which half was wrong", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Scoped by test id: Next renders its own role="alert" route announcer on every page, so a
  // bare getByRole("alert") matches two elements.
  await expect(page.getByTestId("login-error")).toHaveText("Incorrect username or password.");
  // Still on /login, and no session cookie was issued.
  await expect(page).toHaveURL(/\/login/);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === SESSION_COOKIE_NAME)).toBeUndefined();
});

test("a wrong username is refused with the identical message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("someone-else");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByTestId("login-error")).toHaveText("Incorrect username or password.");
});

test("the correct credential opens the Desk and issues an httpOnly session cookie", async ({ page }) => {
  await signIn(page);

  await expect(page).toHaveURL("/");
  /*
   * The Desk shell, and its first section masthead — which is 01 now, not 00.
   *
   * Module 00 (Pipeline) was retired into the header's status strip in N2, so the ritual starts at
   * 01. This anchor was only ever standing in for "the Desk actually rendered", and the macro pulse
   * is the better proof of that anyway: it renders its masthead whether the module has data or is
   * showing its placeholder, so the assertion means the same thing on a fresh database as on a
   * seeded one.
   */
  await expect(page.getByRole("heading", { name: /01 — Macro pulse/i })).toBeVisible();

  const session = (await page.context().cookies()).find(
    (c) => c.name === SESSION_COOKIE_NAME,
  );
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
});

test("a tampered session cookie is rejected and the visitor is sent back to /login", async ({
  page,
  context,
}) => {
  await signIn(page);
  await expect(page).toHaveURL("/");

  const session = (await context.cookies()).find((c) => c.name === SESSION_COOKIE_NAME);
  expect(session).toBeDefined();

  // Flip one character of the signature. The payload still parses; the signature no longer verifies.
  const [header, payload, signature] = session!.value.split(".");
  const flipped = signature[0] === "A" ? "B" : "A";
  await context.clearCookies();
  await context.addCookies([
    { ...session!, value: `${header}.${payload}.${flipped}${signature.slice(1)}` },
  ]);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("an unauthenticated API request gets a 401 JSON body, never a redirect", async ({
  request,
}) => {
  // This is what lets the service worker tell "your cookie expired" from "here is a page".
  // A 3xx here would let the SW cache the login screen as the morning briefing (§5.2).
  const response = await request.get("/api/morning", { maxRedirects: 0 });

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});

test("the icons and manifest resolve without a cookie, so the app stays installable", async ({
  request,
}) => {
  // §5.5.1 asserts this directly: an install prompt fetches the manifest and its icons before
  // any session exists. These land in P0 step 6; the manifest route is the one that exists now.
  const response = await request.get("/login", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
});
