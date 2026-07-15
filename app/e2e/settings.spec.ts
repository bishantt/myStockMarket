import { expect, test } from "@playwright/test";

import { signIn } from "./session";

/**
 * Watchlist writes, end to end (plan §9.2 — the watchlist is the one thing the app itself writes).
 *
 * The unit tests pin the pure rules (reason required, focus cap); this proves the whole write path
 * in a real browser: add a name on /settings, see it appear on the Desk, focus and unfocus it,
 * then remove it — against the seeded test database, never production (guarded by MSM_SEEDED).
 *
 * The two Playwright projects (desktop, phone) run in parallel against ONE test database, so each
 * picks a DIFFERENT seeded instrument to add — otherwise the two workers would race on the same
 * row. The test removes what it added through the UI, leaving the seed as it found it.
 *
 * BUT THAT UI REMOVE IS FLAKY, AND WHEN IT FLAKES IT POISONS THE PIXEL ORACLE (CC4). The remove's
 * reflection is a known intermittent race; when it does not complete, the added row PERSISTS in the
 * leg's shared database — and the desktop/phone legs run `settings.spec` BEFORE `vrt.spec` against
 * that one database (`workers: 1`), so the settings and desk VRT shots (both render the watchlist)
 * then photograph a fourth row and fail on a resize. `cc-4`'s tag run hit exactly this: the flake
 * failed, and settings/desk VRT redded downstream, on a SHA whose rehearsal had passed clean. So the
 * cleanup is GUARANTEED here, in the database, independent of the flaky UI: an afterEach deletes this
 * project's test row whether or not the in-test remove landed. The wide/mbp16 legs never ran this
 * spec (their testMatch is vrt/hardening/grid only), which is why they were immune.
 */

/** The seeded instrument this project adds, and the exact reason it writes — distinct per project so
 * the two local workers never race, and so the cleanup below deletes only THIS project's row. */
function testRow(projectName: string): { symbol: string; reason: string } {
  const symbol = projectName === "phone" ? "DIA" : "QQQ";
  return { symbol, reason: `e2e ${symbol} — watching the reaction` };
}

/**
 * Each of these clicks fires a SERVER ACTION whose reply is a full re-render of /settings — the whole
 * room, its watchlist, its control panel — before the button's new state reaches the browser. On a
 * contended CI runner that comfortably outlives Playwright's 5s default (the same round trip the Desk
 * journal test documented), and CC4 made the room heavier still. So the reflection assertions wait
 * explicitly and say why — a real state that is slow to arrive, not a race we agree to lose slower.
 */
const ACTION_TIMEOUT = 20_000;

test.describe("Watchlist management", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // The guaranteed cleanup — a direct DB delete, not the flaky UI remove (see the header). Scoped to
  // THIS project's exact reason, so a parallel local worker's row is never touched. Same PrismaClient
  // pattern e2e/thin-night.ts uses to reset the seeded world.
  test.afterEach(async ({}, testInfo) => {
    const { reason } = testRow(testInfo.project.name);
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      await db.watchlistItem.deleteMany({ where: { reason } });
    } finally {
      await db.$disconnect();
    }
  });

  test("add a name, see it on the Desk, focus it, then remove it", async ({ page }, testInfo) => {
    // A seeded instrument that is NOT already on the watchlist, distinct per project.
    const { symbol, reason } = testRow(testInfo.project.name);

    await page.goto("/settings");

    // Add it.
    await page.getByLabel("Symbol").fill(symbol);
    await page.getByLabel("Why you are watching it").fill(reason);
    await page.getByRole("button", { name: "Add" }).click();

    // Locate the row by its REASON — a unique string. (The symbol is a poor filter: "DIA" is a
    // substring of "NVIDIA", and the symbol also appears inside the instrument name.)
    const row = page.getByRole("listitem").filter({ hasText: reason });
    await expect(row).toContainText(symbol, { timeout: ACTION_TIMEOUT });

    // It shows on the Desk's watchlist too — one tap down.
    //
    // A NEWLY ADDED NAME IS NOT A FOCUS NAME, and since F5 the Desk shows the focus names and folds
    // the rest behind a counted disclosure. So the name is not on the surface, and it should not be:
    // the module is called the FOCUS watchlist, and the whole point of the fold is that the three
    // names you chose to watch closely are not buried under the ones you merely added. Open the fold
    // and it is there — which is exactly the journey a reader makes.
    await page.goto("/");
    const watch = page.getByRole("region", { name: "Watchlist" });
    await watch.getByText(/Full watchlist/).click();
    await expect(watch.getByText(symbol, { exact: true })).toBeVisible();

    // Focus it, then unfocus it — the button reflects the state each way.
    await page.goto("/settings");
    const addedRow = page.getByRole("listitem").filter({ hasText: reason });
    await addedRow.getByRole("button", { name: "Focus", exact: true }).click();
    await expect(addedRow.getByRole("button", { name: "Unfocus" })).toBeVisible({ timeout: ACTION_TIMEOUT });
    await addedRow.getByRole("button", { name: "Unfocus" }).click();
    await expect(addedRow.getByRole("button", { name: "Focus", exact: true })).toBeVisible({ timeout: ACTION_TIMEOUT });

    // Remove it — and it is gone.
    await addedRow.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: reason })).toHaveCount(0, { timeout: ACTION_TIMEOUT });
  });

  test("a duplicate name is refused with a plain message", async ({ page }) => {
    // AAPL is already on the seeded watchlist; adding it again is refused, not duplicated.
    await page.goto("/settings");
    await page.getByLabel("Symbol").fill("AAPL");
    await page.getByLabel("Why you are watching it").fill("trying to add a duplicate");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByTestId("add-error")).toContainText("already on your watchlist");
  });
});
