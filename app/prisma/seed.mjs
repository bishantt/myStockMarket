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

const db = new PrismaClient();

// The synthetic run date — a fixed Thursday, so the seed is byte-for-byte reproducible.
const RUN_DATE = new Date("2026-07-09T00:00:00.000Z");

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

/** Movers = the unusual-volume scan's matches, ranked. metrics carry the day return and RVOL. */
const MOVERS = [
  { symbol: "SMCI", rank: 1, ret_1: 0.184, rvol20: 4.7, lottery_flag: false },
  { symbol: "GME", rank: 2, ret_1: -0.092, rvol20: 3.3, lottery_flag: false },
  { symbol: "PLTR", rank: 3, ret_1: 0.061, rvol20: 2.8, lottery_flag: false },
];

/** The macro strip's context row: a calm-tape VIX, the 10-year yield, and a positive breadth day. */
const MARKET_CONTEXT = {
  runDate: RUN_DATE,
  vix: 15.84,
  tenYear: 4.54,
  advancers: 3210,
  decliners: 1780,
  pctAbove50dma: 0.61,
};

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
  console.log("Seeding a deterministic synthetic morning (run date 2026-07-09)…");

  await db.pipelineRun.upsert({
    where: { runDate: RUN_DATE },
    update: { finishedAt: new Date("2026-07-09T22:40:00.000Z") },
    create: {
      runDate: RUN_DATE,
      startedAt: new Date("2026-07-09T22:37:00.000Z"),
      finishedAt: new Date("2026-07-09T22:40:00.000Z"),
      stageStatus: { ingest: "ok", compute: "ok", scan: "ok", publish: "ok" },
      sourceStatus: { alpaca: "ok", fred: "ok" },
    },
  });

  for (const i of INSTRUMENTS) {
    await db.instrument.upsert({ where: { symbol: i.symbol }, update: i, create: i });
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
  await db.scanResult.deleteMany({ where: { runDate: RUN_DATE } });
  for (const m of MOVERS) {
    await db.scanResult.create({
      data: {
        runDate: RUN_DATE,
        presetKey: "unusual-volume",
        symbol: m.symbol,
        rank: m.rank,
        metrics: { ret_1: m.ret_1, rvol20: m.rvol20, lottery_flag: m.lottery_flag },
      },
    });
  }

  // The watchlist is the one table the app itself writes; re-seed idempotently by symbol.
  await db.watchlistItem.deleteMany({ where: { symbol: { in: WATCHLIST.map((w) => w.symbol) } } });
  for (const w of WATCHLIST) {
    await db.watchlistItem.create({ data: w });
  }

  console.log(
    `Seeded: ${INSTRUMENTS.length} instruments, ${PRICE_HISTORY.length} price bars, ` +
      `${MOVERS.length} movers, ${WATCHLIST.length} watchlist names, 1 macro context.`,
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
