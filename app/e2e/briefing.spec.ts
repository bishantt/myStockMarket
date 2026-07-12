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

  test("the Learn doorway now links to the seeded lesson (the Academy manifest has it)", async ({ page }) => {
    // The seeded brief's learning_link_slug is an authored M0 lesson, so the doorway lights up.
    const brief = page.getByRole("region", { name: "Daily brief" });
    const doorway = brief.getByRole("link", { name: /Learn:/ });
    await expect(doorway).toBeVisible();
    await expect(doorway).toHaveAttribute("href", "/academy/reading-a-base-rate-sentence");
  });

  test("the evening scorecard shows the live resolved record over the journal prompt", async ({ page }) => {
    const scorecard = page.getByRole("region", { name: "Evening scorecard" });
    await expect(scorecard).toBeVisible();
    // Grading is now live off signal_resolution (P4): the seeded record is 2 hits and a miss.
    await expect(scorecard.getByText(/The app.s record so far/)).toBeVisible();
    await expect(scorecard.getByText(/What did today's session teach you/)).toBeVisible();
  });

  test("the PM journal saves an entry", async ({ page }, testInfo) => {
    // Desktop-only: the journal WRITE path is what this asserts, and it is deterministic on desktop.
    // Phone form-writes are already covered by settings.spec.ts (add-watchlist on Pixel 7); the plan's
    // phone e2e concerns are auth/PWA/offline/back-gesture, not this bottom-of-page write.
    test.skip(testInfo.project.name === "phone", "journal write covered on desktop; phone writes via settings.spec");
    const scorecard = page.getByRole("region", { name: "Evening scorecard" });
    const entry = scorecard.getByRole("textbox");
    await entry.fill("I waited for confirmation instead of chasing the open.");
    const save = scorecard.getByRole("button", { name: "Save entry" });
    await save.scrollIntoViewIfNeeded();
    await save.click();

    /*
     * ASSERT THE FORM CLEARED, not that "Saved." is on screen.
     *
     * This test used to wait for the `journal-saved` marker, and that marker is rendered whenever
     * `state.ok` is true — which is the INITIAL state of useActionState. "Saved." was therefore on
     * the page from the moment it loaded, before anything had been saved, and this assertion passed
     * without the write ever happening. It was a guard that could not fail.
     *
     * The form resets itself on a successful write, so an empty textarea is a real success signal:
     * it cannot be true until the server action has come back ok.
     *
     * The long timeout is not a workaround for a hang. A server action's response carries a full
     * re-render of the page it was invoked from, and on the Desk that means re-reading the entire
     * morning — ten-odd queries — before the client sees the result. It is a genuinely slow round
     * trip, and on a contended CI Postgres it comfortably outlives the 5s default.
     */
    await expect(entry).toHaveValue("", { timeout: 20_000 });
    await expect(scorecard.getByTestId("journal-error")).toHaveCount(0);
  });
});
