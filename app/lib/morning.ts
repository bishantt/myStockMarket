import { db } from "@/lib/db";
import { directionOf, multiple, percent, price, signedPercent } from "@/lib/format";
import { formatUtcDate } from "@/lib/time";
import { buildBrief, parseBriefDraft, type BriefView } from "@/lib/briefing";
import { isKnownLesson } from "@/lib/academy";
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

/** The index ETFs the macro strip shows. SPY is the hero; the rest form the index row (plan §9.2). */
const INDEX_ETFS: ReadonlyArray<{ symbol: string; label: string; hero: boolean }> = [
  { symbol: "SPY", label: "S&P 500", hero: true },
  { symbol: "QQQ", label: "Nasdaq", hero: false },
  { symbol: "DIA", label: "Dow", hero: false },
  { symbol: "IWM", label: "Russell 2000", hero: false },
];

/** The per-run macro-context row, exactly as the market_context table stores it. */
export type MacroContext = {
  vix: number | null;
  tenYear: number | null;
  advancers: number;
  decliners: number;
  pctAbove50dma: number;
};

type IndexQuote = { value: string; deltaPct: string; direction: Direction };

/** The macro strip's view-model — the exact shape MacroPulse renders (minus asOf, added by the page). */
export type MacroView = {
  spx: IndexQuote;
  indices: Array<IndexQuote & { label: string }>;
  breadth: { advancers: number; decliners: number; pctAbove50dma: string };
  vix: string;
  tenYear: string;
};

/**
 * A quote from a symbol's recent closes: the latest level and its day change against the prior
 * close. Returns null when there is not enough history to state a change honestly (needs two bars).
 */
function quoteFromCloses(closes: number[] | undefined): IndexQuote | null {
  if (!closes || closes.length < 2) return null;
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const delta = (latest - prev) / prev;
  return { value: price(latest), deltaPct: signedPercent(delta), direction: directionOf(delta) };
}

/**
 * Build the macro strip from the day's context row and each index ETF's recent closes.
 *
 * Returns null — so the Desk shows the placeholder instead — when the hero (the S&P) cannot be
 * formed or there is no macro context row, because a macro module without its hero numeral or its
 * breadth is not the macro module. An index that lacks two bars is simply dropped from the row; a
 * FRED cell that is null (FRED was down) renders as a quiet "—" rather than a fake zero.
 */
export function buildMacro(
  ctx: MacroContext | null,
  closesBySymbol: Record<string, number[]>,
): MacroView | null {
  if (ctx === null) return null;

  const spxDef = INDEX_ETFS.find((e) => e.hero)!;
  const spx = quoteFromCloses(closesBySymbol[spxDef.symbol]);
  if (spx === null) return null;

  const indices = INDEX_ETFS.filter((e) => !e.hero)
    .map((e) => {
      const quote = quoteFromCloses(closesBySymbol[e.symbol]);
      return quote ? { label: e.label, ...quote } : null;
    })
    .filter((q): q is IndexQuote & { label: string } => q !== null);

  return {
    spx,
    indices,
    breadth: {
      advancers: ctx.advancers,
      decliners: ctx.decliners,
      pctAbove50dma: percent(ctx.pctAbove50dma),
    },
    vix: ctx.vix === null ? "—" : price(ctx.vix),
    // The 10-year yield is stored as a plain percent value (4.54 = 4.54%), so it divides by 100
    // to become the fraction lib/format expects.
    tenYear: ctx.tenYear === null ? "—" : percent(ctx.tenYear / 100, 2),
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
};

/**
 * Format the session calendar for display: the event date (a bare calendar date, by its UTC
 * calendar date, not shifted to ET) and the consensus/prior figures through lib/format. No forecasting.
 */
export function buildCalendar(sources: CalendarSource[]): CalendarRow[] {
  return sources.map((s) => ({
    dateLabel: formatUtcDate(s.date),
    kind: s.kind,
    title: s.title,
    symbol: s.symbol ?? undefined,
    consensus: s.consensus === null ? undefined : price(s.consensus),
    prior: s.prior === null ? undefined : price(s.prior),
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
    const quote = quoteFromCloses(s.closes) ?? { deltaPct: signedPercent(0), direction: "flat" as Direction };
    const prior = s.volumes.slice(0, -1).slice(-RVOL_WINDOW);
    const latestVolume = s.volumes[s.volumes.length - 1];
    const rvol =
      prior.length > 0 ? multiple(latestVolume / (prior.reduce((a, b) => a + b, 0) / prior.length)) : "—";
    return {
      symbol: s.symbol,
      name: s.name,
      reason: s.reason,
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
  /** The evening briefing view-model, or null when no briefing is recorded yet (the Desk shows the
   * placeholder). A "held" brief is a non-null view with status "held" — the module shows the
   * "briefing unavailable" line, not the placeholder. */
  brief: BriefView | null;
  movers: Mover[] | null;
  watch: WatchRow[] | null;
  calendar: CalendarRow[] | null;
  /** Per-source health for the run's footer; an empty array when no run is recorded. */
  sources: SourceStatus[];
};

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
  const [macro, brief, movers, watch, calendar, sources] = await Promise.all([
    loadMacro(),
    loadBrief(),
    loadMovers(),
    loadWatchlist(),
    loadCalendar(),
    loadSourceStatus(),
  ]);
  return { asOf: asOf ? asOf.toISOString() : null, macro, brief, movers, watch, calendar, sources };
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

async function loadCalendar(): Promise<CalendarRow[] | null> {
  try {
    const rows = await db.calendarEvent.findMany({
      orderBy: [{ date: "asc" }],
      take: 15,
      select: { date: true, kind: true, symbol: true, title: true, consensus: true, prior: true },
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

async function loadMacro(): Promise<MacroView | null> {
  try {
    const ctx = await db.marketContext.findFirst({ orderBy: { runDate: "desc" } });
    const bars = await db.priceBar.findMany({
      where: { symbol: { in: INDEX_ETFS.map((e) => e.symbol) } },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      select: { symbol: true, close: true },
    });
    return buildMacro(ctx, closesBy(bars));
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
