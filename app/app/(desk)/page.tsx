import Link from "next/link";

import { EmptyModule } from "@/components/EmptyModule";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
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
import { getMorning } from "@/lib/morning";
import { getTrackRecord } from "@/lib/track-record";
import { formatEtDate } from "@/lib/time";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * The Desk — the one-screen ritual, laid out as a broadsheet spread (§5.1, §3.9).
 *
 * The modules mount in the fixed ritual order (macro → brief → calendar → movers → watchlist → setup
 * cards → sectors/scans → scorecard) — the invariant that mirrors the pre-market sequence, the same on
 * every visit whether or not a module has data. At 1024px the column becomes a SPREAD (wide main column +
 * rail): the main column holds what you read *through* (Pulse, Brief, Movers, Setups, Scorecard), the
 * rail the standing matter you *glance at* (Watchlist, compact Calendar). The two are not interchangeable.
 *
 * LAW 1 — THE TWO COLUMNS FLOW INDEPENDENTLY (PD3, §6.2), the hole-killer this page was rewritten for.
 * THE DEFECT: the spread was ONE grid, every module pinned to a column in shared implicit rows, and a
 * grid row is as tall as its tallest cell. On a thin night the held Brief (~200px) shares a track with a
 * default-open Calendar (~600px), `items-start` pins the short Brief up, and a DEAD HOLE opens under it —
 * Movers cannot begin until the Calendar's track ends (`grid-flow-row-dense` backfills cells, not slack).
 * Photographed on a 16" MacBook, where it is widest. THE FIX: main and rail are now two INDEPENDENTLY-
 * FLOWING flex stacks side by side, sharing no row tracks, so no short module can leave slack.
 * THE PRICE, STATED: CSS groups only DOM-adjacent children, and the ritual interleaves the columns, so a
 * ritual-order DOM and column-grouped wrappers are mutually exclusive. The DOM is now MAIN-THEN-RAIL at
 * every width (01, then main 02/04/06/07-08+scorecard, then rail 03/05) — the column-first reading order
 * amendment 0.2.2 blesses for ≥lg, and what a screen reader hears at every width. Below lg the ritual is
 * restored VISUALLY (`display: contents` on the wrappers + `order` utilities whose numbers ARE the ritual
 * indices), so a sighted keyboard user there tabs main-then-rail while seeing the ritual — a WCAG 2.4.3
 * divergence no tool can detect, stated in DECISIONS.md and pinned BOTH ways in e2e/grid.spec.ts. The
 * alternative (a rail that row-SPANS the main column, keeping the ritual DOM) is strictly worse: a tall
 * rail grows the spanned rows and the dead gap returns, distributed — the thin-night case this law is for.
 */

// The Desk is served from a cached render (ISR), not rebuilt per request — what keeps TTFB and LCP low
// (data changes once a night; plan §4.5). Refreshed on demand: Job A calls /api/revalidate after
// publishing, a watchlist write calls revalidatePath("/"); the 10-minute fallback bounds staleness.
export const revalidate = 600;

export default async function DeskPage() {
  const [latest, lastCompleted, morning, trackRecord] = await Promise.all([
    getLatestRun(),
    getLatestCompletedRun(),
    getMorning(),
    getTrackRecord(1),
  ]);

  // The cached reads return ISO strings; reconstruct the Dates the components format. asOf comes from a
  // recorded run — null if none, so every live module shows its placeholder rather than a fabricated date.
  const asOf = morning.asOf ? new Date(morning.asOf) : null;
  const lastRunFinishedAt = latest?.finishedAt ? new Date(latest.finishedAt) : null;
  const runDate = latest ? new Date(latest.runDate) : null;

  // The edition's own "updated" stamp — what the masthead prints (CC3) and what every module's as-of
  // is measured against (CC4, D4). Today it equals morning.asOf (one run), so every module matches and
  // its stamp recedes; the CC9 morning edition refreshes some modules at dawn, and THOSE stamps differ
  // and come forward. Threaded to every module so the treatment is wired, not dormant.
  const editionAsOf = lastRunFinishedAt ?? undefined;

  /*
   * The spread engages at `lg:` (1024px), not only `desk:` (1366px). Gutters stay 16px until desk:, so at
   * 1024px the main column measures 1024 − 32 − 320 − 24 = 648px (~600px interior) — the Brief holds (65ch
   * Newsreader ≈540px) and the rail rows hold at ~272px. Two columns cannot reach below 1024 by arithmetic
   * (at 768 the main column ≈432px, under the Brief's floor), so the md band (768–1023, iPad portrait)
   * keeps the ritual column capped at a 720px measure — a 990px card is the stretched receipt this plan
   * opened against.
   */

  /*
   * A column stack (Law 1). Below `lg` it is `display: contents` — the wrapper DISSOLVES and its modules
   * become grid items again, which lets the phone column put them back in ritual order with `order`. At
   * `lg`+ it is a real flex column, one of the two independently-flowing stacks. `contents` is safe here
   * because the wrappers carry no semantics (plain divs, no role/label); the `data-column` hooks are for
   * the tests that prove the columns never trade heights.
   */
  const COLUMN = "contents lg:flex lg:flex-col lg:gap-6";

  /*
   * THE ORDER NUMBERS ARE THE RITUAL INDICES. Below `lg` they put the dissolved modules back in reading
   * order; at `lg`+ they are inert (within each column the numbers already ascend in DOM order — main:
   * 2 < 4 < 6 < 7; rail: 3 < 5). One set, correct at every width.
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
        <DeskHeader runDate={runDate} updatedAt={lastRunFinishedAt} />
      ) : null}

      {/*
       * The pipeline strip — page CHROME, not a ritual station (NEWS-AND-CONTROL Part 4.1). Module 00 was
       * a full Surface card in the phone's best slot, one date and one sentence identical on a healthy
       * night and a week-dead one — a decoration that mentioned freshness. It is one line now, escalating:
       * quiet when fresh, amber when a session was missed, the loudest surface when the pipeline is dead.
       * It mounts HERE, above the grid and outside the ritual (01 → 07 stays inviolable), and renders even
       * when nothing has run: an empty database gets the quiet "not yet" line, not silence.
       */}
      <PipelineStrip
        run={lastCompleted}
        serverNow={new Date().toISOString()}
        sourceCount={morning.sources.length}
        degradedCount={morning.sources.filter((s) => s.status !== "ok").length}
      />

      {/* The offline band — shows only when the browser is offline, naming what is on screen. */}
      <OfflineRibbon syncedDate={asOf ? formatEtDate(asOf) : "—"} />

      {/*
       * The widest band `wide:` (≥1536px) buys INTERNAL DENSITY, not a third column: the rail widens to
       * 360px and setup cards go two-up (independent cards, not prose). Brief and movers stay one-up — they
       * are READ stations, and a second reading column would split the ritual into two ambiguous streams,
       * which the whole argument for the ritual exists to avoid.
       */}
      <div
        data-desk-grid
        className="mx-auto grid max-w-[720px] grid-cols-1 gap-6 pt-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start desk:grid-cols-[minmax(0,1fr)_340px] wide:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/*
         * 01 — Macro pulse. The hero, and the only module that spans the spread. A direct child of the
         * grid, above both stacks, because it belongs to neither column. No `order` needed — order 0 is
         * the default, so the pulse is first at every width.
         */}
        {asOf && morning.macro ? (
          <Surface className="p-5 lg:col-span-2 desk:p-6">
            <MacroPulse asOf={asOf} editionAsOf={editionAsOf} {...morning.macro} board={morning.macroBoard} />
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
         * THE MAIN COLUMN — the narrative you read *through*. Its modules follow one another immediately at
         * their natural heights, with nothing in the rail able to push them apart. That is Law 1's point.
         */}
        <div data-column="main" className={COLUMN}>
          {/* 02 — the evening briefing: the editorial centrepiece. */}
          {asOf && morning.brief ? (
            <Surface className={cx("p-5 desk:p-6", BRIEF)}>
              <BriefArticle asOf={asOf} editionAsOf={editionAsOf} brief={morning.brief} />
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
              <Movers asOf={asOf} editionAsOf={editionAsOf} movers={morning.movers} />
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
           * 06 — setup cards: the signature unit. THE TWO WAYS TO BE EMPTY ARE DIFFERENT FACTS (PD3):
           * `setupCards` is NULL when nothing ran, an EMPTY ARRAY when the run fired no setup. An empty
           * array is truthy, so this once handed `[]` to SetupCards and its bespoke 124px "no cards" line.
           * "Setup cards arrive with the nightly base rates" describes a schedule; "No setups fired
           * tonight" is a FINDING, as of a moment, so it takes the run's stamp.
           */}
          {asOf && morning.setupCards && morning.setupCards.length > 0 ? (
            <Surface className={cx("p-5 desk:p-6", SETUPS)}>
              <SetupCards asOf={asOf} editionAsOf={editionAsOf} cards={morning.setupCards} />
            </Surface>
          ) : (
            <EmptyModule
              index={6}
              title="Setup cards"
              /*
               * ONE LINE, AND IT HAS TO STAY ONE LINE — Law 2's band is "masthead + one line + timestamp".
               * The 67-char first draft ("No setups fired tonight — the base rates found nothing worth
               * flagging") was one line on a desk, TWO on a 390px phone (104px → 132px band). Keep it under
               * ~45 characters — a budget that only holds at the width you tested is not a budget.
               */
              note={asOf ? "No setups fired tonight." : "Setup cards arrive with the nightly base rates."}
              asOf={asOf ?? undefined}
              editionAsOf={editionAsOf}
              className={SETUPS}
            />
          )}

        {/*
         * 07 + 08 + the scorecard SHARE a row on a wide desk (NEWS-AND-CONTROL Part 4.2/4.3). Module 07's
         * payload is a count, a doorway and one honesty line — it was taking the full main column (~960px)
         * to say that, and is a half-width card now beside the front-page preview. The wrapper is a grid,
         * not a wrapping flex row, so it stretches both cards to the same height (mismatched heights look
         * assembled, not designed). That `h-full` is the ONE sanctioned height instruction on a module
         * Surface and not a Law 2 violation: it matches a sibling already that tall, it does not RESERVE
         * height. Below `desk:` it is a single column with the same 24px gap, so phone/tablet are unchanged.
         */}
        <div className={cx("grid grid-cols-1 items-start gap-6 desk:grid-cols-2", CLOSING)}>
        {/*
         * 07 — scans. A REAL MODULE NOW, not a paragraph pointing elsewhere (CC4, D4). It was spending
         * ~470px to say one count; it says one row per preset instead — the name, its evidence grade,
         * and tonight's match count — so its height is EARNED. Ordered by the fixed SCAN_PRESETS order,
         * never by count (a busy scan is not a better scan — ruling M1). The whole row is the door to
         * that preset's page; "All scans →" is the door to the index. There is still no hero here (P14):
         * the counts are read in passing, the S&P keeps the Desk's one big figure.
         */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <SectionMasthead index={7} title="Sectors & scans" />
          <ul className="pt-3">
            {morning.scans.breakdown.map((preset) => (
              <li key={preset.key}>
                <Link
                  href={`/scans/${preset.key}`}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline transition-colors duration-(--duration-quick) ease-(--ease-quiet) last:border-b-0 hover:text-accent-deep"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    {/* Newsreader italic — a serif's hairlines collapse below 19px, so a title at this
                        size is set in the prose face, not the display one (new-surface §4). */}
                    <span className="truncate font-prose text-base italic text-ink">{preset.label}</span>
                    {preset.folklore ? (
                      <Tag variant="folklore" />
                    ) : (
                      <Tag variant="grade" grade={preset.grade}>
                        {preset.grade}
                      </Tag>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-ink-2">
                    {preset.count}
                    <span className="pl-1 text-2xs text-muted">{preset.count === 1 ? "match" : "matches"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-3 font-ui text-2xs text-muted">
            {fill(copy.desk.scanCount, { n: morning.scans.matches, k: morning.scans.presets })} — each
            shows its criteria and its evidence grade. A match is a filter hit, not a forecast.
          </p>
          <div className="flex grow items-end pt-3">
            <Link
              href="/scans"
              className="flex min-h-11 items-center font-ui text-sm text-accent-deep underline-offset-2 hover:underline"
            >
              All scans →
            </Link>
          </div>
        </Surface>

        {/* 08 — the Front Page, previewed. A glance and a doorway; the room does the rest. */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <FrontPagePreview
            top={morning.frontPage.top}
            total={morning.frontPage.total}
            asOf={asOf ?? undefined}
            editionAsOf={editionAsOf}
          />
        </Surface>

        {/* The evening counterpart to the morning ritual: the scorecard and the PM journal. Always
            present so the routine's shape is complete; the journal writes whether or not a run is
            recorded, so it does not gate on asOf. */}
        <Surface className="flex h-full flex-col p-5 desk:p-6">
          <ScorecardPM
            asOf={asOf ?? undefined}
            editionAsOf={editionAsOf}
            resolved={trackRecord.summary}
            savedTonight={morning.journalSavedToday}
          />
        </Surface>
        </div>
        </div>

        {/*
         * THE RAIL — the standing matter you *glance at*. It packs its reference matter beside the main
         * column and never trades heights with it: a tall calendar on a thin night just makes the rail
         * tall, with no shared track left to push the main column's modules apart.
         */}
        <div data-column="rail" className={COLUMN}>
          {/*
           * 03 — Session calendar, compact: glanced at, not read through. In the phone's single column it
           * renders full-width in its ritual position — what `order-3` is for.
           */}
          {asOf && morning.calendar ? (
            <Surface className={cx("p-5", CALENDAR)}>
              <CalendarTimeline asOf={asOf} editionAsOf={editionAsOf} events={morning.calendar} compact />
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
              <Watchlist asOf={asOf} editionAsOf={editionAsOf} rows={morning.watch} />
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
       * The provenance line: which sources ran, which degraded, and the FRED attribution. It sits UNDER
       * the grid now, not in the rail (Part 4.2) — a stamp on the whole page, and a footer belongs at the
       * foot. No card wrapper: it decides its own chrome (a plain line on a healthy night, a forced-open
       * card when a source failed), inside the component where a caller cannot get it wrong.
       */}
      <SourceStatusFooter
        sources={morning.sources}
        window={lastRunFinishedAt ? `until ${formatEtDate(lastRunFinishedAt)}` : undefined}
      />
    </RailProvider>
  );
}
