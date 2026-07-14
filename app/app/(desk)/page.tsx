import Link from "next/link";

import { EmptyModule } from "@/components/EmptyModule";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Surface } from "@/components/Surface";
import { MacroPulse } from "@/components/desk/MacroPulse";
import { BriefArticle } from "@/components/desk/BriefArticle";
import { FrontPagePreview } from "@/components/desk/FrontPagePreview";
import { DeskHeader } from "@/components/desk/DeskHeader";
import { Movers } from "@/components/desk/Movers";
import { Watchlist } from "@/components/desk/Watchlist";
import { ScorecardPM } from "@/components/desk/ScorecardPM";
import { SetupCards } from "@/components/desk/SetupCards";
import { CalendarTimeline } from "@/components/desk/CalendarTimeline";
import { SourceStatusFooter } from "@/components/desk/SourceStatusFooter";
import { PipelineStrip } from "@/components/desk/PipelineStrip";
import { RailProvider } from "@/components/rail/Rail";
import { OfflineRibbon } from "@/components/OfflineRibbon";
import { getLatestCompletedRun, getLatestRun } from "@/lib/pipeline";
import { marketState } from "@/lib/market-hours";
import { getMorning } from "@/lib/morning";
import { getTrackRecord } from "@/lib/track-record";
import { formatEtDate } from "@/lib/time";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * The Desk — the one-screen ritual, laid out as a broadsheet spread (§5.1, §3.9).
 *
 * The modules mount in the fixed ritual order (macro → brief → calendar → movers → watchlist →
 * setup cards → sectors/scans → scorecard). That order is the invariant: it mirrors the documented
 * professional pre-market sequence, so the layout itself teaches the routine, and it is the same on
 * every visit whether or not a module has data yet.
 *
 * At 1024px the column becomes a SPREAD — a wide main column and a rail — and the split is not
 * decorative. The main column keeps the narrative in order, the things you read *through*: Pulse,
 * Brief, Movers, Setups, Scorecard. The rail holds the standing matter, the things you *glance at*:
 * the Watchlist and the Calendar in its compact form. That is how a front page works, and it is why
 * the two columns are not interchangeable.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * LAW 1 — THE TWO COLUMNS FLOW INDEPENDENTLY (PD3, §6.2). This is the hole-killer, and it is the
 * whole reason this page was rewritten.
 *
 * THE DEFECT. The spread used to be ONE grid: every module a direct child, pinned to a column with
 * `lg:col-start-*`, placed into shared implicit rows. **A grid row is as tall as its tallest cell.**
 * On a thin night the Brief renders its held state (~200px) while its row-partner — the Calendar,
 * default-OPEN on desktop by APP-FEEL's own rule — renders a full session (~600px). `items-start`
 * pinned the short Brief to the top of that shared track, and the difference became a DEAD HOLE
 * directly under the Brief: Movers is pinned to column 1 of the NEXT row and cannot begin until the
 * Calendar's track ends. `grid-flow-row-dense` cannot help — it backfills empty CELLS, not slack
 * inside a track. The user photographed this on a 16" MacBook, which is where it is widest.
 *
 * THE FIX. The main column and the rail are now two INDEPENDENTLY-FLOWING STACKS — two flex columns
 * side by side inside a two-cell grid. They share no row tracks at all, so there is no track for a
 * short module to leave slack in. A short main module is followed IMMEDIATELY by the next one, and
 * the rail packs its own reference matter beside them, at whatever height it happens to be.
 *
 * THE PRICE, STATED PLAINLY, BECAUSE IT IS REAL AND IT IS NOT FREE.
 * CSS can only group children that are ADJACENT IN THE DOM. The ritual interleaves the two columns
 * (brief, calendar, movers, watchlist…), so a DOM that reads in ritual order and a DOM that groups
 * the columns are mutually exclusive — you cannot have both, in any CSS that exists. Something has
 * to give, and what gives is the DOM:
 *
 *   · THE DOM ORDER IS NOW MAIN-THEN-RAIL at every width: 01, then the main stations (02, 04, 06,
 *     07/08 + scorecard), then the rail's reference matter (03, 05). That is the reading order
 *     amendment 0.2.2 blesses for ≥lg — a broadsheet is read column-first; nobody reads a newspaper
 *     row-by-row across columns — and it is what a screen reader now hears at EVERY width, which at
 *     least makes it one consistent order rather than two.
 *   · BELOW lg the ritual is restored VISUALLY, with `display: contents` on the wrappers (which
 *     dissolves them, so the modules become grid items of this grid again) plus the `order`
 *     utilities below. The order numbers ARE the ritual indices — that is not a coincidence worth
 *     hiding, it is the point. The pulse needs none: it is order 0 by default, and every other
 *     module carries a positive order, so it is always first.
 *   · THE COST: below lg, a SIGHTED KEYBOARD user tabs main-then-rail while seeing the ritual. That
 *     is a WCAG 2.4.3 divergence and axe cannot see it (no tool can — it is a comparison between
 *     two orders, not a property of one). It is stated in DECISIONS.md rather than discovered, and
 *     e2e/grid.spec.ts pins BOTH orders so neither can drift by accident.
 *
 * The alternative shape — a rail that row-SPANS the main column, which would have kept the ritual
 * DOM — was tried on paper and is strictly worse: when the rail is taller than the main column, the
 * grid grows the spanned rows to fit it, and the dead gap comes straight back, merely distributed
 * between the main modules instead of pooled under the Brief. That is the thin-night case, which is
 * the case this law exists for.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

// The Desk is served from a cached render (ISR), not rebuilt per request — that is what keeps its
// TTFB, and so its LCP, low (the data changes once a night, not per visit; plan §4.5). The render is
// refreshed on demand: Job A calls /api/revalidate after publishing, and a watchlist write calls
// revalidatePath("/"). The 10-minute fallback bounds staleness if an on-demand refresh is missed.
export const revalidate = 600;

export default async function DeskPage() {
  const [latest, lastCompleted, morning, trackRecord] = await Promise.all([
    getLatestRun(),
    getLatestCompletedRun(),
    getMorning(),
    getTrackRecord(1),
  ]);

  // The cached reads return ISO strings; reconstruct the Dates the components format. A live module
  // always carries an "as of" timestamp, and that timestamp comes from a recorded run. If no run is
  // recorded, asOf is null and every live module shows its placeholder — the Desk never stamps a
  // module with a fabricated date.
  const asOf = morning.asOf ? new Date(morning.asOf) : null;
  const lastRunFinishedAt = latest?.finishedAt ? new Date(latest.finishedAt) : null;
  const runDate = latest ? new Date(latest.runDate) : null;

  /*
   * The broadsheet spread engages at `lg:` (1024px), not only at `desk:` (1366px).
   *
   * Before this, a 1024–1365px window — which is most laptop windows sharing a screen — got the same
   * single phone column with more margin. The arithmetic says it did not have to: gutters stay at
   * 16px until `desk:` (the 32px step-up would spend width exactly where it is scarce), so at 1024px
   * the main column measures 1024 − 32 − 320 − 24 = 648px, about 600px of card interior. The Brief
   * holds comfortably (65ch of Newsreader is ≈540px), and the rail's compact calendar and watchlist
   * rows hold at ~272px.
   *
   * Two columns genuinely cannot reach below 1024 by arithmetic: at 768px the main column would be
   * 768 − 32 − 280 − 24 ≈ 432px, under the Brief's measure floor. So the md band (768–1023, which is
   * exactly iPad portrait) keeps the ritual column and caps it at a 720px measure instead — a 990px
   * wide card is a stretched receipt, which is the very disease this plan opened with, one band down.
   */

  /*
   * A column stack (Law 1). Below `lg` it is `display: contents` — the wrapper DISSOLVES, and its
   * modules become direct grid items of the spread again, which is what lets the single phone column
   * put them back in ritual order with `order`. At `lg` and above it becomes a real flex column: one
   * of the two independently-flowing stacks, with the same 24px rhythm as the grid it sits in.
   *
   * `contents` is safe here precisely because these wrappers carry no semantics — they are plain
   * divs with no role and no label, so dissolving them removes nothing from the accessibility tree.
   * (The `data-column` hooks are for the tests, which walk these stacks to prove the columns never
   * trade heights and that no dead gap opens between consecutive main modules.)
   */
  const COLUMN = "contents lg:flex lg:flex-col lg:gap-6";

  /*
   * THE ORDER NUMBERS ARE THE RITUAL INDICES. Below `lg` they put the dissolved modules back into
   * the reading order the phone must always have; at `lg` and above they are inert, because within
   * each column the numbers already ascend in DOM order (main: 2 < 4 < 6 < 7; rail: 3 < 5).
   *
   * One set of numbers, correct at every width, and it spells the ritual out loud.
   */
  const BRIEF = "order-2";
  const CALENDAR = "order-3";
  const MOVERS = "order-4";
  const WATCHLIST = "order-5";
  const SETUPS = "order-6";
  const CLOSING = "order-7";

  return (
    <RailProvider>
      {runDate ? (
        <DeskHeader
          runDate={runDate}
          updatedAt={lastRunFinishedAt}
          marketOpen={marketState(new Date()) === "open"}
        />
      ) : null}

      {/*
       * The pipeline strip — page CHROME, not a ritual station (NEWS-AND-CONTROL-PLAN Part 4.1).
       *
       * Module 00 used to be a full Surface card in the first grid position — the most valuable slot
       * the phone viewport has — carrying one date and one sentence that never changed. It looked
       * identical on a healthy night and on a night the pipeline had been dead for a week, which
       * means it was not a freshness indicator; it was a decoration that mentioned freshness.
       *
       * It is one line now, and it escalates: quiet when fresh, amber when a session was missed, and
       * the loudest surface in the app when the pipeline is actually dead. It mounts HERE, above the
       * grid and outside the ritual, because it describes the whole page rather than being one
       * station within it. The ritual now runs 01 → 07, and that order stays inviolable — retiring a
       * station is not reordering the ones that remain.
       *
       * It renders even when nothing has ever run: an empty database gets the quiet "not yet" line,
       * not silence.
       */}
      <PipelineStrip run={lastCompleted} serverNow={new Date().toISOString()} />

      {/* The offline band — shows only when the browser is offline, naming what is on screen. */}
      <OfflineRibbon syncedDate={asOf ? formatEtDate(asOf) : "—"} />

      {/*
       * The widest band, `wide:` (≥1536px), buys INTERNAL DENSITY — not a third column.
       *
       * The rail widens to 360px and the setup cards go two-up inside the main column (they are
       * independent cards, not prose). What does NOT change: the brief and the movers stay one-up,
       * because they are READ stations, and there is no third column at any width. A second reading
       * column would split the ritual's order into two ambiguous streams — the reader would have to
       * decide which column comes first, and the whole argument for the ritual is that they never
       * have to decide anything about the order.
       */}
      <div
        data-desk-grid
        className="mx-auto grid max-w-[720px] grid-cols-1 gap-6 pt-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start desk:grid-cols-[minmax(0,1fr)_340px] wide:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/*
         * 01 — Macro pulse. The hero, and the only module that spans the spread.
         *
         * It stays a direct child of the grid, above both stacks, because it belongs to neither
         * column: it is the page's one shared header. It needs no `order` — order 0 is the default
         * and every other module carries a positive one, so the pulse is first at every width.
         */}
        {asOf && morning.macro ? (
          <Surface className="p-5 lg:col-span-2 desk:p-6">
            <MacroPulse asOf={asOf} {...morning.macro} board={morning.macroBoard} />
          </Surface>
        ) : (
          <EmptyModule
            index={1}
            title="Macro pulse"
            note="Index levels and breadth arrive with the nightly ingest."
            className="lg:col-span-2"
          />
        )}

        {/*
         * THE MAIN COLUMN — the narrative, the stations you read *through*.
         *
         * Its modules follow one another immediately, at their natural heights, with nothing in the
         * rail able to push them apart. That sentence is the entire point of Law 1.
         */}
        <div data-column="main" className={COLUMN}>
          {/* 02 — the evening briefing: the editorial centrepiece. */}
          {asOf && morning.brief ? (
            <Surface className={cx("p-5 desk:p-6", BRIEF)}>
              <BriefArticle asOf={asOf} brief={morning.brief} />
            </Surface>
          ) : (
            <EmptyModule
              index={2}
              title="Daily brief"
              note="The evening briefing lands after the close."
              className={BRIEF}
            />
          )}

          {/* 04 — Movers: the volume-confirmed moves, each with a catalyst or the noise line. */}
          {asOf && morning.movers ? (
            <Surface className={cx("p-5 desk:p-6", MOVERS)}>
              <Movers asOf={asOf} movers={morning.movers} />
            </Surface>
          ) : (
            <EmptyModule
              index={4}
              title="Movers"
              note="Movers arrive with the nightly scans."
              className={MOVERS}
            />
          )}

          {/*
           * 06 — setup cards: the signature unit.
           *
           * THE TWO WAYS TO BE EMPTY ARE DIFFERENT FACTS, and PD3 is where the Desk started saying so.
           *
           * `morning.setupCards` is NULL when nothing has ever run, and an EMPTY ARRAY when the run
           * happened and no setup fired. An empty array is truthy, so this branch used to hand `[]`
           * to SetupCards, which rendered its own bespoke "no setup cards today" line — 124px tall,
           * over Law 2's band budget, and carrying no timestamp at all.
           *
           * They are not the same statement and they should not read the same. "Setup cards arrive
           * with the nightly base rates" describes a schedule. "No setups fired tonight" is a FINDING
           * — the base rates looked and found nothing worth flagging — and a finding is as of a
           * moment, so it takes the run's stamp. That distinction is the whole difference between an
           * app that has not run and an app that has run and has nothing to sell you.
           */}
          {asOf && morning.setupCards && morning.setupCards.length > 0 ? (
            <Surface className={cx("p-5 desk:p-6", SETUPS)}>
              <SetupCards asOf={asOf} cards={morning.setupCards} />
            </Surface>
          ) : (
            <EmptyModule
              index={6}
              title="Setup cards"
              /*
               * ONE LINE, AND IT HAS TO STAY ONE LINE — Law 2's band is "masthead + one line +
               * timestamp". The first draft of this read "No setups fired tonight — the base rates
               * found nothing worth flagging", which is 67 characters: one line on a desk, TWO on a
               * 390px phone, and the band went from 104px to 132px. A budget that only holds at the
               * width you happened to test is not a budget. Keep it under about 45 characters.
               */
              note={asOf ? "No setups fired tonight." : "Setup cards arrive with the nightly base rates."}
              asOf={asOf ?? undefined}
              className={SETUPS}
            />
          )}

        {/*
         * 07 + 08 + the scorecard SHARE a row on a wide desk (NEWS-AND-CONTROL-PLAN Part 4.2/4.3).
         *
         * Module 07's payload is a count, a doorway and one honesty line. On a 1366px desk it was
         * taking the full width of the main column to say that — roughly 960px of card to carry a
         * sentence. It is a half-width card now, beside the front-page preview, and the wrapper is
         * what puts it there.
         *
         * The wrapper is a grid rather than a wrapping flex row because grid stretches both cards to
         * the same height, and two cards of visibly different heights side by side is the thing that
         * makes a spread look assembled rather than designed. That `h-full` is the ONE sanctioned
         * height instruction on a module Surface, and it is not a Law 2 violation: it does not
         * RESERVE height against content that may never come — it matches a sibling that is right
         * there, in the same row, already that tall. Law 2 bans the promise, not the match.
         *
         * Below `desk:` it is a single column with the same 24px gap as the stack it sits in, so the
         * phone and tablet layouts are unchanged: the ritual is one column, and this block is one
         * station of it, holding 07 → 08 → scorecard in order.
         */}
        <div className={cx("grid grid-cols-1 items-start gap-6 desk:grid-cols-2", CLOSING)}>
        {/*
         * 07 — scans. A GLANCE station, so it now reads like one.
         *
         * It used to be a paragraph of prose pointing at another page, which is the opposite of a
         * glance: a station you have to READ in order to learn a number you could have been shown.
         * It is a count and a doorway now. The number comes from one grouped count in the morning
         * loader, amortised by the route's cache.
         */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <SectionMasthead index={7} title="Sectors & scans" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4">
            {/*
             * A GLANCE, not a second hero. `num-lg` here rendered "52 matches across 4 scans" as a
             * three-line block of 32px numerals that competed with the S&P for the eye — and the Desk
             * gets exactly ONE hero figure (P14), which is spent on the index level at the top. This
             * is a sentence with a number in it, set to be read in passing.
             */}
            <p className="font-mono text-base tabular-nums text-ink">
              {fill(copy.desk.scanCount, { n: morning.scans.matches, k: morning.scans.presets })}
            </p>
            <Link
              href="/scans"
              className="flex min-h-11 items-center font-ui text-sm text-accent-deep underline-offset-2 hover:underline"
            >
              All scans →
            </Link>
          </div>
          <p className="pt-2 font-ui text-2xs text-muted">
            Each preset shows its criteria and its evidence grade. A match is a filter hit, not a
            forecast.
          </p>
        </Surface>

        {/* 08 — the Front Page, previewed. A glance and a doorway; the room does the rest. */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <FrontPagePreview
            top={morning.frontPage.top}
            total={morning.frontPage.total}
            asOf={asOf ?? undefined}
          />
        </Surface>

        {/* The evening counterpart to the morning ritual: the scorecard and the PM journal. Always
            present so the routine's shape is complete; the journal writes whether or not a run is
            recorded, so it does not gate on asOf. */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <ScorecardPM
            asOf={asOf ?? undefined}
            resolved={trackRecord.summary}
            savedTonight={morning.journalSavedToday}
          />
        </Surface>
        </div>
        </div>

        {/*
         * THE RAIL — the standing matter, the things you *glance at*.
         *
         * It packs its own reference matter beside the main column and never trades heights with it.
         * A tall calendar on a thin night now simply makes the rail tall; it can no longer reach
         * across and push the main column's modules apart, because there is no shared track left for
         * it to push through.
         */}
        <div data-column="rail" className={COLUMN}>
          {/*
           * 03 — Session calendar, in its compact variant: a reader glances at what is coming, they
           * do not read through it. In the phone's single column it renders full-width, in its
           * ritual position — which is what `order-3` is for.
           */}
          {asOf && morning.calendar ? (
            <Surface className={cx("p-5", CALENDAR)}>
              <CalendarTimeline asOf={asOf} events={morning.calendar} compact />
            </Surface>
          ) : (
            <EmptyModule
              index={3}
              title="Session calendar"
              note="Scheduled catalysts arrive with the nightly ingest."
              className={CALENDAR}
            />
          )}

          {/* 05 — Focus watchlist: standing matter, so it lives in the rail. */}
          {asOf && morning.watch ? (
            <Surface className={cx("p-5", WATCHLIST)}>
              <Watchlist asOf={asOf} rows={morning.watch} />
            </Surface>
          ) : (
            <EmptyModule
              index={5}
              title="Focus watchlist"
              note="Add names and the reason you are watching them."
              className={WATCHLIST}
            />
          )}
        </div>
      </div>

      {/*
       * The provenance line: which sources ran, which degraded, and the FRED attribution.
       *
       * It sits UNDER the grid now, not in the rail (Part 4.2). It is a provenance stamp on the
       * whole page rather than one more thing to glance at, and a footer belongs at the foot.
       *
       * It carries no card wrapper here, because it decides its own chrome: a plain line on a
       * healthy night, and a full forced-open card on a night a source failed. That decision is
       * inside the component, where a caller cannot get it wrong.
       */}
      <SourceStatusFooter
        sources={morning.sources}
        window={lastRunFinishedAt ? `until ${formatEtDate(lastRunFinishedAt)}` : undefined}
      />
    </RailProvider>
  );
}
