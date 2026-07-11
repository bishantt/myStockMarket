import { expect, test } from "@playwright/test";

/**
 * Journey — the evening briefing renders, cites its sources, and the PM journal writes (plan §6.2,
 * P3). The unit tests prove the parser and view-model; this proves the whole path: a real browser
 * signs in, the server reads the seeded briefing, and the BriefArticle shows the Today's-focus
 * headline, the labeled item slots, and a source superscript that links out to the article. It also
 * exercises the one write the PM ritual adds — a journal entry.
 *
 * Seeded-only, guarded by MSM_SEEDED=1 (CI loads prisma/seed.mjs into a throwaway Postgres); locally
 * without the flag the group skips. Every asserted string is a literal from the seeded briefing.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("Daily brief — the seeded evening briefing", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the brief shows the Today's-focus headline and the labeled item slots", async ({ page }) => {
    const brief = page.getByRole("region", { name: "Daily brief" });
    await expect(brief).toBeVisible();
    await expect(brief.getByText("AI-server demand carried the tape")).toBeVisible();
    // A labeled slot and its content from the seeded first item.
    await expect(brief.getByText("What happened").first()).toBeVisible();
    await expect(brief.getByText(/Super Micro beat Q3 estimates/)).toBeVisible();
    await expect(brief.getByText(/Shares rose 18\.40%/)).toBeVisible();
  });

  test("a claim's source renders as a superscript link to the article", async ({ page }) => {
    const brief = page.getByRole("region", { name: "Daily brief" });
    // The footnote list resolves the citation to the seeded article's host.
    await expect(brief.getByRole("link", { name: "reuters.com" })).toBeVisible();
  });

  test("no Learn doorway renders while the Academy manifest is empty (pre-P5)", async ({ page }) => {
    const brief = page.getByRole("region", { name: "Daily brief" });
    await expect(brief.getByRole("link", { name: /Learn:/ })).toHaveCount(0);
  });

  test("the evening scorecard shows the live resolved record over the journal prompt", async ({ page }) => {
    const scorecard = page.getByRole("region", { name: "Evening scorecard" });
    await expect(scorecard).toBeVisible();
    // Grading is now live off signal_resolution (P4): the seeded record is 2 hits and a miss.
    await expect(scorecard.getByText(/The app.s record so far/)).toBeVisible();
    await expect(scorecard.getByText(/What did today's session teach you/)).toBeVisible();
  });

  test("the PM journal saves an entry", async ({ page }) => {
    const scorecard = page.getByRole("region", { name: "Evening scorecard" });
    await scorecard.getByRole("textbox").fill("I waited for confirmation instead of chasing the open.");
    await scorecard.getByRole("button", { name: "Save entry" }).click();
    await expect(scorecard.getByTestId("journal-saved")).toBeVisible();
  });
});
