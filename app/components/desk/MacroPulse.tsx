import { Term } from "@/components/Term";
import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { MacroBoard } from "@/components/desk/MacroBoard";
import { copy } from "@/lib/copy";
import type { MacroBoard as MacroBoardData } from "@/lib/macro-board";
import type { IndexQuote } from "@/lib/morning";

/**
 * MacroPulse — Desk module 01, the market's opening posture at a glance (plan §9.2, Figure 9.2).
 *
 * Every documented professional routine starts macro-first, so this is the top of the ritual
 * column. It carries THE hero numeral of the whole app — the S&P 500 level — and the hero rule is
 * strict: the 64px figure renders in ink, never in the up/down colour, with direction in small type
 * beside it (plan §3.6). Only this module, on the Desk route, may use the hero scale.
 *
 * What this module must never do (redesign §6.1): print an ETF's price under an index's name. Every
 * slot arrives already carrying its own `source` and its own label — an index level, or an ETF that
 * says it is an ETF. This component's whole job on that front is to render the "ETF proxy" chip
 * wherever a proxy is being shown, so the fallback is visible rather than silent.
 *
 * The breadth strip answers "broad or narrow?" — a rally on narrow breadth is a different thing
 * from a broad one, and that is invisible in a price-only view (Research Report §9.2).
 */

type MacroPulseProps = {
  asOf: Date;
  /** The edition's own stamp, for the as-of matches/differs treatment (CC4). See SectionMasthead. */
  editionAsOf?: Date;
  /** The S&P 500 — the hero. */
  spx: IndexQuote;
  /** The other index slots (Nasdaq, Dow, and small caps — the last of which is always an ETF). */
  indices: IndexQuote[];
  /** Breadth of the ingested universe, with the window it covers. */
  breadth: { advancers: number; decliners: number; pctAbove50dma: string; asOf: string };
  /** Context cells pulled from FRED. */
  vix: string;
  tenYear: string;
  /** The provenance line, composed by buildMacro from the rows actually rendered (ruling C6). */
  provenance: string;
  /**
   * The macro board (N3): the five household stats.
   *
   * Null only when the database has no macro_stat rows at all — a brand-new install, before the
   * first nightly. Once any stat exists the board renders, and any cell without one says so itself.
   */
  board?: MacroBoardData | null;
};

/**
 * One index slot: the figure, its window, and — when the number is an ETF's rather than an index's —
 * the ONE chip that says so.
 *
 * The old grammar said "ETF proxy" twice on every proxy row: once as a label suffix ("S&P 500 · SPY
 * (ETF proxy)") and once again as a freestanding chip reading "ETF proxy". On screen that reads as
 * noise, and noise is where a beginner stops reading. There is now exactly one mark, and it says
 * what the number IS — "IWM · ETF price" — rather than merely flagging that something is off.
 */
function IndexSlot({
  quote,
  scale,
  layout = "stack",
}: {
  quote: IndexQuote;
  scale: "hero" | "body" | "dense";
  layout?: "stack" | "row";
}) {
  const delta =
    quote.deltaPct === "—"
      ? undefined
      : { value: quote.deltaPct, direction: quote.direction, window: copy.window.d1 };

  return (
    <div className="flex flex-col gap-1">
      <StatFigure label={quote.label} value={quote.value} scale={scale} layout={layout} delta={delta} />

      {quote.proxyChip ? (
        <span
          title={
            quote.proxySymbol ? copy.macro.proxyNote.replace("{symbol}", quote.proxySymbol) : undefined
          }
        >
          <Tag variant="catalyst">{quote.proxyChip}</Tag>
        </span>
      ) : null}

      {/*
       * The age note, on the ONE row that is behind — never on the rows that are current.
       *
       * The masthead's as-of already covers the normal case, so a date under every figure every
       * night would be chrome. A date under the one figure that is not tonight's is information.
       */}
      {quote.staleAsOf ? (
        <span className="font-mono text-2xs text-muted">{quote.staleAsOf}</span>
      ) : null}
    </div>
  );
}

export function MacroPulse({
  asOf,
  editionAsOf,
  spx,
  indices,
  breadth,
  vix,
  tenYear,
  provenance,
  board = null,
}: MacroPulseProps) {
  return (
    <section aria-label="Macro pulse">
      <SectionMasthead index={1} title="Macro pulse" asOf={asOf} editionAsOf={editionAsOf} />

      <div className="flex flex-col gap-6 pt-4">
        {/* The hero: the S&P 500 level, 64px ink, direction beside it in small type. */}
        <IndexSlot quote={spx} scale="hero" />

        {/*
         * THE FIGURES, BELOW md: TWO GRIDS, NOT A SHELF (PD4, amendment 0.2.1).
         *
         * This module carried the app's one horizontal swipe-shelf for two phases. The shelf's own
         * justification was "position is visibility" — in a rail, what starts off-screen is what gets
         * read least, so the figures were ORDERED by how much they mattered. That argument was sound,
         * and it defeats itself: a grid that shows all five figures at once is strictly more visible
         * than a rail that shows three and hides two. The reasoning survives the shelf's retirement;
         * it is now expressed as ROOM instead of as POSITION.
         *
         * ROW A — the risk gauges, 2-up and roomier. VIX and the 10-year carry information the hero
         * above does NOT: the S&P's level says what the market did, and these two say what it costs to
         * be worried and what money costs. Independent facts get the bigger cells.
         *
         * ROW B — the tape echoes, 3-up and deliberately denser. Nasdaq, the Dow and the small-cap
         * proxy largely restate the equity tape the 64px hero has already stated. They are supporting
         * data, and `dense` is the scale that says so — and, not by coincidence, the only scale that
         * FITS a 3-up cell on a 360px phone (see StatFigure's `dense` note: a nine-character index
         * level at 21px is wider than the cell it would live in, and a mono numeral cannot wrap).
         *
         * The count lines retire with the shelves. `copy.pulse.marketsShelf` said "Markets — 5
         * figures, swipe", and M8 required it: a rail that hides an unstated number of things can hide
         * anything. Nothing is hidden now, so the honest count is the one the reader can see, and a
         * line asserting it would be chrome. The copy keys are deleted, not orphaned.
         */}
        {/*
         * Both groups carry a `data-macro-group` name — the same device PD3 used for the Desk's
         * columns. A layout with a rule about it needs a handle the tests can hold: the unit suite
         * asserts WHICH figures live in which group (the risk/echo split is the whole argument, and a
         * silent reshuffle would erase it), and the browser suite measures the boxes.
         */}
        <div className="flex flex-col gap-2 md:hidden">
          <div data-macro-group="risk" className="grid grid-cols-2 gap-2">
            <Surface className="h-full p-3">
              <StatFigure label="VIX" value={vix} scale="body" />
            </Surface>
            <Surface className="h-full p-3">
              <StatFigure label="10-year" value={tenYear} scale="body" />
            </Surface>
          </div>

          {/*
           * THE TAPE — A LIST, NOT THREE CARDS, AND THE MEASUREMENT IS THE REASON (PD4).
           *
           * Part 7.1 specified this row as a 3-up grid of cards. It was built that way, photographed,
           * and MEASURED, and the arithmetic does not close: three cards across a phone leave 74px of
           * interior at 360 and 91px at 412, while an index level ("22,345.67") is ~81px and its delta
           * chip ("▲ +0.29% · 1D") is ~95px. At 360 the levels overflowed 8px INTO THE CARD NEXT DOOR
           * and the chips shattered into three lines. No type scale fixes that — the cell is simply
           * smaller than the fact it has to hold.
           *
           * A list spends the phone's ONE abundant axis instead of fighting over its scarcest. The
           * figures fit, on one line each, with room to spare.
           *
           * AND IT KEEPS 7.1's ARGUMENT INTACT, which is why this is an amendment and not a
           * countermand. That argument was never "three columns" — it was that the risk gauges carry
           * information the hero does NOT have and deserve room, while these three merely echo the tape
           * the 64px hero has already stated and should read as supporting data. Cards above, a list
           * below, says that MORE plainly than a big card next to a small one ever did.
           */}
          <Surface data-macro-group="tape" className="p-3">
            {indices.map((idx, i) => (
              <div
                key={idx.label}
                // A hairline between rows, never above the first — the card's own edge already does
                // that job, and a second line on top of it reads as a mistake.
                className={i > 0 ? "border-t border-hairline pt-2 mt-2" : undefined}
              >
                <IndexSlot quote={idx} scale="dense" layout="row" />
              </div>
            ))}
          </Surface>
        </div>

        {/*
         * ≥md the grid returns. Desktop has the width; a horizontal scroller there is a toy.
         *
         * THE ORDER IS THE SAME REASONING AS THE SHELF ABOVE, AND NOW IT IS THE SAME ORDER.
         *
         * Until now the desktop grid ran indices-first and the phone shelf ran risk-first, so the
         * two widths disagreed about what mattered. The phone was right. The beginner's questions
         * come in a fixed order — (1) what did the market do? (2) should I be worried? (3) what does
         * money cost? (4) what about the rest of the market? — and the hero directly above ALREADY
         * answers (1). So the two figures carrying information the hero does NOT have, the risk
         * pair, come next; the tape echoes that merely restate it follow.
         */}
        <div className="hidden flex-wrap gap-x-10 gap-y-4 md:flex">
          <StatFigure label="VIX" value={vix} scale="body" />
          <StatFigure label="10-year" value={tenYear} scale="body" />
          {indices.map((idx) => (
            <IndexSlot key={idx.label} quote={idx} scale="body" />
          ))}
        </div>

        {/*
         * WHERE THESE NUMBERS CAME FROM — composed, never recited (ruling C6).
         *
         * This line used to be a fixed string: "Index levels · FRED · prior close". It rendered under
         * whatever the rows happened to show, so on the night FRED's index series failed it sat
         * beneath four ETF prices and declared them FRED index levels. A provenance line that can
         * disagree with its own surface is worse than none at all — it turns a visible gap into an
         * invisible lie. It is now assembled from the sources of the rows that actually rendered.
         */}
        <p className="font-mono text-2xs text-muted">{provenance}</p>

        {/*
         * BREADTH STAYS FIXED AND FULL-WIDTH, BELOW THE FIGURES.
         *
         * It is the module's summary anchor: the one line that claims to describe the WHOLE market.
         * While the figures rode a shelf, this line was deliberately kept OFF it — a claim about
         * everything must not be reachable only by swiping (M2's instinct, that a visible claim may
         * not have a hidden caveat, applied to a scroll container). PD4 retired the shelf, so nothing
         * on this module is off-screen any more and that particular hazard is gone.
         *
         * It stays full-width anyway, because that is what it IS: not a sixth cell in the grid, but
         * the sentence that generalises over the five.
         */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-hairline pt-3">
          <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
            <Term term="breadth">Breadth</Term>
          </span>
          <span className="font-mono text-sm text-ink-2">
            {breadth.advancers} <Term term="advance-decline">advancing</Term> ·{" "}
            {breadth.decliners} declining
          </span>
          <span className="font-mono text-sm text-ink-2">
            {breadth.pctAbove50dma} above the{" "}
            <Term term="50-day-average">50-day average</Term>
            {/*
             * Breadth's window. This line makes a claim about the WHOLE market, and it was the one
             * figure on the module carrying no window at all — it named its indicator's lookback
             * (50 days) but never said when it was measured (C2).
             */}
            <span className="pl-1 text-muted"> · {breadth.asOf}</span>
          </span>
        </div>

        {/*
         * THE MACRO BOARD (N3) — and it sits LAST on purpose.
         *
         * Everything above it is the market's own tape: the index levels, the risk gauges, the one
         * line that generalises over the whole market. This board is a different subject — what the
         * reader's own money is doing, and how the tape FEELS — and putting it after breadth means
         * the module reads as two thoughts in order rather than one long list of unrelated numbers.
         */}
        {board ? <MacroBoard board={board} /> : null}
      </div>
    </section>
  );
}
