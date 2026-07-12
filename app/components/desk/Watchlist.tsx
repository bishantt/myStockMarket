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
  /** The last close, already formatted. */
  price: string;
  changePct: string;
  direction: Direction;
  rvol: string;
  isFocus: boolean;
  /** A small set of recent closes for the sparkline (already numeric). */
  spark: number[];
};

/** The delta chip — semantic text on its own wash, with the sign always inside it. */
const DELTA_CHIP: Record<Direction, string> = {
  up: "text-up-text bg-up-wash",
  down: "text-down-text bg-down-wash",
  flat: "text-ink",
};

/**
 * A tiny inline sparkline: a stroke in the direction's colour, over a soft area fill.
 *
 * Two things about it are worth stating, because they look like rule violations and are not:
 *
 * 1. **It is coloured by direction, and colour is its only channel.** That is legal HERE, and only
 *    here, because the price and the delta chip sit immediately beside it — carrying the triangle,
 *    the sign, and the number. The sparkline is a shape that a redundant, colourblind-safe delta is
 *    already saying out loud. Move it away from that delta and it stops being legal. (§3.8.)
 *
 * 2. **It is a record, not a forecast**, so it may render at all: fourteen days of history, drawn
 *    complete. It never sweeps or draws in — a left-to-right reveal on a price series reads as
 *    momentum, as "…and then", which is precisely the expectation this product refuses to create.
 *
 * It is aria-hidden: the numbers it summarises are already on the row in text.
 */
function Sparkline({ points, direction }: { points: number[]; direction: Direction }) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * 100,
    y: 100 - ((p - min) / range) * 100,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  // The area closes the path down to the baseline, so the fill has something to fill.
  const area = `${line} L100,100 L0,100 Z`;

  const stroke = direction === "down" ? "text-down" : "text-up";
  const fill = direction === "down" ? "url(#spark-down)" : "url(#spark-up)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cx("h-9 w-20 shrink-0", stroke)}
    >
      <defs>
        <linearGradient id="spark-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-up)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-up)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-down)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-down)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
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
                className="flex items-center gap-3 rounded-panel px-2 py-2.5 transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:bg-accent-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-sm font-semibold text-ink">{r.symbol}</span>
                    {r.isFocus ? (
                      <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">focus</span>
                    ) : null}
                  </div>
                  <span className="block truncate font-ui text-2xs text-muted">{r.reason}</span>
                </div>
                <Sparkline points={r.spark} direction={r.direction} />

                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-mono text-sm text-ink">{r.price}</span>
                  <span
                    className={cx(
                      "rounded-chip px-1.5 py-0.5 font-mono text-2xs",
                      DELTA_CHIP[r.direction],
                    )}
                  >
                    {r.changePct}
                  </span>
                </span>
              </RailTrigger>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
