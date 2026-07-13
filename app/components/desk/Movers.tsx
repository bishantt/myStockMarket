import { Disclosure } from "@/components/Disclosure";
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

/** The delta chip: semantic text on its own soft wash. Never colour alone — the triangle and the
 * sign ride with it, always. */
const DELTA_CHIP: Record<Direction, string> = {
  up: "text-up-text bg-up-wash",
  down: "text-down-text bg-down-wash",
  flat: "text-ink",
};

/** RVOL is emphasised once it clears 2x — the point at which "unusual volume" stops being a phrase
 * and starts being a fact. It is accent, because it is the row's one interactive-grade signal. */
const RVOL_EMPHASIS_THRESHOLD = 2;

const GLYPH: Record<Direction, string> = { up: "▲", down: "▼", flat: "" };

/** How many movers stay in view on a phone before the rest fold away (§4.1). */
const VISIBLE_ON_PHONE = 3;

export function Movers({ asOf, movers }: { asOf: Date; movers: Mover[] }) {
  const head = movers.slice(0, VISIBLE_ON_PHONE);
  const tail = movers.slice(VISIBLE_ON_PHONE);

  return (
    <section aria-label="Movers">
      <SectionMasthead index={4} title="Movers" asOf={asOf} />

      {movers.length === 0 ? (
        // A day where nothing cleared the bar is information, not an empty shelf.
        <p className="max-w-[46ch] pt-4 font-prose text-base text-ink-2">{copy.mover.quiet}</p>
      ) : (
        <>
          {/*
           * MOVERS ARE A READ STATION, AND A READ STATION NEVER RIDES A SHELF.
           *
           * An earlier draft of the plan put these on a swipeable rail and the adversarial pass
           * caught it contradicting the plan's own reasoning: a mover row carries a headline and a
           * source link — that is READING content, and putting reading content on a pan axis invites
           * carousel-skimming of exactly the material that must be read rather than glanced. It also
           * puts a fresh touch target (the source link) back in harm's way on a scrolling surface.
           *
           * So the rows stay vertical at every width. What changes on a phone is only how many of
           * them are in view at once: the first three by the pipeline's own rank, and the rest one
           * labelled tap away. Nothing is removed; the full anatomy of every row — catalyst chip,
           * headline, source, or the honest noise line — is unchanged (P8).
           */}
          <ul className="pt-2">
            {head.map((m) => (
              <li key={m.symbol} className="border-b border-hairline last:border-b-0">
                <MoverRow mover={m} />
              </li>
            ))}
          </ul>

          {tail.length > 0 ? (
            <div className="md:hidden">
              <Disclosure label={copy.disclosure.movers} count={tail.length} context="by rank">
                <ul>
                  {tail.map((m) => (
                    <li key={m.symbol} className="border-b border-hairline last:border-b-0">
                      <MoverRow mover={m} />
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          ) : null}

          {/* ≥md there is room for the whole set: the tail renders inline, with no disclosure. */}
          {tail.length > 0 ? (
            <ul className="hidden md:block">
              {tail.map((m) => (
                <li key={m.symbol} className="border-b border-hairline last:border-b-0">
                  <MoverRow mover={m} />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {movers.length > 0 ? (
        <p className="max-w-[70ch] pt-4 font-ui text-2xs text-muted">{copy.mover.relvolNote}</p>
      ) : null}
    </section>
  );
}

/**
 * One mover row. The anatomy never changes with the container (P8): symbol, name, the delta chip,
 * RVOL, and then either the catalyst — chip, headline, source link — or the honest noise line. A
 * mover with no explanation says so; it never gets a manufactured one.
 */
function MoverRow({ mover: m }: { mover: Mover }) {
  return (
<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
<RailTrigger
                payload={{
                  symbol: m.symbol,
                  name: m.name,
                  changePct: m.changePct,
                  direction: m.direction,
                  rvol: m.rvol,
                  note: m.catalyst ? m.catalyst.headline : copy.mover.noNews,
                }}
                // The hover feedback is a BACKGROUND shift, never a lift: this row contains a delta
                // chip, and a transform on an ancestor would move a money visual (P2, §3.6).
                className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 rounded-panel px-2 py-2.5 transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:bg-accent-muted"
              >
                <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ink">{m.symbol}</span>
                <span className="hidden min-w-0 flex-1 truncate font-ui text-sm text-muted sm:block">{m.name}</span>
                {/*
                 * The window rides INSIDE the chip (ruling C2). "+8.2%" is not a fact; "+8.2% · 1D"
                 * is — a percentage with no period attached is a number the reader has to guess the
                 * meaning of, and a beginner will guess wrong. It is set quieter than the figure
                 * because it is the figure's UNIT, not a second number.
                 */}
                <span className={cx("flex shrink-0 items-baseline gap-0.5 rounded-chip px-1.5 py-0.5 font-mono text-sm", DELTA_CHIP[m.direction])}>
                  {m.direction !== "flat" ? <span aria-hidden="true">{GLYPH[m.direction]}</span> : null}
                  {m.changePct}
                  <span className="pl-1 text-2xs font-normal">· {copy.window.d1}</span>
                </span>

                {/*
                 * And RVOL states what it is relative TO, on the cell. It used to depend on a
                 * footnote at the bottom of the module — which the footnote still carries, for the
                 * definition — but a reader who meets "3.1×" first meets a number with no unit.
                 */}
                <span
                  className={cx(
                    "shrink-0 text-right font-mono text-sm",
                    parseFloat(m.rvol) >= RVOL_EMPHASIS_THRESHOLD ? "font-semibold text-accent-deep" : "text-ink-2",
                  )}
                >
                  {m.rvol}
                  <span className="pl-1 font-normal text-2xs text-muted">· {copy.window.avg20d}</span>
                </span>
              </RailTrigger>
                {/* The catalyst — chip, headline, source link — or the noise line. Full-width on a
                 * phone (wraps to its own line so the row never overflows); a fixed column on desktop. */}
                <span className="flex w-full min-w-0 shrink-0 items-baseline gap-2 sm:w-72">
                  {m.catalyst ? (
                    <>
                      <Tag variant="catalyst">{m.catalyst.type}</Tag>
                      <span className="min-w-0 flex-1 font-ui text-2xs text-ink-2 sm:truncate" title={m.catalyst.headline}>
                        {m.catalyst.headline}
                      </span>
                      <ExternalLink href={m.catalyst.url} className="flex min-h-11 shrink-0 items-center font-ui text-2xs text-accent-deep md:min-h-0">
                        {m.catalyst.source}
                      </ExternalLink>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 font-prose text-2xs italic text-muted sm:truncate" title={copy.mover.noNews}>
                      {copy.mover.noNews}
                    </span>
                  )}
                </span>
              </div>
  );
}
