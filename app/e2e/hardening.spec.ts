import { expect, test, type Page } from "@playwright/test";

import { sweptBy, type Sweep } from "../lib/routes";

/**
 * hardening.spec.ts — the sweeps (R6, §7.1).
 *
 * Everything here is a rule that applies to EVERY route, which is exactly the kind of rule that a
 * per-page test never catches. A 38px tap target or an input that zooms iOS in and never zooms back
 * out does not break a page — it just makes the app quietly worse on a phone, in a way nobody
 * notices until they are standing on a train with one thumb.
 *
 * So the sweep walks every route and checks every control.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

/**
 * Every route a reader can reach — read from lib/routes-manifest.json, the ONE list of rooms (G3).
 *
 * The sweep is only as honest as this list, and it used to be hand-kept here. A route family left
 * out of a sweep is a gap that quietly becomes permanent, because nothing fails: /news shipped in
 * N5 — two horizontally-scrolling chip rows, a pagination control and a card grid of links, which
 * is the single densest room in the app for the 44px rule — and this sweep did not look at it until
 * N7. The manifest now owns the list, and lib/routes-manifest.test.ts reds the unit suite the moment
 * a `page.tsx` exists with no entry behind it.
 *
 * THE ONE ROUTE THAT IS NOT IN THE MANIFEST, and why it is named here by hand: /styleguide is not a
 * product room — no reader ever opens it — so it is deliberately absent from the manifest (argued in
 * routes-manifest.test.ts's exemption list). But it IS the densest control surface in the repo, one
 * of every button, input and disclosure the design system owns, on a single page. That makes it the
 * best possible target for a touch-target and sideways-scroll sweep, and the worst possible one for
 * an accessibility sweep of "rooms". So this file sweeps it and a11y.spec.ts does not — a real
 * difference between the two lists, preserved on purpose rather than smoothed away.
 */
/**
 * Two sweeps live in this file and they are separate rules, so they read the manifest separately.
 *
 * They happen to walk the same rooms today — every swept room carries all three sweeps. Deriving
 * both from one list would still work, and would quietly make the manifest's `sweeps` field a lie
 * the first time a room asked for one sweep and not the other. A field that nothing reads is a
 * measurement that is not being taken.
 */
const always = (sweep: Sweep) => sweptBy(sweep).filter((room) => !room.seeded).map((room) => room.path);
const seeded = (sweep: Sweep) => sweptBy(sweep).filter((room) => room.seeded).map((room) => room.path);

const ROUTES = [...always("touch"), "/styleguide"];
const SCROLL_ROUTES = [...always("scroll"), "/styleguide"];

/**
 * Rooms that only EXIST when the database is seeded (N7).
 *
 * Ask for a story by a cluster id that is not there and the route calls `notFound()`, so an unseeded
 * sweep measures the 404 page — and passes. See `open()` for the recording, and for why the status
 * code cannot tell you this.
 *
 * The manifest's `seeded` flag draws this line now, so a new seeded room cannot land in the
 * always-there list by accident.
 */
const SEEDED_ROUTES = seeded("touch");
const SEEDED_SCROLL_ROUTES = seeded("scroll");

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
 * These sweeps measure whatever is on the screen. A route that 404s puts the error page under the
 * ruler: it has no controls under 44px, it does not scroll sideways, and it passes every rule here
 * while the room it stands for is never looked at.
 *
 * THE STATUS CODE IS NOT THE WITNESS. The first version of this guard asserted `status === 200` and
 * still passed on a missing page. Recorded on this tree: `/news/nc-fed-hold` and
 * `/ticker/NOTAREALTICKER` both answer **HTTP 200 with "404 — This page could not be found" in the
 * body**, because a `notFound()` raised inside a statically-generated route is served as a 200; only
 * a path the router cannot match at all gets a real 404. The body is the only honest witness, so the
 * body is what this reads.
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
   * Measure every control in one room. Returns the offenders AND the number of controls it actually
   * looked at, because a sweep that measured nothing must not be allowed to report success — the
   * lesson the 16px rule below learned the hard way, applied here before it can happen again.
   */
  async function measureTargets(page: Page, route: string) {
      await open(page, route);

      // Wait for the LAYOUT to settle, which is the only thing this sweep actually depends on — it
      // measures the size of every control, and a control's size is not final until its text is in
      // its real font.
      //
      // This used to wait for "networkidle", and that stopped working at F1 — not because anything
      // broke, but because the cure worked. Every room is a static route now, so the router
      // prefetches the links on screen as the browser goes idle; the network keeps trickling, and
      // "500ms with nothing in flight" may simply never arrive. It timed out on the busiest pages.
      //
      // Fonts are the honest wait here. A button measured mid-swap, still in the fallback face, is a
      // button measured at the wrong width. (Waiting on the tab bar instead would have been wrong for
      // a different reason: /styleguide has no tab bar, so the sweep would hang on the one page whose
      // whole job is to show every control in the system.)
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
           * THE INLINE EXCEPTION, and it is a real one — not a way of dodging the rule.
           *
           * WCAG 2.5.8 exempts a target that sits "in a sentence or block of text", for a good
           * reason: a glossary term inside a paragraph has its height set by the LINE it lives on,
           * and padding it to 44px would break that paragraph — for no accessibility gain at all,
           * because a reader taps the word where the word is.
           *
           * This app leans on that exception deliberately: the dotted-underline glossary terms are
           * one of its better ideas, and they only work inline.
           *
           * The test is two-part, and BOTH halves are needed. The element has to participate in a
           * line box (a <button> defaults to inline-block, not inline — checking only for `inline`
           * silently exempted nothing and let the real offenders through), AND it has to actually
           * be inside running text. A button that is merely inline-block inside a toolbar is a
           * target like any other, and it gets its 44px.
           */
          const display = getComputedStyle(el).display;
          const inLineBox = display.startsWith("inline");
          /*
           * `figcaption` joined this list in N2, and it is a real omission being corrected, not a
           * loophole being opened.
           *
           * The chart's attribution reads "Chart by TradingView", with TradingView as the link. That
           * is a link inside a sentence — precisely the case WCAG 2.5.8's inline exception exists
           * for — and padding it to 44px would break the caption for no accessibility gain, because
           * a reader taps the word where the word is. The list simply never named the element that
           * caption lives in.
           *
           * (It surfaced now because it had been passing VACUOUSLY: the chart is code-split, so on a
           * slower run the figcaption did not exist yet and the sweep found no link to measure. A
           * guard that only fails when the page happens to be fast is not a guard.)
           */
          const inRunningText =
            el.closest("p, h1, h2, h3, h4, li, dd, blockquote, span, figcaption") !== null;
          if (inLineBox && inRunningText) continue;

          /*
           * THE LABELLED-CONTROL EXCEPTION.
           *
           * A native checkbox is 14px and cannot be made 44px without either scaling it into
           * something that no longer looks like a checkbox, or padding the row into absurdity. But
           * clicking its LABEL activates it — that is what a label is — so the real target is the
           * label, and the label is 44px.
           *
           * So the rule becomes: the control passes if the thing a thumb actually hits is big
           * enough. If the enclosing label is under 44px too, this exempts nothing and the failure
           * still fires, which is the whole point of measuring the label rather than assuming it.
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
   * The iOS zoom rule (§7.1) — REPAIRED IN N2, and it was broken in both directions at once.
   *
   * The rule itself is real: focusing a TEXT-ENTRY field under 16px makes Safari zoom the viewport
   * in, and it does NOT zoom back out. The reader is stranded at 1.3x on a page they now have to pan
   * around. The fix is the font size, never a maximum-scale lock — pinch-zoom is an accessibility
   * right, not an annoyance to design away.
   *
   * WHAT THIS TEST GOT WRONG, TWICE.
   *
   * 1. IT COULD PASS WITHOUT LOOKING AT ANYTHING. /paper's ticket lives behind a Suspense boundary
   *    (it reads useSearchParams, so it cannot prerender). `page.goto()` resolves before that island
   *    hydrates, so the sweep would query the DOM, find ZERO fields, iterate over nothing, and
   *    report success. It has been "passing" on the page whose form is the entire reason the rule
   *    exists. Perturbing the timing by a few milliseconds — any unrelated change — flips it. That
   *    is not a flake to retry; it is a guard that never ran.
   *
   *    So it now WAITS for the form and asserts it actually found fields. A sweep that swept nothing
   *    is a failure, not a pass.
   *
   * 2. IT CRIED WOLF ON CONTROLS iOS DOES NOT ZOOM FOR. It measured every `input`, including the
   *    segmented control's radios — which are 13.5px, the browser's default, and have been since F2.
   *    But iOS zooms on focusing a field that summons a KEYBOARD. A radio summons no keyboard; it
   *    cannot trigger the behaviour. Failing the build for it would have driven someone to "fix" a
   *    control that was never broken, in a way that made the design worse.
   *
   *    So the selector now names the fields iOS actually zooms for, and says why.
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

      // The form must actually BE here before we can claim anything about it. This is what stops the
      // sweep from passing over an empty page. /paper's ticket hydrates behind a Suspense boundary,
      // so "the document loaded" is not the same thing as "the form exists" — we wait for a real
      // text-entry field to be attached, which is the thing this test is about.
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
 * THE 360px SWEEP (PD4, §7.3) — the narrowest width this product honors.
 *
 * The sweep above already runs at every project's own viewport, and the `phone` project is a Pixel 7
 * at 412px. That is a comfortable phone. 360px is not: it is the width of a Galaxy S-series in
 * portrait and of essentially every budget Android sold, and it is the width at which a layout that
 * merely FITS at 412 starts to spill.
 *
 * It gets ONE test rather than one-per-room, and that is deliberate: the count is the point. A sweep
 * that measured nothing reports success — the lesson the 16px rule learned the hard way, and the
 * reason `measureTargets` returns a tally. So this walks the rooms itself, counts them, and refuses
 * to pass unless it actually visited the whole route map. A guard that cannot prove it looked is not
 * a guard.
 *
 * WHY THERE IS NO 360 BASELINE TO GO WITH IT. Pixel truth costs a photograph per room per theme, and
 * one width of it is enough when the other is asserted behaviorally: 412 is photographed, 360 is
 * measured. What only 360 can tell us is whether anything overflows, and overflow is a NUMBER —
 * `scrollWidth - clientWidth` — not a picture. Photographing it would buy a second opinion on a
 * question that already has an exact answer.
 */
test.describe("the phone never scrolls sideways at 360px either", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("every room stays on-axis at 360 — and the sweep proves it swept them", async ({ page }, testInfo) => {
    // The phone project only. The other three are desk widths, and resizing one of them to 360 would
    // measure a phone layout while pretending to be a desktop — a third opinion from a witness who
    // was not there.
    test.skip(testInfo.project.name !== "phone", "the 360 sweep is a phone-project rule");

    await signIn(page);

    /*
     * The rooms this run can HONESTLY sweep. The seeded rooms only exist when the database is seeded;
     * without it they 404, and `open()` would (correctly) fail rather than quietly measure an error
     * page. CI seeds, so CI sweeps all of them.
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

    // THE SWEEP PROVES IT SWEPT. Both halves matter: the first catches a loop that silently visited
    // nothing, the second catches a route list that quietly shrank away from the manifest — which is
    // exactly how /news went through two tagged phases with no sweep ever looking at it.
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
