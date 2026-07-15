import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./session";

/**
 * The control room, end to end (N6, plan 8.7).
 *
 * GitHub is mocked AT THE ROUTE BOUNDARY — Playwright intercepts `api.github.com` — so this proves
 * the whole app-side path (press → dispatch → recover the run id → poll → resolve → the panel says
 * so) without firing a real workflow on every CI run. The one thing a mock cannot prove, that the
 * real API behaves as we think, was verified by a live drill and is recorded in
 * docs/nc-evidence/n6-control.md.
 *
 * THE MOCK ENCODES WHAT THE REAL API ACTUALLY DOES, WHICH IS NOT WHAT THE PLAN SAID:
 *
 *   POST .../dispatches  ->  204 No Content, EMPTY BODY. No run id. None.
 *
 * That is recorded, not assumed (2026-07-13). The plan claimed the response carries a
 * `workflow_run_id`; GitHub's own REST docs claim it too; both are wrong. So the app has to RECOVER
 * the run by matching its request id in the run's name, and these tests exercise that recovery —
 * including the case where it never resolves, which is the one that could otherwise leave the reader
 * watching a spinner forever for a run that does not exist.
 */

/** The row for one action — a list item, located by its label. */
function actionRow(page: Page, label: string) {
  return page.getByRole("listitem").filter({ hasText: label }).first();
}

test.describe("The control room", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the unauthenticated status route 401s — it is behind the wall like everything else", async ({
    browser,
  }) => {
    // A fresh context: no session cookie. The proxy answers /api/* with a 401 JSON body rather than
    // a redirect, so the service worker can never cache a login page as data.
    const anonymous = await browser.newContext();
    const response = await anonymous.request.get("/api/pipeline/status");

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthenticated" });

    await anonymous.close();
  });

  test("without a token, the panel says so ONCE and offers no button it cannot honour", async ({
    page,
  }) => {
    // The e2e server carries no GH_DISPATCH_TOKEN (P-2 is unprovisioned), so this is the real state
    // of the deployed app today, not a contrived one.
    await page.goto("/settings#pipeline");

    const panel = page.getByRole("region", { name: "Pipeline" });
    await expect(panel).toBeVisible();

    // The reason is stated exactly once — not once per row. (The first build printed it five times,
    // which every test passed and a screenshot immediately refuted.)
    await expect(panel.getByText(/Manual runs need a GitHub token/)).toHaveCount(1);

    // And no row pretends it could dispatch.
    await expect(panel.getByRole("button", { name: "Run" })).toHaveCount(0);
  });

  test("`full` is never a dead end: it offers a control, or the panel explains why it cannot", async ({
    page,
  }) => {
    /*
     * THIS TEST USED TO ROT WITH THE HOUR CI HAPPENED TO RUN, and N7 is where it finally went off.
     *
     * It asserted that the `full` ROW must always contain one of the five reasons. That passed at the
     * nc-6 tag — whose CI ran at 19:22 UTC, 3:22pm ET, while the market was OPEN, so the row truthfully
     * said "Markets are open". N7's CI ran at 20:39 UTC, 4:39pm ET, AFTER THE CLOSE — and after the
     * close on a weekday with no successful run yet, `full` is genuinely RUNNABLE. It has no reason to
     * give, because there is nothing stopping it. Nobody changed a line; the clock moved, and a green
     * test turned red.
     *
     * WORSE, IT CONTRADICTED N6'S OWN RULING. The missing-token sentence is deliberately printed ONCE,
     * above the rows — "the STATE is per-row, the REASON is per-panel" — because printing a shared
     * reason five times is not five times as honest, it is five times as long. So a row that is
     * runnable-but-for-the-token correctly says nothing, and the test demanded it repeat the panel.
     *
     * The invariant that actually matters is weaker and truer: THE READER IS NEVER LEFT WITH A ROW
     * THAT NEITHER WORKS NOR EXPLAINS ITSELF. That holds in all three worlds, at any hour:
     *
     *   1. the row cannot run for a reason of its own  → it states that reason (a C5 sentence);
     *   2. the row can run and we hold a token         → it offers a Run button;
     *   3. the row can run and we do NOT hold a token  → the PANEL states that, once, above.
     */
    await page.goto("/settings#pipeline");

    const panel = page.getByRole("region", { name: "Pipeline" });
    const full = actionRow(page, "Run tonight's full pipeline");
    await expect(full).toBeVisible();

    const reason = await full
      .getByText(/Markets are open|weekend|markets are closed today|already succeeded/i)
      .count();
    const button = await full.getByRole("button", { name: "Run" }).count();
    const panelExplains = await panel.getByText(/Manual runs need a GitHub token/).count();

    expect(
      reason + button + panelExplains,
      "the `full` row gave the reader NOTHING: no reason of its own, no button to press, and no " +
        "panel-level explanation. A control that neither works nor says why is the one thing plan " +
        "8.1 forbids.",
    ).toBeGreaterThan(0);

    // And the honest pairing: a row that cannot run must never ALSO offer the button.
    if (reason > 0) expect(button, "a row that states why it cannot run must not also offer a button").toBe(0);
  });

  test("the Desk's freshness strip lands the reader ON the panel, not at the top of settings", async ({
    page,
  }) => {
    // The strip has linked to `/settings#pipeline` since N2 — including from its DEAD alert, the one
    // a reader follows when the pipeline is broken and they most need to get here. There was no
    // element with that id until N6, so the fragment matched nothing and the browser quietly dropped
    // them at the top of the page, looking at a form for adding a stock to a watchlist.
    await page.goto("/settings#pipeline");

    const panel = page.getByRole("region", { name: "Pipeline" });
    await expect(panel).toBeVisible();
    // The anchor resolves: the element the fragment names actually exists.
    await expect(page.locator("#pipeline")).toHaveCount(1);
  });

  test("the history states its own cut", async ({ page }) => {
    await page.goto("/settings#pipeline");
    // A list that shows ten of an unknown number, silently, is a cut nobody stated (ruling M8).
    await expect(page.getByRole("heading", { name: /Recent manual runs · last 10/ })).toBeVisible();
  });
});

/**
 * The dispatch loop, with GitHub mocked at the route boundary.
 *
 * These need a token, so they inject one by intercepting GitHub rather than by provisioning P-2:
 * the app decides whether it is "configured" from the env, so these tests can only run where the
 * env has one. They are skipped otherwise, and the skip is honest — it is stated, not hidden.
 */
test.describe("The dispatch loop (GitHub mocked)", () => {
  test.skip(process.env.MSM_SEEDED !== "1", "needs a seeded test database (MSM_SEEDED=1)");
  test.skip(!process.env.GH_DISPATCH_TOKEN, "needs GH_DISPATCH_TOKEN set (P-2)");

  test("press → dispatched → found → running → succeeded, and the panel follows it", async ({
    page,
  }) => {
    const RUN_ID = 987654321;
    let dispatched = false;
    let polls = 0;

    // The dispatch: 204, EMPTY BODY. This is what the live API really does.
    await page.route("**/api.github.com/repos/**/dispatches", async (route) => {
      dispatched = true;
      await route.fulfill({ status: 204, body: "" });
    });

    // The runs list — how the app RECOVERS the id it was never given. The run's name carries the
    // request id, which is the whole reason the workflow sets `run-name:`.
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

    const macro = actionRow(page, "Refresh macro stats");
    await macro.getByRole("button", { name: "Run" }).click();

    // IT MUST LEAVE `available`. A button that fires and then looks exactly as it did before is the
    // silent failure this phase exists to prevent — a run that ran and a run that never ran must
    // never look the same.
    await expect(macro).toContainText(/requested|queued|running/i, { timeout: 20_000 });

    // And it must resolve, and SAY it resolved. The run appears in the history with the WORD.
    await expect(page.getByText(/succeeded/i).first()).toBeVisible({ timeout: 60_000 });

    expect(dispatched).toBe(true);
  });

  test("a dispatch GitHub REFUSES writes no ledger row and burns no cap", async ({ page }) => {
    // The 422 the live drill actually hit (the workflow's inputs were not yet on main). The reader
    // must be told plainly — and, crucially, must not lose one of the day's runs to a run that never
    // happened. `full` is capped at 1/day: one bad dispatch silently eating it would lock the reader
    // out of the recovery button for the rest of the day.
    await page.route("**/api.github.com/repos/**/dispatches", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ message: 'Unexpected inputs provided: ["request_id"]' }),
      });
    });

    await page.goto("/settings#pipeline");

    const macro = actionRow(page, "Refresh macro stats");
    await macro.getByRole("button", { name: "Run" }).click();

    await expect(macro).toContainText(/GitHub would not start the run/i, { timeout: 20_000 });
    // Nothing was requested, so nothing was spent.
    await expect(macro).toContainText("6 of 6 left today");
  });
});

/**
 * The request id the app just generated, read back out of the page.
 *
 * The mock has to echo the SAME id back in the run's name, because matching that id is the only way
 * the app can find its run. Rather than guess it, we read the ledger row the app wrote — which is
 * exactly what the real GitHub would be echoing.
 */
async function currentRequestId(page: Page): Promise<string> {
  const response = await page.request.get("/api/pipeline/status");
  if (!response.ok()) return "unknown";
  const body = (await response.json()) as { history?: Array<{ id: string }> };
  return body.history?.[0]?.id ?? "unknown";
}
