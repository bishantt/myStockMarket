"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { runPipeline, type RunResult } from "@/app/(desk)/settings/pipeline-actions";
import { cx } from "@/lib/cx";
import { copy, fill } from "@/lib/copy";
import type { ActionRow, ManualRunRow, RunState } from "@/lib/pipeline-control";
import { formatEtClock, formatEtDate } from "@/lib/time";

/**
 * PipelinePanel — the control room (N6, plan 8.5).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * MOST OF THE TIME THIS IS NOT A ROW OF BUTTONS. IT IS A PIECE OF WRITING.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The commission asked for user-triggered pipeline runs. Plan 8.1 did the honest evaluation first
 * and narrowed it hard: this is an end-of-day product, and on a normal weeknight the pipeline HAS
 * ALREADY RUN — a manual re-run would recompute byte-identical data. **For that case the honest
 * control is the EXPLANATION, not the button.**
 *
 * So a row here renders in exactly ONE state, and several of those states have no button at all.
 * The sentence IS the row (ruling C5: an empty state is information, not an apology). A button that
 * is present but pointless invites a press that changes nothing — and a product that lets you do a
 * pointless thing and says nothing about it has lied to you about what you just did.
 *
 * THE TWO HONESTY RULES THIS SURFACE LEANS ON:
 *
 * · **The word goes in the chip.** A run's outcome — succeeded, failed — is spelled out. Colour is
 *   the redundant channel and never the primary one, so a colourblind reader loses nothing.
 *
 * · **The cost is money, so it never moves** (`data-p2`). "~$0.15 of API budget" carries the P2
 *   attribute and no ancestor of it animates, transitions or transforms. It is the only figure on
 *   this panel, and it is the reader's money.
 */

type Props = {
  rows: ActionRow[];
  history: ManualRunRow[];
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

export function PipelinePanel({ rows: initialRows, history: initialHistory, lastRun, configured }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [history, setHistory] = useState(initialHistory);

  const anyLive = rows.some((r) => LIVE.has(r.state.kind));

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/pipeline/status", { cache: "no-store" });
      if (!response.ok) return; // a blip must not blank the panel; the next tick tries again
      const next = (await response.json()) as { rows: ActionRow[]; history: ManualRunRow[] };
      setRows(next.rows);
      setHistory(next.history);
    } catch {
      // Offline, or the route is down. The panel keeps showing what it last knew, which is true —
      // it simply stops being current, and the run's own elapsed time stops advancing with it.
    }
  }, []);

  /*
   * The poll runs ONLY while a run is live. An idle panel makes no requests at all.
   *
   * A run that is live has to be watched from here rather than waited out, because the app cannot
   * be told when it finishes: GitHub does not call us back, and the run's own revalidate busts the
   * page caches but cannot reach a panel that is already open in front of the reader.
   */
  useEffect(() => {
    if (!anyLive) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [anyLive, refresh]);

  return (
    <div>
      <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
        {copy.control.title}
      </h2>
      <div className="mt-1 h-px bg-hairline-strong" />

      <LastRun lastRun={lastRun} />

      {/*
       * P-2 IS SAID ONCE, HERE — NOT ONCE PER ROW.
       *
       * The first version put `copy.control.notConfigured` on every row, which is what the state
       * machine honestly reports: all five rows ARE not_configured. Every test passed. Then I
       * photographed the page and found the same 63-character sentence printed **five times in a
       * column**, and a reader has to read it five times to learn one fact.
       *
       * The state is per-row; the REASON is per-panel. Printing a shared reason once per row is not
       * more honest, it is just louder — and a wall of repetition is how a reader learns to skip a
       * surface, which is the last thing this one can afford.
       */}
      {!configured ? (
        <p className="mt-4 rounded-panel border border-hairline bg-band px-3 py-2 font-ui text-sm text-ink-2">
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

      <History history={history} />
    </div>
  );
}

/**
 * What the pipeline last did, verbatim from `pipeline_run` (plan 8.5, 8.6).
 *
 * The per-provider health is here in full and CANNOT be folded away (ruling M2). It is also the
 * reason `compute` mode has its own publish function: a recompute that went through the ordinary
 * publish would have overwritten this map, and a night on which a provider was degraded would start
 * reporting every source healthy the moment the reader pressed "Recompute scans".
 */
function LastRun({ lastRun }: { lastRun: Props["lastRun"] }) {
  if (!lastRun) {
    return (
      <p className="pt-3 font-ui text-sm text-muted">
        No run has completed yet. The nightly lands at ~6:37pm ET on trading days.
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

      <div className="flex flex-wrap gap-1.5 pt-2">
        {Object.entries(lastRun.sources).map(([source, status]) => (
          <span
            key={source}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-chip border px-1.5 py-0.5",
              "font-mono text-2xs font-medium uppercase tracking-[0.04em]",
              status === "ok"
                ? "border-hairline bg-surface text-ink-2"
                : "border-down-wash bg-down-wash text-down-text",
            )}
          >
            {source} · {status}
          </span>
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

  // The moment a dispatch lands, ask the server what is actually happening rather than assuming.
  // The button reported that GitHub ACCEPTED the run — it has said nothing about the run itself.
  const dispatched = useRef(false);
  useEffect(() => {
    if (result.ok && dispatched.current) {
      dispatched.current = false;
      onDispatched();
    }
  }, [result, onDispatched]);

  const { state } = row;

  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-ui text-sm font-bold text-ink">{row.label}</span>

        {state.kind === "available" ? (
          <form action={formAction} onSubmit={() => (dispatched.current = true)}>
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
       * The description carries the only money on this panel ("~$0.15 of API budget"), so the row
       * is marked `data-p2`: it renders complete on first paint, it never animates, and no ancestor
       * of it may animate or transform either. The jsdom walker in p2-motion.test.tsx enforces that
       * from above, which is the only place it CAN be enforced — the motion would be in the parent.
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
 * The state, as a chip with THE WORD IN IT.
 *
 * Never a bare colour, never a bare dot. A failed run and a succeeded run render at the same size
 * and the same weight; only the hue differs, and the hue is the redundant channel.
 */
function StateChip({ state }: { state: RunState }) {
  const SHELL =
    "inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em]";

  if (state.kind === "running" || state.kind === "queued" || state.kind === "requested") {
    return <span className={cx(SHELL, "bg-band text-ink-2")}>{state.kind}</span>;
  }
  if (state.kind === "failed") {
    return <span className={cx(SHELL, "bg-down-wash text-down-text")}>failed</span>;
  }
  if (state.kind === "lost") {
    return <span className={cx(SHELL, "bg-down-wash text-down-text")}>not found</span>;
  }
  // capped, cooldown, blocked, not_applicable, not_configured — the SENTENCE below says it, and a
  // chip repeating the same thing in shorthand would be noise sitting on top of the explanation.
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

    // Nothing. The panel states the reason ONCE, above the rows — see the note there. Repeating it
    // on each row is not five times as honest, it is just five times as long.
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
     * THE STATE THAT STOPS A SILENT FAILURE.
     *
     * The dispatch API answers 204 with an empty body, so the app never receives the run id — it has
     * to hunt for it by matching the request id in the run's name. When that hunt never resolves,
     * this is what the reader sees. Without it the panel would show "requested…" forever, and a run
     * that fired and a run that never fired would look exactly the same from the couch.
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
 * "running — 2m 40s".
 *
 * Computed at RENDER, from the poll's own tick, so it advances in 15-second steps rather than
 * ticking every second. That is deliberate on both counts: a second-by-second stopwatch is
 * manufactured urgency, and this app does not do that. It is information about how long something
 * has been going, not a countdown pressing the reader to act.
 */
function elapsedSince(since: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * The last ten manual runs, and IT SAYS SO (ruling M8).
 *
 * A list that shows ten of an unknown number, silently, is a cut nobody stated — and this app's
 * whole argument is that a cut you cannot audit is a cut that can hide anything. The heading names
 * its own rule.
 */
function History({ history }: { history: ManualRunRow[] }) {
  return (
    <div className="pt-6">
      {/*
       * "· last 10" is MUTED, not faint, and drift rule 18 is what corrected me.
       *
       * I reached for `faint` because the phrase looked like chrome. It is not chrome: it is the
       * list STATING ITS OWN CUT (ruling M8), which is the single thing that keeps a truncated list
       * honest. Information never renders in a colour that fails the contrast floor — and a stated
       * cut, printed too pale to read, is a cut that has not really been stated.
       */}
      <h3 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
        {copy.control.history} · last 10
      </h3>
      <div className="mt-1 h-px bg-hairline" />

      {history.length === 0 ? (
        // An empty history is the HEALTHY state: the scheduled runs are doing their job and nobody
        // has had to intervene. It is information, not an apology.
        <p className="pt-3 font-ui text-sm text-muted">{copy.control.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col pt-1">
          {history.map((run) => (
            <li
              key={run.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-2 last:border-b-0"
            >
              <span className="font-mono text-2xs text-muted">
                {formatEtDate(run.requestedAt)} {formatEtClock(run.requestedAt)} ET
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

/** The word, always. Colour is redundant — see the OutcomeChip on the track record, same rule. */
function RunOutcomeChip({ status }: { status: ManualRunRow["status"] }) {
  const styles: Record<string, string> = {
    succeeded: "bg-up-wash text-up-text",
    failed: "bg-down-wash text-down-text",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em]",
        styles[status] ?? "bg-band text-ink-2",
      )}
    >
      {status}
    </span>
  );
}
