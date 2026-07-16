import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./session";

/**
 * The control room, end to end (CC7, plan 4.6 — was N6, plan 8.7).
 *
 * CC7 turned the flat panel into a TABLE of the Desk's three schedules plus a per-row detail sheet; the
 * manual modes are actions INSIDE the sheets, not rows. So the table is informative from the database
 * alone (cadence, next run, last run) with or without a GitHub token, and the run-now controls live in
 * the sheets — which is where these tests go to find them.
 *
 * GitHub is mocked AT THE ROUTE BOUNDARY — Playwright intercepts `api.github.com` — so this proves the
 * whole app-side path (press → dispatch → recover the run id → poll → resolve → the sheet says so)
 * without firing a real workflow on every CI run. The mock encodes what the real API actually does, which
 * is NOT what the plan said: POST .../dispatches → 204 No Content, EMPTY BODY, no run id. So the app
 * RECOVERS the run by matching its request id in the run's name, and these tests exercise that recovery.
 */

/** Open a pipeline's detail sheet by its → affordance. DataTable renders BOTH the desktop table and the
 *  phone card list into the DOM and hides one — so `:visible` is load-bearing (a `.first()` picks the
 *  hidden copy on the wrong layout and the click hangs). Returns the sheet dialog. */
async function openSheet(page: Page, pipelineName: string) {
  await page
    .getByRole("button", { name: `Open ${pipelineName} details` })
    .filter({ visible: true })
    .first()
    .click();
  return page.getByRole("dialog");
}

test.describe("The control room", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the unauthenticated status route 401s — it is behind the wall like everything else", async ({
    browser,
  }) => {
    // A fresh context: no session cookie. The proxy answers /api/* with a 401 JSON body rather than a
    // redirect, so the service worker can never cache a login page as data.
    const anonymous = await browser.newContext();
    const response = await anonymous.request.get("/api/pipeline/status");

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthenticated" });

    await anonymous.close();
  });

  test("the table renders every schedule from the database alone — never blank, token or not", async ({
    page,
  }) => {
    await page.goto("/settings#pipeline");

    const panel = page.getByRole("region", { name: "Pipeline" });
    await expect(panel).toBeVisible();

    // All three schedules, by name — informative with no GitHub token (P-2 is unprovisioned here).
    for (const name of ["Nightly full (Job A)", "Dawn refresh", "Evening briefing (Job B)"]) {
      await expect(panel.getByText(name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    // The full nightly's cadence reads DST-honestly, both seasons — the tested cron→ET computation.
    await expect(
      panel.getByText("Mon–Fri · ~6:37 PM EDT / 5:37 PM EST").filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("without a token, the sheet says so ONCE and offers no button it cannot honour", async ({
    page,
  }) => {
    // The e2e server carries no GH_DISPATCH_TOKEN (P-2 is unprovisioned), so this is the real state of
    // the deployed app today, not a contrived one.
    await page.goto("/settings#pipeline");
    const sheet = await openSheet(page, "Nightly full (Job A)");
    await expect(sheet).toBeVisible();

    // The reason is stated exactly once — not once per action. (The first control-room build printed it
    // on every row, which every test passed and one screenshot refuted immediately.)
    await expect(sheet.getByText(/Manual runs need a GitHub token/)).toHaveCount(1);
    // And no control pretends it could dispatch.
    await expect(sheet.getByRole("button", { name: "Run" })).toHaveCount(0);
  });

  test("`full` is never a dead end: it offers a control, or the sheet explains why it cannot", async ({
    page,
  }) => {
    /*
     * The invariant that survives every hour and every token state: THE READER IS NEVER LEFT WITH A
     * CONTROL THAT NEITHER WORKS NOR EXPLAINS ITSELF. In the Nightly full sheet the `full` action is
     * one of: a reason of its own (a C5 sentence), a Run button, or — runnable but tokenless — covered
     * by the sheet's one banner. (The old form of this test rotted with the hour CI ran; this is the
     * weaker, truer version.)
     */
    await page.goto("/settings#pipeline");
    const sheet = await openSheet(page, "Nightly full (Job A)");
    await expect(sheet).toBeVisible();

    const reason = await sheet
      .getByText(/Markets are open|weekend|markets are closed today|already succeeded/i)
      .count();
    const button = await sheet.getByRole("button", { name: "Run" }).count();
    const sheetExplains = await sheet.getByText(/Manual runs need a GitHub token/).count();

    expect(
      reason + button + sheetExplains,
      "the `full` action gave the reader NOTHING: no reason of its own, no button, and no sheet-level " +
        "explanation. A control that neither works nor says why is the one thing plan 8.1 forbids.",
    ).toBeGreaterThan(0);

    // And the honest pairing: a control that cannot run must never ALSO offer the button.
    if (reason > 0) expect(button, "an action that states why it cannot run must not also offer a button").toBe(0);
  });

  test("the Desk's freshness strip lands the reader ON the panel, not at the top of settings", async ({
    page,
  }) => {
    // The strip has linked to `/settings#pipeline` since N2 — including from its DEAD alert, the one a
    // reader follows when the pipeline is broken and they most need to get here.
    await page.goto("/settings#pipeline");

    const panel = page.getByRole("region", { name: "Pipeline" });
    await expect(panel).toBeVisible();
    await expect(page.locator("#pipeline")).toHaveCount(1);
  });

  test("a pipeline's sheet shows its depth: what it fetches, its stages, its recent runs", async ({
    page,
  }) => {
    await page.goto("/settings#pipeline");
    const sheet = await openSheet(page, "Nightly full (Job A)");
    await expect(sheet).toBeVisible();

    // The plan's sheet sections are all present, and the merged recent-runs list shows the seeded
    // scheduled record (the nightly wrote one `pipeline_run`).
    await expect(sheet.getByRole("heading", { name: "What it fetches" })).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Stages" })).toBeVisible();
    await expect(sheet.getByRole("heading", { name: /Recent runs/ })).toBeVisible();
    // tonight's degraded source is named, with the word (marketaux went degraded in the seed).
    await expect(sheet.getByText(/marketaux · degraded/)).toBeVisible();
  });
});

/**
 * The dispatch loop, with GitHub mocked at the route boundary. These need a token, so they inject one by
 * intercepting GitHub rather than by provisioning P-2 (the app decides "configured" from the env). They
 * are skipped otherwise, and the skip is honest — stated, not hidden.
 */
test.describe("The dispatch loop (GitHub mocked)", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
  test.skip(!process.env.GH_DISPATCH_TOKEN, "needs GH_DISPATCH_TOKEN set (P-2)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("press → dispatched → found → running → succeeded, and the sheet follows it", async ({ page }) => {
    const RUN_ID = 987654321;
    let dispatched = false;
    let polls = 0;

    // The dispatch: 204, EMPTY BODY. This is what the live API really does.
    await page.route("**/api.github.com/repos/**/dispatches", async (route) => {
      dispatched = true;
      await route.fulfill({ status: 204, body: "" });
    });

    // The runs list — how the app RECOVERS the id it was never given. The run's name carries the request
    // id, which is the whole reason the workflow sets `run-name:`.
    await page.route("**/api.github.com/repos/**/runs?**", async (route) => {
      const requestId = await currentRequestId(page);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workflow_runs: dispatched
            ? [
                {
                  id: RUN_ID,
                  name: `nightly-a · macro · ${requestId}`,
                  display_title: `nightly-a · macro · ${requestId}`,
                  status: "in_progress",
                  conclusion: null,
                  html_url: `https://github.com/bishantt/myStockMarket/actions/runs/${RUN_ID}`,
                },
              ]
            : [],
        }),
      });
    });

    // The run itself: in_progress for the first poll, then completed/success.
    await page.route(`**/api.github.com/repos/**/actions/runs/${RUN_ID}`, async (route) => {
      polls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: RUN_ID,
          status: polls > 1 ? "completed" : "in_progress",
          conclusion: polls > 1 ? "success" : null,
          html_url: `https://github.com/bishantt/myStockMarket/actions/runs/${RUN_ID}`,
        }),
      });
    });

    await page.goto("/settings#pipeline");
    // macro lives in the Dawn refresh sheet (the dawn cron IS macro mode).
    const sheet = await openSheet(page, "Dawn refresh");
    await sheet.getByRole("button", { name: "Run" }).click();

    // IT MUST LEAVE `available`. A button that fires and then looks exactly as it did before is the
    // silent failure this phase exists to prevent.
    await expect(sheet).toContainText(/requested|queued|running/i, { timeout: 20_000 });
    // And it must resolve, and SAY it resolved. The run appears in the recent-runs list with the WORD.
    await expect(page.getByText(/succeeded/i).first()).toBeVisible({ timeout: 60_000 });

    expect(dispatched).toBe(true);
  });

  test("a dispatch GitHub REFUSES writes no ledger row and burns no cap", async ({ page }) => {
    await page.route("**/api.github.com/repos/**/dispatches", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ message: 'Unexpected inputs provided: ["request_id"]' }),
      });
    });

    await page.goto("/settings#pipeline");
    const sheet = await openSheet(page, "Dawn refresh");
    await sheet.getByRole("button", { name: "Run" }).click();

    await expect(sheet).toContainText(/GitHub would not start the run/i, { timeout: 20_000 });
    // Nothing was requested, so nothing was spent (macro is 6/day).
    await expect(sheet).toContainText("6 of 6 left today");
  });
});

/**
 * The request id the app just generated, read back out of the page. The mock has to echo the SAME id in
 * the run's name, because matching it is the only way the app can find its run. Rather than guess it, we
 * read the ledger row the app wrote — which is exactly what the real GitHub would be echoing.
 */
async function currentRequestId(page: Page): Promise<string> {
  const response = await page.request.get("/api/pipeline/status");
  if (!response.ok()) return "unknown";
  const body = (await response.json()) as { runs?: Array<{ id: string }> };
  return body.runs?.[0]?.id ?? "unknown";
}
