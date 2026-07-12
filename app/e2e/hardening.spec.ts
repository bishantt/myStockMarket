import { expect, test, type Page } from "@playwright/test";

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

/** Every route a reader can reach. The sweep is only as honest as this list. */
const ROUTES = [
  "/",
  "/scans",
  "/paper",
  "/track-record",
  "/settings",
  "/academy",
  "/academy/glossary",
  "/academy/review",
  "/styleguide",
];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("touch targets (phone)", () => {
  test.skip(({ isMobile }) => !isMobile, "phone project only");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const route of ROUTES) {
    test(`every control on ${route} is at least 44px`, async ({ page }) => {
      await page.goto(route);

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

      const small = await page.evaluate(() => {
        const MIN = 44;
        const offenders: string[] = [];

        const controls = document.querySelectorAll<HTMLElement>(
          "a, button, [role=button], summary, input:not([type=hidden]), select, textarea",
        );

        for (const el of controls) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue; // not rendered at this breakpoint

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
          const inRunningText = el.closest("p, h1, h2, h3, h4, li, dd, blockquote, span") !== null;
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
        return offenders;
      });

      expect(small, `controls below 44px tall on ${route}`).toEqual([]);
    });
  }

  test("every form control renders at 16px or more, so iOS never zooms in", async ({ page }) => {
    // The iOS rule (§7.1): a focused input under 16px makes Safari zoom the viewport in — and it
    // does NOT zoom back out afterwards. The reader is left stranded at 1.3x on a page they now
    // have to pan around. The fix is the font size, never a maximum-scale lock: pinch-zoom is an
    // accessibility right, not an annoyance to design away.
    for (const route of ["/paper", "/settings", "/login"]) {
      await page.goto(route);

      const tooSmall = await page.evaluate(() => {
        const offenders: string[] = [];
        const fields = document.querySelectorAll<HTMLElement>(
          "input:not([type=hidden]), textarea, select",
        );
        for (const field of fields) {
          const size = parseFloat(getComputedStyle(field).fontSize);
          if (size < 16) offenders.push(`${field.getAttribute("name") ?? field.tagName} at ${size}px`);
        }
        return offenders;
      });

      expect(tooSmall, `inputs under 16px on ${route} — iOS will zoom and stay zoomed`).toEqual([]);
    }
  });
});

test.describe("no page scrolls sideways, anywhere", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const route of ROUTES) {
    test(`${route} stays on-axis`, async ({ page }) => {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    });
  }
});
