import { type Page } from "@playwright/test";

/**
 * WAIT FOR THE PAGE TO BE STYLED BEFORE MEASURING IT (PD4) — a bug fix, not a precaution.
 *
 * A bounding box read before the stylesheet lands is a measurement of unstyled HTML: every block
 * starts at x = 0, so both Desk columns report left: 0 and the rail is, technically, not to the right
 * of the main column. That is exactly how grid.spec failed in CI — mainRight: 0, railLeft: 0, on a
 * Desk that was fine. It is a RACE (CI is the slower machine): page.goto() resolves on `load`, which
 * does not guarantee the CSSOM has been applied to a layout the test then forces.
 *
 * The token is the honest signal — `--color-paper` is defined in globals.css and is an empty string
 * until that stylesheet is in effect. Fonts come next, because every height a box-measuring spec
 * asserts depends on text having its real metrics.
 *
 * CLAUDE.md's grid law: every box-measuring spec calls this. It lives here, exported, so the law is
 * an import rather than a copy-paste.
 */
export async function waitForLayout(page: Page) {
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim() !== "",
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => document.fonts.ready);
}
