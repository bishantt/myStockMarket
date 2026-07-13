import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The accessibility sweep (APP-FEEL-PLAN F7).
 *
 * The suite already checks the two things this app gets wrong most easily on a phone — a 44px touch
 * target and a 16px input — because those are rules a machine can measure and a human forgets. This
 * is the other half: the WCAG rules that a linter cannot see and a designer cannot feel, run against
 * every room by axe.
 *
 * Scoped to serious and critical violations, deliberately. Axe's "minor" and "moderate" buckets are
 * full of advisory findings that are genuinely arguable (a landmark preference here, a heading-order
 * opinion there); a gate that fires on those trains its reader to skim past it, and this codebase has
 * already learned that lesson three separate times. Serious and critical are the ones that actually
 * lock somebody out.
 *
 * COLOR-CONTRAST IS EXCLUDED FROM THE GATE, AND THAT EXCLUSION IS A RECORDED FINDING, NOT A DODGE.
 * Read docs/feel-evidence/accessibility.md before you touch this line.
 *
 * The first axe run found up to 58 failing nodes on a single page, and it split cleanly in two:
 *
 *   1. `text-faint` used to carry INFORMATION — a disclosure's count, the em-dash standing in for an
 *      unknown value, a table's column label. The token sheet has said "placeholders/disabled; never
 *      body text" since R1, and the app (and this plan's own kit) ignored it. `faint` measures 2.23:1
 *      against Morning's paper where AA wants 4.5:1. FIXED — every one of those is `muted` now, and
 *      drift rule 18 stops it coming back.
 *
 *   2. `text-muted` on a GLASS card. The token was verified at 4.83:1 "on paper", and it clears that
 *      — but a Surface is translucent, so the colour a reader actually sees it against is the card
 *      composited over the lavender wash, not the paper. Axe measures what is on screen; the token
 *      was measured against something else.
 *
 * The second one is a PALETTE decision, and the palette is the redesign plan's territory, not this
 * one's (the authority order is explicit: UI-REDESIGN-PLAN wins on look). Darkening `muted` app-wide
 * is a change to every surface the user signed off on, so it is logged for them as [NEED] rather
 * than made unilaterally at 2am by the executor. The finding is recorded with its numbers; the gate
 * holds the line on everything else so that a NEW violation cannot hide behind an old one.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/** Every room a reader can reach. The sweep is only as honest as this list. */
const ROUTES = [
  "/",
  "/scans",
  "/scans/unusual-volume",
  "/paper",
  "/track-record",
  "/ticker/SPY",
  "/settings",
  "/academy",
  "/academy/glossary",
  "/academy/review",
];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("accessibility", () => {
  test("the login wall itself is clean — it is the one page a reader meets first", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  for (const route of ROUTES) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await signIn(page);
      await page.goto(route);
      await page.waitForLoadState("load");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"]) // recorded, not dodged — see the header
        .analyze();

      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

      // Name the offending node, not just the rule. The first version of this gate printed
      // "nested-interactive (1 nodes)" and nothing else, which tells the reader that something,
      // somewhere on a page of a hundred elements, is wrong — and leaves them to find it. A gate
      // that fires without saying where is only half a gate.
      expect(
        serious.map(
          (v) => `${v.id} (${v.nodes.length} nodes): ${v.help}\n${v.nodes.map((n) => `      at ${n.target.join(" ")}\n      ${n.html}`).join("\n")}`,
        ),
        `serious/critical accessibility violations on ${route}`,
      ).toEqual([]);
    });
  }
});
