import { expect, test } from "@playwright/test";

/**
 * Journey 4 — the setup cards render honest-by-construction, and the track record shows the app's
 * misses (plan §6.2, P4). Seeded-only (MSM_SEEDED=1); every asserted string is a seeded value.
 *
 * The three seeded cards demonstrate the acceptance: a WEAK-capped card (CI spans the baseline), a
 * moderate card with its percentage and interval, and a suppressed card (N < 30, no percentage).
 * The track-record page shows the resolved log — two hits and a miss.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Setup cards & track record — the seeded morning", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("a card whose CI spans the baseline shows the WEAK tier lexicon word", async ({ page }) => {
    const cards = page.getByRole("region", { name: "Setup cards" });
    await expect(cards.getByText("Golden cross")).toBeVisible();
    // The tier tag is the lexicon word "watch only" (copy.tier.weak), never a colour.
    await expect(cards.getByText("watch only").first()).toBeVisible();
  });

  test("the moderate card shows its percentage, interval, and the always-up baseline", async ({ page }) => {
    const cards = page.getByRole("region", { name: "Setup cards" });
    await cards.getByText("Near the 52-week high").click(); // open the disclosure
    await expect(cards.getByText(/66%/)).toBeVisible();
    await expect(cards.getByText(/95% interval/)).toBeVisible();
    await expect(cards.getByText(/read this against that baseline/)).toBeVisible();
  });

  test("the small-sample card suppresses its percentage", async ({ page }) => {
    const cards = page.getByRole("region", { name: "Setup cards" });
    await cards.getByText("Unusual volume").click();
    await expect(cards.getByText(/Insufficient history/)).toBeVisible();
  });

  test("the track record shows the app's hits and misses", async ({ page }) => {
    await page.goto("/track-record");
    await expect(page.getByRole("heading", { name: "Track record" })).toBeVisible();
    // Two seeded hits, one miss.
    await expect(page.getByText("Miss").first()).toBeVisible();
    await expect(page.getByText("Hit").first()).toBeVisible();
  });
});
