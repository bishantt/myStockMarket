import Link from "next/link";

import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { MacroPulse } from "@/components/desk/MacroPulse";
import { BriefArticle } from "@/components/desk/BriefArticle";
import { DeskHeader } from "@/components/desk/DeskHeader";
import { Movers } from "@/components/desk/Movers";
import { Watchlist } from "@/components/desk/Watchlist";
import { ScorecardPM } from "@/components/desk/ScorecardPM";
import { SetupCards } from "@/components/desk/SetupCards";
import { CalendarTimeline } from "@/components/desk/CalendarTimeline";
import { SourceStatusFooter } from "@/components/desk/SourceStatusFooter";
import { RailProvider } from "@/components/rail/Rail";
import { OfflineRibbon } from "@/components/OfflineRibbon";
import { getLatestRun } from "@/lib/pipeline";
import { marketState } from "@/lib/market-hours";
import { getMorning } from "@/lib/morning";
import { getTrackRecord } from "@/lib/track-record";
import { formatEtDate, formatUtcDate } from "@/lib/time";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * The Desk — the one-screen ritual, laid out as a broadsheet spread (§5.1, §3.9).
 *
 * The modules mount in the fixed ritual order (heartbeat → macro → brief → calendar → movers →
 * watchlist → setup cards → sectors/scans → scorecard). That order is the invariant: it mirrors the
 * documented professional pre-market sequence, so the layout itself teaches the routine, and it is
 * the same on every visit whether or not a module has data yet.
 *
 * At 1366px the column becomes a SPREAD — a wide main column and a 340px rail — and the split is not
 * decorative. The main column keeps the narrative in order, the things you read *through*: Pulse,
 * Brief, Movers, Setups, Scorecard. The rail holds the standing matter, the things you *glance at*:
 * the Watchlist, the Calendar in its compact form, the source status. That is how a front page
 * works, and it is why the two columns are not interchangeable.
 *
 * THE DOM ORDER STAYS RITUAL. Modules are placed into the spread by CSS grid, never by reordering
 * the markup, so the tab order and the phone's single column both follow the ritual exactly. A
 * reader tabbing through the Desk walks the routine in sequence; a sighted reader on a wide screen
 * sees a newspaper. Neither is a compromise made for the other.
 */

// The Desk is served from a cached render (ISR), not rebuilt per request — that is what keeps its
// TTFB, and so its LCP, low (the data changes once a night, not per visit; plan §4.5). The render is
// refreshed on demand: Job A calls /api/revalidate after publishing, and a watchlist write calls
// revalidatePath("/"). The 10-minute fallback bounds staleness if an on-demand refresh is missed.
export const revalidate = 600;

/**
 * A module with no data yet: its masthead, one muted line, and a quiet shimmer.
 *
 * The shimmer is the single sanctioned loading animation (§3.6), and it may appear HERE — on an
 * empty structural placeholder — but never on a probability or money placeholder, which loads as
 * text. A shimmering number implies a number is coming. A shimmering empty slot implies only that
 * the slot exists.
 */
function Placeholder({
  index,
  title,
  note,
  className,
}: {
  index: number;
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <Surface className={cx("p-5", className)}>
      <SectionMasthead index={index} title={title} />
      <div className="pt-4">
        <p className="font-ui text-sm text-muted">{note}</p>
        <div aria-hidden="true" className="shimmer mt-3 h-2 w-2/3 rounded-pill bg-hairline" />
      </div>
    </Surface>
  );
}

export default async function DeskPage() {
  const [latest, morning, trackRecord] = await Promise.all([
    getLatestRun(),
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

  // Grid placement. On phone and tablet these classes are inert — the ritual is one column. At
  // `desk:` they compose the spread, while the DOM stays in ritual order.
  /*
   * The broadsheet spread now engages at `lg:` (1024px), not only at `desk:` (1366px).
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
  const MAIN = "lg:col-start-1";
  const RAIL = "lg:col-start-2";

  return (
    <RailProvider>
      {runDate ? (
        <DeskHeader
          runDate={runDate}
          updatedAt={lastRunFinishedAt}
          marketOpen={marketState(new Date()) === "open"}
        />
      ) : null}

      {/* The offline band — shows only when the browser is offline, naming what is on screen. */}
      <OfflineRibbon syncedDate={asOf ? formatEtDate(asOf) : "—"} />

      <div className="mx-auto grid max-w-[720px] grid-flow-row-dense grid-cols-1 gap-6 pt-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start desk:grid-cols-[minmax(0,1fr)_340px]">
        {/*
         * 00 — the pipeline heartbeat: the app renders what the cloud wrote, and says so.
         *
         * It spans the spread rather than sitting in the rail, and that is a layout FIX, not a
         * preference. Placed in the rail it occupied the first row's right-hand cell, and the grid's
         * dense backfill then pulled the Brief (module 02) up into the empty cell beside it — so the
         * Desk rendered 02 above 01. The ritual order is the one thing this layout may not break.
         */}
        <Surface className="p-5 lg:col-span-2">
          <SectionMasthead
            index={0}
            title="Pipeline"
            asOf={lastRunFinishedAt ?? undefined}
            provenance="GitHub Actions · nightly, after the US close"
          />
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 pt-4">
            <StatFigure
              label="Last cloud run"
              value={latest ? formatUtcDate(new Date(latest.runDate)) : "—"}
              scale="body"
            />
            <p className="font-ui text-2xs text-muted">
              {latest
                ? "Written by the nightly pipeline in the cloud — nothing runs on this device."
                : "No run recorded yet. The nightly jobs write here after each US close."}
            </p>
          </div>
        </Surface>

        {/* 01 — Macro pulse. The hero, and the only module that spans the spread. */}
        {asOf && morning.macro ? (
          <Surface className="p-5 lg:col-span-2 desk:p-6">
            <MacroPulse asOf={asOf} {...morning.macro} />
          </Surface>
        ) : (
          <Placeholder
            index={1}
            title="Macro pulse"
            note="Index levels and breadth arrive with the nightly ingest."
            className="lg:col-span-2"
          />
        )}

        {/* 02 — the evening briefing: the editorial centrepiece. */}
        {asOf && morning.brief ? (
          <Surface className={cx("p-5 desk:p-6", MAIN)}>
            <BriefArticle asOf={asOf} brief={morning.brief} />
          </Surface>
        ) : (
          <Placeholder
            index={2}
            title="Daily brief"
            note="The evening briefing lands after the close."
            className={MAIN}
          />
        )}

        {/*
         * 03 — Session calendar. It sits in the RAIL on a wide screen, in its compact variant: a
         * reader glances at what is coming, they do not read through it. In the phone's single
         * column it renders full-width, in its ritual position.
         */}
        {asOf && morning.calendar ? (
          <Surface className={cx("p-5", RAIL)}>
            <CalendarTimeline asOf={asOf} events={morning.calendar} compact />
          </Surface>
        ) : (
          <Placeholder
            index={3}
            title="Session calendar"
            note="Scheduled catalysts arrive with the nightly ingest."
            className={RAIL}
          />
        )}

        {/* 04 — Movers: the volume-confirmed moves, each with a catalyst or the noise line. */}
        {asOf && morning.movers ? (
          <Surface className={cx("p-5 desk:p-6", MAIN)}>
            <Movers asOf={asOf} movers={morning.movers} />
          </Surface>
        ) : (
          <Placeholder
            index={4}
            title="Movers"
            note="Movers arrive with the nightly scans."
            className={MAIN}
          />
        )}

        {/* 05 — Focus watchlist: standing matter, so it lives in the rail. */}
        {asOf && morning.watch ? (
          <Surface className={cx("p-5", RAIL)}>
            <Watchlist asOf={asOf} rows={morning.watch} />
          </Surface>
        ) : (
          <Placeholder
            index={5}
            title="Focus watchlist"
            note="Add names and the reason you are watching them."
            className={RAIL}
          />
        )}

        {/* 06 — setup cards: the signature unit. */}
        {asOf && morning.setupCards ? (
          <Surface className={cx("p-5 desk:p-6", MAIN)}>
            <SetupCards asOf={asOf} cards={morning.setupCards} />
          </Surface>
        ) : (
          <Placeholder
            index={6}
            title="Setup cards"
            note="Setup cards arrive with the nightly base rates."
            className={MAIN}
          />
        )}

        {/*
         * 07 — scans. A GLANCE station, so it now reads like one.
         *
         * It used to be a paragraph of prose pointing at another page, which is the opposite of a
         * glance: a station you have to READ in order to learn a number you could have been shown.
         * It is a count and a doorway now. The number comes from one grouped count in the morning
         * loader, amortised by the route's cache.
         */}
        <Surface className={cx("p-5 desk:p-6", MAIN)}>
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

        {/* The evening counterpart to the morning ritual: the scorecard and the PM journal. Always
            present so the routine's shape is complete; the journal writes whether or not a run is
            recorded, so it does not gate on asOf. */}
        <Surface className={cx("p-5 desk:p-6", MAIN)}>
          <ScorecardPM
            asOf={asOf ?? undefined}
            resolved={trackRecord.summary}
            savedTonight={morning.journalSavedToday}
          />
        </Surface>

        {/* The provenance line: which sources ran, which degraded, and the FRED attribution. */}
        <Surface className={cx("p-5", RAIL)}>
          <SourceStatusFooter
            sources={morning.sources}
            window={lastRunFinishedAt ? `until ${formatEtDate(lastRunFinishedAt)}` : undefined}
          />
        </Surface>
      </div>
    </RailProvider>
  );
}
