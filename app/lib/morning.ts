import { db } from "@/lib/db";
import { SCAN_PRESETS } from "@/lib/scan-presets";
import type { EvidenceGrade } from "@/components/Tag";
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
import { calendarAnchorIdFromDate } from "@/lib/calendar-anchor";
import { buildSetupCardView } from "@/lib/setup-card-view";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { Direction } from "@/components/StatFigure";
import type { Catalyst, Mover } from "@/components/desk/Movers";
import type { CalendarRow } from "@/components/desk/CalendarTimeline";
import type { SourceStatus } from "@/components/desk/SourceStatusFooter";
import type { WatchRow } from "@/components/desk/Watchlist";

/**
 * morning.ts — the Desk's data loader (plan §9.2, P1 step 6).
 *
 * getMorning() assembles the ritual column from the serving database the nightly pipeline fills. Two
 * ideas hold it together: (1) graceful degradation — each module reads independently and each read is
 * wrapped, so one unreachable table degrades one module to a placeholder rather than crashing the Desk;
 * (2) pure builders — all the arithmetic (buildMacro/buildMovers/buildWatchlist) lives in exported pure
 * functions over plain row shapes, unit-tested without a database, and getMorning is only the I/O shell
 * around them. Every number goes through lib/format — nothing here calls toFixed or toLocaleString.
 */

// ── Macro ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The macro strip's four slots, and the honesty rule that shapes this section: an ETF is not its index.
 * SPY tracks the S&P 500's percentage move but trades near 755 while the index sits near 6,800, so
 * printing SPY's price under "S&P 500" tells a beginner something false in the Desk's largest numeral.
 * Each slot renders one of two ways and the label follows: source "index" (the true FRED level) or
 * "etf-proxy" (the ETF's own price under the ETF's own label). There is no third path where an ETF price
 * wears an index's name. The Russell 2000 has no free FRED series, so its slot is always the proxy — and
 * always says so (UI-REDESIGN §6.1, Appendix E-1).
 */
type IndexSlot = {
  /** The label this slot wears — an index's name, or for the by-design proxy the GROUP ("Small caps"),
   *  never an index we cannot quote. */
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
    // QQQ tracks the Nasdaq-100, NOT the Composite — a different index; the chip must not blur that.
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
    // No free FRED daily series for the Russell 2000 (FRED deleted all 36 FTSE Russell series in 2019;
    // alternatives checked and rejected, plan Appendix A.2), so this slot NEVER has an index level —
    // which is why it is "Small caps", the GROUP, not an index name the row could never honour.
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
   * The session the index levels are actually FOR — not always the run's date. FRED posts closes after
   * both jobs run, and a flaky night keeps the levels it had rather than nulling them; both mean a level
   * can be real and not tonight's, which is how the Desk knows to say so (ruling C7).
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
   * The slot's SINGLE proxy mark, filled in — e.g. "IWM · ETF price". On exactly the proxy slots, the
   * only place "ETF" now appears; the old grammar said it twice (a label suffix and a chip), which read
   * as noise.
   */
  proxyChip?: string;
  /**
   * Set when a slot's number is a REAL index level that is not tonight's ("as of Jul 9"). Only staleness
   * earns a per-slot date — the masthead's as-of covers the normal case, so a date on the one row that is
   * behind is information, not chrome (ruling C7).
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
   * The provenance line, COMPOSED from the rows actually rendered (ruling C6). It used to be a static
   * "Index levels · FRED · prior close"; the night FRED failed it sat under four ETF prices and declared
   * them FRED levels — a provenance that can disagree with its surface converts a visible gap into an
   * invisible lie.
   */
  provenance: string;
};

/**
 * A quote from a true index level and the level before it. If the prior is missing the level still
 * renders and the change is "—" — never borrowed from the ETF, because "close" is not "the same" and a
 * number the database cannot justify is not printed.
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
 * The one-day change from a run of closes: latest against the one before. Null when there are fewer than
 * two bars — a single bar is not a change. Shared by the macro strip's ETF fallback and the watchlist.
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

/** A quote from an ETF's recent closes — the fallback path, and the Russell's only path. The label is
 * the slot's PROXY label, so the ETF is named as an ETF wherever this is used. */
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
    // THE ONE PROXY MARK: on small caps it names what the number is ("IWM · ETF price"); on a DEGRADED
    // index slot (an index's name over an ETF price) it negates the misreading — "… not the index level".
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
 * Compose the provenance line from the rows that ACTUALLY rendered (ruling C6) — the fix for a static
 * "Index levels · FRED · prior close" printed under four ETF prices. Assembled from each slot's real
 * source: live indexes say so, fallbacks name which, and an all-fallback night opens by saying so
 * outright, because an absence inferred from four small chips is one most readers miss.
 */
export function buildMacroProvenance(
  spx: IndexQuote,
  indices: IndexQuote[],
  { vix, tenYear }: { vix: string; tenYear: string },
): string {
  const parts: string[] = [];

  // The index slots — not the by-design proxy (small caps), which is never a degradation.
  const indexSlots = [spx, ...indices].filter((q) => q.label !== "Small caps");
  const live = indexSlots.filter((q) => q.source === "index");
  const fellBack = indexSlots.filter((q) => q.source === "etf-proxy");

  if (live.length === 0 && fellBack.length > 0) {
    parts.push(copy.macro.indexesUnavailable);
  } else {
    if (live.length > 0) {
      const stale = live.filter((q) => q.staleAsOf);
      const names = live.map((q) => q.label).join(", ");
      // A carried-forward level is still a FRED level, but not tonight's — the line says so rather than
      // letting the masthead's as-of speak for it.
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
 * Build the macro strip from the day's context row, its index levels, and the ETF closes that stand in
 * when a level is missing. Returns null (Desk shows the placeholder) when the hero S&P cannot be formed
 * either way or there is no context row — a macro module without its hero or its breadth is not the
 * module. A slot with neither a level nor two bars is dropped; a null FRED cell renders "—", never a
 * fake zero.
 */
export function buildMacro(
  ctx: MacroContext | null,
  closesBySymbol: Record<string, number[]>,
  runDate?: Date | null,
): MacroView | null {
  if (ctx === null) return null;

  // Are the stored index levels tonight's, or an earlier session's carried forward? The pipeline keeps
  // a good level rather than nulling it on a flaky FRED night, so a level can be REAL and OLD at once —
  // the slot then says "as of Jul 9" and the number stands, rather than collapsing a good level to an
  // ETF price just to avoid printing a date.
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
      // Breadth is a claim about the WHOLE market and was the only figure here carrying no window (C2):
      // it is as of the close and says so. formatUtcWeekday, never a local Intl formatter — one door for
      // weekday words (ruling E2); a second copy would drift, and check-drift rule 22 now fails the build
      // for a weekday formatter outside lib/time.
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

/** RVOL is emphasised once it clears 2× — the point at which "unusual volume" stops being a phrase
 * and starts being a fact. The decision is made here, on the number, not parsed back out of the
 * display string (which may read "≥20×" and has no leading digit). */
const RVOL_EMPHASIS_THRESHOLD = 2;

/** rvol20 = today's volume ÷ its own 20-day average, and that average INCLUDES today — so the ratio
 * is mathematically bounded by the window length (20). A value at the ceiling means the trailing
 * average is degenerate (a thin or newly-listed name whose prior days had ~no volume), so the display
 * saturates to "≥20×" (copy.mover.relvolCapped) rather than a canned "20.0×" (CC6, D6). The −0.05
 * catches everything that would round up to 20.0. */
const RVOL_CEILING = 20;

/**
 * Format the movers, preserving the pipeline's order. Each carries its matched catalyst or none — the
 * component renders the catalyst chip when present and the honest "likely noise" line when absent
 * (§1.5 rule 9).
 */
export function buildMovers(sources: MoverSource[]): Mover[] {
  return sources.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    changePct: signedPercent(s.changeFraction),
    direction: directionOf(s.changeFraction),
    rvol: s.rvol >= RVOL_CEILING - 0.05 ? copy.mover.relvolCapped : multiple(s.rvol),
    emphasizeRvol: s.rvol >= RVOL_EMPHASIS_THRESHOLD,
    catalyst: s.catalyst,
  }));
}

// ── Calendar ──────────────────────────────────────────────────────────────────────────────────

/** The session calendar as the Desk shows it (CC6, D7): the forward rows, plus the symbols that
 * reported earnings on the edition's OWN session — collapsed into one retrospective "Reported today"
 * line, so a post-close reader leads with what is ahead rather than a stack of names already reported. */
export type CalendarView = {
  rows: CalendarRow[];
  reportedToday: string[];
};

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
 * Format the session calendar: the event date (bare UTC calendar date, not shifted to ET) and
 * consensus/prior through lib/format, no forecasting. The chip is the allowlist's `code`, not the raw
 * `kind` — the calendar speaks one small vocabulary it chose; a pre-allowlist row has no code and falls
 * back to its kind rather than an empty chip.
 */
export function buildCalendar(sources: CalendarSource[]): CalendarRow[] {
  return sources.map((s) => ({
    dateLabel: formatUtcDate(s.date),
    // The per-day anchor a story's watch rows link to (PD8). Derived from the SAME date the row
    // shows, so a watch date and its calendar day can never spell their anchor differently.
    anchorId: calendarAnchorIdFromDate(s.date),
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
 * Build the focus watchlist rows: the day change from the last two closes, RVOL from the latest volume
 * against its trailing average, and the closes as the sparkline. RVOL is a quiet "—" for a fresh name
 * with no prior volume, not a meaningless 1.0×.
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
      // The last close, formatted — the row shows a price beside its delta (§5.1); a percentage with
      // nothing to be a percentage OF is a number the reader cannot check.
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

/** Everything the Desk renders. A null field means "show the placeholder"; an empty array means "wired
 * but nothing today" (its own empty state renders). `asOf` is an ISO string, not a Date, because this
 * object is cached and the cache serialises to JSON. */
export type Morning = {
  asOf: string | null;
  macro: MacroView | null;
  /**
   * The macro board — the five household stats (N3). Null only for a brand-new database (no stat ever
   * stored); once any exists the board renders and every empty cell says "not yet reported".
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
  calendar: CalendarView | null;
  /** Per-source health for the run's footer; an empty array when no run is recorded. */
  sources: SourceStatus[];
  /**
   * How many matches the night's scans found, across how many presets (§4.1 module 07). Module 07 is a
   * GLANCE station, not a paragraph pointing elsewhere; one count query, amortised by the route cache,
   * makes it a figure the reader can read in passing.
   */
  scans: { matches: number; presets: number; breakdown: ScanBreakdownRow[] };
  /**
   * The top of tonight's Front Page and how many catalysts it is the top OF (§4.1 module 08). A bounded
   * preview that states its own cut ("First 3 of 14 by significance") — an unlabelled slice of a ranked
   * list is the lie ruling M8 forbids: three-of-three and three-of-forty are very different nights.
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

/** One preset's line in the Desk's Sectors & Scans module (CC4): its name, its evidence grade, and
 * how many names it caught tonight. */
export type ScanBreakdownRow = {
  key: string;
  label: string;
  grade: EvidenceGrade;
  folklore: boolean;
  count: number;
};

/**
 * The per-preset breakdown, in the FIXED SCAN_PRESETS order, ALWAYS — never sorted by count. Ordering
 * the index by how many names each filter caught would be a cross-preset leaderboard, which ruling M1
 * forbids: a busy scan is not a better scan. A preset with no matches prints its "0", because a scan
 * that found nothing still RAN.
 */
export function buildScanBreakdown(counts: Record<string, number>): ScanBreakdownRow[] {
  return SCAN_PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    grade: preset.grade,
    folklore: Boolean(preset.folklore),
    count: counts[preset.key] ?? 0,
  }));
}

/**
 * The latest run's scan matches: the total, the preset count, and the per-preset breakdown module 07
 * renders as one row each (CC4). A count/group query, not a fetch — the module needs the numbers, not
 * the rows. Degrades to zeros if the database is unreachable — "0 matches across 0 scans" is honest
 * about what it knows.
 */
async function loadScanCount(): Promise<{ matches: number; presets: number; breakdown: ScanBreakdownRow[] }> {
  try {
    const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (!latest) return { matches: 0, presets: SCAN_PRESETS.length, breakdown: buildScanBreakdown({}) };

    const grouped = await db.scanResult.groupBy({
      by: ["presetKey"],
      where: { runDate: latest.runDate },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.presetKey] = g._count._all;
    return {
      matches: grouped.reduce((sum, g) => sum + g._count._all, 0),
      // Every preset RAN. Reporting only the ones that matched would undercount the work and imply a
      // scan that found nothing did not happen — a result this product states everywhere else.
      presets: SCAN_PRESETS.length,
      breakdown: buildScanBreakdown(counts),
    };
  } catch (error) {
    console.error("getMorning: could not count the scan matches", error);
    return { matches: 0, presets: SCAN_PRESETS.length, breakdown: buildScanBreakdown({}) };
  }
}

/**
 * How many journal entries exist for today. The collapsed row reports its own state ("1 saved
 * tonight"/"none"), and a zero is a STATE, not an offer of more (ruling M2) — without this count the
 * disclosure would hide an unstated number of things.
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
 * Load the whole morning. Reads the latest run for the timestamp, then each module independently; any
 * read that throws is logged and degrades that one module — the Desk never crashes because one table
 * was slow or empty.
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
 * The top of tonight's front page, with the total it was cut from. The order is the pipeline's
 * `significance` and nothing else — re-deriving it here would eventually disagree with the Front Page,
 * and then the Desk and the room would print two different front pages.
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
        // significance v2 first; ties break NEWEST-first (CC6, amending the old oldest-first tie) —
        // this must match the pipeline's own sort (newsdesk/ingest.py) or the Desk and the room disagree.
        orderBy: [{ significance: "desc" }, { firstSeen: "desc" }, { id: "asc" }],
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
 * Load the latest run's setup cards into view-models for module 06. Maps each card's stored base-rate
 * figures onto the shared BaseRate shape (the app renders, never derives) with its saved weakener
 * state. A read failure degrades the module to a placeholder, never the Desk.
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
    // The row → view mapping is shared with PD8's per-symbol "record" blocks (lib/setup-card-view.ts).
    return rows.map(buildSetupCardView);
  } catch (error) {
    console.error("getMorning: could not load setup cards", error);
    return null;
  }
}

/**
 * Load the latest evening briefing into the BriefArticle view-model. The stored JSON is validated at
 * the boundary and its citation ids resolved to the news behind them (superscripts link out); a held
 * briefing yields a held view, an unreadable one degrades to null. learning_link_slug is gated against
 * the Academy manifest (empty until P5), so early briefs carry no Learn doorway.
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
 * Resolve a briefing's citation ids to their news articles. Collects the ids the draft cites and looks
 * them up in news_item — a citation that is a computed stat (no news row) is simply absent, treated as
 * an unlinked, non-footnoted reference.
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
 * How many calendar rows the Desk shows. Load-bearing: rows sort by date ascending, so anything
 * stranded in the PAST sorts first and spends these slots — an eviction, not just clutter. See
 * calendarFloor below.
 */
const CALENDAR_ROWS = 15;

/**
 * The earliest date the session calendar may show: the edition's own session. The calendar is a FORWARD
 * view, so it must never render a past day. The floor is the EDITION's session date, not the wall clock
 * (PD0's two-clocks lesson — a clock-based floor would disagree with the masthead between midnight and
 * the next run). With no run at all, fall back to today: showing nothing beats showing history.
 */
export function calendarFloor(editionDate: Date | null, now: Date): Date {
  if (editionDate !== null) return editionDate;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The session calendar: the next few things the market is waiting for.
 *
 * THE BUG THIS GUARDS (PD1): this read once had no lower bound, so four pre-allowlist rows dated on a
 * weekend sorted to the TOP and sat on the Desk for weeks — spending 4 of 15 slots, so the Desk showed
 * 11 of 23 real forward events and dropped the rest. The pipeline now sweeps the whole table on refresh
 * (publish._replace_calendar); the floor here is the other half of the fence, and the half that holds
 * when the pipeline has not run for days.
 */
async function loadCalendar(): Promise<CalendarView | null> {
  try {
    const edition = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    const editionDate = edition?.runDate ?? null;

    // FORWARD-FIRST (CC6, D7). The reader is post-close, so what already reported on THIS session is
    // retrospective. Two reads, not one: the forward rows lead with the NEXT session on (date > the
    // edition), and today's earnings are collected separately and collapsed into one "Reported today"
    // line — so a busy Thursday's fifteen bank earnings never evict the week ahead. With no edition at
    // all, there is no "today" to speak of, so the floor stands in and nothing is collapsed.
    const [todayEarnings, forwardRows] = await Promise.all([
      editionDate
        ? db.calendarEvent.findMany({
            where: { date: editionDate, OR: [{ kind: "earnings" }, { code: "EARNINGS" }] },
            orderBy: { symbol: "asc" },
            select: { symbol: true },
          })
        : Promise.resolve([] as { symbol: string | null }[]),
      db.calendarEvent.findMany({
        where: editionDate
          ? { date: { gt: editionDate } }
          : { date: { gte: calendarFloor(editionDate, new Date()) } },
        orderBy: [{ date: "asc" }],
        take: CALENDAR_ROWS,
        select: {
          date: true, kind: true, symbol: true, title: true,
          consensus: true, prior: true, code: true, importance: true,
        },
      }),
    ]);

    const reportedToday = todayEarnings
      .map((r) => r.symbol)
      .filter((s): s is string => s !== null);
    return { rows: buildCalendar(forwardRows), reportedToday };
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
 * Load the macro board: the five household stats plus the run's source health (N3, Part 6). Both are
 * read because they answer different questions: the ROWS say what the newest observation is and when;
 * the STATUS says whether the source could be reached tonight. A cell can be current but failed to
 * refresh, or refreshed cleanly but far too old to trust. A read failure degrades the board to null.
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

    // Age is judged against the RUN's date, not the reader's clock — the board is part of a cached
    // render and would drift from its own page otherwise. (The pipeline strip is the deliberate
    // exception: catching a pipeline that died since the render is its whole job.)
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
    // The ETF bars are still read: the fallback path for any slot whose index level is missing, and the
    // Russell 2000's only path (§6.1).
    const bars = await db.priceBar.findMany({
      where: { symbol: { in: PROXY_SYMBOLS } },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      select: { symbol: true, close: true },
    });
    // The run date goes in too, so the builder can tell tonight's level from a carried-forward one and
    // say "as of Jul 9" on the latter.
    return buildMacro(ctx, closesBy(bars), ctx?.runDate ?? null);
  } catch (error) {
    console.error("getMorning: could not load the macro strip", error);
    return null;
  }
}

/** How far back from the run date to look for a mover's catalyst — enough to catch a weekend and
 * the after-hours news that explains an open. */
const CATALYST_WINDOW_DAYS = 3;

/** The Desk's Movers module shows this many, after the liquid floor. */
const DESK_MOVERS = 8;

/** The only funds the liquid floor keeps — the four index ETFs and eleven sector SPDRs (mirrors the
 * pipeline's CORE_SERVED). Every other fund, and every thin name, falls out to the universe-wide
 * Scans. A common stock needs no whitelist; it qualifies on assetClass alone. */
const CORE_FUND_MOVERS = new Set([
  "SPY", "QQQ", "DIA", "IWM",
  "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
]);

/**
 * The Movers liquid floor (CC6, D6). A mover is eligible only if it is a large/mid name by dollar
 * volume (the base-rate engine's own bucket, reused — never a second liquidity notion) AND either a
 * common stock or one of the core index/sector ETFs. Everything else — trusts, ADR-hedged wrappers,
 * structured products, thin or exotic funds — belongs in the universe-wide Scans, not the Desk's
 * front-of-paper module. Pure and exported so the floor is tested directly, without a database.
 */
export function isLiquidFloorEligible(meta: {
  symbol: string;
  assetClass: string | null;
  dvBucket: string | null;
}): boolean {
  if (meta.dvBucket !== "large_mid") return false;
  return meta.assetClass === "stock" || CORE_FUND_MOVERS.has(meta.symbol);
}

async function loadMovers(): Promise<Mover[] | null> {
  try {
    // Take the LATEST run's unusual-volume matches in full, ranked — not a pre-truncated top eight,
    // because the liquid floor is applied AFTER ranking and the raw top of the list is exactly the
    // thin junk it removes (D6: eight rows all reading "20.0×", none a name to open Yahoo for).
    const latest = await db.scanResult.findFirst({
      where: { presetKey: "unusual-volume" },
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    if (!latest) return [];
    const rows = await db.scanResult.findMany({
      where: { presetKey: "unusual-volume", runDate: latest.runDate },
      orderBy: { rank: "asc" },
      select: { symbol: true, metrics: true },
    });
    if (rows.length === 0) return [];

    const meta = await instrumentFloorMeta(rows.map((r) => r.symbol));

    // THE LIQUID FLOOR (CC6, D6). A mover is eligible only if it is a large/mid name by dollar volume
    // (the base-rate engine's own bucket — reused, never a second liquidity notion) AND either a
    // common stock or one of the core index/sector ETFs. Trusts, ADR-hedged wrappers, structured
    // products and every other fund fall out here — in the front-of-paper module, not in Scans.
    const eligible = rows
      .filter((r) => {
        const m = meta[r.symbol];
        return m !== undefined && isLiquidFloorEligible({ symbol: r.symbol, ...m });
      })
      .slice(0, DESK_MOVERS);
    if (eligible.length === 0) return [];

    const catalysts = await loadCatalysts(eligible.map((r) => r.symbol), latest.runDate);
    const sources: MoverSource[] = eligible.map((r) => {
      const m = (r.metrics ?? {}) as Record<string, unknown>;
      return {
        symbol: r.symbol,
        name: meta[r.symbol]?.name ?? r.symbol,
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
 * For a set of mover symbols, find each one's most recent in-window news as a Catalyst. A symbol with no
 * match is absent, and the Movers row renders the honest noise line. Event type is the pipeline's stored
 * classification; the source label is the article's domain.
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

/** For a set of mover symbols, look up each one's display name and the two fields the liquid floor
 * reads — its coarse class and its dollar-volume bucket (CC6). */
async function instrumentFloorMeta(
  symbols: string[],
): Promise<Record<string, { name: string; assetClass: string | null; dvBucket: string | null }>> {
  const rows = await db.instrument.findMany({
    where: { symbol: { in: symbols } },
    select: { symbol: true, name: true, assetClass: true, dvBucket: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.symbol, { name: r.name, assetClass: r.assetClass, dvBucket: r.dvBucket }]),
  );
}
