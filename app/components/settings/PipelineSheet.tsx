"use client";

import { OutcomeChip, type OutcomeTone } from "@/components/OutcomeChip";
import { PipelineActionRow } from "@/components/settings/PipelineActionRow";
import { RUN_CAPS, type RunAction } from "@/lib/constants";
import { copy, fill } from "@/lib/copy";
import type { CompletedRun } from "@/lib/freshness";
import { controlPanel, type ManualRunRow } from "@/lib/pipeline-control";
import { mergeRuns, type PipelineDisplay, type RunEvent, type RunRecord } from "@/lib/pipelines";
import { formatEtClockPadded, formatEtDate } from "@/lib/time";

/**
 * PipelineSheet — a pipeline's depth, opened over the control-room table (CC7, plan 4.6).
 *
 * The table is a read station; this is where the reader looks closer and, for the modes that earn a
 * button, acts. Six sections, exactly as the plan names them: what it fetches (with tonight's per-source
 * status when there is a run to report), its stages, its daily limits, the run-now controls, and its
 * recent runs (manual dispatches and the scheduled record, merged). Missing a GitHub token (P-2) is said
 * ONCE, above the controls — the state is per-row, the reason is per-sheet.
 */

const ACTION_LABEL: Record<RunAction, string> = {
  full: copy.control.runFull,
  news: copy.control.runNews,
  macro: copy.control.runMacro,
  compute: copy.control.runCompute,
  briefing: copy.control.runBriefing,
};

/** The recent-runs chip: a fired run's success is a wanted outcome (green); a scheduled run's health is
 *  the normal case (neutral). Only real trouble takes a hue. The word is always the primary channel. */
const TONE: Record<string, OutcomeTone> = {
  succeeded: "positive",
  failed: "negative",
  FAILED: "negative",
  DEGRADED: "negative",
  "not found": "negative",
};
function toneFor(word: string): OutcomeTone {
  return TONE[word] ?? "neutral";
}

type Props = {
  display: PipelineDisplay;
  runs: ManualRunRow[];
  records: RunRecord[];
  lastRunSession: CompletedRun | null;
  configured: boolean;
  now: Date | null;
  onDispatched: () => void;
};

export function PipelineSheet({ display, runs, records, lastRunSession, configured, now, onDispatched }: Props) {
  const { def, lastRun } = display;

  // The action states are decided here, in the browser, against the reader's clock — the same rule the
  // Desk's freshness strip follows, so the sheet and the nav can never disagree about the market. Before
  // the clock mounts, grade against the newest thing we know rather than flash an empty control.
  const rows = controlPanel({
    runs,
    lastRun: lastRunSession,
    now: now ?? lastRunSession?.finishedAt ?? new Date(0),
    tokenConfigured: configured,
  }).filter((row) => def.actions.includes(row.action));

  const events = mergeRuns(def, runs, records);

  return (
    <div className="flex flex-col gap-6 py-4">
      <header>
        <h2 className="font-display text-xl font-bold text-ink">{def.name}</h2>
        <p className="max-w-[60ch] pt-1 font-prose text-base text-ink-2">{def.description}</p>
      </header>

      <Section title={copy.control.sheet.fetches}>
        {lastRun?.sources ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(lastRun.sources).map(([source, status]) => (
              <OutcomeChip key={source} tone={status === "ok" ? "neutral" : "negative"} label={`${source} · ${status}`} />
            ))}
          </div>
        ) : def.providers.length > 0 ? (
          <p className="font-mono text-sm text-ink-2">{def.providers.join(" · ")}</p>
        ) : (
          <p className="font-ui text-sm text-muted">{copy.control.sheet.fetchesEmpty}</p>
        )}
      </Section>

      <Section title={copy.control.sheet.stages}>
        <div className="flex flex-wrap gap-1.5">
          {def.stages.map((stage) => {
            const status = lastRun?.stages?.[stage];
            return status ? (
              <OutcomeChip key={stage} tone={status === "ok" ? "neutral" : "negative"} label={`${stage} · ${status}`} />
            ) : (
              <span key={stage} className="rounded-pill bg-band-outer px-2.5 py-1 font-mono text-2xs text-ink-2">
                {stage}
              </span>
            );
          })}
        </div>
      </Section>

      <Section title={copy.control.sheet.limits}>
        <ul className="flex flex-col gap-1">
          {def.actions.map((action) => {
            const cap = RUN_CAPS[action];
            const perDay = fill(copy.control.sheet.perDay, { n: cap.perDay });
            const gap = cap.cooldownMinutes > 0 ? ` · ${fill(copy.control.sheet.cooldownGap, { min: cap.cooldownMinutes })}` : "";
            return (
              <li key={action} className="font-ui text-sm text-ink-2">
                {ACTION_LABEL[action]} <span className="font-mono text-muted">— {perDay}{gap}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={copy.control.sheet.runByHand}>
        {/*
         * P-2 IS SAID ONCE, HERE — not once per control. The first control-room build printed it on every
         * row and every test passed; a screenshot showed the same sentence repeated. The state is per-row,
         * the reason is per-sheet; a wall of repetition is how a reader learns to skip a surface.
         */}
        {!configured ? (
          <p className="mb-3 rounded-panel border border-hairline bg-band-outer px-3 py-2 font-ui text-sm text-ink-2">
            {copy.control.notConfigured}
          </p>
        ) : null}
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.action}>
              <PipelineActionRow row={row} onDispatched={onDispatched} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={events.length >= 10 ? copy.control.sheet.recentRunsCapped : copy.control.sheet.recentRuns}>
        {events.length === 0 ? (
          // The dawn refresh has no record of its own in CC7; every other empty history is the healthy
          // state (nobody has had to intervene). Either way it is information, not an apology.
          <p className="font-ui text-sm text-muted">
            {def.id === "dawn-refresh" ? copy.control.sheet.dawnShares : copy.control.sheet.recentEmpty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {events.map((event) => (
              <RecentRunRow key={event.key} event={event} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">{title}</h3>
      <div className="mt-1 mb-2 h-px bg-hairline" />
      {children}
    </section>
  );
}

function RecentRunRow({ event }: { event: RunEvent }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-2 last:border-b-0">
      <span className="font-mono text-2xs text-muted">
        {formatEtDate(event.when)} {formatEtClockPadded(event.when)} ET
      </span>
      <span className="font-ui text-sm text-ink">{event.label}</span>
      {event.url ? (
        // External GitHub link — a raw anchor, formatted multiline like every external link here (drift
        // rule 14's line regex governs internal /paths; `<a` and `href` sit apart deliberately).
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          className="text-accent-deep underline underline-offset-2"
        >
          <OutcomeChip tone={toneFor(event.status)} label={event.status} />
        </a>
      ) : (
        <OutcomeChip tone={toneFor(event.status)} label={event.status} />
      )}
    </li>
  );
}
