import { copy, fill } from "@/lib/copy";
import type { Direction } from "@/components/StatFigure";
import { decimal, directionOf, percent, price, signedPercent } from "@/lib/format";
import { sessionsBetween, type TradingDate } from "@/lib/market-hours";
import { toTradingDate } from "@/lib/pipeline";

/**
 * macro-board.ts — the five household stats, and the ladder that decides how honest each cell has to be
 * tonight (NEWS-AND-CONTROL Part 6, rulings C7 and C8).
 *
 * Four of the five are other people's numbers; the fifth (Mood) is ours and must justify its existence
 * every render (C8). THE HARD PART IS NOT THE HAPPY PATH — the five sources fail in different ways on
 * different schedules, and a board that rendered identically whether its numbers arrived tonight or a
 * fortnight ago is the decoration this plan was commissioned to remove. So every cell carries its own
 * state, escalating with how bad the news is:
 *   ok       current for its own cadence (a Thursday mortgage rate on a Tuesday is the newest that exists).
 *   stale    old enough to mislead — amber, and says the word: "stale — last Jul 2".
 *   missing  no history at all — an em-dash and "not yet reported", information, not an apology.
 * A source unreachable TONIGHT adds its own note: a value standing still because nobody could reach its
 * source is a different fact from one standing still because nothing changed. And AGE IS COUNTED THE WAY
 * EACH SOURCE PUBLISHES (why STALE_AFTER is not one number): gold trades on sessions, so Friday's price
 * on Monday is zero sessions old; the rupee publishes every calendar day, so there a day is the unit.
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
 * The C7 rung-5 thresholds: "older than its cadence × 3". Three is where an absence stops being a
 * hiccup and starts being a pattern: one missed weekly survey is a late Thursday, three is a source
 * that has stopped answering.
 */
const STALE_AFTER: Record<MacroSeriesKey, StaleRule> = {
  // Weekly survey → three weeks.
  mortgage30us: { unit: "days", after: 21 },
  // Monthly print → three months. Generous: CPI lands mid-month for the month BEFORE, so a healthy cell
  // is routinely six weeks old and must not go amber.
  cpi_yoy: { unit: "days", after: 93 },
  // A market price → three SESSIONS, not days: the gold market is shut at the weekend.
  gold_usd: { unit: "sessions", after: 3 },
  // NRB publishes every calendar day, weekends included — so here a calendar day is the honest unit.
  usd_npr: { unit: "days", after: 3 },
  // Computed by the nightly, so it moves on sessions like the pipeline does.
  mood: { unit: "sessions", after: 3 },
};

/**
 * A HOUSEHOLD COST'S DELTA CARRIES NO UP/DOWN COLOUR, and the first baseline taught us: the mortgage cell
 * shipped with `directionOf()` and the photograph showed a FALLING rate in red with a down triangle. On a
 * tape red-down is a fact; on the price of housing money it is the wrong opinion — a falling mortgage rate
 * is the best news on this board. So the board's deltas render `flat`: the sign and window carry the fact,
 * and the app makes no judgement it has no business making. Gold keeps its direction colour, because gold
 * IS a market price.
 */
const HOUSEHOLD_COST: Direction = "flat";

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
 * The gauge, when it has a score. RULING C8 LIVES IN THIS TYPE: `components` is a NON-EMPTY tuple, so a
 * gauge without its breakdown does not type-check (the shape BaseRate uses). Not a convention or a lint
 * rule a review must remember — a sentiment number you cannot take apart is one you must trust, and this
 * app does not ask anyone to.
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
 * Checking again here means the display contract does not DEPEND on the writer being careful — no future
 * job, hand-repaired row, or replayed fixture can put a two-component "market mood" on screen, because
 * the surface that renders it refuses on its own authority.
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
 * `sourceStatus` is the per-source map: a stat keyed "degraded" had its source fail TONIGHT — a statement
 * about the fetch, while `state` is about the number. Different facts, and a cell can carry both (current
 * but failed to refresh, or stale for a source that answered fine).
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
 * The shared skeleton of every cell: the ladder, in one place. Each stat differs only in how its number
 * is FORMATTED and what its delta means; the how-honest decision is identical and made here once, so a
 * new cell cannot arrive next year with its own private idea of "stale".
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
  // Rung 4: nothing ever stored. The em-dash is the truth and "not yet reported" says why. (This is what
  // gold says in production today: its key is not provisioned, so it has no number and will not pretend.)
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

  // Rung 5 outranks rung 3 in the WORDS — a number too old to trust is a worse fact than a fetch that
  // failed once — but both are worth saying, so a stale+degraded cell reports the staleness and the note
  // explains the silence behind it.
  const note = stale
    ? fill(copy.macroBoard.staleCell, { asOf: row.asOfLabel })
    : degraded
      ? copy.macroBoard.sourceUnreachable
      : undefined;

  return {
    key,
    label,
    // The window comes from the SOURCE's own observation date — the point of the cadence rule: this label
    // never says "tonight" about a number that is not from tonight.
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
              direction: HOUSEHOLD_COST,
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
      // NO DELTA CHIP, deliberately: "-0.4 vs prior month" beside a rate reads as "prices fell", when
      // what fell is the RATE at which they rose. The month label is the context this number needs.
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
 * The rupee — the one cell whose LABEL depends on which source answered. NRB publishes the official
 * reference rate; the fallback publishes a market mid-rate — two measurements of different things, and
 * the cell names whichever is on screen (ruling C6). It carries the qualifier no rate table is honest
 * without: this is not what a remittance app will give you.
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
        // NRB quotes a buy AND a sell and the cell shows both — picking one side answers a question the
        // reader never asked. The mid-market fallback has no sides, so it shows the single number it is.
        value:
          pair?.buy !== undefined && pair?.sell !== undefined
            ? fill(copy.macroBoard.nprPair, { buy: decimal(pair.buy, 2), sell: decimal(pair.sell, 2) })
            : decimal(r.value, 2),
        // No delta. The rupee's prior is the last observation WE HOLD, days back — a delta days apart
        // wearing a one-day label is the quiet lie this board exists to prevent.
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
 * The Mood gauge — a score with its full breakdown, or an honest absence. No third option, and that is
 * ruling C8: the number is ours (no external source can be licensed), and the one thing that makes a
 * home-built sentiment number legitimate is that the reader can take it apart. So it renders with its
 * components or not at all.
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

  // No row, no breakdown, or too thin a breakdown is not a gauge. Naming which inputs were missing is a
  // real answer to "how does the market feel?" when the instruments are down — better than averaging
  // whatever survived into a confident-looking number.
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
 * The components, rendered — with the arrow DERIVED from the percentile, not read from storage. The
 * pipeline computes the same arrow the same way, so deriving it again here means no stored value can put
 * an arrow on screen that disagrees with the percentile beside it. The N0 seed had drifted exactly that
 * way: a component at the 48th percentile, below its median, labelled "greedy".
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
