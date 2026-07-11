import { SectionMasthead } from "@/components/SectionMasthead";
import { RailTrigger } from "@/components/rail/Rail";
import { cx } from "@/lib/cx";
import { copy } from "@/lib/copy";
import type { Direction } from "@/components/StatFigure";

/**
 * Movers — Desk module 04, the day's biggest moves WITH a reason (plan §9.2, §3.6 MoversRow).
 *
 * The highest-leverage terminal pattern for a beginner: a percentage move and its relative volume
 * on the same row, so "why is this moving and is anyone actually trading it?" is answerable at a
 * glance. At P1 the catalyst chips are not wired yet — the row shows the move and RVOL, and a
 * quiet note says reasons arrive in P2. A bare "+21%" with no context is exactly the momentum bait
 * this module exists to defuse, so RVOL is always on the row and the honest noise line stands in
 * for a missing catalyst.
 */

export type Mover = {
  symbol: string;
  name: string;
  /** Already formatted and signed, e.g. "+8.2%". */
  changePct: string;
  direction: Direction;
  /** Relative volume, formatted, e.g. "3.1×". */
  rvol: string;
  /** True when RVOL is low enough that the move is likely noise (Appendix J mover.noNews). */
  likelyNoise: boolean;
};

const DELTA_COLOUR: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
  flat: "text-ink",
};

const GLYPH: Record<Direction, string> = { up: "▲", down: "▼", flat: "" };

export function Movers({ asOf, movers }: { asOf: Date; movers: Mover[] }) {
  return (
    <section aria-label="Movers">
      <SectionMasthead
        index={4}
        title="Movers"
        asOf={asOf}
        action={<span className="font-ui text-2xs text-muted">reasons arrive in P2</span>}
      />

      {movers.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">No notable movers.</p>
      ) : (
        <ul className="pt-2">
          {movers.map((m) => (
            <li key={m.symbol} className="border-b border-hairline last:border-b-0">
              <RailTrigger
                payload={{
                  symbol: m.symbol,
                  name: m.name,
                  changePct: m.changePct,
                  direction: m.direction,
                  rvol: m.rvol,
                  note: m.likelyNoise ? copy.mover.noNews : undefined,
                }}
                className="flex items-baseline gap-4 py-2 hover:bg-desk-bg"
              >
                <span className="w-16 shrink-0 font-ui text-sm font-semibold text-ink">{m.symbol}</span>
                <span className="min-w-0 flex-1 truncate font-ui text-sm text-muted">{m.name}</span>
                <span className={cx("flex w-20 shrink-0 items-baseline justify-end gap-0.5 font-mono text-sm", DELTA_COLOUR[m.direction])}>
                  {m.direction !== "flat" ? <span aria-hidden="true">{GLYPH[m.direction]}</span> : null}
                  {m.changePct}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-sm text-ink-2">{m.rvol}</span>
                {/* No catalyst wiring yet: a low-RVOL move gets the honest noise line, not an invented cause. */}
                <span className="w-64 shrink-0 font-ui text-2xs text-muted">
                  {m.likelyNoise ? copy.mover.noNews : "—"}
                </span>
              </RailTrigger>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
