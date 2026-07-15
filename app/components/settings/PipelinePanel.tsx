"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { runPipeline, type RunResult } from "@/app/(desk)/settings/pipeline-actions";
import { OutcomeChip, type OutcomeTone } from "@/components/OutcomeChip";
import { copy, fill } from "@/lib/copy";
import { controlPanel, type ActionRow, type ManualRunRow, type RunState } from "@/lib/pipeline-control";
import type { CompletedRun } from "@/lib/freshness";
import { formatEtClock, formatEtClockPadded, formatEtDate } from "@/lib/time";

/**
 * PipelinePanel — the control room (N6, plan 8.5).
 *
 * MOST OF THE TIME THIS IS NOT A ROW OF BUTTONS, IT IS A PIECE OF WRITING. Plan 8.1's honest evaluation:
 * this is an end-of-day product, and on a normal weeknight the pipeline HAS ALREADY RUN — a manual re-run
 * recomputes byte-identical data, so the honest control is the EXPLANATION, not the button. A row renders
 * in exactly ONE state, several with no button (ruling C5: an empty state is information). Two honesty
 * rules this surface leans on: the WORD goes in the chip (colour is the redundant channel), and the cost
 * is money so it never moves (`data-p2` — "~$0.15 of API budget" is the only figure here, the reader's
 * money).
 */

type Props = {
  /** The ledger, reconciled with GitHub. The STATES are derived here, in the browser — see below. */
  runs: ManualRunRow[];
  /** The newest completed pipeline run — what the reader is actually looking at. */
  lastRunSession: { runDate: string; finishedAt: Date } | null;
  /** Is the GitHub token provisioned (P-2)? When it is not, the panel says so ONCE — see below. */
  configured: boolean;
  /** The pipeline's own last word: what ran, and how each provider behaved while it did. */
  lastRun: {
    session: string;
    finishedAt: string;
    stages: Record<string, string>;
    sources: Record<string, string>;
  } | null;
};

/** Poll only while something is actually live, and only while the panel is on screen (plan 8.5). */
const POLL_MS = 15_000;

const LIVE: ReadonlySet<RunState["kind"]> = new Set(["requested", "queued", "running"]);

/**
 * JSON HAS NO DATE TYPE, AND THIS CRASHED THE PANEL ON ITS FIRST POLL. The server hands the first render
 * real `Date` objects (React serializes them across the boundary), so it mounts perfectly; then the poll
 * fetches the same shape as JSON and `JSON.parse` gives back STRINGS, and `formatEtClock("…Z")` throws
 * `Invalid time value` on re-render — React keeps the old DOM and the button appears to do nothing. A REAL
 * RUN HAD FIRED: the failure this phase was warned about, reached by a new route. TypeScript could not see
 * it because the old `as { … ActionRow[] }` cast on a parsed payload is an ASSERTION, not a check
 * (`response.json()` is `any`). It is N5's `_json_safe` lesson mirrored: not "does it serialize?" but
 * "does it deserialize into what the type claims?" — no, for every Date. So the boundary CONVERTS:
 * `new Date(x)` accepts a Date or an ISO string, idempotent on both.
 */
export function revive(payload: unknown): { runs: ManualRunRow[]; lastRun: CompletedRun | null } {
  const raw = payload as { runs: ManualRunRow[]; lastRun: CompletedRun | null };

  return {
    runs: raw.runs.map((run) => ({
      ...run,
      requestedAt: new Date(run.requestedAt),
      finishedAt: run.finishedAt === null ? null : new Date(run.finishedAt),
    })),
    lastRun: raw.lastRun && { ...raw.lastRun, finishedAt: new Date(raw.lastRun.finishedAt) },
  };
}

export function PipelinePanel({
  runs: initialRuns,
  lastRunSession,
  configured,
  lastRun,
}: Props) {
  const [runs, setRuns] = useState(initialRuns);

  /*
   * THE STATES ARE DECIDED HERE, IN THE BROWSER, AGAINST THE READER'S OWN CLOCK. They used to be decided
   * on the server, and the PIXEL ORACLE caught it: the first baseline photographed this panel saying
   * "Markets are open — today's closing data doesn't exist until 4:00pm ET" under a nav reading "MARKET
   * CLOSED" — one page, two clocks (CI ran at 3pm ET). That is N4's bug with a second head: the baseline
   * would rot on its own, because every state turns on the time CI happened to run. The Desk's freshness
   * strip already reads the browser's clock deliberately — the one clock that matters is the reader's, and
   * `controlPanel` is pure so running it here costs nothing. The clock is read ONCE, on mount (reading it
   * during render would break hydration; a module var would freeze a tab left open overnight).
   */
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock; see above
    setNow(new Date().toISOString());
  }, []);

  const rows = useMemo(
    () =>
      controlPanel({
        runs,
        lastRun: lastRunSession,
        // Before the clock lands (first paint), grade against the newest thing we know — the last
        // completed run. One frame, never a state we would not stand behind (vs a flash of empty panel).
        now: now ? new Date(now) : (lastRunSession?.finishedAt ?? new Date(0)),
        tokenConfigured: configured,
      }),
    [runs, lastRunSession, now, configured],
  );

  const anyLive = rows.some((r) => LIVE.has(r.state.kind));

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/pipeline/status", { cache: "no-store" });
      if (!response.ok) {
        console.error(`PipelinePanel: the status route answered ${response.status}`);
        return; // a blip must not blank the panel; the next tick tries again
      }
      setRuns(revive(await response.json()).runs);
    } catch (error) {
      // Offline, or the route is down. The panel keeps showing what it last knew — still true, just no
      // longer current. Logged, never swallowed: a poll that quietly stopped looks like nothing to report.
      console.error("PipelinePanel: could not read the pipeline's status", error);
    }
  }, []);

  /*
   * The poll runs ONLY while a run is live; an idle panel makes no requests. A live run must be watched
   * from here: GitHub does not call us back, and the run's revalidate busts the page caches but cannot
   * reach a panel already open in front of the reader.
   */
  useEffect(() => {
    if (!anyLive) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [anyLive, refresh]);

  return (
    <div>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">
        {copy.control.title}
      </h2>
      <div className="mt-1 h-px bg-hairline-strong" />

      <LastRun lastRun={lastRun} />

      {/*
       * P-2 IS SAID ONCE, HERE — NOT ONCE PER ROW. The first version put `notConfigured` on every row
       * (which is what the state machine reports — all five ARE not_configured) and every test passed; the
       * photograph showed the same 63-char sentence five times in a column. The state is per-row, the
       * REASON is per-panel: repeating a shared reason is not more honest, just louder, and a wall of
       * repetition is how a reader learns to skip a surface.
       */}
      {!configured ? (
        <p className="mt-4 rounded-panel border border-hairline bg-band-outer px-3 py-2 font-ui text-sm text-ink-2">
          {copy.control.notConfigured}
        </p>
      ) : null}

      <ul className="flex flex-col gap-px pt-4">
        {rows.map((row) => (
          <li key={row.action}>
            <ActionRowView row={row} onDispatched={refresh} />
          </li>
        ))}
      </ul>

      <History history={runs} />
    </div>
  );
}

/**
 * What the pipeline last did, verbatim from `pipeline_run` (plan 8.5, 8.6). The per-provider health is
 * here in full and CANNOT be folded away (ruling M2) — and it is why `compute` mode has its own publish
 * function: an ordinary publish would overwrite this map, so a degraded night would start reporting every
 * source healthy the moment the reader pressed "Recompute scans".
 */
function LastRun({ lastRun }: { lastRun: Props["lastRun"] }) {
  if (!lastRun) {
    return (
      <p className="pt-3 font-ui text-sm text-muted">
        No run has completed yet. The nightly lands at ~6:37 PM ET on trading days.
      </p>
    );
  }

  const degraded = Object.entries(lastRun.sources).filter(([, status]) => status !== "ok");

  return (
    <div className="pt-3">
      <p className="font-ui text-sm text-muted">
        Data through <span className="font-mono text-ink-2">{lastRun.session}</span> · last run
        finished <span className="font-mono text-ink-2">{lastRun.finishedAt}</span>
      </p>

      {/*
       * Each source's verdict through the app's one outcome chip (PD6 — this markup was a verbatim third
       * copy of Tag.tsx's shell). "ok" IS NEUTRAL, NOT POSITIVE, deliberately: a source behaving is the
       * normal case, and green on the normal case spends a hue on "nothing happened" and leaves the reader
       * scanning a wall of green for the one chip that is not. Only degradation gets a hue (E6).
       */}
      <div className="flex flex-wrap gap-1.5 pt-2">
        {Object.entries(lastRun.sources).map(([source, status]) => (
          <OutcomeChip
            key={source}
            tone={status === "ok" ? "neutral" : "negative"}
            label={`${source} · ${status}`}
          />
        ))}
      </div>

      {degraded.length > 0 ? (
        <p className="pt-2 font-ui text-sm text-muted">
          {degraded.length} of {Object.keys(lastRun.sources).length} sources did not report normally
          on that run. Their sections are thinner; everything else is unaffected.
        </p>
      ) : null}
    </div>
  );
}

/** One action, in exactly one state. */
function ActionRowView({ row, onDispatched }: { row: ActionRow; onDispatched: () => void }) {
  const [result, formAction, pending] = useActionState<RunResult, FormData>(runPipeline, { ok: true });

  /*
   * THE MOMENT THE ACTION FINISHES, ASK THE SERVER WHAT ACTUALLY HAPPENED. The bug this replaces shipped,
   * and only the live drill found it: the first version hung off the form's `onSubmit`, but React does not
   * fire onSubmit when a form has an action function — the refresh never ran and the panel went back to a
   * Run button. The run was REAL (GitHub accepted, executed, completed it) and the panel showed no sign —
   * the "fired and never-fired look identical" failure, past 572 unit tests and a green e2e. `pending`
   * true→false is the signal that cannot lie (React's own record that the action ran and came back). We
   * refresh on ANY completion, since a failed dispatch changes what the panel should say too.
   */
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      onDispatched();
    }
  }, [pending, onDispatched]);

  const { state } = row;

  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-ui text-sm font-bold text-ink">{row.label}</span>

        {state.kind === "available" ? (
          <form action={formAction}>
            <input type="hidden" name="action" value={row.action} />
            {/* The house's primary button, verbatim from AddWatchlistForm — one button in this app,
                not two. min-h-11 is the 44px thumb floor every control here clears. */}
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-control border border-ink bg-ink px-4 py-2 font-ui text-xs font-semibold uppercase tracking-[0.06em] text-surface disabled:opacity-60"
            >
              {pending ? "Starting…" : "Run"}
            </button>
          </form>
        ) : (
          <StateChip state={state} />
        )}
      </div>

      {/*
       * The description carries the only money on this panel ("~$0.15 of API budget"), so the row is
       * `data-p2`: complete on first paint, never animating, no ancestor animating or transforming. The
       * jsdom walker in p2-motion.test.tsx enforces it from above, the only place it can be (the motion
       * would be in the parent).
       */}
      <p data-p2 className="max-w-[60ch] font-ui text-sm text-muted">
        {row.description}
      </p>

      <StateLine state={state} capLine={row.capLine} />

      {result.ok ? null : (
        <p className="font-ui text-sm text-down-text">{result.error}</p>
      )}
    </div>
  );
}

/**
 * The state, as a chip with THE WORD IN IT. Never a bare colour or dot: a failed and a succeeded run
 * render at the same size and weight, only the hue differs, and the hue is the redundant channel.
 */
function StateChip({ state }: { state: RunState }) {
  if (state.kind === "running" || state.kind === "queued" || state.kind === "requested") {
    return <OutcomeChip tone="neutral" label={state.kind} />;
  }
  if (state.kind === "failed") {
    return <OutcomeChip tone="negative" label="failed" />;
  }
  if (state.kind === "lost") {
    return <OutcomeChip tone="negative" label="not found" />;
  }
  // capped, cooldown, blocked, not_applicable, not_configured — the SENTENCE below says it; a chip
  // repeating it in shorthand would be noise on top of the explanation.
  return null;
}

/** The line under the description: the cap, the cooldown, the explanation, the link to the log. */
function StateLine({ state, capLine }: { state: RunState; capLine: string | null }) {
  switch (state.kind) {
    case "available":
      return <span className="font-mono text-2xs text-muted">{capLine}</span>;

    case "cooldown":
      return (
        <span className="font-mono text-2xs text-muted">
          {fill(copy.control.cooldown, { time: `${formatEtClock(state.availableAt)} ET` })} · {capLine}
        </span>
      );

    case "capped":
      return <span className="font-mono text-2xs text-muted">{copy.control.capped}</span>;

    // THE SENTENCE IS THE ROW. This is the state plan 8.1 says most weeknights should land in, and
    // it is the whole reason this panel is not just five buttons.
    case "not_applicable":
      return <span className="font-ui text-sm text-ink-2">{state.reason}</span>;

    // Nothing. The panel states the reason ONCE, above the rows. Repeating it per row is not more honest.
    case "not_configured":
      return null;

    case "blocked":
      return <span className="font-ui text-sm text-muted">{copy.control.blocked}</span>;

    case "queued":
      return <span className="font-ui text-sm text-muted">{copy.control.queuedBehind}</span>;

    case "requested":
      return <span className="font-ui text-sm text-muted">Dispatched — finding the run…</span>;

    case "running":
      return (
        <span className="font-ui text-sm text-muted">
          {fill(copy.control.running, { elapsed: elapsedSince(state.since) })}
          {state.runUrl ? (
            <>
              {" · "}
              <RunLink href={state.runUrl} />
            </>
          ) : null}
        </span>
      );

    /*
     * THE STATE THAT STOPS A SILENT FAILURE. The dispatch API answers 204 with an empty body, so the app
     * hunts for the run id by matching the request id in the run's name; when the hunt never resolves, this
     * is what the reader sees. Without it the panel shows "requested…" forever, and a fired run and a
     * never-fired run look identical from the couch.
     */
    case "lost":
      return <span className="font-ui text-sm text-ink-2">{copy.control.lost}</span>;

    case "failed":
      return (
        <span className="font-ui text-sm text-ink-2">
          {copy.control.failed}{" "}
          {state.runUrl ? <RunLink href={state.runUrl} /> : null}
        </span>
      );
  }
}

function RunLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent-deep underline underline-offset-2"
    >
      {copy.control.viewRun}
    </a>
  );
}

/**
 * "running — 2m 40s". Computed at RENDER from the poll's tick, so it advances in 15-second steps, not
 * every second — a second-by-second stopwatch is manufactured urgency, and this is information about how
 * long something has run, not a countdown pressing the reader to act.
 */
function elapsedSince(since: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * The last ten manual runs, and IT SAYS SO (ruling M8). A list showing ten of an unknown number,
 * silently, is a cut nobody stated — and a cut you cannot audit can hide anything. The heading names its
 * own rule.
 */
function History({ history }: { history: ManualRunRow[] }) {
  return (
    <div className="pt-6">
      {/*
       * "· last 10" is MUTED, not faint, and drift rule 18 corrected me: it looks like chrome but it is the
       * list STATING ITS OWN CUT (M8), the thing that keeps a truncated list honest — and a stated cut
       * printed too pale to read is a cut not really stated. Information never renders below the contrast floor.
       */}
      <h3 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
        {copy.control.history} · last 10
      </h3>
      <div className="mt-1 h-px bg-hairline" />

      {history.length === 0 ? (
        // An empty history is the HEALTHY state: the scheduled runs are doing their job and nobody has had
        // to intervene. Information, not an apology.
        <p className="pt-3 font-ui text-sm text-muted">{copy.control.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col pt-1">
          {history.map((run) => (
            <li
              key={run.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-2 last:border-b-0"
            >
              <span className="font-mono text-2xs text-muted">
                {formatEtDate(run.requestedAt)} {formatEtClockPadded(run.requestedAt)} ET
              </span>
              <span className="font-ui text-sm text-ink">{run.action}</span>
              <RunOutcomeChip status={run.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The word, always; colour is redundant. This comment once read "see the OutcomeChip on the track record,
 * same rule" — which named the duplication instead of removing it, and the two copies had drifted. It IS
 * that chip now (components/OutcomeChip.tsx, PD6).
 */
function RunOutcomeChip({ status }: { status: ManualRunRow["status"] }) {
  const TONE: Record<string, OutcomeTone> = {
    succeeded: "positive",
    failed: "negative",
  };
  return <OutcomeChip tone={TONE[status] ?? "neutral"} label={status} />;
}
