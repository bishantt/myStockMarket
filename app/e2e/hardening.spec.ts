import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./session";

import { sweptBy, type Sweep } from "../lib/routes";

/**
 * hardening.spec.ts — the sweeps (R6, §7.1). Everything here is a rule that applies to EVERY route, exactly
 * the kind a per-page test never catches: a 38px tap target or an input that zooms iOS in and never back
 * out does not break a page, it just makes the app quietly worse on a phone. So the sweep walks every route
 * and checks every control.
 */

/**
 * Every route a reader can reach — read from lib/routes-manifest.json, the ONE list of rooms (G3). The sweep
 * is only as honest as this list, and a route left out is a gap that quietly becomes permanent because
 * nothing fails: /news shipped in N5 (the densest room for the 44px rule) and this sweep did not look at it
 * until N7. The manifest owns the list now, and routes-manifest.test.ts reds the unit suite the moment a
 * page.tsx has no entry. THE ONE ROUTE NOT IN THE MANIFEST: /styleguide is not a product room (no reader
 * opens it, argued in the exemption list), but it IS the densest control surface in the repo — one of every
 * button, input and disclosure — so this file sweeps it (best target for touch/scroll) while a11y.spec.ts
 * does not (worst target for an accessibility sweep of "rooms"). A real difference, preserved on purpose.
 */
/**
 * Two sweeps live here and are separate rules, so they read the manifest separately. They walk the same
 * rooms today, but deriving both from one list would make the manifest's `sweeps` field a lie the first time
 * a room asked for one sweep and not the other — a field nothing reads is a measurement not being taken.
 */
const always = (sweep: Sweep) => sweptBy(sweep).filter((room) => !room.seeded).map((room) => room.path);
const seeded = (sweep: Sweep) => sweptBy(sweep).filter((room) => room.seeded).map((room) => room.path);

const ROUTES = [...always("touch"), "/styleguide"];
const SCROLL_ROUTES = [...always("scroll"), "/styleguide"];

/**
 * Rooms that only EXIST when the database is seeded (N7). Ask for a story by a cluster id that is not there
 * and the route calls `notFound()`, so an unseeded sweep measures the 404 page and passes (see `open()` for
 * the recording, and why the status code cannot tell you this). The manifest's `seeded` flag draws the line.
 */
const SEEDED_ROUTES = seeded("touch");
const SEEDED_SCROLL_ROUTES = seeded("scroll");

/**
 * Open a room, and PROVE it is the room — not an error page, not the login wall (N7). These sweeps measure
 * whatever is on screen: a 404 puts the error page under the ruler (no controls under 44px, no sideways
 * scroll — passes) while the room it stands for is never looked at. THE STATUS CODE IS NOT THE WITNESS: a
 * `notFound()` inside a statically-generated route is served as 200 with "404 …" in the body (only an
 * unmatchable path gets a real 404), so the body is the only honest witness, and the body is what this reads.
 */
async function open(page: Page, route: string) {
  await page.goto(route);

  const missing = await page.getByText("This page could not be found").count();
  expect(
    missing,
    `${route} rendered the 404 PAGE — this sweep would have measured an error page and passed. ` +
      `(Note: it answers HTTP 200, so no status check can see this.)`,
  ).toBe(0);

  expect(
    new URL(page.url()).pathname,
    `${route} redirected — this sweep would have measured a DIFFERENT ROOM and passed`,
  ).toBe(route);
}

test.describe("touch targets (phone)", () => {
  test.skip(({ isMobile }) => !isMobile, "phone project only");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * Measure every control in one room. Returns the offenders AND the count it looked at, because a sweep
   * that measured nothing must not report success — the lesson the 16px rule learned, applied here first.
   */
  async function measureTargets(page: Page, route: string) {
      await open(page, route);

      // Wait for the LAYOUT to settle, the only thing this sweep depends on — a control's size is not final
      // until its text is in its real font. This used to wait for "networkidle", which stopped working at F1:
      // every room is static now, so the router prefetches on-screen links as the browser idles and the
      // network never goes quiet on busy pages. Fonts are the honest wait; a button measured mid-swap is
      // measured at the wrong width. (Waiting on the tab bar would hang /styleguide, which has none.)
      await page.waitForLoadState("load");
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      return await page.evaluate(() => {
        const MIN = 44;
        const offenders: string[] = [];
        let swept = 0;

        const controls = document.querySelectorAll<HTMLElement>(
          "a, button, [role=button], summary, input:not([type=hidden]), select, textarea",
        );

        for (const el of controls) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue; // not rendered at this breakpoint

          swept += 1;

          /*
           * THE INLINE EXCEPTION, a real one, not a dodge. WCAG 2.5.8 exempts a target "in a sentence or
           * block of text": a glossary term inside a paragraph has its height set by the LINE, and padding it
           * to 44px would break the paragraph for no gain (a reader taps the word where it is). This app leans
           * on that deliberately (the dotted-underline glossary terms only work inline). Two-part, and BOTH
           * halves needed: the element must participate in a line box (a <button> defaults to inline-block, so
           * checking only `inline` exempted nothing) AND be inside running text (an inline-block button in a
           * toolbar gets its 44px).
           */
          const display = getComputedStyle(el).display;
          const inLineBox = display.startsWith("inline");
          /*
           * `figcaption` joined this list in N2 — a real omission corrected, not a loophole. The chart's
           * "Chart by TradingView" attribution is a link inside a sentence (exactly WCAG 2.5.8's case), and
           * padding it to 44px would break the caption for no gain; the list simply never named the element it
           * lives in. (It surfaced now because it had been passing VACUOUSLY: the chart is code-split, so on a
           * slower run the figcaption did not exist and the sweep found no link — a guard that only fails when
           * the page is fast is not a guard.)
           */
          const inRunningText =
            el.closest("p, h1, h2, h3, h4, li, dd, blockquote, span, figcaption") !== null;
          if (inLineBox && inRunningText) continue;

          /*
           * THE LABELLED-CONTROL EXCEPTION. A native checkbox is 14px and cannot be made 44px without scaling
           * it into something else — but clicking its LABEL activates it, so the real target is the label, and
           * the label is 44px. The rule: the control passes if the thing a thumb hits is big enough; if the
           * enclosing label is under 44px too, this exempts nothing and the failure still fires.
           */
          const label = el.closest("label");
          if (label !== null && label.getBoundingClientRect().height >= MIN - 0.5) continue;

          if (box.height < MIN - 0.5) {
            offenders.push(
              `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} ` +
                `— ${Math.round(box.width)}×${Math.round(box.height)} — "${(el.textContent ?? "").trim().slice(0, 30)}"`,
            );
          }
        }
        return { offenders, swept };
      });
  }

  /** Assert the room's controls, having first proved there WERE controls. */
  async function checkTargets(page: Page, route: string) {
    const { offenders, swept } = await measureTargets(page, route);

    expect(
      swept,
      `the sweep measured NO controls at all on ${route} — every room in this app has at least a ` +
        `tab bar, so finding none means the page did not render, and the rule passed over an empty ` +
        `screen. A sweep that swept nothing is a failure, not a pass.`,
    ).toBeGreaterThan(0);

    expect(offenders, `controls below 44px tall on ${route}`).toEqual([]);
  }

  for (const route of ROUTES) {
    test(`every control on ${route} is at least 44px`, async ({ page }) => {
      await checkTargets(page, route);
    });
  }

  for (const route of SEEDED_ROUTES) {
    test(`every control on ${route} is at least 44px (seeded)`, async ({ page }) => {
      test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
      await checkTargets(page, route);
    });
  }

  /**
   * The iOS zoom rule (§7.1) — REPAIRED IN N2, broken in both directions at once. The rule is real: focusing
   * a TEXT-ENTRY field under 16px makes Safari zoom the viewport in and NOT back out, stranding the reader at
   * 1.3x. The fix is the font size, never a maximum-scale lock (pinch-zoom is a right, not an annoyance).
   * WHAT THIS TEST GOT WRONG, TWICE. 1. IT COULD PASS WITHOUT LOOKING: /paper's ticket lives behind a Suspense
   * boundary (useSearchParams, cannot prerender), so `page.goto()` resolved before it hydrated, the sweep
   * found ZERO fields, and reported success — "passing" on the page whose form is the reason the rule exists;
   * any timing change flips it. It now WAITS for the form and asserts it found fields. 2. IT CRIED WOLF on
   * controls iOS does not zoom for: it measured the segmented radios (13.5px), but iOS zooms only on a field
   * that summons a KEYBOARD, and a radio summons none. The selector now names the fields iOS actually zooms for.
   */
  test("every text-entry field renders at 16px or more, so iOS never zooms in", async ({ page }) => {
    // The field types that summon a keyboard, and therefore zoom. Radios, checkboxes, buttons,
    // ranges, colours and file pickers do not — they have no caret and no keyboard.
    const ZOOMS = [
      "text",
      "email",
      "password",
      "number",
      "search",
      "tel",
      "url",
      "date",
      "datetime-local",
      "month",
      "week",
      "time",
    ];

    for (const route of ["/paper", "/settings", "/login"]) {
      await page.goto(route);

      // The form must actually BE here before we claim anything — what stops the sweep passing over an empty
      // page. /paper's ticket hydrates behind a Suspense boundary, so "the document loaded" is not "the form
      // exists": wait for a real text-entry field to be attached, the thing this test is about.
      await page.waitForLoadState("load");
      await page
        .locator('input[type="text"], input[type="password"], input[type="number"], textarea, select')
        .first()
        .waitFor({ state: "attached", timeout: 15_000 });

      const { offenders, swept } = await page.evaluate((zooms) => {
        const offenders: string[] = [];
        let swept = 0;

        const fields = document.querySelectorAll<HTMLElement>("input, textarea, select");
        for (const field of fields) {
          const type = (field.getAttribute("type") ?? "text").toLowerCase();
          const isTextEntry =
            field.tagName === "TEXTAREA" || field.tagName === "SELECT" || zooms.includes(type);
          if (!isTextEntry) continue;

          swept += 1;
          const size = parseFloat(getComputedStyle(field).fontSize);
          if (size < 16) {
            offenders.push(`${field.getAttribute("name") ?? field.tagName} at ${size}px`);
          }
        }
        return { offenders, swept };
      }, ZOOMS);

      expect(
        swept,
        `the sweep found NO text-entry fields on ${route} — it measured nothing and would have ` +
          `reported success. That is how this guard silently stopped working.`,
      ).toBeGreaterThan(0);

      expect(offenders, `text-entry fields under 16px on ${route} — iOS will zoom and stay zoomed`).toEqual([]);
    }
  });
});

test.describe("no page scrolls sideways, anywhere", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  async function checkOnAxis(page: Page, route: string) {
    await open(page, route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
  }

  for (const route of SCROLL_ROUTES) {
    test(`${route} stays on-axis`, async ({ page }) => {
      await checkOnAxis(page, route);
    });
  }

  for (const route of SEEDED_SCROLL_ROUTES) {
    test(`${route} stays on-axis (seeded)`, async ({ page }) => {
      test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
      await checkOnAxis(page, route);
    });
  }
});

/**
 * THE 360px SWEEP (PD4, §7.3) — the narrowest width this product honors. The sweep above runs at each
 * project's own viewport, and `phone` is a Pixel 7 at 412px, a comfortable phone; 360px is not (a Galaxy
 * S-series in portrait, essentially every budget Android), and it is where a layout that merely FITS at 412
 * starts to spill. It gets ONE test rather than one-per-room, deliberately: the count is the point — a sweep
 * that measured nothing reports success (the 16px lesson), so this walks the rooms, counts them, and refuses
 * to pass unless it visited the whole route map. WHY NO 360 BASELINE: pixel truth costs a photograph per room
 * per theme, and one width is enough when the other is asserted behaviorally — 412 is photographed, 360 is
 * measured, and overflow is a NUMBER (`scrollWidth - clientWidth`), not a picture.
 */
test.describe("the phone never scrolls sideways at 360px either", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("every room stays on-axis at 360 — and the sweep proves it swept them", async ({ page }, testInfo) => {
    // The phone project only: the other three are desk widths, and resizing one to 360 would measure a phone
    // layout while pretending to be a desktop.
    test.skip(testInfo.project.name !== "phone", "the 360 sweep is a phone-project rule");

    await signIn(page);

    /*
     * The rooms this run can HONESTLY sweep. The seeded rooms only exist when the database is seeded; without
     * it they 404 and `open()` correctly fails rather than measure an error page. CI seeds, so CI sweeps all.
     */
    const seededAvailable = process.env.MSM_SEEDED === "1";
    const expected = seededAvailable ? [...SCROLL_ROUTES, ...SEEDED_SCROLL_ROUTES] : SCROLL_ROUTES;

    const offenders: string[] = [];
    let swept = 0;

    for (const route of expected) {
      await open(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      swept += 1;
      // A 1px allowance for sub-pixel rounding, the same tolerance the sweep above uses. Anything
      // more is a real spill: something in the room is wider than the phone holding it.
      if (overflow > 1) offenders.push(`${route} (+${overflow}px)`);
    }

    // THE SWEEP PROVES IT SWEPT. Both halves matter: the first catches a loop that visited nothing, the second
    // a route list that quietly shrank away from the manifest — how /news went two tagged phases unswept.
    expect(swept, "the 360 sweep visited NO rooms — it measured nothing and would have passed").toBeGreaterThan(0);
    expect(
      swept,
      `the 360 sweep visited ${swept} rooms but its route list holds ${expected.length}`,
    ).toBe(expected.length);

    if (seededAvailable) {
      const rooms = sweptBy("scroll").length;
      expect(
        swept,
        `the 360 sweep visited ${swept} rooms; the manifest lists ${rooms} rooms carrying the scroll ` +
          `sweep. A room nobody measures is a room that can break in silence.`,
      ).toBeGreaterThanOrEqual(rooms);
    }

    expect(offenders, "rooms that scroll sideways at 360px").toEqual([]);
  });
});
