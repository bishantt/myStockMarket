import { copy, fill } from "@/lib/copy";
import type { Direction } from "@/components/StatFigure";
import { decimal, directionOf, percent, price, signedPercent } from "@/lib/format";
import { sessionsBetween, type TradingDate } from "@/lib/market-hours";
import { toTradingDate } from "@/lib/pipeline";

/**
 * macro-board.ts — the five household stats, and the ladder that decides how honest each cell has
 * to be tonight (NEWS-AND-CONTROL-PLAN Part 6, rulings C7 and C8).
 *
 * The board answers the questions a market number cannot: what does a mortgage cost, what did prices
 * actually do, what is gold worth, what is a dollar worth in rupees — and how does the market feel.
 * Four of those are other people's numbers. The fifth is ours, and it is the only one on this board
 * that has to justify its own existence every time it renders (C8).
 *
 * THE HARD PART IS NOT THE HAPPY PATH. It is that these five sources fail in different ways, on
 * different schedules, and a board that rendered identically whether its numbers arrived tonight or
 * a fortnight ago would be exactly the decoration this plan was commissioned to remove. So every
 * cell carries its own state, and the states escalate with how bad the news actually is:
 *
 *   ok       the number is current for its own cadence. A Thursday mortgage rate on a Tuesday is
 *            NOT stale — it is the newest rate that exists, and the label is the honesty.
 *   stale    old enough that the number now misleads more than it informs. The cell goes amber and
 *            says the word: "stale — last Jul 2".
 *   missing  no history at all. An em-dash and "not yet reported" — information, not an apology.
 *
 * And a source that was unreachable TONIGHT adds its own note to whatever it is showing, because a
 * value standing still because nobody could reach its source is a different fact from a value
 * standing still because nothing has changed.
 *
 * AGE IS COUNTED THE WAY EACH SOURCE ACTUALLY PUBLISHES. This is the whole reason STALE_AFTER below
 * is not a single number. Gold trades on market sessions, so Friday's price read on Monday is zero
 * sessions old and perfectly fresh — counting calendar days would paint it amber every Monday, and a
 * lamp that cries wolf every Monday is a lamp nobody looks at on the morning it is telling the truth.
 * The rupee, by contrast, is published by Nepal Rastra Bank every calendar day including weekends,
 * so for that cell a calendar day IS the unit. Same ladder, different clocks, because the sources
 * keep different clocks.
 */

/** The closed set. Five cells, each with a verified source, a cadence, and a label grammar. */
export type MacroSeriesKey = "mortgage30us" | "cpi_yoy" | "gold_usd" | "usd_npr" | "mood";

/** A macro_stat row as the loader reads it. */
export type MacroStatRow = {
  seriesKey: string;
  asOfDate: Date;
  value: number;
  prior: number | null;
  asOfLabel: string;
  sourceKey: string;
  meta: unknown;
};

/** How old a cell may get before it stops being information and starts being furniture. */
type StaleRule =
  | { unit: "sessions"; after: number }
  | { unit: "days"; after: number };

/**
 * The C7 rung-5 thresholds: "older than its cadence × 3".
 *
 * Three of a thing is the point at which an absence stops being a hiccup and starts being a pattern:
 * one missed weekly survey is a late Thursday, three is a source that has stopped answering.
 */
const STALE_AFTER: Record<MacroSeriesKey, StaleRule> = {
  // Weekly survey → three weeks.
  mortgage30us: { unit: "days", after: 21 },
  // Monthly print → three months. Generous on purpose: CPI's release lands mid-month for the month
  // BEFORE, so a perfectly healthy CPI cell is routinely six weeks old and must not go amber for it.
  cpi_yoy: { unit: "days", after: 93 },
  // A market price → three SESSIONS. Not three days: the gold market is shut at the weekend, and a
  // Friday price is the newest one that exists until Monday's close.
  gold_usd: { unit: "sessions", after: 3 },
  // NRB publishes every calendar day, weekends included — so here a calendar day is the honest unit.
  usd_npr: { unit: "days", after: 3 },
  // Computed by the nightly, so it moves on sessions like the pipeline does.
  mood: { unit: "sessions", after: 3 },
};

/** Where a cell sits on the C7 ladder. */
export type CellState = "ok" | "stale" | "missing";

/** One cell of the board. */
export type MacroCell = {
  key: MacroSeriesKey;
  label: string;
  /** Already formatted, or an em-dash. This module never calls toFixed — every number goes through lib/format. */
  value: string;
  /** The window, from the closed C2 vocabulary. Empty only on a cell with nothing to date. */
  asOf: string;
  state: CellState;
  /** The beginner's explainer, rendered as title text. */
  title?: string;
  /** A delta chip — only where the two ends of the delta are genuinely adjacent observations. */
  delta?: { value: string; direction: Direction; window: string };
  /** The honest note: what is wrong, in words, so the colour is never carrying the meaning alone. */
  note?: string;
  /** Where this number came from — following the source key, mechanically (C6). */
  provenance?: string;
  /** The line a cell is required to carry regardless of its state (the rupee's, mainly). */
  qualifier?: string;
  /** A licence-required attribution, rendered ONLY when the source that requires it is the one showing. */
  attribution?: { text: string; href: string };
};

/** One input to the Mood gauge, ready to render. */
export type MoodComponent = {
  key: string;
  label: string;
  /** Formatted for reading. */
  value: string;
  window: string;
  percentile: string;
  /** DERIVED from the percentile — see moodComponents(). It cannot disagree with the number beside it. */
  contributes: "greedy" | "fearful";
};

/**
 * The gauge, when it has a score.
 *
 * RULING C8 LIVES IN THIS TYPE. `components` is required and is a NON-EMPTY tuple, so a gauge
 * without its breakdown does not type-check — the same enforcement shape BaseRate uses. This is
 * deliberately not a convention, not a lint rule, and not something a code review has to remember:
 * a sentiment number you cannot take apart is a number you have to trust, and this app does not ask
 * anyone to trust it.
 */
export type MoodView = {
  score: number;
  band: string;
  components: [MoodComponent, ...MoodComponent[]];
  cell: MacroCell;
};

/** The gauge when it could not be computed — which is a result, not an error. */
export type MoodUnavailable = {
  /** Which inputs were missing, already worded. */
  reason: string;
  cell: MacroCell;
};

export type MacroBoard = {
  /** The four external stats, in reading order: household costs first, then the market's own prices. */
  cells: MacroCell[];
  /** The gauge — a score with its breakdown, or an honest absence. Never a bare number. */
  mood: MoodView | MoodUnavailable;
};

/**
 * The gauge needs at least three of its five inputs, and the APP checks this as well as the pipeline.
 *
 * The pipeline already suppresses a thin gauge and will not write one. Checking it again here is not
 * belt-and-braces for its own sake: it means the display contract does not DEPEND on the writer
 * having been careful. A row assembled by a future job, a hand-repaired database, a replayed fixture
 * — none of them can put a two-component "market mood" on screen, because the surface that renders
 * it refuses to, on its own authority.
 */
const MIN_MOOD_COMPONENTS = 3;

/** The gauge's five inputs, in the order the board shows them. Used to name the missing ones. */
const MOOD_INPUTS: Record<string, string> = {
  breadth: "breadth",
  volatility: "volatility",
  momentum: "momentum",
  range: "range position",
  credit: "credit spreads",
};

/**
 * Build the board from what the pipeline stored, the run's source health, and tonight's date.
 *
 * `sourceStatus` is the run row's per-source map. A stat whose key reads "degraded" had its source
 * fail TONIGHT — which is why the note it earns ("source unreachable tonight") is a statement about
 * the fetch, while `state` is a statement about the number. They are different facts and the cell
 * can carry both: a value can be perfectly current AND have failed to refresh, and it can be badly
 * stale for a source that answered fine.
 */
export function buildMacroBoard(
  rows: MacroStatRow[],
  sourceStatus: Record<string, unknown> | null,
  runDate: Date,
): MacroBoard {
  const latest = newestPerSeries(rows);
  const status = (key: MacroSeriesKey) =>
    (sourceStatus?.[`macro-${key}`] ?? null) === "degraded";

  return {
    cells: [
      mortgageCell(latest.get("mortgage30us"), status("mortgage30us"), runDate),
      cpiCell(latest.get("cpi_yoy"), status("cpi_yoy"), runDate),
      goldCell(latest.get("gold_usd"), status("gold_usd"), runDate),
      rupeeCell(latest.get("usd_npr"), status("usd_npr"), runDate),
    ],
    mood: moodView(latest.get("mood"), status("mood"), runDate),
  };
}

/** The newest stored row per series — history accumulates, and only the newest row is a cell. */
function newestPerSeries(rows: MacroStatRow[]): Map<string, MacroStatRow> {
  const newest = new Map<string, MacroStatRow>();
  for (const row of rows) {
    const held = newest.get(row.seriesKey);
    if (!held || row.asOfDate.getTime() > held.asOfDate.getTime()) newest.set(row.seriesKey, row);
  }
  return newest;
}

/**
 * How old this observation is, in the unit its own source actually publishes in (see STALE_AFTER).
 */
export function isStale(key: MacroSeriesKey, asOf: Date, runDate: Date): boolean {
  const rule = STALE_AFTER[key];

  if (rule.unit === "days") {
    const days = Math.floor((startOfUtcDay(runDate) - startOfUtcDay(asOf)) / 86_400_000);
    return days > rule.after;
  }

  const from: TradingDate = toTradingDate(asOf);
  const to: TradingDate = toTradingDate(runDate);
  return sessionsBetween(from, to) > rule.after;
}

/** Midnight UTC, so a clock time can never decide whether two bare dates are the same day. */
function startOfUtcDay(day: Date): number {
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

/**
 * The shared skeleton of every cell: the ladder, in one place.
 *
 * Each stat differs only in how its number is FORMATTED and what its delta means. The decision about
 * how honest to be is identical for all of them, and it is made here — once — so that a new cell
 * cannot arrive next year with its own private idea of what "stale" means.
 */
function buildCell(
  key: MacroSeriesKey,
  label: string,
  row: MacroStatRow | undefined,
  degraded: boolean,
  runDate: Date,
  render: (row: MacroStatRow) => Pick<MacroCell, "value" | "delta" | "provenance" | "qualifier" | "attribution">,
  title?: string,
): MacroCell {
  // Rung 4: nothing has ever been stored. The em-dash is the truth, and "not yet reported" says why
  // without apologising for it. (This is what gold says in production today: its key is not
  // provisioned, so it has no source, so it has no number — and it will not pretend otherwise.)
  if (!row) {
    return {
      key,
      label,
      value: "—",
      asOf: "",
      state: "missing",
      note: copy.macroBoard.notYetReported,
      title,
    };
  }

  const stale = isStale(key, row.asOfDate, runDate);

  // Rung 5 outranks rung 3 in the WORDS, because it is the worse fact: a number too old to trust is
  // a bigger problem than a fetch that failed once. But a failed fetch tonight is still true and
  // still worth saying, so when both are true the cell reports the staleness and the note explains
  // the silence behind it.
  const note = stale
    ? fill(copy.macroBoard.staleCell, { asOf: row.asOfLabel })
    : degraded
      ? copy.macroBoard.sourceUnreachable
      : undefined;

  return {
    key,
    label,
    // The window comes from the SOURCE's own observation date. It is the entire point of the cadence
    // rule upstream: this label never says "tonight" about a number that is not from tonight.
    asOf: row.asOfLabel,
    state: stale ? "stale" : "ok",
    note,
    title,
    ...render(row),
  };
}

function mortgageCell(row: MacroStatRow | undefined, degraded: boolean, runDate: Date): MacroCell {
  return buildCell(
    "mortgage30us",
    copy.macroBoard.mortgageLabel,
    row,
    degraded,
    runDate,
    (r) => ({
      value: percent(r.value / 100, 2),
      // The two ends of this delta are genuinely adjacent observations — FRED hands over last week's
      // survey with this week's — so the chip can state its window truthfully.
      delta:
        r.prior === null
          ? undefined
          : {
              value: signedPercent((r.value - r.prior) / 100),
              direction: directionOf(r.value - r.prior),
              window: copy.window.vsPriorWeek,
            },
    }),
    copy.macroBoard.mortgageNote,
  );
}

function cpiCell(row: MacroStatRow | undefined, degraded: boolean, runDate: Date): MacroCell {
  return buildCell(
    "cpi_yoy",
    copy.macroBoard.cpiLabel,
    row,
    degraded,
    runDate,
    (r) => ({
      // FRED computes this year-over-year figure and we print what it published. The rounding is the
      // only thing the app does to it: FRED reports 4.24867, and a reader wants 4.2%.
      value: percent(r.value / 100, 1),
      // NO DELTA CHIP, deliberately. A chip reading "-0.4 vs prior month" beside a rate is read by
      // almost everyone as "prices fell", when what fell is the RATE at which they rose. A delta of a
      // rate is one of the easiest numbers in finance to misread, and the cell simply does not offer
      // it: the month label is the context this number actually needs.
    }),
    copy.macroBoard.cpiNote,
  );
}

function goldCell(row: MacroStatRow | undefined, degraded: boolean, runDate: Date): MacroCell {
  return buildCell(
    "gold_usd",
    copy.macroBoard.goldLabel,
    row,
    degraded,
    runDate,
    (r) => ({
      value: price(r.value),
      delta:
        r.prior === null
          ? undefined
          : {
              value: signedPercent((r.value - r.prior) / r.prior),
              direction: directionOf(r.value - r.prior),
              window: copy.window.d1,
            },
      // Never "LBMA price", never "COMEX settlement" — licensed benchmark names this app has not
      // bought and cannot verify. The label says exactly what the number is.
      provenance: copy.macroBoard.goldProvenance,
    }),
  );
}

/**
 * The rupee — and the one cell whose LABEL depends on which source answered.
 *
 * Nepal Rastra Bank publishes the central bank's official reference rate. The fallback publishes a
 * market mid-rate. These are two different measurements of two different things, and the cell names
 * whichever one is actually on screen (ruling C6). It also carries the qualifier that no rate table
 * on the internet is honest without: this is not what a remittance app will give you.
 */
function rupeeCell(row: MacroStatRow | undefined, degraded: boolean, runDate: Date): MacroCell {
  return buildCell(
    "usd_npr",
    copy.macroBoard.nprLabel,
    row,
    degraded,
    runDate,
    (r) => {
      const pair = r.meta as { buy?: number; sell?: number } | null;
      const fromNrb = r.sourceKey === "nrb";

      return {
        // NRB quotes a buy AND a sell, and the cell shows both: picking one side would silently
        // answer a question the reader never asked. The mid-market fallback HAS no sides, so it
        // shows the single number it actually is rather than inventing a spread to match the shape.
        value:
          pair?.buy !== undefined && pair?.sell !== undefined
            ? fill(copy.macroBoard.nprPair, { buy: decimal(pair.buy, 2), sell: decimal(pair.sell, 2) })
            : decimal(r.value, 2),
        // No delta. The rupee's prior is the last observation WE HOLD, which may be days back — and
        // a delta whose two ends are days apart, wearing a one-day label, is precisely the quiet lie
        // this board exists to prevent.
        provenance: fromNrb ? copy.macroBoard.nprSourceNrb : copy.macroBoard.nprSourceMid,
        qualifier: copy.macroBoard.nprQualifier,
        // A licence condition of the fallback's free tier — rendered only when the fallback is the
        // source actually showing, which is the only time it is true.
        attribution: fromNrb
          ? undefined
          : { text: copy.macroBoard.erApiAttribution, href: "https://www.exchangerate-api.com" },
      };
    },
  );
}

/**
 * The Mood gauge — a score with its full breakdown, or an honest absence.
 *
 * There is no third option, and that is ruling C8. The number is ours; it exists only because no
 * legitimate external fear-and-greed source can be licensed; and the single thing that makes a
 * home-built sentiment number legitimate to show at all is that the reader can take it apart. So it
 * renders with its components or it does not render.
 */
function moodView(
  row: MacroStatRow | undefined,
  degraded: boolean,
  runDate: Date,
): MoodView | MoodUnavailable {
  const cell = buildCell(
    "mood",
    copy.macroBoard.moodLabel,
    row,
    degraded,
    runDate,
    (r) => ({ value: String(Math.round(r.value)) }),
  );

  const meta = row?.meta as
    | { score?: number; band?: string; components?: unknown[] }
    | null
    | undefined;

  const components = moodComponents(meta?.components);

  // No row, no breakdown, or too thin a breakdown is not a gauge. It says which inputs were missing
  // — which is a real answer to "how does the market feel tonight?" when the instruments that would
  // tell us are down, and a considerably better one than averaging whatever survived into a
  // confident-looking number.
  if (!row || !meta || components.length < MIN_MOOD_COMPONENTS) {
    return {
      reason: fill(copy.macroBoard.moodInsufficient, { names: missingInputs(components) }),
      cell: { ...cell, value: "—", state: row ? cell.state : "missing" },
    };
  }

  return {
    score: Math.round(row.value),
    band: meta.band ?? "",
    components: components as [MoodComponent, ...MoodComponent[]],
    cell,
  };
}

/**
 * The components, rendered — with the arrow DERIVED from the percentile rather than read from storage.
 *
 * The pipeline computes the same arrow the same way, so the two agree by construction. Deriving it
 * again here is not redundancy: it means no stored value, however it got into the database, can put
 * an arrow on screen that disagrees with the percentile printed beside it. The N0 seed had already
 * drifted exactly that way — a component sitting at the 48th percentile, below its own median,
 * labelled "greedy".
 */
function moodComponents(raw: unknown[] | undefined): MoodComponent[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    const c = entry as { key?: string; label?: string; value?: number; window?: string; percentile?: number };
    if (!c.key || typeof c.percentile !== "number" || typeof c.value !== "number") return [];

    return [{
      key: c.key,
      label: c.label ?? c.key,
      value: decimal(c.value, 2),
      window: c.window ?? "",
      percentile: percent(c.percentile),
      contributes: c.percentile >= 0.5 ? ("greedy" as const) : ("fearful" as const),
    }];
  });
}

/** Which of the gauge's five inputs are absent tonight — named, not counted. */
function missingInputs(present: MoodComponent[]): string {
  const have = new Set(present.map((c) => c.key));
  const missing = Object.entries(MOOD_INPUTS)
    .filter(([key]) => !have.has(key))
    .map(([, label]) => label);
  return missing.join(", ");
}
