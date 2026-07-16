"use client";

import { useActionState, useEffect, useRef } from "react";

import { runPipeline, type RunResult } from "@/app/(desk)/settings/pipeline-actions";
import { OutcomeChip } from "@/components/OutcomeChip";
import { copy, fill } from "@/lib/copy";
import type { ActionRow, RunState } from "@/lib/pipeline-control";
import { formatEtClock } from "@/lib/time";

/**
 * PipelineActionRow — one manual mode, in exactly one state, inside a pipeline's sheet (CC7, plan 4.6).
 *
 * This is N6's control-room row, unchanged in behaviour and lifted out of the old PipelinePanel: the
 * state machine (lib/pipeline-control) still decides what the reader may press and, far more often, why
 * there is nothing worth pressing. What moved is only WHERE it renders — from a flat panel into the sheet
 * of the pipeline the mode belongs to. The load-bearing pieces travel intact: the description carries the
 * only money on the surface (news' `~$0.15`), so the row is `data-p2` (complete on first paint, never
 * animating — the sheet's own fade is opacity-only and admitted to the P2 walk by name); and the moment
 * the action finishes we ask the server what actually happened, because a run that fired and a run that
 * never fired must never look the same from the couch.
 */
export function PipelineActionRow({ row, onDispatched }: { row: ActionRow; onDispatched: () => void }) {
  const [result, formAction, pending] = useActionState<RunResult, FormData>(runPipeline, { ok: true });

  /*
   * THE MOMENT THE ACTION FINISHES, ASK THE SERVER WHAT ACTUALLY HAPPENED. `pending` true→false is the
   * signal that cannot lie — React's own record that the action ran and came back. We refresh on ANY
   * completion, since a failed dispatch changes what the row should say too. (The original hung off the
   * form's onSubmit, which React does not fire when a form has an action function — the panel showed a
   * run had done nothing while GitHub had accepted, executed and completed it.)
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
            {/* The house's primary button, verbatim from AddWatchlistForm — one button in this app, not
                two. min-h-11 is the 44px thumb floor every control here clears. */}
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
       * The description carries the only money on this surface ("~$0.15 of API budget"), so the row is
       * `data-p2`: complete on first paint, never animating, no ancestor animating or transforming. The
       * sheet opens with `.sheet-fade` (opacity only), which p2-motion.test.tsx admits by name.
       */}
      <p data-p2 className="max-w-[60ch] font-ui text-sm text-muted">
        {row.description}
      </p>

      <StateLine state={state} capLine={row.capLine} />

      {result.ok ? null : <p className="font-ui text-sm text-down-text">{result.error}</p>}
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
  if (state.kind === "failed") return <OutcomeChip tone="negative" label="failed" />;
  if (state.kind === "lost") return <OutcomeChip tone="negative" label="not found" />;
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

    // THE SENTENCE IS THE ROW. This is the state plan 8.1 says most weeknights should land in.
    case "not_applicable":
      return <span className="font-ui text-sm text-ink-2">{state.reason}</span>;

    // Nothing. The sheet states the reason ONCE, above the rows. Repeating it per row is not more honest.
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
     * hunts for the run id by matching the request id in the run's name; when the hunt never resolves,
     * this is what the reader sees, rather than "requested…" forever.
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
  // An external GitHub link — a raw anchor is correct (drift rule 14 governs INTERNAL links, and its
  // line regex is why `<a` and `href` sit on separate lines, as every external link in this app does).
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
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
