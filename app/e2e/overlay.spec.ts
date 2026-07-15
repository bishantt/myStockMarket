import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The detail sheet — the @modal overlay (POLISH-AND-DEPTH-PLAN Part 11, PD9).
 *
 * THE ACCEPTANCE TESTS ARE THE SPEC (11.3). On the phone, a story or a ticker opens OVER the live
 * room and dismisses back to EXACTLY where the reader was — same scroll, same filters, focus returned
 * to the control that launched it. That restoration is only free because the room never unmounts: the
 * intercepting route fills the @modal slot while the room stays put underneath, and every dismissal is
 * a `router.back()` that pops the history entry the tap pushed. So the load-bearing assertions here
 * are the ones about what DID NOT change — the feed's scroll offset, its active filter — after the
 * sheet came and went five different ways.
 *
 * And E9's deep-link truth: reload while the sheet is open and the STANDALONE page renders in its
 * place, content-identical, because both are literally the same body component (StoryPageBody /
 * TickerPageBody). The unit suite pins that they share the component; this pins that the two DOMs
 * carry the same words.
 *
 * A PHONE SPEC by nature — the sheet is the phone presentation, and the overscroll pull is a touch
 * gesture. The beforeEach skips any other project so a desktop leg cannot mis-measure it.
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Open a seeded story from the feed and return the launcher link, so the caller can assert focus
 * comes home to it. `viaKeyboard` focuses the card link and presses Enter — the realistic path for
 * the focus-restoration claim, which only has meaning for a keyboard user (a mouse has no focus to
 * lose). The SMCI story ranks third, so opening it requires a scroll, which is exactly what the
 * scroll-preservation assertions need.
 */
async function openStory(page: Page, opts: { viaKeyboard?: boolean } = {}): Promise<Locator> {
  const link = page
    .getByTestId("news-row")
    .filter({ hasText: "Super Micro" })
    .first()
    .getByRole("link")
    .first();
  await link.scrollIntoViewIfNeeded();
  if (opts.viaKeyboard) {
    await link.focus();
    await link.press("Enter");
  } else {
    await link.click();
  }
  await expect(page.getByRole("dialog")).toBeVisible();
  return link;
}

/**
 * Dispatch a from-the-top downward pull on the sheet's scroll container (the overscroll gesture).
 *
 * The gesture only means "dismiss" when it begins AT THE TOP, so we first return the container to
 * scrollTop 0 — exactly what a reader does: scroll back up, then keep pulling. Then a real touch
 * drag downward, well past the 90px threshold.
 */
async function overscrollPull(page: Page) {
  const scroller = page.getByTestId("overlay-scroll");
  await scroller.evaluate((el) => el.scrollTo(0, 0));
  await scroller.evaluate((el) => {
    const at = (y: number) =>
      new Touch({ identifier: 1, target: el, clientX: 100, clientY: y });
    const fire = (type: string, y: number, ended = false) =>
      el.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: ended ? [] : [at(y)],
          targetTouches: ended ? [] : [at(y)],
          changedTouches: [at(y)],
        }),
      );
    // Begin at the very top (scrollTop 0) and pull down well past the 90px threshold.
    fire("touchstart", 300);
    fire("touchmove", 440);
    fire("touchend", 440, true);
  });
}

/** The five sanctioned ways out (11.2), each closing a sheet that is currently open. */
const DISMISSALS: Array<{ name: string; run: (page: Page) => Promise<unknown> }> = [
  {
    name: "the ✕ button",
    run: (page) => page.getByRole("dialog").getByRole("button", { name: "Close" }).click(),
  },
  {
    name: "the Escape key",
    run: (page) => page.keyboard.press("Escape"),
  },
  {
    name: "a scrim tap",
    run: async (page) => {
      // The sheet is 92dvh from the bottom, so the top strip of the screen is scrim. Tap it.
      const width = page.viewportSize()!.width;
      await page.touchscreen.tap(width / 2, 12);
    },
  },
  {
    name: "the back button",
    run: (page) => page.goBack(),
  },
  {
    name: "an overscroll-past-top pull",
    run: (page) => overscrollPull(page),
  },
];

test.describe("The detail sheet — @modal restoration (PD9)", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the sheet is the phone presentation");
    await signIn(page);
  });

  test("a story opens OVER the live feed — the room stays put, the URL is the story's own", async ({
    page,
  }) => {
    await page.goto("/news");
    const launcher = page
      .getByTestId("news-row")
      .filter({ hasText: "Super Micro" })
      .first()
      .getByRole("link")
      .first();
    await launcher.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore, "the SMCI card should sit far enough down to need a scroll").toBeGreaterThan(0);

    await launcher.click();

    // The sheet is a modal dialog: Radix moves focus to the first focusable control (the ✕) and
    // traps it inside — the visible proof that the focus trap, scroll lock and inert room are active.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(page).toHaveURL(/\/news\/nc-/);

    // The feed is STILL MOUNTED behind the sheet, and opening it did not scroll the room.
    await expect(page.getByTestId("news-count")).toBeAttached();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  for (const dismissal of DISMISSALS) {
    test(`dismissing by ${dismissal.name} lands the reader back exactly where they were`, async ({
      page,
    }) => {
      await page.goto("/news");
      const launcher = await scrolledLauncher(page);
      const scrollBefore = await page.evaluate(() => window.scrollY);

      await launcher.focus();
      await launcher.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();

      // Scroll INSIDE the sheet — this must not disturb the feed behind it.
      await page.getByTestId("overlay-scroll").evaluate((el) => el.scrollTo(0, 200));

      await dismissal.run(page);

      // Back on the feed, and nothing moved: URL, scroll offset, and keyboard focus all restored.
      await expect(page).toHaveURL("/news");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
      await expect(launcher).toBeFocused();
    });
  }

  test("an active filter survives the sheet — the feed's client state is never unmounted", async ({
    page,
  }) => {
    await page.goto("/news");
    await page.getByRole("button", { name: "FDA", exact: true }).click();
    await expect(page.getByTestId("news-count")).toHaveText("1 catalyst · FDA");

    // Open the one FDA story, then dismiss. The filter is client state in the never-unmounted feed.
    const fda = page
      .getByTestId("news-lead")
      .filter({ hasText: "FDA approves" })
      .getByRole("link")
      .first();
    await fda.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("news-count")).toHaveText("1 catalyst · FDA");
  });

  test("reloading while the sheet is open renders the STANDALONE page, content-identical (E9)", async ({
    page,
  }) => {
    await page.goto("/news");
    await openStory(page);

    // The sheet's headline, before the reload.
    const sheetHeading = await page.getByRole("dialog").getByRole("heading", { level: 1 }).innerText();

    await page.reload();

    // The deep-link truth: no dialog, same URL, the same story rendered as a full page.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/news\/nc-/);
    const pageHeading = page.getByRole("heading", { level: 1 });
    await expect(pageHeading).toBeVisible();
    expect(await pageHeading.innerText()).toBe(sheetHeading);
    // A block only the full anatomy carries, proving the whole body rendered — not a stub.
    await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
  });

  /**
   * The sheet's OWN touch targets (PD10, Part 12 · PD10 item 1).
   *
   * The sheet is not a room, so hardening.spec's manifest sweep never puts a ruler on its controls.
   * So we open it and measure them here — the one place that OPENS the overlay. The chrome (✕,
   * grabber, scroll container) is one component (DetailOverlay), identical for a story and a ticker,
   * so measuring one sheet measures both; the axe pass in a11y.spec opens both bodies for the
   * content-accessibility question, which is where the two differ.
   *
   * WHAT THE 44px RULE ACTUALLY BINDS, and the grabber decision it forces. The rule (WCAG 2.5.8, and
   * this app's own 44px sweep) is about ANNOUNCED interactive targets. The sheet has exactly one: the
   * ✕ (`Dialog.Close`, `size-11`). The grabber is `aria-hidden` and carries no role, no handler and
   * no announced name — it is a visual hint that the sheet can be pulled, not a target. The pull
   * gesture itself rides the SCROLL CONTAINER (`overlay-scroll`), whose hit area is the whole sheet
   * body — the operative pull target, and it dwarfs 44px. So this asserts the ✕ ≥44px, proves the
   * grabber is decorative rather than a mis-sized target, and measures the pull surface. Padding the
   * decorative pill to 44px to satisfy a rule it does not owe would be a green light wired to nothing
   * (DECISIONS 2026-07-15). The measured numbers are recorded in docs/pd-evidence/pd10-hardening.md.
   */
  test("the open sheet's own touch targets pass — the ✕ and the pull surface (PD10)", async ({
    page,
  }) => {
    await page.goto("/news");
    await openStory(page);

    const dialog = page.getByRole("dialog");

    // The ✕ — the sheet's one announced interactive control. Both axes ≥44px (measured 44×44).
    const close = dialog.getByRole("button", { name: "Close" });
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.width, "the ✕ close control width").toBeGreaterThanOrEqual(44 - 0.5);
    expect(closeBox.height, "the ✕ close control height").toBeGreaterThanOrEqual(44 - 0.5);

    // The grabber is a decorative hint, NOT a target — proven aria-hidden, so the 44px target-size
    // rule (which binds announced interactive controls) does not reach it. Measured 410×24: full
    // width, a short pill. It is not padded to 44px because doing so would gate a rule it does not
    // owe and shift the phone sheet by 20px for no functional gain (DECISIONS 2026-07-15).
    const grabber = page.getByTestId("sheet-grabber");
    await expect(grabber).toHaveAttribute("aria-hidden", "true");

    // The pull-dismiss surface — the scroll container the touch handlers ride. THIS is the target a
    // reader actually pulls, and it is the whole sheet body (measured 410×746), far past 44px.
    const scroller = page.getByTestId("overlay-scroll");
    const scrollBox = (await scroller.boundingBox())!;
    expect(scrollBox.height, "the pull-dismiss surface height").toBeGreaterThanOrEqual(44);
    expect(scrollBox.width, "the pull-dismiss surface width").toBeGreaterThanOrEqual(44);
  });

  test("a ticker chip opens the instrument sheet over its room, and dismissing restores it", async ({
    page,
  }) => {
    // A room with a real TickerChip DOOR — the standalone story page's affected-names table. (The
    // scans rows use LABEL chips: the whole row is the link, drift rule 26.) Hard-load the story, then
    // the tap on a ticker door is a soft nav the @modal slot intercepts into a sheet over the story.
    await page.goto("/news/nc-fda-nonopioid");
    const chip = page.locator('a[href^="/ticker/"]').first();
    await expect(chip).toBeVisible();
    await chip.scrollIntoViewIfNeeded();
    const href = await chip.getAttribute("href");
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await chip.focus();
    await chip.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(page).toHaveURL(href!);

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL("/news/nc-fda-nonopioid");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(chip).toBeFocused();
  });
});

/** Scroll the SMCI launcher into view and return it, asserting the scroll is genuinely non-zero. */
async function scrolledLauncher(page: Page): Promise<Locator> {
  const link = page
    .getByTestId("news-row")
    .filter({ hasText: "Super Micro" })
    .first()
    .getByRole("link")
    .first();
  await link.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  return link;
}
