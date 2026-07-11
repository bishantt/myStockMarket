import { expect, test } from "@playwright/test";

/**
 * Journey 7 — the paper desk: the entry form, the sizing helper, and the cooling-off interstitial
 * that fires when an order follows a just-seen signal (plan §7 P6 acceptance). Behind the login wall;
 * the page reads an empty ledger without seeding, so no seeded database is required.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("The paper desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the paper desk shows the cost mirror and the sizing helper", async ({ page }) => {
    await page.goto("/paper");
    await expect(page.getByRole("heading", { name: "Paper desk" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost mirror" })).toBeVisible();
    await expect(page.getByText(/Sizing helper/)).toBeVisible();
  });

  test("the cooling-off interstitial fires within the window of a viewed signal", async ({ page }) => {
    // Arrive as if from a setup card whose signal was just viewed (well inside the 30-minute window).
    const justNow = new Date(Date.now() - 60_000).toISOString();
    await page.goto(`/paper?symbol=DEMO&signalViewedAt=${encodeURIComponent(justNow)}`);

    await page.getByRole("spinbutton", { name: "Reference open" }).fill("100");
    await page.getByRole("button", { name: "Place paper trade" }).click();

    // It does not submit silently — the cooling-off dialog appears with a way to proceed or wait.
    await expect(page.getByRole("alertdialog", { name: "Cooling-off" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sit with it" })).toBeVisible();
  });
});
