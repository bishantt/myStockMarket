/**
 * seed.mjs — a deterministic synthetic morning for a DEVELOPMENT or TEST database (plan §6.1).
 *
 * This fills the serving tables with a fixed, hand-made trading day so the Desk lights up locally
 * and the seeded e2e journey has something real to assert against. Every value here is invented and
 * clearly synthetic — it is NEVER meant to run against the user's production Supabase, because the
 * project's honesty rules forbid showing fabricated numbers as if the pipeline produced them. A
 * guard below refuses to touch a Supabase host unless MSM_SEED_FORCE=1 is set on purpose.
 *
 * It is written as plain ESM (not TypeScript) so it runs under `node prisma/seed.mjs` with no
 * extra toolchain, and it uses the generated Prisma client directly. Run via `npx prisma db seed`.
 */

import { PrismaClient } from "@prisma/client";
import { RUN_DATE, SEEDED_SESSION, sessionAt, sessionDayIso, sessionPlus } from "./fixtures/clock.mjs";
import { SCAN_ROWS, SCAN_INSTRUMENTS } from "./fixtures/scans.mjs";
import { PAPER_TRADES } from "./fixtures/paper.mjs";
import { MACRO_STATS } from "./fixtures/macro.mjs";
import { NEWS_CLUSTERS, CATALYST_LINKS, NEWS_IMAGES, NEWS_INSTRUMENTS } from "./fixtures/news.mjs";

const db = new PrismaClient();

/*
 * The synthetic run date — a fixed Thursday, so the seed is byte-for-byte reproducible — now comes
 * from fixtures/clock.mjs, which is the ONE place in prisma/ allowed to say a date (drift rule 21).
 *
 * Every instant below is derived from it, and each call site carries its answer in a trailing comment
 * so a reader can check the arithmetic against a calendar without running the code. Read clock.mjs's
 * header for why: an absolute fixture under a relative rule has a fuse on it, and this build has been
 * burned by one twice.
 */

/**
 * Build `count` daily bars ending on RUN_DATE for one symbol, oldest first. The path is a plain
 * deterministic drift with a set final-day change, so closes and volumes are stable across runs
 * (no randomness). `finalChange` is the last day's fractional move; `volumeSpike` multiplies the
 * last day's volume so a watchlist RVOL reads above 1.0×.
 */
function bars(symbol, { base, count = 22, finalChange = 0.004, baseVolume, volumeSpike = 1 }) {
  const rows = [];
  let close = base;
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(RUN_DATE);
    date.setUTCDate(date.getUTCDate() - i);
    const isLast = i === 0;
    const prev = close;
    // A gentle, fixed daily drift for the history; the final day applies the stated change.
    close = isLast ? prev * (1 + finalChange) : prev * 1.0015;
    const open = prev;
    const high = Math.max(open, close) * 1.004;
    const low = Math.min(open, close) * 0.996;
    const vol = Math.round(baseVolume * (isLast ? volumeSpike : 1));
    rows.push({
      symbol,
      date,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      adjC: round2(close),
      vol: BigInt(vol),
    });
  }
  return rows;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** The instruments this seed introduces: the four index ETFs, three watchlist names, three movers. */
const INSTRUMENTS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "ARCA", sector: "Index" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", sector: "Index" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", exchange: "ARCA", sector: "Index" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", exchange: "ARCA", sector: "Index" },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "SMCI", name: "Super Micro Computer, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "GME", name: "GameStop Corp.", exchange: "NYSE", sector: "Consumer Discretionary" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", exchange: "NASDAQ", sector: "Technology" },
];

/** The index ETFs and watchlist names get price history; the movers are read from the scan only. */
const PRICE_HISTORY = [
  ...bars("SPY", { base: 600, finalChange: 0.011, baseVolume: 70_000_000 }),
  ...bars("QQQ", { base: 500, finalChange: 0.008, baseVolume: 40_000_000 }),
  ...bars("DIA", { base: 440, finalChange: -0.004, baseVolume: 4_000_000 }),
  ...bars("IWM", { base: 220, finalChange: 0.002, baseVolume: 25_000_000 }),
  ...bars("AAPL", { base: 210, finalChange: 0.021, baseVolume: 55_000_000, volumeSpike: 2.4 }),
  ...bars("NVDA", { base: 165, finalChange: -0.013, baseVolume: 210_000_000, volumeSpike: 1.6 }),
  ...bars("MSFT", { base: 470, finalChange: 0.006, baseVolume: 22_000_000, volumeSpike: 1.2 }),
];

/** The watchlist: three names, each with its required written reason; AAPL is the one focus name. */
const WATCHLIST = [
  { symbol: "AAPL", reason: "Earnings next week — watching the reaction, not the number.", isFocus: true },
  { symbol: "NVDA", reason: "Post-run cooldown; want to see if the 50-day holds as support.", isFocus: false },
  { symbol: "MSFT", reason: "Quiet base after the last leg — a patience name.", isFocus: false },
];

/**
 * The scan matches — all five presets — live in prisma/fixtures/scans.mjs.
 *
 * The Desk's movers module is not a separate fixture: it READS the unusual-volume preset (the
 * strongest eight by rank, lib/morning.ts). So the movers and the scan table are the same rows seen
 * from two rooms, which is exactly what they are in production. Ranks 1–3 are frozen there for that
 * reason — the seeded briefing's prose quotes their numbers.
 */

/** News that explains the movers — each tagged to its ticker, published on the run day. One mover
 * (PLTR) is intentionally left with NO news, so the Desk renders the honest noise line for it. */
const NEWS = [
  { id: "seed-smci", publishedAt: sessionAt("13:10"), provider: "finnhub", url: "https://reuters.com/smci-q3", // 2026-07-09T13:10Z
    headline: "Super Micro beats Q3 estimates on AI server demand", snippet: "Revenue jumped 40%.", tickers: ["SMCI"], eventType: "earnings" },
  { id: "seed-gme", publishedAt: sessionAt("11:30"), provider: "marketaux", url: "https://bloomberg.com/gme-downgrade", // 2026-07-09T11:30Z
    headline: "Analyst downgrades GameStop to Sell on weak fundamentals", snippet: "Price target cut.", tickers: ["GME"], eventType: "analyst" },
];

/** A published evening briefing over the seeded news and movers (Appendix G shape). Its numbers
 * match the movers (SMCI +18.40%, GME -9.20%) and the breadth (3210 advancers); its citations point
 * at the seeded news ids so the BriefArticle's source superscripts resolve to real links. The
 * learning_link_slug is deliberately unknown until P5, so no Learn doorway renders yet. */
const BRIEFING = {
  runDate: RUN_DATE,
  status: "published",
  amJson: {
    today_focus: {
      headline: "AI-server demand carried the tape",
      body: "Breadth was positive, with 3210 advancers against 1780 decliners, and the session's story was Super Micro's earnings beat.",
      citations: ["seed-smci", "stat-breadth"],
      no_edge_flag: false,
    },
    items: [
      {
        what_happened: "Super Micro beat Q3 estimates on AI server demand.",
        why_it_matters: "It is an early read on datacentre spending this quarter.",
        by_the_numbers: "Shares rose 18.40% on relative volume of 4.7×.",
        yes_but: "One quarter of demand is not a trend.",
        citations: ["seed-smci"],
      },
      {
        what_happened: "An analyst downgraded GameStop to sell.",
        why_it_matters: "The move was on a rating change, not a shift in the business.",
        by_the_numbers: "Shares fell 9.20%.",
        yes_but: "A single downgrade is one view, not a verdict.",
        citations: ["seed-gme"],
      },
    ],
    calendar_notes: [`CPI for June is due ${sessionDayIso(3)}.`], // 2026-07-12 — the same day the CALENDAR row below carries
    learning_link_slug: "reading-a-base-rate-sentence",
  },
  verificationJson: { status: "ok", checked: 4, held_reason: null, flags: [] },
  modelMeta: { model_extract: "claude-haiku-4-5", model_synth: "claude-sonnet-5", extract_count: 2 },
};

/**
 * The forward session calendar — earnings with consensus, plus market-wide macro/Fed days.
 *
 * Every row carries the chip `code` the Desk renders and its importance, exactly as the pipeline's
 * release allowlist writes them (UI-REDESIGN-PLAN §6.2, Appendix C). Earnings sit at "medium": the
 * "high" marker is reserved for the market-wide catalysts a beginner most needs to see coming.
 */
/**
 * The two rows marked `high` below (FOMC and the jobs report) sit at positions 5 and 6 by date —
 * deliberately BELOW the calendar module's routine cut of three rows.
 *
 * That placement is the guard for ruling M2. The Desk collapses the routine tail of the calendar
 * behind a disclosure, but a high-importance row — a CPI print, an FOMC decision — may never be
 * hidden behind a fold: the calendar's whole job is warning, and a module that hides a warning
 * while looking complete is worse than one that shows nothing. The F5 e2e asserts BOTH of these
 * rows are on screen while the disclosure is still collapsed. If someone ever "simplifies" the
 * calendar back to a plain first-N slice, these two rows disappear and that test goes red.
 */
const CALENDAR = [
  // Reported on the edition's OWN session (2026-07-09): post-close, these are retrospective, so the
  // Desk collapses them into one "Reported today: BAC · C · GS · JPM · WFC" line rather than letting
  // five bank earnings lead the rail above the week ahead (CC6, D7). Exercises the collapse in VRT/e2e.
  { date: sessionPlus(0), kind: "earnings", symbol: "JPM", timing: null, title: "JPM earnings", consensus: 4.12, prior: 4.05, importance: "medium", code: "EARNINGS" }, // 2026-07-09
  { date: sessionPlus(0), kind: "earnings", symbol: "BAC", timing: null, title: "BAC earnings", consensus: 0.86, prior: 0.83, importance: "medium", code: "EARNINGS" }, // 2026-07-09
  { date: sessionPlus(0), kind: "earnings", symbol: "GS", timing: null, title: "GS earnings", consensus: 9.4, prior: 8.62, importance: "medium", code: "EARNINGS" }, // 2026-07-09
  { date: sessionPlus(0), kind: "earnings", symbol: "C", timing: null, title: "C earnings", consensus: 1.55, prior: 1.42, importance: "medium", code: "EARNINGS" }, // 2026-07-09
  { date: sessionPlus(0), kind: "earnings", symbol: "WFC", timing: null, title: "WFC earnings", consensus: 1.28, prior: 1.2, importance: "medium", code: "EARNINGS" }, // 2026-07-09
  // TODAY (Friday 2026-07-10) — the session the seeded dawn ran for. These carry TIMING (CC8/CC9): earnings
  // bmo/amc from Finnhub, a macro release at its canonical ET time. The Morning Plan's "Today's calendar"
  // renders them bmo-first with the timing in words ("before the open", "8:30 AM ET"); the evening calendar
  // shows the same events as its NEXT forward day (Friday is the session after Thursday). Untimed elsewhere
  // stays null (P9). PPI is medium, so it does not add a fourth high row above the seed's three (CPI/FOMC/JOBS).
  { date: sessionPlus(1), kind: "earnings", symbol: "JNJ", timing: "bmo", title: "JNJ earnings", consensus: 2.68, prior: 2.55, importance: "medium", code: "EARNINGS" }, // 2026-07-10
  { date: sessionPlus(1), kind: "macro", symbol: null, timing: "8:30 AM ET", title: "Producer Price Index", consensus: null, prior: null, importance: "medium", code: "PPI" }, // 2026-07-10
  { date: sessionPlus(1), kind: "earnings", symbol: "NFLX", timing: "amc", title: "NFLX earnings", consensus: 5.12, prior: 4.88, importance: "medium", code: "EARNINGS" }, // 2026-07-10
  { date: sessionPlus(3), kind: "macro", symbol: null, timing: null, title: "Consumer Price Index", consensus: null, prior: null, importance: "high", code: "CPI" }, // 2026-07-12
  { date: sessionPlus(4), kind: "earnings", symbol: "MSFT", timing: null, title: "MSFT earnings", consensus: 3.12, prior: 2.94, importance: "medium", code: "EARNINGS" }, // 2026-07-13
  { date: sessionPlus(5), kind: "earnings", symbol: "GME", timing: null, title: "GME earnings", consensus: 0.04, prior: 0.02, importance: "medium", code: "EARNINGS" }, // 2026-07-14
  { date: sessionPlus(6), kind: "earnings", symbol: "AAPL", timing: null, title: "AAPL earnings", consensus: 1.28, prior: 1.4, importance: "medium", code: "EARNINGS" }, // 2026-07-15
  { date: sessionPlus(7), kind: "fed", symbol: null, timing: null, title: "FOMC decision", consensus: null, prior: null, importance: "high", code: "FOMC" }, // 2026-07-16
  { date: sessionPlus(8), kind: "macro", symbol: null, timing: null, title: "Jobs report", consensus: null, prior: null, importance: "high", code: "JOBS" }, // 2026-07-17
  { date: sessionPlus(11), kind: "earnings", symbol: "NVDA", timing: null, title: "NVDA earnings", consensus: 0.92, prior: 0.85, importance: "medium", code: "EARNINGS" }, // 2026-07-20
  { date: sessionPlus(12), kind: "earnings", symbol: "PLTR", timing: null, title: "PLTR earnings", consensus: 0.15, prior: 0.13, importance: "medium", code: "EARNINGS" }, // 2026-07-21
];

/**
 * The macro strip's context row: a calm-tape VIX, the 10-year yield, a positive breadth day — and
 * the three true index levels with the level before each.
 *
 * The levels are not decoration in the seed. Without them the seeded Desk falls back to the ETF
 * proxy path, and the redesign's regression lock (the S&P hero must read as an index level, near
 * 6,800, not as SPY's ~755 price) could never be asserted end to end.
 */
const MARKET_CONTEXT = {
  runDate: RUN_DATE,
  vix: 15.84,
  tenYear: 4.54,
  sp500: 6812.34,
  sp500Prior: 6789.1,
  nasdaqComposite: 22345.67,
  nasdaqCompositePrior: 22280.15,
  djia: 44210.55,
  djiaPrior: 44320.8,
  // The levels ARE this session's, so no per-slot date renders. A date under every figure every
  // night would be chrome; a date under the one figure that is behind is information (ruling C7).
  // The stale variant is exercised in the unit tests, which can vary this freely.
  indexLevelsAsOf: RUN_DATE,
  advancers: 3210,
  decliners: 1780,
  pctAbove50dma: 0.61,
};

/** Base rates for the seeded cards — one large-N with a baseline-spanning CI (WEAK cap), one
 * clear moderate, plus the always-up baselines. */
const BASE_RATES = [
  { patternKey: "golden-cross", universe: "large_mid", horizonDays: 10, regime: "risk_on",
    n: 140, wins: 77, winRate: 0.55, ciLow: 0.47, ciHigh: 0.63, baselineUpRate: 0.54,
    publicationYear: 1992, evidenceGrade: "weak", decayNote: "Weakened after Sullivan–Timmermann–White (1999)." },
  { patternKey: "52w-high-proximity", universe: "large_mid", horizonDays: 10, regime: "risk_on",
    n: 110, wins: 73, winRate: 0.66, ciLow: 0.57, ciHigh: 0.74, baselineUpRate: 0.54,
    publicationYear: 2004, evidenceGrade: "mixed", decayNote: "George–Hwang (2004); regime-dependent." },
];

/** Setup cards demonstrating the three N-gate regimes and the WEAK cap:
 *  - golden-cross (SPY): N=140, CI spans the 54% baseline ⇒ WEAK cap (RR Fig 9.3).
 *  - 52w-high (QQQ):     N=110, clear of the baseline ⇒ moderate, full % + CI shown.
 *  - unusual-volume (SMCI): N=18 ⇒ suppressed ("insufficient history"). */
const SETUP_CARDS = [
  { runDate: RUN_DATE, symbol: "SPY", patternKey: "golden-cross", tier: "weak", weakeners: {},
    state: { direction: "up", winRate: 0.55, n: 140, ciLow: 0.47, ciHigh: 0.63, baseline: 0.54,
             horizonDays: 10, regime: "risk_on", universe: "large_mid", evidenceGrade: "weak",
             decayNote: "Weakened after Sullivan–Timmermann–White (1999).", publicationYear: 1992, fwdMedian: 0.004 } },
  { runDate: RUN_DATE, symbol: "QQQ", patternKey: "52w-high-proximity", tier: "moderate", weakeners: { "low-rvol": true },
    state: { direction: "up", winRate: 0.66, n: 110, ciLow: 0.57, ciHigh: 0.74, baseline: 0.54,
             horizonDays: 10, regime: "risk_on", universe: "large_mid", evidenceGrade: "mixed",
             decayNote: "George–Hwang (2004); regime-dependent.", publicationYear: 2004, fwdMedian: 0.012 } },
  { runDate: RUN_DATE, symbol: "SMCI", patternKey: "unusual-volume", tier: "weak", weakeners: {},
    state: { direction: "up", winRate: 0.61, n: 18, ciLow: 0.39, ciHigh: 0.80, baseline: 0.54,
             horizonDays: 10, regime: "risk_on", universe: "large_mid", evidenceGrade: "mixed",
             decayNote: "Gervais–Kaniel–Mingelgrin (2001); small effect.", publicationYear: 2001, fwdMedian: 0.02 } },
];

/** Vol bands for a watchlist name (AAPL), horizons 5/10/20, both coverage levels. */
/**
 * The vol bands the Range Ladder renders. Three horizons, each with its nested 50%/80% pair, and
 * each carrying the sample size and the window it was drawn from — a range without its N is an
 * assertion, and the ladder prints both on every row.
 */
const VOL_BANDS = [
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 5, coverage: 0.5, lo: -0.018, hi: 0.021, label: "5 in 10 5-day paths stayed in this range", n: 495, windowDays: 500 },
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 5, coverage: 0.8, lo: -0.043, hi: 0.048, label: "8 in 10 5-day paths stayed in this range", n: 495, windowDays: 500 },
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 10, coverage: 0.5, lo: -0.027, hi: 0.031, label: "5 in 10 10-day paths stayed in this range", n: 490, windowDays: 500 },
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 10, coverage: 0.8, lo: -0.062, hi: 0.071, label: "8 in 10 10-day paths stayed in this range", n: 490, windowDays: 500 },
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 20, coverage: 0.5, lo: -0.038, hi: 0.045, label: "5 in 10 20-day paths stayed in this range", n: 480, windowDays: 500 },
  { runDate: RUN_DATE, symbol: "AAPL", horizonDays: 20, coverage: 0.8, lo: -0.089, hi: 0.104, label: "8 in 10 20-day paths stayed in this range", n: 480, windowDays: 500 },
];

/** Fired signals and their resolved outcomes — the track record fills with hits and a miss. */
const SIGNAL_LOGS = [
  { id: "sig-spy", firedDate: sessionPlus(-15), symbol: "SPY", patternKey: "golden-cross", horizonDays: 10, resolvesOn: sessionPlus(-1) }, // fired 2026-06-24, resolves 07-08
  { id: "sig-qqq", firedDate: sessionPlus(-15), symbol: "QQQ", patternKey: "52w-high-proximity", horizonDays: 10, resolvesOn: sessionPlus(-1) }, // fired 2026-06-24, resolves 07-08
  { id: "sig-smci", firedDate: sessionPlus(-16), symbol: "SMCI", patternKey: "unusual-volume", horizonDays: 10, resolvesOn: sessionPlus(-2) }, // fired 2026-06-23, resolves 07-07
];
const RESOLUTIONS = [
  { id: "res-spy", signalId: "sig-spy", outcome: "hit", resolvedAt: sessionPlus(-1, "00:30") }, // 2026-07-08T00:30Z
  { id: "res-qqq", signalId: "sig-qqq", outcome: "hit", resolvedAt: sessionPlus(-1, "00:30") }, // 2026-07-08T00:30Z
  { id: "res-smci", signalId: "sig-smci", outcome: "miss", resolvedAt: sessionPlus(-2, "00:30") }, // 2026-07-07T00:30Z
];

function guardAgainstProduction() {
  const url = process.env.DATABASE_URL ?? "";
  const looksProd = /supabase\.(co|com)/i.test(url);
  if (looksProd && process.env.MSM_SEED_FORCE !== "1") {
    console.error(
      "Refusing to seed: DATABASE_URL points at a Supabase host and this seed is synthetic.\n" +
        "Point DATABASE_URL at a local or test database, or set MSM_SEED_FORCE=1 to override.",
    );
    process.exit(1);
  }
}

async function main() {
  guardAgainstProduction();
  console.log(`Seeding a deterministic synthetic morning (run date ${SEEDED_SESSION})…`);

  // The dawn entry publish_dawn stamps BESIDE the night's source_status (CC8, closing Q-CC7-1). CC9 seeds
  // it so the seeded world can exercise the MORNING edition: the masthead, the Morning Plan, and the
  // control room's Dawn refresh row all read it. It rode a Friday 6:31 AM ET dawn — the session after the
  // Thursday run (E1 keeps runDate Thursday). e2e/seeded-clock's SEEDED_MORNING pins the browser to that
  // Friday morning, and the edition-state machine reads dawn.ranAt to greet the morning.
  const DAWN_ENTRY = {
    ranAt: sessionPlus(1, "10:31").toISOString(), // 2026-07-10T10:31Z = 6:31 AM ET Friday
    sources: { fred: "ok", finnhub: "ok", marketaux: "ok" },
    stages: { macro: "ok", news: "ok", catalysts: "ok", publish: "ok", revalidate: "ok" },
  };
  // The janitor's retirements, stamped BESIDE the night's source_status by publish_janitor (CC10, plan 4.8).
  // Seeded so the control room's Janitor row shows a real "Retired last night" line — not "—" — and the
  // settings VRT locks it. Like the dawn entry, it rides BESIDE the provider strings as a nested object
  // (statusFromRun, buildSourceStatus and nightSources all skip it — it is a cleanup, not a provider).
  const JANITOR_ENTRY = {
    ranAt: sessionAt("22:40").toISOString(), // the janitor is the last stage of the nightly
    news: 214, days: 45, scans: 1, backupsKept: 8, backupsSeen: 9,
    deleted: { news_item: 200, news_cluster: 12, catalyst_link: 2, scan_result: 30, setup_card: 8, vol_band: 8, price_bar: 15 },
  };
  // marketaux degraded on purpose, so the SourceStatusFooter's honest degraded line shows. The dawn and
  // janitor entries ride BESIDE these strings (statusFromRun ignores the nested objects).
  const NIGHT_SOURCE_STATUS = { alpaca: "ok", finnhub: "ok", marketaux: "degraded", fmp: "ok", fred: "ok", dawn: DAWN_ENTRY, janitor: JANITOR_ENTRY };
  await db.pipelineRun.upsert({
    where: { runDate: RUN_DATE },
    // The update refreshes sourceStatus too, so a LOCAL re-seed of an existing row picks up the dawn entry
    // (CI is always a fresh container, so its `create` path applies it either way).
    update: { finishedAt: sessionAt("22:40"), sourceStatus: NIGHT_SOURCE_STATUS },
    create: {
      runDate: RUN_DATE,
      startedAt: sessionAt("22:37"), // 2026-07-09T22:37Z — the cron's real slot
      finishedAt: sessionAt("22:40"), // 2026-07-09T22:40Z
      stageStatus: { ingest: "ok", compute: "ok", scan: "ok", publish: "ok" },
      sourceStatus: NIGHT_SOURCE_STATUS,
    },
  });

  // The PRIOR edition's heartbeat — Wednesday 2026-07-08's nightly (CC10, R8). The "new" tag is
  // edition-relative: a cluster first seen after the prior edition went to press wears it. Without a prior
  // run there is no prior press time, so nothing is "new" and the tag never renders. This one gives the
  // seeded world a genuine prior edition, so tonight's fresh clusters tag "new" and the carried-over
  // nc-nvda-guidance (first seen Wednesday 21:10, before this 22:40 press) does not — the honest contrast.
  await db.pipelineRun.upsert({
    where: { runDate: sessionPlus(-1) }, // 2026-07-08
    update: { finishedAt: sessionPlus(-1, "22:40") },
    create: {
      runDate: sessionPlus(-1), // 2026-07-08
      startedAt: sessionPlus(-1, "22:37"),
      finishedAt: sessionPlus(-1, "22:40"), // 2026-07-08T22:40Z — the prior edition's press time
      stageStatus: { ingest: "ok", compute: "ok", scan: "ok", publish: "ok" },
      sourceStatus: { alpaca: "ok", finnhub: "ok", marketaux: "ok", fmp: "ok", fred: "ok" },
    },
  });

  // The Desk's own names, plus every name the scan tables reference, plus the four the news night
  // introduces — the match table joins on Instrument for its Name column, and a match whose
  // instrument is missing renders a nameless row.
  //
  // CC6: each instrument also carries the two fields the Movers floor reads — a coarse class and a
  // dollar-volume bucket. The pipeline stamps these nightly; the seed mirrors it. Class is name-derived
  // (fund vs stock); the bucket comes from the scan's own is_large_mid where a symbol is a match, else
  // large/mid (the index ETFs and watchlist names are all liquid). The awkward scan rows carry
  // is_large_mid=false, so the floor's filter is genuinely exercised on the universe-wide scan set.
  const FUND_NAME = /\b(?:etf|etn|fund)\b/i;
  const bucketBySymbol = new Map(
    SCAN_ROWS
      .filter((r) => r.metrics && "is_large_mid" in r.metrics)
      .map((r) => [r.symbol, r.metrics.is_large_mid ? "large_mid" : "small"]),
  );
  for (const i of [...INSTRUMENTS, ...SCAN_INSTRUMENTS, ...NEWS_INSTRUMENTS]) {
    const enriched = {
      ...i,
      assetClass: FUND_NAME.test(i.name) ? "fund" : "stock",
      dvBucket: bucketBySymbol.get(i.symbol) ?? "large_mid",
    };
    await db.instrument.upsert({ where: { symbol: i.symbol }, update: enriched, create: enriched });
  }

  for (const b of PRICE_HISTORY) {
    await db.priceBar.upsert({
      where: { symbol_date: { symbol: b.symbol, date: b.date } },
      update: b,
      create: b,
    });
  }

  await db.marketContext.upsert({
    where: { runDate: RUN_DATE },
    update: MARKET_CONTEXT,
    create: MARKET_CONTEXT,
  });

  // Scan results are replaced for the run date, so a re-seed does not pile up duplicates.
  // These rows feed BOTH the /scans match tables and the Desk's movers module (which reads the
  // strongest eight unusual-volume rows) — one set of facts, two rooms.
  await db.scanResult.deleteMany({ where: { runDate: RUN_DATE } });
  for (const row of SCAN_ROWS) {
    await db.scanResult.create({
      data: {
        runDate: RUN_DATE,
        presetKey: row.presetKey,
        symbol: row.symbol,
        rank: row.rank,
        metrics: row.metrics,
      },
    });
  }

  // The watchlist is the one table the app itself writes; re-seed idempotently by symbol.
  await db.watchlistItem.deleteMany({ where: { symbol: { in: WATCHLIST.map((w) => w.symbol) } } });
  for (const w of WATCHLIST) {
    await db.watchlistItem.create({ data: w });
  }

  // News upserts by (provider, url); the calendar replaces its forward window.
  for (const n of NEWS) {
    await db.newsItem.upsert({
      where: { provider_url: { provider: n.provider, url: n.url } },
      update: n,
      create: n,
    });
  }
  await db.calendarEvent.deleteMany({});
  for (const e of CALENDAR) {
    await db.calendarEvent.create({ data: e });
  }

  // The evening briefing — keyed by run date, so a re-seed replaces it in place.
  await db.briefing.upsert({
    where: { runDate: RUN_DATE },
    update: BRIEFING,
    create: BRIEFING,
  });

  // P4 — base rates (upsert by their unique key), setup cards + vol bands (replaced per run date).
  for (const br of BASE_RATES) {
    await db.baseRateStat.upsert({
      where: { patternKey_universe_horizonDays_regime: {
        patternKey: br.patternKey, universe: br.universe, horizonDays: br.horizonDays, regime: br.regime } },
      update: br,
      create: br,
    });
  }
  await db.setupCard.deleteMany({ where: { runDate: RUN_DATE } });
  for (const card of SETUP_CARDS) await db.setupCard.create({ data: card });
  await db.volBand.deleteMany({ where: { runDate: RUN_DATE } });
  for (const band of VOL_BANDS) await db.volBand.create({ data: band });

  // Fired signals and their resolved outcomes (signal_log + signal_resolution are insert-only, so
  // create only if absent — a re-seed must not attempt to overwrite them).
  for (const sig of SIGNAL_LOGS) {
    const exists = await db.signalLog.findUnique({ where: { id: sig.id }, select: { id: true } });
    if (!exists) await db.signalLog.create({ data: sig });
  }
  for (const res of RESOLUTIONS) {
    const exists = await db.signalResolution.findUnique({ where: { id: res.id }, select: { id: true } });
    if (!exists) await db.signalResolution.create({ data: res });
  }

  // The paper ledger. Replaced by id on every seed, so the ledger tables always show the same six
  // trades and the VRT pixels stay deterministic.
  await db.paperTrade.deleteMany({ where: { id: { in: PAPER_TRADES.map((t) => t.id) } } });
  for (const trade of PAPER_TRADES) await db.paperTrade.create({ data: trade });

  // ── The News & Control plan's data (N0 seeds it; the CODE that reads it arrives per phase) ──

  // The macro board's five household stats. Keyed by (series, the date the SOURCE says it is for),
  // so a re-seed replaces each row in place. Gold's row is deliberately a week old — the amber
  // "stale" cell (C7 rung 5) needs a seeded source, and it happens to be gold's honest state until
  // the GoldAPI key is provisioned.
  for (const stat of MACRO_STATS) {
    await db.macroStat.upsert({
      where: { seriesKey_asOfDate: { seriesKey: stat.seriesKey, asOfDate: stat.asOfDate } },
      update: stat,
      create: stat,
    });
  }

  // The news night. Images first (clusters point at them), then clusters, then the per-ticker links.
  // Delete-then-create keeps the seed idempotent and the VRT pixels stable.
  for (const img of NEWS_IMAGES) {
    await db.newsImage.upsert({ where: { id: img.id }, update: img, create: img });
  }
  await db.catalystLink.deleteMany({ where: { clusterId: { in: NEWS_CLUSTERS.map((c) => c.id) } } });
  for (const cluster of NEWS_CLUSTERS) {
    await db.newsCluster.upsert({ where: { id: cluster.id }, update: cluster, create: cluster });
  }
  for (const link of CATALYST_LINKS) {
    await db.catalystLink.create({ data: link });
  }

  const byPreset = SCAN_ROWS.reduce((counts, row) => {
    counts[row.presetKey] = (counts[row.presetKey] ?? 0) + 1;
    return counts;
  }, {});
  const presetSummary = Object.entries(byPreset)
    .map(([key, count]) => `${key} ${count}`)
    .join(", ");

  const instrumentCount = INSTRUMENTS.length + SCAN_INSTRUMENTS.length + NEWS_INSTRUMENTS.length;
  console.log(
    `Seeded: ${instrumentCount} instruments, ${PRICE_HISTORY.length} price bars, ` +
      `${SCAN_ROWS.length} scan matches (${presetSummary}; rsi-extreme 0 — the empty state is seeded on purpose), ` +
      `${PAPER_TRADES.length} paper trades, ${WATCHLIST.length} watchlist names, 1 macro context, ` +
      `${NEWS.length} news items, ${CALENDAR.length} calendar events, 1 briefing,\n` +
      `        ${MACRO_STATS.length} macro stats (gold deliberately stale — the amber cell), ` +
      `${NEWS_CLUSTERS.length} news clusters, ${CATALYST_LINKS.length} catalyst links, ` +
      `${NEWS_IMAGES.length} cached images.\n` +
      `        The biggest mover (SMCI +18.4%) ranks THIRD by significance — the lead is a Fed ` +
      `statement that moved nothing. That ordering is the point.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
