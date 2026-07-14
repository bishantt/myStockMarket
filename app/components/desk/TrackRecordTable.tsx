"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { OutcomeChip, type OutcomeTone } from "@/components/OutcomeChip";
import { TickerChip } from "@/components/TickerChip";
import { cx } from "@/lib/cx";
import type { Column } from "@/lib/table";

/** One resolved signal, already formatted by the loader. */
export type ResolvedRow = {
  id: string;
  firedDate: string;
  symbol: string;
  patternLabel: string;
  horizonDays: number;
  outcome: string;
  resolvedAt: string;
};

/**
 * TrackRecordTable — the app's own record, misses and all (APP-FEEL-PLAN §4.4).
 *
 * This is the accountability surface, so two things about it are not negotiable:
 *
 * **THE MISSES RIDE THE SAME TABLE, AT THE SAME WEIGHT.** Hits and misses are one list, one sort,
 * one type scale. The filter DEFAULTS TO ALL — a default of "hits" would be a product grading its
 * own homework, and P5 exists precisely to stop that. An e2e asserts a seeded miss is on the first
 * page without anyone touching a control.
 *
 * **THE OUTCOME IS ON LINE 1 OF THE PHONE CARD-ROW.** Symbol and outcome together, never the outcome
 * below the fold of its own row. If a reader has to scroll to find out whether the app was wrong,
 * the app has hidden being wrong.
 *
 * The default sort is by resolution date, newest first — recency of RESOLUTION is neutral
 * bookkeeping, not a ranking. It is not a leaderboard and the header never says "top".
 *
 * This also kills the last `overflow-x-auto` table in the app: a 6-column grid peeked through a
 * 390px keyhole was the phone experience here, and it is card-rows now.
 */

type Filter = "all" | "hit" | "miss";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hit", label: "Hits" },
  { key: "miss", label: "Misses" },
];

export function TrackRecordTable({ rows }: { rows: ResolvedRow[] }) {
  // ALL, always, by default (P5). The misses are not an opt-in.
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.outcome === filter)),
    [rows, filter],
  );

  const columns: Column<ResolvedRow>[] = useMemo(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        kind: "mono",
        priority: 1,
        value: (r) => r.symbol,
        // A DOOR: this table's rows are inert (no rail, no payload), so the symbol is free to be the
        // link it wants to be. From a resolved signal straight to the name it fired on.
        render: (r) => <TickerChip symbol={r.symbol} door />,
      },
      {
        key: "outcome",
        header: "Outcome",
        kind: "text",
        priority: 1, // line 1 on a phone: the outcome is never below the fold of its own row
        value: (r) => r.outcome,
        render: (r) => <OutcomeChip tone={TONE_OF[r.outcome] ?? "neutral"} label={r.outcome} />,
      },
      { key: "patternLabel", header: "Pattern", kind: "text", priority: 2, value: (r) => r.patternLabel },
      { key: "horizonDays", header: "Horizon (trading days)", kind: "int", priority: 2, value: (r) => r.horizonDays },
      { key: "resolvedAt", header: "Resolved", kind: "text", priority: 2, value: (r) => r.resolvedAt },
      { key: "firedDate", header: "Fired", kind: "text", priority: 3, value: (r) => r.firedDate },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter the record">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cx(
              "min-h-11 rounded-pill border px-4 font-ui text-sm touch-manipulation",
              filter === f.key
                ? "border-transparent bg-accent-soft font-semibold text-accent-deep"
                : "border-hairline text-ink-2 hover:border-hairline-strong",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={shown}
        // Recency of RESOLUTION, newest first. Neutral bookkeeping — not a ranking of anything.
        defaultSort={{ key: "resolvedAt", dir: "desc" }}
        rowKey={(r) => r.id}
        ariaLabel="Resolved signals"
        perPage={50}
      />
    </div>
  );
}

/**
 * A resolved outcome's TONE — and nothing else. The chip itself lives in components/OutcomeChip.tsx.
 *
 * This file used to hold its own copy of that chip, with a comment promising that a hit and a miss
 * render at the same size and weight. Two other files held the same copy and made the same promise,
 * and the three had already drifted (this one painted its neutral case on `bg-band`, a solid
 * mid-purple that its own dark text could not clear). The promise is structural now: one component,
 * one token swapped, and a test that strips the colours off a hit and a miss and asserts nothing
 * else about them differs. See PD6 in OutcomeChip.tsx.
 *
 * Anything not named here is NEUTRAL, and that is the honest default: an "unresolvable" signal is
 * one the market never answered, not one we got wrong.
 */
const TONE_OF: Record<string, OutcomeTone> = {
  hit: "positive",
  miss: "negative",
};
