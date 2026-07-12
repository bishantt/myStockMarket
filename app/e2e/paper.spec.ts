import { expect, test } from "@playwright/test";

/**
 * Journey 7 — the paper desk: the entry form, the sizing helper, and the cooling-off interstitial
 * that fires when an order follows a just-seen signal (plan §7 P6 acceptance). Behind the login wall.
 *
 * These assertions hold whether or not the ledger has trades in it, so this file needs no seeded
 * database. (It used to read a ledger that was always empty; since F0 the seed publishes six paper
 * trades, so in CI these journeys run against a populated ledger and must keep passing anyway.)
 */

const USER = "testuser";
const PASSWORD = "correct horse battery staple";

test.describe("The paper desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("the paper desk shows the cost mirror and the sizing helper", async ({ page }) => {
    await page.goto("/paper");
    await expect(page.getByRole("heading", { name: "Paper desk" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost mirror" })).toBeVisible();
    await expect(page.getByText(/Sizing helper/)).toBeVisible();
  });

  test("the cooling-off interstitial fires within the window of a viewed signal", async ({ page }) => {
    // Arrive as if from a setup card whose signal was just viewed (well inside the 30-minute window).
    const justNow = new Date(Date.now() - 60_000).toISOString();
    await page.goto(`/paper?symbol=DEMO&signalViewedAt=${encodeURIComponent(justNow)}`);

    // Side must be chosen explicitly since F4 — it has no default (ruling M9), and without one the
    // form will not submit at all. That is the rule working: this test used to pass by relying on a
    // pre-selected "buy", which is precisely the quiet nudge M9 removed.
    await page.getByRole("radio", { name: "Buy" }).click();
    await page.getByRole("spinbutton", { name: "Reference open" }).fill("100");
    await page.getByRole("button", { name: "Place paper trade" }).click();

    // It does not submit silently — the cooling-off dialog appears with a way to proceed or wait.
    await expect(page.getByRole("alertdialog", { name: "Cooling-off" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sit with it" })).toBeVisible();
  });
});

/**
 * The rebuilt ticket (APP-FEEL-PLAN §4.3).
 *
 * The load-bearing test in here is the doorway journey. The cooling-off pause has been built,
 * tested, and completely unreachable since P6: nothing in the product ever constructed the URL that
 * arms it — only the e2e test above did. The setup card's "Practice on paper →" link (ruling M10) is
 * its first real producer, and the journey below walks it exactly as a reader would.
 */
test.describe("The ticket", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("SIDE HAS NO DEFAULT — neither Buy nor Sell is pressed on arrival (M9)", async ({ page }) => {
    await page.goto("/paper");
    // The old form defaulted to "buy" on the one surface built to slow that decision down.
    await expect(page.getByRole("radio", { name: "Buy" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Sell (short)" })).not.toBeChecked();
    // A parameter, by contrast, keeps its default.
    await expect(page.getByRole("radio", { name: /Large \/ mid/ })).toBeChecked();
  });

  test("submitting without a side is refused, plainly", async ({ page }) => {
    await page.goto("/paper");
    await page.getByLabel("Symbol").fill("AAPL");
    await page.getByRole("spinbutton", { name: "Reference open" }).fill("210");
    await page.getByRole("button", { name: "Place paper trade" }).click();

    // Nothing was placed: the side control is required, and the browser refuses the submit.
    await expect(page.getByRole("radio", { name: "Buy" })).not.toBeChecked();
    await expect(page).toHaveURL(/\/paper/);
  });

  test("the symbol field suggests real instruments, and picking one fills it", async ({ page }) => {
    await page.goto("/paper");
    await page.getByLabel("Symbol").fill("aapl");

    // The Instrument table has held a name for every ticker since P1; the ticket finally asks it.
    // Lowercase on purpose: the search is case-insensitive on BOTH clauses, because a phone's
    // autocapitalize only sets the shift key — the reader can still type "aapl", and a case-sensitive
    // prefix match would fail to find AAPL while they are looking straight at it.
    // Wait for the option we actually mean, not merely for "an option": the search is debounced, so
    // the list can briefly still be showing the results for "aap" (AAPB, AAPC, …) when a naive
    // .first() clicks it.
    const option = page.getByRole("option").filter({ has: page.getByText("AAPL", { exact: true }) });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByLabel("Symbol")).toHaveValue("AAPL");
  });

  test("the quantity stepper steps, and its presets set the value without submitting", async ({ page }) => {
    await page.goto("/paper");
    // The spinbutton role, not getByLabel: the stepper's − and + carry aria-labels that CONTAIN the
    // word "quantity" ("Decrease quantity"), so a label lookup resolves to all three controls.
    const quantity = page.getByRole("spinbutton", { name: "Quantity" });
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(quantity).toHaveValue("11");

    await page.getByRole("button", { name: "50", exact: true }).click();
    await expect(quantity).toHaveValue("50");
    await expect(page).toHaveURL(/\/paper$/); // a preset chip must never submit the ticket
  });

  test("THE DOORWAY: a setup card leads to the ticket, and the cooling-off pause fires", async ({ page }) => {
    test.skip(process.env.MSM_SEEDED !== "1", "needs the seeded setup cards");

    // This is the journey the cooling-off mechanic was built for and never had. Open a setup card —
    // the reader is now looking at a base rate — and follow the practice doorway.
    await page.goto("/");
    const card = page.getByRole("region", { name: "Setup cards" }).locator("details").first();
    await card.locator("summary").click();

    await card.getByRole("button", { name: "Practice on paper →" }).click();

    // It lands on the ticket with the symbol prefilled and the signal's timestamp carried across.
    await expect(page).toHaveURL(/\/paper\?symbol=.*signalViewedAt=/);
    await expect(page.getByLabel("Symbol")).not.toHaveValue("");

    // And the ticket it lands on has NO side pre-selected (M10's third condition): a bullish card
    // must never deposit the reader on a pre-set Buy.
    await expect(page.getByRole("radio", { name: "Buy" })).not.toBeChecked();

    // Now place the trade immediately. THIS is the moment the pause exists for.
    await page.getByRole("radio", { name: "Buy" }).click();
    await page.getByRole("spinbutton", { name: "Reference open" }).fill("100");
    await page.getByRole("button", { name: "Place paper trade" }).click();

    await expect(page.getByRole("alertdialog", { name: "Cooling-off" })).toBeVisible();
    // "Sit with it" is the PRIMARY button — the one place in the app where the calm choice is loud.
    await expect(page.getByRole("button", { name: "Sit with it" })).toBeVisible();
  });

  test("the ledger's closed trades fold away, and every figure is formatted, not toFixed'd", async ({ page, isMobile }) => {
    test.skip(process.env.MSM_SEEDED !== "1", "needs the seeded ledger");
    // The <table> is the desktop rendering; the phone gets card-rows, and asking for a table there
    // finds nothing. (The phone rendering is covered by the scans card-row journey.)
    test.skip(!!isMobile, "the desktop table is what this asserts");
    await page.goto("/paper");

    // The closed book is behind a disclosure that states its own count (M2).
    await expect(page.getByText(/Closed trades/)).toBeVisible();

    // A loss renders with the WORD in the chip, not colour alone (P7) — and with a TRUE minus.
    await page.getByText(/Closed trades/).click();

    // Scoped to the desktop table: the DataTable renders BOTH the phone card-rows and the real table
    // into the DOM, and which one the reader sees is a CSS decision, so an unscoped match resolves to
    // the hidden one.
    const table = page.getByRole("table").filter({ hasText: "Realized" });
    await expect(table.getByText("loss").first()).toBeVisible();
    await expect(table.getByText("gain").first()).toBeVisible();
    await expect(table.getByText(/−77\.50/)).toBeVisible(); // U+2212, not a hyphen
  });
});
