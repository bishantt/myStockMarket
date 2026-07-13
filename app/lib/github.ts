import { RUN_WORKFLOW, type RunAction } from "@/lib/constants";

/**
 * github.ts — the bridge from a button in the app to a run on GitHub Actions (N6, plan 8.2).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE CHANGING ANYTHING HERE. The dispatch API does not tell you what it did.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The plan (8.2) said the app should dispatch "with `return_run_details: true` (verified current API
 * — the response carries `workflow_run_id`)", and stash the id on the request row. GitHub's own REST
 * documentation says the same: a 200 response carrying `workflow_run_id`, `run_url`, `html_url`.
 *
 * BOTH ARE WRONG. Recorded against the live API on 2026-07-13:
 *
 *     POST /repos/bishantt/myStockMarket/actions/workflows/nightly-a.yml/dispatches
 *     { "ref": "main", "inputs": { "mode": "macro" } }
 *
 *     -> HTTP/2.0 204 No Content
 *        (empty body — no workflow_run_id, no run_url, no html_url)
 *
 * There is no `return_run_details` parameter either; it is not in the docs and it is not accepted.
 *
 * Had this been built on the plan's claim, every dispatched run would have carried a null run id,
 * could never have been polled, and would have sat on "requested…" forever — which is precisely the
 * failure this phase was warned about: **a run that fired and a run that never fired would look
 * identical from the couch.**
 *
 * So the run id is RECOVERED, not received. The app stamps each dispatch with a `request_id`, the
 * workflow prints it into its `run-name:`, and `findRun` matches it in the runs list. That is why
 * the run-name line in the workflow YAML is load-bearing and has a test guarding it.
 *
 * The token (GH_DISPATCH_TOKEN, provisioning row P-2) lives only here, on the server. It is never
 * serialized into a payload, never sent to a client component, and the routes that call this module
 * all sit behind the session wall.
 */

const REPO = "bishantt/myStockMarket";
const API = "https://api.github.com";
const REF = "main";

/** Is P-2 provisioned? The panel renders its real states either way, and says which. */
export function isDispatchConfigured(): boolean {
  return Boolean(process.env.GH_DISPATCH_TOKEN);
}

function authHeaders(): HeadersInit {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    throw new Error("GH_DISPATCH_TOKEN is not set — a manual run cannot be dispatched (P-2).");
  }
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
  };
}

/** What GitHub says about a run. `null` conclusion means it has not finished. */
export type GhRun = {
  id: string;
  status: "queued" | "in_progress" | "completed" | string;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | string | null;
  htmlUrl: string;
};

/**
 * Fire a run. Throws — with the reason — if GitHub refuses.
 *
 * IT THROWS ON PURPOSE, and the caller must not swallow it. A dispatch that never reached GitHub
 * requested nothing and ran nothing, so it must not leave a ledger row behind claiming otherwise
 * (plan 8.3: "the not-applicable and not-configured cases are UI states of the panel, never stored
 * rows: nothing was requested"). The same reasoning covers a refused dispatch, and it is also what
 * keeps a bad token from silently burning the day's cap on an action that never ran.
 */
export async function dispatchRun(action: RunAction, requestId: string): Promise<void> {
  const workflow = RUN_WORKFLOW[action];

  // Job B has no modes — its whole job IS the evening assembly — so it takes only the request id.
  const inputs: Record<string, string> =
    workflow === "nightly-b.yml"
      ? { request_id: requestId }
      : { mode: action, request_id: requestId };

  const response = await fetch(`${API}/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ref: REF, inputs }),
    cache: "no-store",
  });

  // 204 No Content is SUCCESS here, and it is the only success. See the module note above.
  if (response.status !== 204) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `GitHub refused the dispatch (${response.status}): ${detail.slice(0, 200) || "no detail"}`,
    );
  }
}

/**
 * Find the run a dispatch created, by matching the request id in its name.
 *
 * This is the ONLY way to learn the run id (see the module note). `display_title` carries the
 * workflow's `run-name:` when one is set, which is why both workflows now set one and print the
 * request id into it.
 *
 * Returns null when the run does not exist YET — normal for a second or two after a dispatch — and
 * also when it will never exist. The panel cannot tell those apart from one call, so it does not
 * try: it keeps looking, and after RUN_LOOKUP_TIMEOUT_SECONDS it reports the run as lost rather
 * than leaving the reader watching a spinner for something that is never coming.
 */
export async function findRun(action: RunAction, requestId: string): Promise<GhRun | null> {
  const workflow = RUN_WORKFLOW[action];
  const url = `${API}/repos/${REPO}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=20`;

  const response = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GitHub would not list the runs (${response.status}).`);
  }

  const body = (await response.json()) as { workflow_runs?: unknown[] };
  const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];

  for (const raw of runs) {
    const run = raw as { id?: number; name?: string; display_title?: string; status?: string; conclusion?: string | null; html_url?: string };
    // The request id is a cuid, so an `includes` match on it cannot collide with anything else.
    const name = `${run.display_title ?? ""} ${run.name ?? ""}`;
    if (run.id && name.includes(requestId)) {
      return {
        // A string, not a number: run ids are int64 and JavaScript numbers are not. Prisma stores a
        // BigInt, and `JSON.stringify` throws on one — so it is a string everywhere above the DB.
        id: String(run.id),
        status: run.status ?? "queued",
        conclusion: run.conclusion ?? null,
        htmlUrl: run.html_url ?? `https://github.com/${REPO}/actions/runs/${run.id}`,
      };
    }
  }

  return null;
}

/** Read one run's current state, once we know its id. */
export async function getRun(ghRunId: string): Promise<GhRun | null> {
  const response = await fetch(`${API}/repos/${REPO}/actions/runs/${ghRunId}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub would not describe run ${ghRunId} (${response.status}).`);
  }

  const run = (await response.json()) as {
    id: number;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
  };

  return {
    id: String(run.id),
    status: run.status ?? "queued",
    conclusion: run.conclusion ?? null,
    htmlUrl: run.html_url ?? `https://github.com/${REPO}/actions/runs/${run.id}`,
  };
}

/**
 * Translate GitHub's vocabulary into the ledger's.
 *
 * GitHub says `status: queued | in_progress | completed` and, once completed, a `conclusion`. The
 * ledger says `requested | queued | running | succeeded | failed`.
 *
 * ANYTHING THAT IS NOT A SUCCESS IS A FAILURE HERE — cancelled, timed out, skipped, and any value
 * GitHub adds after this was written. That is the safe direction to be wrong in: reporting a
 * cancelled run as "failed" tells the reader to go and look, which is exactly what they should do.
 * Reporting an unknown conclusion as a success would tell them their data refreshed when it did not.
 */
export function ledgerStatus(run: GhRun): "queued" | "running" | "succeeded" | "failed" {
  if (run.status === "queued") return "queued";
  if (run.status !== "completed") return "running";
  return run.conclusion === "success" ? "succeeded" : "failed";
}
