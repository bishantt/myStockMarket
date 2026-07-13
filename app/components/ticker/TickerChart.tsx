"use client";

import { useState } from "react";

import { RangeControl, rangeStorageKey, type RangeOption } from "@/components/RangeControl";
import { CandleChartLoader } from "@/components/ticker/CandleChartLoader";
import { copy, fill } from "@/lib/copy";
import { decimal } from "@/lib/format";
import type { Candle, VolumeBar } from "@/lib/ticker";

/**
 * TickerChart — the price chart, its range control, and the caption that says what it is.
 *
 * THE ONE THING WORTH KNOWING: SWITCHING RANGE MAKES NO NETWORK REQUEST.
 *
 * The page already serves the symbol's full history in its initial (cached) payload — that is what
 * the chart needs anyway — so a range is a SLICE of data already in the browser. Changing it is a
 * synchronous re-render. There is no fetch, no skeleton, no loading state, and no cache interplay to
 * reason about, because nothing ever got slow enough to need any of that. An e2e test asserts the
 * zero-requests claim rather than trusting it.
 *
 * The ranges are the ones an end-of-day product can honestly offer, and no others (plan Part 5.3):
 * there is no 1D or 5D, because intraday data does not exist here and five daily points is a shrug
 * pretending to be a chart. The default is 6M — long enough to show a regime, short enough that the
 * last month is still readable, and it matches the framing the vol bands below already teach.
 */

/** Trading sessions per range. Bars are daily, so a session count IS the window. */
const SESSIONS: Record<string, number> = {
  "1m": 21,
  "3m": 63,
  "6m": 126,
  "1y": 252,
  "5y": 1260,
};

/** ~252 sessions a year. Used only to describe coverage to a reader, never to compute a metric. */
const SESSIONS_PER_YEAR = 252;

/** Below four years of bars, a "5Y" view would be a five-year label on a two-year chart. */
const MIN_SESSIONS_FOR_5Y = 4 * SESSIONS_PER_YEAR;

const DEFAULT_RANGE = "6m";

export function TickerChart({
  candles,
  volumes,
  through,
}: {
  candles: Candle[];
  volumes: VolumeBar[];
  /** The last session the bars actually cover, already formatted ("Fri Jul 10"). */
  through: string;
}) {
  /*
   * The reader's frame, restored from the session — read lazily, ONCE, on first render.
   *
   * `useState(initialiser)` runs the initialiser only on the first render, which matters here: this
   * component is client-only (the chart is dynamically imported with ssr:false), so there is no
   * server HTML for this to disagree with, and reading sessionStorage during render is safe.
   */
  const [range, setRange] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem(rangeStorageKey("ticker-chart")) ?? DEFAULT_RANGE;
    } catch {
      return DEFAULT_RANGE;
    }
  });

  const canShow5Y = candles.length >= MIN_SESSIONS_FOR_5Y;

  const options: RangeOption[] = [
    { label: "1M", value: "1m", available: true },
    { label: "3M", value: "3m", available: true },
    { label: "6M", value: "6m", available: true },
    { label: "1Y", value: "1y", available: true },
    {
      label: "5Y",
      value: "5y",
      available: canShow5Y,
      // Shown and disabled rather than hidden: 5Y exists for this SURFACE, it just does not exist
      // for this symbol. A reader who knows it exists and cannot find it concludes the app is
      // broken; a reader told why has learned something true about the symbol.
      reason: fill(copy.ticker.rangeUnavailable, { min: "4 years" }),
    },
  ];

  // A slice of what is already here. Never a request.
  const want = SESSIONS[range] ?? SESSIONS[DEFAULT_RANGE];
  const shownCandles = candles.slice(-want);
  const shownVolumes = volumes.slice(-want);

  /*
   * The caption tells the truth about what is on screen, not about what was asked for.
   *
   * If the reader picks 1Y and the symbol only carries 7 months of bars, the chart shows 7 months —
   * and a caption reading "1Y" over it would be a label contradicting its own picture, which is the
   * exact defect ruling C6 exists to forbid (a provenance line must be composed from what is
   * actually rendered). So when the range asks for more than exists, the caption states the coverage
   * it actually has.
   */
  const isTruncated = candles.length < want;
  // Through lib/format, like every other number that reaches a reader (drift rule 12). A coverage
  // figure is a figure: it gets the house's decimal, not a raw .toFixed().
  const years = decimal(candles.length / SESSIONS_PER_YEAR, 1);

  return (
    <div className="grid grid-cols-1 gap-6 desk:grid-cols-12">
      <div className="desk:col-span-9">
        <CandleChartLoader candles={shownCandles} volumes={shownVolumes} />
      </div>

      {/* The stats stack: the control, then the provenance of what it is showing. */}
      <aside className="flex flex-col gap-4 desk:col-span-3" aria-label="Chart range">
        <RangeControl
          surface="ticker-chart"
          options={options}
          value={range}
          onChange={setRange}
        />

        <div className="flex flex-col gap-1">
          <p className="font-mono text-2xs text-muted">
            {fill(copy.ticker.rangeCaption, { date: through })}
          </p>
          {isTruncated ? (
            <p className="font-mono text-2xs text-muted">
              {fill(copy.ticker.rangeCoverage, { years: `${years}y` })}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
