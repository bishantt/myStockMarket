import { SectionMasthead } from "@/components/SectionMasthead";
import { RailTrigger } from "@/components/rail/Rail";
import { Tag } from "@/components/Tag";
import { ExternalLink } from "@/components/ExternalLink";
import { cx } from "@/lib/cx";
import { copy } from "@/lib/copy";
import type { Direction } from "@/components/StatFigure";

/**
 * Movers — Desk module 04, the day's biggest moves WITH a reason (plan §9.2, §3.6 MoversRow).
 *
 * The highest-leverage terminal pattern for a beginner: a percentage move and its relative volume
 * on the same row, so "why is this moving and is anyone actually trading it?" is answerable at a
 * glance. And the answer is honest by construction (§1.5 rule 9): a move either carries a CATALYST —
 * a type chip, a one-line reason, and a source link — or it renders the plain "No news found —
 * likely noise" line. A bare "+21%" with no context is exactly the momentum bait this module exists
 * to defuse, so it never appears alone. Market-wide catalyst coverage is partial by design, and the
 * noise line is what says so.
 */

/** The catalyst behind a move: its type, a one-line headline, and where it came from. */
export type Catalyst = {
  /** The catalyst type, e.g. "earnings", "analyst", "m&a" — rendered as the chip label. */
  type: string;
  headline: string;
  source: string;
  url: string;
};

export type Mover = {
  symbol: string;
  name: string;
  /** Already formatted and signed, e.g. "+8.2%". */
  changePct: string;
  direction: Direction;
  /** Relative volume, formatted, e.g. "3.1×". */
  rvol: string;
  /** The matched catalyst, or undefined — in which case the honest noise line renders. */
  catalyst?: Catalyst;
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
      <SectionMasthead index={4} title="Movers" asOf={asOf} />

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
                  note: m.catalyst ? m.catalyst.headline : copy.mover.noNews,
                }}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 hover:bg-desk-bg"
              >
                <span className="w-14 shrink-0 font-ui text-sm font-semibold text-ink">{m.symbol}</span>
                <span className="hidden min-w-0 flex-1 truncate font-ui text-sm text-muted sm:block">{m.name}</span>
                <span className={cx("flex w-20 shrink-0 items-baseline justify-end gap-0.5 font-mono text-sm", DELTA_COLOUR[m.direction])}>
                  {m.direction !== "flat" ? <span aria-hidden="true">{GLYPH[m.direction]}</span> : null}
                  {m.changePct}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-sm text-ink-2">{m.rvol}</span>
                {/* The catalyst — chip, headline, source link — or the noise line. Full-width on a
                 * phone (wraps to its own line so the row never overflows); a fixed column on desktop. */}
                <span className="flex w-full min-w-0 shrink-0 items-baseline gap-2 sm:w-72">
                  {m.catalyst ? (
                    <>
                      <Tag variant="catalyst">{m.catalyst.type}</Tag>
                      <span className="min-w-0 flex-1 font-ui text-2xs text-ink-2 sm:truncate" title={m.catalyst.headline}>
                        {m.catalyst.headline}
                      </span>
                      <ExternalLink href={m.catalyst.url} className="shrink-0 font-ui text-2xs text-ink">
                        {m.catalyst.source}
                      </ExternalLink>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 font-ui text-2xs text-muted sm:truncate" title={copy.mover.noNews}>
                      {copy.mover.noNews}
                    </span>
                  )}
                </span>
              </RailTrigger>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
