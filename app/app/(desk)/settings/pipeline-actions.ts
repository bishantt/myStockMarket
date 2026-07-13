"use server";

import { randomUUID } from "node:crypto";

import { RUN_ACTIONS, RUN_WORKFLOW, type RunAction } from "@/lib/constants";
import { db } from "@/lib/db";
import { dispatchRun, isDispatchConfigured } from "@/lib/github";
import { controlPanel } from "@/lib/pipeline-control";
import { readPanel } from "@/lib/pipeline-runs";

/**
 * The control room's one write action (N6, plan 8.2–8.4).
 *
 * It sits behind the login wall like every other write in this app (proxy.ts stands in front of
 * /settings), and the GitHub token never leaves the server: the client component below sends an
 * action name and nothing else, and gets back a state.
 */

export type RunResult = { ok: boolean; error?: string };

/**
 * Fire one manual pipeline run.
 *
 * THE ORDER OF THE TWO WRITES BELOW IS THE WHOLE DESIGN, so it is worth saying why.
 *
 * We dispatch FIRST, and only write the ledger row once GitHub has accepted it (204). The obvious
 * alternative — write the row, then dispatch — is worse in a way that costs the reader real
 * function: a dispatch that GitHub REFUSES (a revoked token, a renamed workflow, an outage) would
 * leave behind a row saying a run was requested when nothing ran. That row would then count against
 * the day's cap. With `full` capped at 1/day, a single bad-token press would lock the reader out of
 * the recovery button for the rest of the day, for a run that never happened.
 *
 * Plan 8.3 states the principle and this follows it: the not-applicable and not-configured cases are
 * UI states, "never stored rows: nothing was requested". A refused dispatch requested nothing too.
 *
 * The request id is generated HERE, before the dispatch, because it has to travel INTO the workflow
 * — it is printed into the run's name, and matching it there is the only way we can ever find the
 * run again (the dispatch API returns 204 with an empty body; see lib/github.ts).
 */
export async function runPipeline(_prev: RunResult, formData: FormData): Promise<RunResult> {
  const action = String(formData.get("action") ?? "");

  // Validate at the boundary. Never trust a form body — a hand-crafted POST must not be able to
  // dispatch a workflow this app does not offer.
  if (!RUN_ACTIONS.includes(action as RunAction)) {
    return { ok: false, error: "That is not something this app can run." };
  }
  const runAction = action as RunAction;

  if (!isDispatchConfigured()) {
    return { ok: false, error: "Manual runs need a GitHub token — see QUESTIONS-FOR-BISHANT (P-2)." };
  }

  /*
   * Re-check the guardrails ON THE SERVER, against the ledger, rather than trusting the panel that
   * rendered the button. A cap enforced only in the UI is a cap enforced only for readers who did
   * not open the developer console — and these caps exist to protect a real provider budget.
   *
   * The PANEL derives its states in the browser, against the reader's clock (so it can never
   * disagree with the nav about whether the market is open). This does not, and must not: a client
   * clock is an input the caller controls, and "the market is closed, honest" is not something a
   * form body gets to assert. The same pure function, run against the server's own clock — which is
   * the only clock with any authority over whether a run may fire.
   */
  const { runs, lastRun, configured } = await readPanel();
  const rows = controlPanel({ runs, lastRun, now: new Date(), tokenConfigured: configured });

  const row = rows.find((r) => r.action === runAction);
  if (!row || row.state.kind !== "available") {
    return { ok: false, error: "That run isn't available right now — reload the panel." };
  }

  // The ledger row's id IS the request id. One identifier, generated here, that travels into the
  // workflow, comes back in the run's name, and ties the run on GitHub to the row in our database.
  // Prisma would happily default this to a cuid — but it would do so at INSERT time, which is after
  // the dispatch, and by then it is too late to put it in the run's name.
  const requestId = randomUUID();

  try {
    await dispatchRun(runAction, requestId);
  } catch (error) {
    // Nothing ran, so nothing is recorded. The reader is told plainly, and their cap is untouched.
    console.error("runPipeline: the dispatch failed", error);
    return { ok: false, error: "GitHub would not start the run. Nothing was dispatched." };
  }

  try {
    await db.manualRun.create({
      data: {
        id: requestId,
        workflow: RUN_WORKFLOW[runAction],
        mode: runAction,
        status: "requested",
      },
    });
  } catch (error) {
    // The run IS going — GitHub took it. We simply failed to write it down. Say so, rather than
    // reporting a failure the reader would reasonably respond to by pressing the button again.
    console.error("runPipeline: dispatched, but the ledger row could not be written", error);
    return { ok: false, error: "The run started, but it could not be recorded. Check the Actions tab." };
  }

  // NOTE: no revalidatePath("/settings") here, and that is deliberate.
  //
  // This action is invoked FROM /settings, and a page that revalidates itself from inside its own
  // action races its own reply — the render the reader gets back can be the copy from before their
  // click. That bug has cost this build twice (the Desk's write deadlock in F4, the vanishing
  // watchlist row in F7), which is why /settings renders on request and the panel polls instead.
  return { ok: true };
}
