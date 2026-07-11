import { SectionMasthead } from "@/components/SectionMasthead";
import { RailTrigger } from "@/components/rail/Rail";
import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

/**
 * Watchlist — Desk module 05, the focus list (plan §9.2, §3.6).
 *
 * Pros cap attention deliberately: an unbounded list produces scattered, emotional decisions, so
 * the focus list is capped at three names (the cap itself is explained in the UI, and enforced by
 * the write path, not shown here). Each name carries a required written reason — the app makes the
 * user articulate why they are watching it. RVOL rides on the row because it is a base rate in
 * disguise: "is this name unusually active today?".
 */

export type WatchRow = {
  symbol: string;
  name: string;
  /** The user's written reason for watching it (required). */
  reason: string;
  changePct: string;
  direction: Direction;
  rvol: string;
  isFocus: boolean;
  /** A small set of recent closes for the sparkline (already numeric). */
  spark: number[];
};

const DELTA_COLOUR: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
  flat: "text-ink",
};

/**
 * A tiny inline sparkline: a single hairline path, no axes, no colour — a shape, not a chart.
 * Drawn as a normalised SVG polyline so it scales with the row. Purely decorative to a screen
 * reader (the numbers it summarises are on the row), so it is aria-hidden.
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p - min) / range) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="h-6 w-20 text-muted">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Watchlist({ asOf, rows }: { asOf: Date; rows: WatchRow[] }) {
  return (
    <section aria-label="Watchlist">
      <SectionMasthead index={5} title="Focus watchlist" asOf={asOf} />

      {rows.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">
          Nothing on the watchlist yet. Add a name and the reason you are watching it.
        </p>
      ) : (
        <ul className="pt-2">
          {rows.map((r) => (
            <li key={r.symbol} className="border-b border-hairline last:border-b-0">
              <RailTrigger
                payload={{
                  symbol: r.symbol,
                  name: r.name,
                  changePct: r.changePct,
                  direction: r.direction,
                  rvol: r.rvol,
                  note: r.reason,
                }}
                className="flex items-center gap-4 py-2 hover:bg-desk-bg"
              >
                <div className="w-20 shrink-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-ui text-sm font-semibold text-ink">{r.symbol}</span>
                    {r.isFocus ? (
                      <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">focus</span>
                    ) : null}
                  </div>
                  <span className="font-ui text-2xs text-muted">{r.name}</span>
                </div>
                <span className="min-w-0 flex-1 truncate font-ui text-2xs text-ink-2">{r.reason}</span>
                <Sparkline points={r.spark} />
                <span className={cx("w-16 shrink-0 text-right font-mono text-sm", DELTA_COLOUR[r.direction])}>
                  {r.changePct}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-sm text-ink-2">{r.rvol}</span>
              </RailTrigger>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
