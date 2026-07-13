import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { THEME_COOKIE } from "../lib/theme";

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
 * COLOUR CONTRAST IS IN THE GATE. Nothing is excluded. It was excluded for one day, and the story
 * of getting it back in is worth the paragraph, because it is a trap anybody re-running axe will
 * fall into:
 *
 * The first run reported 58 failing nodes across the app, in every colour the app owns — muted, ink,
 * the accent, the up/down chips. That looked like a broken palette. It was not. Every page in this
 * app fades in (`.route-fade`, opacity 0 → 1), and axe was measuring DURING the fade: it composites
 * a foreground through any ancestor's opacity, so it was faithfully reporting the colours of a page
 * that was still arriving. `text-muted` at 55% opacity really is 2.23:1. It is also not a colour any
 * reader ever reads.
 *
 * Wait for the fade to land and the 58 collapse to ONE real finding, which is now fixed:
 * `--color-muted` was verified at 4.83:1 against the PAPER, but muted text lives on a Surface, and a
 * Surface is white at 72% over the lavender wash — which composites to #f0effe. Against the thing a
 * reader is actually looking at, the old #6e6c80 measured 4.48:1 and missed the floor. It is #676577
 * now (4.99:1 on glass) — approved by the user as a readability floor, 2026-07-12.
 *
 * THE LESSON, because it will happen again: never measure a colour, a size or a position while the
 * page is still animating. You will measure the animation. Any test that reads a computed style must
 * first wait for the thing to be finished arriving — which is what `settle()` below does.
 *
 * Scoped to serious and critical, and run in BOTH themes: a two-theme app whose gate only checks one
 * theme is checking half its colours.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/** Both themes. Colour is half of what axe checks, and this app has two palettes. */
const THEMES = ["light", "dark"] as const;

/**
 * Every room a reader can reach. The sweep is only as honest as this list.
 *
 * These exist whatever is in the database — an empty room still renders its empty state, and an
 * empty state is a room with markup in it.
 */
const ROUTES = [
  "/",
  // The Front Page (N5): dense with chips and a scrolling filter row, which is exactly the shape
  // that ships a keyboard trap.
  "/news",
  "/scans",
  "/scans/unusual-volume",
  "/paper",
  "/track-record",
  "/ticker/SPY",
  // /settings carries the control room (N6) — five action rows, the live states and the P-2 notice.
  "/settings",
  "/academy",
  "/academy/glossary",
  "/academy/review",
];

/**
 * Rooms that only EXIST when the database is seeded, and the reason they are separated (N7).
 *
 * A story page is addressed by a cluster id. Ask for one that is not there and the route calls
 * `notFound()` — so an unseeded run of this sweep did not measure the story page at all. It
 * measured the framework's 404 page, found nothing wrong with it, and reported the story page
 * clean. Verified: this sweep passed against `/news/nc-fed-hold` on a database that has never
 * contained it.
 *
 * That is this build's oldest hazard wearing an accessibility gate's clothes — a guard that passes
 * because the thing it measures is ABSENT rather than correct. The `open()` helper below now makes
 * that impossible to do quietly, so these routes must state the condition they need instead.
 */
const SEEDED_ROUTES = ["/news/nc-fed-hold"];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Open a room, and PROVE it is the room — not an error page, and not the login wall (N7).
 *
 * A sweep measures whatever is on the screen. If the route is missing, it measures the 404 page; if
 * the session lapsed, it measures the login form. Both are perfectly accessible, both pass, and the
 * room the gate exists to protect was never looked at. Measured before this was written: the axe
 * sweep passed `/news/nc-fed-hold` against a database that has never contained that cluster. It was
 * sweeping the 404 page and calling the story page clean.
 *
 * AND THE STATUS CODE IS NOT THE WITNESS — this is the part that will catch the next person, because
 * it caught me. The first version of this guard asserted `status === 200`, and it still passed on the
 * missing story page. Recorded, on this tree:
 *
 *     /news/nc-fed-hold        status=200   body: "404 — This page could not be found."
 *     /ticker/NOTAREALTICKER   status=200   body: "404 — This page could not be found."
 *     /scans/not-a-preset      status=404
 *     /no-such-room-at-all     status=404
 *
 * A `notFound()` raised INSIDE a statically-generated route answers **200 with the 404 page in the
 * body**; only a path the router cannot match at all gets a real 404. So a status check certifies
 * exactly the page it was written to refuse. The honest witness is what the reader can actually see,
 * which is the BODY — so that is what this asserts.
 */
async function open(page: Page, route: string) {
  await page.goto(route);

  // The framework's not-found page, named by the words a reader would see on it.
  const missing = await page.getByText("This page could not be found").count();
  expect(
    missing,
    `${route} rendered the 404 PAGE — the sweep would have measured an error page and passed. ` +
      `(Note: it answers HTTP 200, so no status check can see this.)`,
  ).toBe(0);

  expect(
    new URL(page.url()).pathname,
    `${route} redirected — the sweep would have measured a DIFFERENT ROOM and passed`,
  ).toBe(route);
}

/**
 * Wait until the page has finished arriving.
 *
 * Axe composites a foreground colour through every ancestor's opacity, so a page caught mid-fade
 * reports colours that no reader ever sees — and reports them as failures. This is the difference
 * between measuring the palette and measuring the animation. See the header.
 */
async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".route-fade, .content-fade")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
}

test.describe("accessibility", () => {
  test("the login wall itself is clean — it is the one page a reader meets first", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  /**
   * Sweep one room in one theme. Shared by the always-there rooms and the seeded ones, so both get
   * the same `open()` proof that the room actually arrived.
   */
  async function sweepRoom(page: Page, context: BrowserContext, theme: string, route: string) {
    await signIn(page);
    await context.addCookies([{ name: THEME_COOKIE, value: theme, url: "http://127.0.0.1:3210" }]);
    await open(page, route);
    await settle(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Name the offending node, not just the rule. The first version of this gate printed
    // "nested-interactive (1 nodes)" and nothing else, which tells the reader that something,
    // somewhere on a page of a hundred elements, is wrong — and leaves them to find it. A gate
    // that fires without saying where is only half a gate. For a contrast failure the summary
    // carries the measured foreground, background and ratio, which is the whole diagnosis.
    expect(
      serious.map(
        (v) =>
          `${v.id} (${v.nodes.length} nodes): ${v.help}\n${v.nodes
            .map((n) => `      at ${n.target.join(" ")}\n      ${n.html}\n      ${(n.failureSummary ?? "").replace(/\s+/g, " ").trim()}`)
            .join("\n")}`,
      ),
      `serious/critical accessibility violations on ${route} (${theme})`,
    ).toEqual([]);
  }

  const label = (theme: string) => (theme === "light" ? "Morning" : "Midnight");

  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`${route} has no serious or critical violations — ${label(theme)}`, async ({
        page,
        context,
      }) => {
        await sweepRoom(page, context, theme, route);
      });
    }

    for (const route of SEEDED_ROUTES) {
      test(`${route} has no serious or critical violations — ${label(theme)} (seeded)`, async ({
        page,
        context,
      }) => {
        test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
        await sweepRoom(page, context, theme, route);
      });
    }
  }
});
