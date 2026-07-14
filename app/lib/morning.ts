import { db } from "@/lib/db";
import { SCAN_PRESETS } from "@/lib/scan-presets";
import { copy } from "@/lib/copy";
import { directionOf, multiple, percent, price, signedPercent } from "@/lib/format";
import { formatUtcDate, formatUtcWeekday } from "@/lib/time";
import { buildBrief, parseBriefDraft, type BriefView } from "@/lib/briefing";
import { isKnownLesson } from "@/lib/academy";
import {
  buildMacroBoard,
  type MacroBoard as MacroBoardData,
  type MacroStatRow,
} from "@/lib/macro-board";
import { patternCause, patternLabel, patternLessonSlug } from "@/lib/patterns";
import { weakenersFor } from "@/lib/weakeners";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { Tier } from "@/lib/constants";
import type { Direction } from "@/components/StatFigure";
import type { Catalyst, Mover } from "@/components/desk/Movers";
import type { CalendarRow } from "@/components/desk/CalendarTimeline";
import type { SourceStatus } from "@/components/desk/SourceStatusFooter";
import type { WatchRow } from "@/components/desk/Watchlist";

/**
 * morning.ts — the Desk's data loader (plan §9.2, P1 step 6).
 *
 * getMorning() assembles everything the ritual column renders from the serving database the nightly
 * cloud pipeline fills: the macro strip, the movers, and the focus watchlist. The rich briefing,
 * setup cards, and scans arrive in later phases and mount as they land.
 *
 * Two ideas hold this file together:
 *
 *  1. Graceful degradation. Each module reads independently and each read is wrapped, so a single
 *     unreachable table degrades one module to a quiet placeholder rather than crashing the Desk.
 *     A market command center that goes dark because one query failed is worse than one that shows
 *     three modules and a placeholder.
 *
 *  2. Pure builders. All the arithmetic that turns raw closes and volumes into a formatted day
 *     change, a relative volume, and a direction lives in exported pure functions (buildMacro,
 *     buildMovers, buildWatchlist). They take plain row shapes and return view-models, so they are
 *     unit-tested without a database; getMorning is only the input/output shell around them.
 *
 * Every number is formatted through lib/format — nothing here calls toFixed or toLocaleString.
 */

// ── Macro ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The macro strip's four slots, and the honesty rule that shapes this whole section.
 *
 * An ETF is not its index. SPY tracks the S&P 500's percentage move, but it trades near 755 while
 * the index sits near 6,800 — so printing SPY's price under the words "S&P 500" tells a beginner
 * something false, in the largest numeral on the Desk. That is what this code exists to prevent.
 *
 * Each slot therefore has two ways to render, and the label follows whichever one happened:
 *
 *   source: "index"      the true level, from the FRED series stored on market_context
 *   source: "etf-proxy"  the ETF's own price, under the ETF's own honest label
 *
 * There is deliberately no third path where an ETF price wears an index's name. The Russell 2000
 * has no free FRED series at all, so its slot is *always* the proxy — and always says so
 * (UI-REDESIGN-PLAN §6.1, Appendix E-1).
 */
type IndexSlot = {
  /** The label this slot wears. For an index slot it is the index's name; for the by-design proxy
   *  slot it names the GROUP ("Small caps") and never an index we cannot actually quote. */
  label: string;
  /** The ETF that stands in when the index level is missing — or, for small caps, always. */
  proxySymbol: string;
  /** The single proxy mark. A template from copy.ts; `{symbol}` is filled at render. */
  proxyChip: string;
  /** True for the slot that is an ETF BY DESIGN, not by degradation (small caps). */
  proxyByDesign?: boolean;
  /** Pulls this slot's level and prior level out of the context row. */
  level: (ctx: MacroContext) => { value: number | null; prior: number | null };
};

const SPX_SLOT: IndexSlot = {
  label: "S&P 500",
  proxySymbol: "SPY",
  proxyChip: copy.macro.proxyChipDegraded,
  level: (ctx) => ({ value: ctx.sp500, prior: ctx.sp500Prior }),
};

const INDEX_SLOTS: readonly IndexSlot[] = [
  {
    label: "Nasdaq Composite",
    // QQQ tracks the Nasdaq-100, NOT the Composite. The chip must not blur that — it is a different
    // index with different members, and letting "Composite" sit silently over QQQ's price would be
    // a lie of exactly the kind this module was rewritten to stop.
    proxySymbol: "QQQ",
    proxyChip: copy.macro.proxyChipNasdaq,
    level: (ctx) => ({ value: ctx.nasdaqComposite, prior: ctx.nasdaqCompositePrior }),
  },
  {
    label: "Dow",
    proxySymbol: "DIA",
    proxyChip: copy.macro.proxyChipDegraded,
    level: (ctx) => ({ value: ctx.djia, prior: ctx.djiaPrior }),
  },
  {
    // No free FRED daily series exists for the Russell 2000 (FRED deleted all 36 FTSE Russell series
    // in 2019; every licensable alternative was checked and rejected — the search is recorded in the
    // plan's Appendix A.2). So this slot NEVER has an index level.
    //
    // Which is why it is not called "Russell 2000". We cannot quote that index, so we do not put its
    // name on the row at all — we name the GROUP the number describes ("Small caps") and let the
    // chip say what the number is. A label that claims an index we are structurally unable to
    // measure is a promise the row can never keep.
    label: "Small caps",
    proxySymbol: "IWM",
    proxyChip: copy.macro.proxyChip,
    proxyByDesign: true,
    level: () => ({ value: null, prior: null }),
  },
];

/** Every ETF the strip may need — the fallback quotes, and the Russell's only quote. */
const PROXY_SYMBOLS: string[] = [SPX_SLOT, ...INDEX_SLOTS].map((s) => s.proxySymbol);

/** The per-run macro-context row, exactly as the market_context table stores it. */
export type MacroContext = {
  vix: number | null;
  tenYear: number | null;
  /** True index levels from FRED, each with the level before it. Null when the series was down. */
  sp500: number | null;
  sp500Prior: number | null;
  nasdaqComposite: number | null;
  nasdaqCompositePrior: number | null;
  djia: number | null;
  djiaPrior: number | null;
  advancers: number;
  decliners: number;
  pctAbove50dma: number;
  /**
   * The session the index levels above are actually FOR — which is not always the run's own date.
   *
   * FRED posts the index closes after both nightly jobs run, and a flaky night now keeps the levels
   * it already had rather than overwriting them with null. Both mean a level can be real and not
   * tonight's, and this is how the Desk knows to say so (ruling C7).
   */
  indexLevelsAsOf?: Date | string | null;
};

/** Where a slot's number came from. The label is not free to disagree with this. */
export type QuoteSource = "index" | "etf-proxy";

/** Midnight UTC of a date, for comparing bare dates without letting a clock time decide the answer. */
function startOfUtcDay(day: Date): number {
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

export type IndexQuote = {
  label: string;
  /** Already formatted. This module never calls toFixed; every number goes through lib/format. */
  value: string;
  /** The one-day change, or "—" when it is not knowable from what was stored. */
  deltaPct: string;
  direction: Direction;
  source: QuoteSource;
  /** Set only on a proxy slot: the ETF actually being shown. */
  proxySymbol?: string;
  /**
   * The slot's SINGLE proxy mark, already filled in — e.g. "IWM · ETF price".
   *
   * Present on exactly the proxy slots, and it is the only place the word "ETF" now appears. The old
   * grammar said it twice — a label suffix "(ETF proxy)" AND a freestanding chip reading "ETF proxy"
   * — which on screen read as noise, and noise is where a beginner stops reading.
   */
  proxyChip?: string;
  /**
   * Set when this slot's number is a REAL index level that is not tonight's: "as of Jul 9".
   *
   * Only staleness earns a per-slot date. The masthead's as-of already covers the normal case, so a
   * date on every row every night would be chrome; a date on the ONE row that is behind is
   * information (ruling C7).
   */
  staleAsOf?: string;
};

/** The macro strip's view-model — the exact shape MacroPulse renders (minus asOf, added by the page). */
export type MacroView = {
  spx: IndexQuote;
  indices: IndexQuote[];
  breadth: { advancers: number; decliners: number; pctAbove50dma: string; asOf: string };
  vix: string;
  tenYear: string;
  /**
   * The provenance line, COMPOSED from the rows actually rendered (ruling C6).
   *
   * It used to be a static string — "Index levels · FRED · prior close" — printed under whatever the
   * rows happened to show. On the night FRED's index series failed, it sat under four ETF prices and
   * declared them FRED index levels. A provenance line that can disagree with its own surface is
   * worse than no provenance line at all, because it converts a visible gap into an invisible lie.
   */
  provenance: string;
};

/**
 * A quote from a true index level and the level before it.
 *
 * If the prior level is missing, the level still renders and the change renders "—". It is never
 * borrowed from the ETF: the ETF's percentage move is close to the index's, but "close" is not
 * "the same", and a number the database cannot justify does not get printed.
 */
function quoteFromLevel(slot: IndexSlot, ctx: MacroContext, staleAsOf?: string): IndexQuote | null {
  const { value, prior } = slot.level(ctx);
  if (value === null) return null;

  const base = { label: slot.label, value: price(value), source: "index" as const, ...(staleAsOf ? { staleAsOf } : {}) };

  if (prior === null) {
    return { ...base, deltaPct: "—", direction: "flat" };
  }
  const delta = (value - prior) / prior;
  return { ...base, deltaPct: signedPercent(delta), direction: directionOf(delta) };
}

/**
 * The one-day change from a run of closes: the latest close against the one before it.
 *
 * Returns null when there is not enough history to state a change honestly — it needs two bars, and
 * a single bar is not a change. Shared by the macro strip's ETF fallback and the watchlist.
 */
function dayChange(
  closes: number[] | undefined,
): { latest: number; deltaPct: string; direction: Direction } | null {
  if (!closes || closes.length < 2) return null;
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const delta = (latest - prev) / prev;
  return { latest, deltaPct: signedPercent(delta), direction: directionOf(delta) };
}

/**
 * A quote from an ETF's recent closes — the fallback path, and the Russell's only path.
 *
 * The label is the slot's *proxy* label, so the ETF is named as an ETF wherever this is used.
 */
function quoteFromCloses(slot: IndexSlot, closes: number[] | undefined): IndexQuote | null {
  const change = dayChange(closes);
  if (change === null) return null;
  return {
    label: slot.label,
    value: price(change.latest),
    deltaPct: change.deltaPct,
    direction: change.direction,
    source: "etf-proxy",
    proxySymbol: slot.proxySymbol,
    // THE ONE PROXY MARK. On the small-caps slot it simply names what the number is ("IWM · ETF
    // price"). On a DEGRADED index slot — where an index's name and an ETF's price share a row, the
    // one case this module has always guarded hardest — it negates the misreading outright:
    // "SPY · ETF price — not the index level".
    proxyChip: slot.proxyChip.replace("{symbol}", slot.proxySymbol),
  };
}

/** The true level if the pipeline stored one, otherwise the honestly-labelled ETF. Never a hybrid. */
function quoteForSlot(
  slot: IndexSlot,
  ctx: MacroContext,
  closesBySymbol: Record<string, number[]>,
  staleAsOf?: string,
): IndexQuote | null {
  return (
    quoteFromLevel(slot, ctx, staleAsOf) ?? quoteFromCloses(slot, closesBySymbol[slot.proxySymbol])
  );
}

/**
 * Compose the provenance line from the rows that ACTUALLY rendered (ruling C6).
 *
 * This is the fix for the defect in the user's screenshot: a static footer reading "Index levels ·
 * FRED · prior close" printed under four ETF prices. The sentence was written for the happy path and
 * rendered regardless — so on the one night it mattered, it was a confident lie.
 *
 * Now the line is assembled from each slot's real source. If the indexes are live it says so; if
 * some fell back it names which; if they ALL fell back it opens by saying that outright, because an
 * absence the reader has to infer from four small chips is an absence most readers will not notice.
 */
export function buildMacroProvenance(
  spx: IndexQuote,
  indices: IndexQuote[],
  { vix, tenYear }: { vix: string; tenYear: string },
): string {
  const parts: string[] = [];

  // The index slots — everything except the by-design proxy (small caps), which is never a
  // degradation and so never belongs in a story about index levels being missing.
  const indexSlots = [spx, ...indices].filter((q) => q.label !== "Small caps");
  const live = indexSlots.filter((q) => q.source === "index");
  const fellBack = indexSlots.filter((q) => q.source === "etf-proxy");

  if (live.length === 0 && fellBack.length > 0) {
    parts.push(copy.macro.indexesUnavailable);
  } else {
    if (live.length > 0) {
      const stale = live.filter((q) => q.staleAsOf);
      const names = live.map((q) => q.label).join(", ");
      // A carried-forward level is still a FRED level — but it is not tonight's, and the line says so
      // rather than letting the masthead's as-of quietly speak for it.
      parts.push(
        stale.length === live.length && stale[0].staleAsOf
          ? `${names}: FRED, ${stale[0].staleAsOf}`
          : `${names}: FRED, prior close`,
      );
    }
    for (const q of fellBack) {
      parts.push(`${q.label}: ${q.proxySymbol} ETF close (index level unavailable)`);
    }
  }

  const smallCaps = [spx, ...indices].find((q) => q.label === "Small caps");
  if (smallCaps) parts.push(`Small caps: ${smallCaps.proxySymbol} ETF close`);

  if (vix !== "—") parts.push("VIX: Cboe via FRED");
  if (tenYear !== "—") parts.push("10-yr: US Treasury via FRED");

  return parts.join(" · ");
}

/**
 * Build the macro strip from the day's context row, its index levels, and the ETF closes that stand
 * in when a level is missing.
 *
 * Returns null — so the Desk shows the placeholder instead — when the hero (the S&P) cannot be
 * formed by either path, or when there is no macro context row at all: a macro module without its
 * hero numeral or its breadth is not the macro module. A slot with neither a level nor two bars is
 * dropped from the row. A FRED context cell that is null renders as a quiet "—", never a fake zero.
 */
export function buildMacro(
  ctx: MacroContext | null,
  closesBySymbol: Record<string, number[]>,
  runDate?: Date | null,
): MacroView | null {
  if (ctx === null) return null;

  // Are the stored index levels tonight's, or an earlier session's carried forward?
  //
  // The pipeline no longer lets a flaky FRED night overwrite a good level with null — it keeps what
  // it has and records the session those levels are really for. So a level can now be REAL and OLD
  // at the same time, which is a state the Desk has never had to render before. When it happens the
  // slot says "as of Jul 9" and the number stands; the alternative — collapsing a perfectly good
  // index level to an ETF price because it is one day behind — would be throwing away the better
  // number to avoid printing a date.
  const levelsAsOf = ctx.indexLevelsAsOf ? new Date(ctx.indexLevelsAsOf) : null;
  const levelsAreStale =
    levelsAsOf !== null && runDate != null && levelsAsOf.getTime() < startOfUtcDay(runDate);
  const staleAsOf =
    levelsAreStale && levelsAsOf
      ? copy.macro.staleLevel.replace("{date}", formatUtcDate(levelsAsOf))
      : undefined;

  const spx = quoteForSlot(SPX_SLOT, ctx, closesBySymbol, staleAsOf);
  if (spx === null) return null;

  const indices = INDEX_SLOTS.map((slot) =>
    quoteForSlot(slot, ctx, closesBySymbol, staleAsOf),
  ).filter((quote): quote is IndexQuote => quote !== null);

  const vix = ctx.vix === null ? "—" : price(ctx.vix);
  // The 10-year yield is stored as a plain percent value (4.54 = 4.54%), so it divides by 100
  // to become the fraction lib/format expects.
  const tenYear = ctx.tenYear === null ? "—" : percent(ctx.tenYear / 100, 2);

  return {
    spx,
    indices,
    breadth: {
      advancers: ctx.advancers,
      decliners: ctx.decliners,
      pctAbove50dma: percent(ctx.pctAbove50dma),
      // Breadth is a claim about the WHOLE market, and until now it was the only figure on the
      // module carrying no window at all (C2). It is as of the close, and it says so.
      // formatUtcWeekday, not a local Intl formatter (ruling E2 — one door for weekday words). The
      // duplicate that used to live here was byte-for-byte the same call and would have drifted the
      // day anyone changed one of them; a second copy of a formatter is a second answer waiting to
      // happen. check-drift.mjs rule 22 now fails the build for a weekday formatter outside lib/time.
      asOf: runDate ? copy.macro.breadthClose.replace("{day}", formatUtcWeekday(runDate)) : "at the close",
    },
    vix,
    tenYear,
    provenance: buildMacroProvenance(spx, indices, { vix, tenYear }),
  };
}

// ── Movers ────────────────────────────────────────────────────────────────────────────────────

/** One mover before formatting — the fields pulled from a scan result, the instrument table, and
 * (if any) the matched catalyst from the news. */
export type MoverSource = {
  symbol: string;
  name: string;
  changeFraction: number;
  rvol: number;
  catalyst?: Catalyst;
};

/**
 * Format the movers, preserving the order given (the pipeline ranks them). Each mover carries its
 * matched catalyst, or none — the Movers component renders the catalyst chip when present and the
 * honest "no news found — likely noise" line when it is absent (§1.5 rule 9).
 */
export function buildMovers(sources: MoverSource[]): Mover[] {
  return sources.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    changePct: signedPercent(s.changeFraction),
    direction: directionOf(s.changeFraction),
    rvol: multiple(s.rvol),
    catalyst: s.catalyst,
  }));
}

// ── Calendar ──────────────────────────────────────────────────────────────────────────────────

/** One calendar event as it comes from the calendar_event table. */
export type CalendarSource = {
  date: Date;
  kind: string;
  symbol: string | null;
  title: string;
  consensus: number | null;
  prior: number | null;
  /** The chip code the pipeline's allowlist assigned (CPI, JOBS, FOMC, EARNINGS…). */
  code: string | null;
  /** "high" | "medium". Older rows, written before the allowlist, carry null. */
  importance: string | null;
};

/**
 * Format the session calendar for display: the event date (a bare calendar date, by its UTC
 * calendar date, not shifted to ET) and the consensus/prior figures through lib/format. No forecasting.
 *
 * The chip the reader sees is the allowlist's `code`, not the raw `kind`. That is the point of the
 * allowlist: the calendar speaks one small vocabulary it chose, rather than whatever FRED happened
 * to call a release that night. A row written before the allowlist existed has no code, so it falls
 * back to its kind rather than rendering an empty chip.
 */
export function buildCalendar(sources: CalendarSource[]): CalendarRow[] {
  return sources.map((s) => ({
    dateLabel: formatUtcDate(s.date),
    kind: s.kind,
    code: s.code ?? s.kind,
    title: s.title,
    symbol: s.symbol ?? undefined,
    consensus: s.consensus === null ? undefined : price(s.consensus),
    prior: s.prior === null ? undefined : price(s.prior),
    high: s.importance === "high",
  }));
}

// ── Source status ─────────────────────────────────────────────────────────────────────────────

/** The order sources are listed in the footer — a stable inventory, whichever ran tonight. */
const SOURCE_ORDER = ["alpaca", "finnhub", "marketaux", "fmp", "fred", "edgar"];

/** Turn the run's sourceStatus JSON ({alpaca: "ok", finnhub: "degraded", ...}) into ordered rows. */
export function buildSourceStatus(status: Record<string, unknown> | null): SourceStatus[] {
  if (!status) return [];
  const known = SOURCE_ORDER.filter((name) => name in status).map((name) => ({
    name,
    status: String(status[name]),
  }));
  // Include any provider not in the known order (a future source), after the known ones.
  const extra = Object.keys(status)
    .filter((name) => !SOURCE_ORDER.includes(name))
    .map((name) => ({ name, status: String(status[name]) }));
  return [...known, ...extra];
}

// ── Watchlist ─────────────────────────────────────────────────────────────────────────────────

/** How many recent volumes the watchlist RVOL averages over (the trailing baseline). */
const RVOL_WINDOW = 20;

/** One watchlist name before formatting — its written reason plus its recent closes and volumes. */
export type WatchSource = {
  symbol: string;
  name: string;
  reason: string;
  isFocus: boolean;
  /** Recent closes, oldest first; the last two give the day change and all of them the sparkline. */
  closes: number[];
  /** Recent volumes, oldest first, aligned with closes; the last vs the trailing average is RVOL. */
  volumes: number[];
};

/**
 * Build the focus watchlist rows: the day change from the last two closes, a relative volume from
 * the latest volume against its trailing average, and the closes as the sparkline. RVOL renders as
 * a quiet "—" for a freshly-added name with no prior volume to compare against, rather than a
 * meaningless 1.0×.
 */
export function buildWatchlist(sources: WatchSource[]): WatchRow[] {
  return sources.map((s) => {
    const quote = dayChange(s.closes) ?? { deltaPct: signedPercent(0), direction: "flat" as Direction };
    const prior = s.volumes.slice(0, -1).slice(-RVOL_WINDOW);
    const latestVolume = s.volumes[s.volumes.length - 1];
    const rvol =
      prior.length > 0 ? multiple(latestVolume / (prior.reduce((a, b) => a + b, 0) / prior.length)) : "—";
    const lastClose = s.closes[s.closes.length - 1];
    return {
      symbol: s.symbol,
      name: s.name,
      reason: s.reason,
      // The last close, formatted. The row shows a price beside its delta (§5.1) — a percentage
      // with nothing to be a percentage OF is a number the reader cannot check.
      price: lastClose === undefined ? "—" : price(lastClose),
      changePct: quote.deltaPct,
      direction: quote.direction,
      rvol,
      isFocus: s.isFocus,
      spark: s.closes,
    };
  });
}

// ── The loader ──────────────────────────────────────────────────────────────────────────────────

/** Everything the Desk renders. A null field means "show the placeholder"; an empty array means
 * "the module is wired but had nothing today" (its own empty state renders). `asOf` is an ISO
 * string (not a Date) because this whole object is cached, and the cache serialises to JSON — the
 * page reconstructs the Date. */
export type Morning = {
  asOf: string | null;
  macro: MacroView | null;
  /**
   * The macro board — the five household stats (N3). Null when no stat has ever been stored, which
   * is a brand-new database rather than a broken one. Once ANY stat exists the board renders, and
   * every cell without a row of its own says "not yet reported" in its own words.
   */
  macroBoard: MacroBoardData | null;
  /** The evening briefing view-model, or null when no briefing is recorded yet (the Desk shows the
   * placeholder). A "held" brief is a non-null view with status "held" — the module shows the
   * "briefing unavailable" line, not the placeholder. */
  brief: BriefView | null;
  /** The setup cards for the run — an empty array when the module is wired but nothing fired. */
  setupCards: SetupCardView[] | null;
  movers: Mover[] | null;
  watch: WatchRow[] | null;
  calendar: CalendarRow[] | null;
  /** Per-source health for the run's footer; an empty array when no run is recorded. */
  sources: SourceStatus[];
  /**
   * How many matches the night's scans found, across how many presets (§4.1 module 07).
   *
   * Module 07 used to be a paragraph of prose pointing at another page. It is a GLANCE station, and
   * a glance station that cannot be glanced at is a paragraph. One count query, amortised by the
   * route's cache, turns it into a figure the reader can actually read in passing.
   */
  scans: { matches: number; presets: number };
  /**
   * The top of tonight's Front Page, and how many catalysts it is the top OF (§4.1 module 08).
   *
   * A bounded preview, and it states its own cut — "First 3 of 14 by significance" — because an
   * unlabelled slice of a ranked list is the same lie ruling M8 exists to forbid: the reader cannot
   * tell three-of-three from three-of-forty, and those are very different nights.
   */
  frontPage: { top: FrontPagePreviewRow[]; total: number };
  /** How many journal entries exist for today (0 or 1). The scorecard's disclosure reports it (M2). */
  journalSavedToday: number;
};

/** One line of the Desk's Front Page preview. Deliberately thin: it is a doorway, not a card. */
export type FrontPagePreviewRow = {
  id: string;
  headline: string;
  eventType: string;
  sources: number;
};

/**
 * How many scan matches the latest run produced, and across how many presets.
 *
 * A count query, not a fetch: module 07 needs the number, not the rows. Degrades to zeros if the
 * database cannot be reached — the module then reads "0 matches across 0 scans", which is honest
 * about what it knows rather than pretending the scans found nothing.
 */
async function loadScanCount(): Promise<{ matches: number; presets: number }> {
  try {
    const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (!latest) return { matches: 0, presets: SCAN_PRESETS.length };

    const grouped = await db.scanResult.groupBy({
      by: ["presetKey"],
      where: { runDate: latest.runDate },
      _count: { _all: true },
    });
    return {
      matches: grouped.reduce((sum, g) => sum + g._count._all, 0),
      // Every preset RAN. Reporting only the ones that matched would quietly undercount the work and
      // imply that a scan which found nothing did not happen — and "the filter ran and found nothing"
      // is a result this product goes out of its way to state everywhere else.
      presets: SCAN_PRESETS.length,
    };
  } catch (error) {
    console.error("getMorning: could not count the scan matches", error);
    return { matches: 0, presets: SCAN_PRESETS.length };
  }
}

/**
 * How many journal entries exist for today.
 *
 * The collapsed journal row reports its own state — "1 saved tonight" or "none saved tonight" — and
 * a zero is a STATE, not an offer of more (ruling M2). Without this count the disclosure would be
 * hiding an unstated number of things, which is exactly what the rule forbids.
 */
async function loadJournalCount(): Promise<number> {
  try {
    const today = new Date(new Date().toISOString().slice(0, 10));
    return await db.journalEntry.count({ where: { date: today } });
  } catch (error) {
    console.error("getMorning: could not count tonight's journal entries", error);
    return 0;
  }
}

/** Group price rows (already sorted oldest-first) into a symbol → closes map. */
function closesBy(rows: Array<{ symbol: string; close: number }>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const r of rows) (out[r.symbol] ??= []).push(r.close);
  return out;
}

/**
 * Load the whole morning. Reads the latest run for the timestamp, then each module independently.
 * Any single read that throws is logged on the server and degrades that one module — the Desk never
 * crashes because one table was slow or empty.
 */
export async function getMorning(): Promise<Morning> {
  const asOf = await latestAsOf();
  const [macro, macroBoard, brief, setupCards, movers, watch, calendar, sources, scans, frontPage, journalSavedToday] =
    await Promise.all([
      loadMacro(),
      loadMacroBoard(),
      loadBrief(),
      loadSetupCards(),
      loadMovers(),
      loadWatchlist(),
      loadCalendar(),
      loadSourceStatus(),
      loadScanCount(),
      loadFrontPage(),
      loadJournalCount(),
    ]);
  return {
    asOf: asOf ? asOf.toISOString() : null,
    macro,
    macroBoard,
    brief,
    setupCards,
    movers,
    watch,
    calendar,
    sources,
    scans,
    frontPage,
    journalSavedToday,
  };
}

/** How many stories the Desk's Front Page preview shows before pointing at the room. */
const FRONT_PAGE_PREVIEW = 3;

/**
 * The top of tonight's front page, with the total it was cut from.
 *
 * The order is the pipeline's `significance` and nothing else — the Desk does not get a second
 * opinion about which story leads. Reading it here rather than re-deriving it is the point: two
 * places that decide what the day's biggest story was will eventually disagree, and then the Desk
 * and the Front Page would print two different front pages.
 */
async function loadFrontPage(): Promise<{ top: FrontPagePreviewRow[]; total: number }> {
  try {
    const latest = await db.newsCluster.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    if (!latest) return { top: [], total: 0 };

    const [rows, total] = await Promise.all([
      db.newsCluster.findMany({
        where: { runDate: latest.runDate },
        orderBy: [{ significance: "desc" }, { firstSeen: "asc" }, { id: "asc" }],
        take: FRONT_PAGE_PREVIEW,
        select: { id: true, headline: true, eventType: true, sources: true },
      }),
      db.newsCluster.count({ where: { runDate: latest.runDate } }),
    ]);

    return { top: rows, total };
  } catch (error) {
    console.error("getMorning: could not load the front page preview", error);
    return { top: [], total: 0 };
  }
}

/**
 * Load the latest run's setup cards into view-models for module 06. Each card's stored state carries
 * the base-rate figures the pipeline computed; this maps them onto the shared BaseRate data shape
 * (the app renders, never derives) and attaches the per-pattern weakener items with their saved
 * checkbox state. A read failure degrades the module to a placeholder, never the Desk.
 */
async function loadSetupCards(): Promise<SetupCardView[] | null> {
  try {
    const latest = await db.setupCard.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (latest === null) return [];
    const rows = await db.setupCard.findMany({
      where: { runDate: latest.runDate },
      orderBy: [{ tier: "asc" }, { symbol: "asc" }],
      select: { id: true, symbol: true, patternKey: true, tier: true, state: true, weakeners: true },
    });
    return rows.map((row) => {
      const state = (row.state ?? {}) as Record<string, unknown>;
      const n = Number(state.n ?? 0);
      const winRate = Number(state.winRate ?? 0);
      return {
        id: row.id,
        symbol: row.symbol,
        patternKey: row.patternKey,
        patternLabel: patternLabel(row.patternKey),
        tier: row.tier as Tier,
        cause: patternCause(row.patternKey),
        baseRate: {
          n,
          wins: Math.round(winRate * n),
          winRate,
          ciLow: Number(state.ciLow ?? 0),
          ciHigh: Number(state.ciHigh ?? 0),
          baseline: state.baseline == null ? null : Number(state.baseline),
          horizonDays: Number(state.horizonDays ?? 10),
          refClass: refClassLabel(String(state.universe ?? "")),
          publicationYear: state.publicationYear == null ? null : Number(state.publicationYear),
          evidenceGrade: (state.evidenceGrade as SetupCardView["baseRate"]["evidenceGrade"]) ?? null,
          decayNote: (state.decayNote as string | null) ?? null,
        },
        weakeners: weakenersFor(row.patternKey),
        weakenerState: (row.weakeners ?? {}) as Record<string, boolean>,
        // The card links to its pattern's lesson — but only once that lesson is authored (the
        // doorway gates on the slug existing), so cards for not-yet-written lessons carry none.
        learnSlug: knownLessonOrNull(patternLessonSlug(row.patternKey)),
      };
    });
  } catch (error) {
    console.error("getMorning: could not load setup cards", error);
    return null;
  }
}

/** A lesson slug only if the Academy manifest knows it — else null (no doorway yet). */
function knownLessonOrNull(slug: string | null): string | null {
  return slug && isKnownLesson(slug) ? slug : null;
}

/** The reference-class label the base-rate sentence reads ("US large/mid", "US small"). */
function refClassLabel(universe: string): string {
  if (universe === "large_mid") return "US large/mid names";
  if (universe === "small") return "US small-cap names";
  return "US names";
}

/**
 * Load the latest evening briefing and turn it into the BriefArticle view-model.
 *
 * The stored JSON is validated at the boundary and its citation ids are resolved to the news
 * articles behind them (so the superscripts link out); a held briefing yields a held view (the
 * "unavailable" line), and an unreadable one degrades to null (the placeholder). learning_link_slug
 * is gated against the Academy manifest, empty until P5, so early briefs carry no Learn doorway.
 */
async function loadBrief(): Promise<BriefView | null> {
  try {
    const row = await db.briefing.findFirst({
      orderBy: { runDate: "desc" },
      select: { status: true, amJson: true },
    });
    if (row === null) return null;

    const resolver = await citationResolver(row.amJson);
    return buildBrief({
      status: row.status,
      draft: row.amJson,
      resolveCitation: (id) => resolver[id] ?? null,
      isKnownLesson,
    });
  } catch (error) {
    console.error("getMorning: could not load the briefing", error);
    return null;
  }
}

/**
 * Resolve a briefing's citation ids to their news articles. Parses the draft to collect the ids it
 * cites, then looks those up in news_item — a citation that is a computed stat (no matching news
 * row) is simply absent, and buildBrief treats it as an unlinked, non-footnoted reference.
 */
async function citationResolver(amJson: unknown): Promise<Record<string, { url: string; source: string }>> {
  const draft = parseBriefDraft(amJson);
  if (draft === null) return {};

  const ids = new Set<string>(draft.today_focus.citations);
  for (const item of draft.items) for (const id of item.citations) ids.add(id);
  if (ids.size === 0) return {};

  const rows = await db.newsItem.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, url: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, { url: r.url, source: sourceLabel(r.url) }]));
}

/**
 * How many calendar rows the Desk shows. Named because the cap is load-bearing: the rows are sorted
 * by date ascending, so anything stranded in the PAST sorts first and spends these slots. That is
 * not a cosmetic problem — it is an eviction. See calendarFloor below.
 */
const CALENDAR_ROWS = 15;

/**
 * The earliest date the session calendar may show: the edition's own session.
 *
 * The calendar is a FORWARD view — it says what is coming — so it must never render a day that has
 * already been. The floor is the EDITION's session date, not the wall clock, and that choice is
 * PD0's lesson restated: the Desk serves a dated edition, and every module on it speaks from that
 * same day. A clock-based floor would quietly disagree with the masthead in the hours between
 * midnight and the next night's run, which is exactly the kind of two-clocks bug this codebase has
 * already paid for once.
 *
 * With no run at all (an empty database) there is no edition to speak from, so fall back to today:
 * showing nothing is better than showing history.
 */
export function calendarFloor(editionDate: Date | null, now: Date): Date {
  if (editionDate !== null) return editionDate;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The session calendar: the next few things the market is waiting for.
 *
 * THE BUG THIS GUARDS (PD1). This read used to have no lower bound at all — it simply took the 15
 * earliest rows in the table. So four rows written by the pre-allowlist ingest ("Coinbase
 * Cryptocurrencies", a raw "FOMC Press Release") and dated on a Saturday and a Sunday sorted to the
 * TOP of the list and sat on the live Desk for weeks. They were not merely ugly: they were spending
 * 4 of the 15 slots, so the Desk showed 11 of its 23 real forward events and silently dropped the
 * rest.
 *
 * The pipeline's refresh now sweeps the whole table (publish._replace_calendar), so the litter
 * cannot accumulate. This is the other half of the fence, and it is the half that holds when the
 * pipeline has not run for a few days: a floor at the read means a stale row can never be rendered,
 * whatever is sitting in the table.
 */
async function loadCalendar(): Promise<CalendarRow[] | null> {
  try {
    const edition = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    const rows = await db.calendarEvent.findMany({
      where: { date: { gte: calendarFloor(edition?.runDate ?? null, new Date()) } },
      orderBy: [{ date: "asc" }],
      take: CALENDAR_ROWS,
      select: {
        date: true, kind: true, symbol: true, title: true,
        consensus: true, prior: true, code: true, importance: true,
      },
    });
    return buildCalendar(rows);
  } catch (error) {
    console.error("getMorning: could not load the calendar", error);
    return null;
  }
}

async function loadSourceStatus(): Promise<SourceStatus[]> {
  try {
    const run = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { sourceStatus: true },
    });
    return buildSourceStatus((run?.sourceStatus ?? null) as Record<string, unknown> | null);
  } catch (error) {
    console.error("getMorning: could not read source status", error);
    return [];
  }
}

async function latestAsOf(): Promise<Date | null> {
  try {
    const run = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true, finishedAt: true },
    });
    return run ? (run.finishedAt ?? run.runDate) : null;
  } catch (error) {
    console.error("getMorning: could not read the latest run", error);
    return null;
  }
}

/**
 * Load the macro board: the five household stats, plus the run's own source health (N3, Part 6).
 *
 * The source status is read alongside the rows because the two answer different questions and the
 * board needs both. The ROWS say what the newest observation is and when it is for. The STATUS says
 * whether the source could be reached tonight at all. A cell can be perfectly current and still have
 * failed to refresh, and it can have refreshed cleanly and still be far too old to trust — so a cell
 * that only knew one of these two facts would be guessing about the other.
 *
 * A read failure degrades the whole board to null (the module simply omits it) rather than the Desk.
 */
async function loadMacroBoard(): Promise<MacroBoardData | null> {
  try {
    const [rows, run, latest] = await Promise.all([
      db.macroStat.findMany({
        orderBy: [{ seriesKey: "asc" }, { asOfDate: "desc" }],
        select: {
          seriesKey: true,
          asOfDate: true,
          value: true,
          prior: true,
          asOfLabel: true,
          sourceKey: true,
          meta: true,
        },
      }),
      db.pipelineRun.findFirst({ orderBy: { runDate: "desc" }, select: { sourceStatus: true } }),
      db.marketContext.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } }),
    ]);

    if (rows.length === 0) return null;

    // Age is judged against the RUN's date, not against the reader's clock. The board is part of a
    // cached render, and a cell that graded itself against "now" would drift from the rest of the
    // page it is printed on. (The pipeline strip is the deliberate exception, and for the opposite
    // reason: catching a pipeline that died since the render is its entire job.)
    const runDate = latest?.runDate ?? new Date();

    return buildMacroBoard(
      rows as MacroStatRow[],
      (run?.sourceStatus ?? null) as Record<string, unknown> | null,
      runDate,
    );
  } catch (error) {
    console.error("getMorning: could not load the macro board", error);
    return null;
  }
}

async function loadMacro(): Promise<MacroView | null> {
  try {
    const ctx = await db.marketContext.findFirst({ orderBy: { runDate: "desc" } });
    // The ETF bars are still read: they are the fallback path for any slot whose index level is
    // missing, and the only path the Russell 2000 has (§6.1).
    const bars = await db.priceBar.findMany({
      where: { symbol: { in: PROXY_SYMBOLS } },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      select: { symbol: true, close: true },
    });
    // The run date goes in too, so the builder can tell a level that is tonight's from one that was
    // carried forward — and say "as of Jul 9" on the latter rather than letting the masthead's
    // as-of quietly speak for a number it does not describe.
    return buildMacro(ctx, closesBy(bars), ctx?.runDate ?? null);
  } catch (error) {
    console.error("getMorning: could not load the macro strip", error);
    return null;
  }
}

/** How far back from the run date to look for a mover's catalyst — enough to catch a weekend and
 * the after-hours news that explains an open. */
const CATALYST_WINDOW_DAYS = 3;

async function loadMovers(): Promise<Mover[] | null> {
  try {
    // The movers are the volume-confirmed moves — the "unusual-volume" scan's matches, ranked.
    // Top eight of the latest run.
    const rows = await db.scanResult.findMany({
      where: { presetKey: "unusual-volume" },
      orderBy: [{ runDate: "desc" }, { rank: "asc" }],
      take: 8,
      select: { symbol: true, metrics: true, runDate: true },
    });
    if (rows.length === 0) return [];

    const symbols = rows.map((r) => r.symbol);
    const [names, catalysts] = await Promise.all([
      instrumentNames(symbols),
      loadCatalysts(symbols, rows[0].runDate),
    ]);
    const sources: MoverSource[] = rows.map((r) => {
      const m = (r.metrics ?? {}) as Record<string, unknown>;
      return {
        symbol: r.symbol,
        name: names[r.symbol] ?? r.symbol,
        changeFraction: Number(m.ret_1 ?? 0),
        rvol: Number(m.rvol20 ?? 0),
        catalyst: catalysts[r.symbol],
      };
    });
    return buildMovers(sources);
  } catch (error) {
    console.error("getMorning: could not load movers", error);
    return null;
  }
}

/**
 * For a set of mover symbols, find each one's most recent in-window news and return it as a
 * Catalyst (symbol → Catalyst). A symbol with no matching news is simply absent, and the Movers
 * row renders the honest noise line for it. The classification (event type) is done by the pipeline
 * and stored on the row; the source label is the article's domain.
 */
async function loadCatalysts(symbols: string[], runDate: Date): Promise<Record<string, Catalyst>> {
  const windowStart = new Date(runDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - CATALYST_WINDOW_DAYS);

  const news = await db.newsItem.findMany({
    where: { tickers: { hasSome: symbols }, publishedAt: { gte: windowStart } },
    orderBy: { publishedAt: "desc" },
    select: { tickers: true, headline: true, url: true, eventType: true },
  });

  const wanted = new Set(symbols);
  const out: Record<string, Catalyst> = {};
  // News is newest-first, so the FIRST article naming a symbol is its most recent catalyst.
  for (const article of news) {
    for (const ticker of article.tickers) {
      if (wanted.has(ticker) && !out[ticker]) {
        out[ticker] = {
          type: article.eventType ?? "news",
          headline: article.headline,
          source: sourceLabel(article.url),
          url: article.url,
        };
      }
    }
  }
  return out;
}

/** A short, human source label from an article URL — its host, without a leading "www.". */
function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

async function loadWatchlist(): Promise<WatchRow[] | null> {
  try {
    const items = await db.watchlistItem.findMany({
      orderBy: [{ isFocus: "desc" }, { addedAt: "asc" }],
      select: { symbol: true, reason: true, isFocus: true, instrument: { select: { name: true } } },
    });
    if (items.length === 0) return [];
    const bars = await db.priceBar.findMany({
      where: { symbol: { in: items.map((i) => i.symbol) } },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      select: { symbol: true, close: true, vol: true },
    });
    const closes: Record<string, number[]> = {};
    const volumes: Record<string, number[]> = {};
    for (const b of bars) {
      (closes[b.symbol] ??= []).push(b.close);
      (volumes[b.symbol] ??= []).push(Number(b.vol));
    }
    const sources: WatchSource[] = items.map((i) => ({
      symbol: i.symbol,
      name: i.instrument.name,
      reason: i.reason,
      isFocus: i.isFocus,
      closes: closes[i.symbol] ?? [],
      volumes: volumes[i.symbol] ?? [],
    }));
    return buildWatchlist(sources);
  } catch (error) {
    console.error("getMorning: could not load the watchlist", error);
    return null;
  }
}

/** Look up display names for a set of symbols, returning a symbol → name map. */
async function instrumentNames(symbols: string[]): Promise<Record<string, string>> {
  const rows = await db.instrument.findMany({
    where: { symbol: { in: symbols } },
    select: { symbol: true, name: true },
  });
  return Object.fromEntries(rows.map((r) => [r.symbol, r.name]));
}
