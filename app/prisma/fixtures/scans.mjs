/**
 * fixtures/scans.mjs — the deterministic scan matches the seeded morning publishes.
 *
 * Why this file exists at all: before the app-feel plan, the seed gave `unusual-volume` three rows
 * and every other preset zero. That was enough to light up the Desk's movers module and nothing
 * else — you cannot test a paginated, sortable match table against three rows, and you certainly
 * cannot test an empty state you never seed. So the scan fixtures moved here and grew teeth.
 *
 * Every row is invented and clearly synthetic. The shapes, though, are the real ones: the metric
 * keys are exactly the keys `pipeline/publish.py` writes for a match, and each preset carries the
 * metrics its own criteria are stated in (APP-FEEL-PLAN Appendix F).
 *
 * Four properties this fixture is built to guarantee, each load-bearing for a test somewhere:
 *
 *   1. RANKS 1–3 OF unusual-volume ARE FROZEN. The Desk reads its movers straight out of this
 *      preset (lib/morning.ts, take: 8), and desk.spec.ts asserts the exact formatted values of
 *      SMCI, GME and PLTR — and the seeded briefing's prose quotes those same numbers. Change
 *      ret_1 or rvol20 on those three rows and you have quietly made the briefing lie.
 *   2. THE AWKWARD ROWS SIT AT RANK ≥ 9, below the movers' cut of 8, so they can never wander into
 *      the Desk. Those are the two lottery-risk rows and the two null-metric rows.
 *   3. NULLS ARE REAL. Two rows carry `dollar_volume: null` — the pipeline coerces NaN to null
 *      rather than to zero (DECISIONS 2026-07-11), so "unknown" is a value the table must sort
 *      correctly (null sorts LAST in both directions — an unknown is not a zero).
 *   4. rsi-extreme MATCHES NOTHING. A scan that ran and found nothing is information, and the empty
 *      state is a first-class rendering with its own VRT baseline. It only stays honest if it is
 *      seeded.
 *
 * 32 unusual-volume rows is also 2 pages at 25 rows a page — the pagination is exercised by the
 * fixture, not by a test that has to invent its own data.
 */

/** Instruments the scan rows reference. The table joins on these for the Name column. */
export const SCAN_INSTRUMENTS = [
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "COIN", name: "Coinbase Global, Inc.", exchange: "NASDAQ", sector: "Financials" },
  { symbol: "MARA", name: "MARA Holdings, Inc.", exchange: "NASDAQ", sector: "Financials" },
  { symbol: "SOFI", name: "SoFi Technologies, Inc.", exchange: "NASDAQ", sector: "Financials" },
  { symbol: "RIVN", name: "Rivian Automotive, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary" },
  { symbol: "LCID", name: "Lucid Group, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary" },
  { symbol: "PLUG", name: "Plug Power Inc.", exchange: "NASDAQ", sector: "Industrials" },
  { symbol: "SNDL", name: "SNDL Inc.", exchange: "NASDAQ", sector: "Consumer Staples" },
  { symbol: "CHPT", name: "ChargePoint Holdings, Inc.", exchange: "NYSE", sector: "Industrials" },
  { symbol: "AFRM", name: "Affirm Holdings, Inc.", exchange: "NASDAQ", sector: "Financials" },
  { symbol: "SNAP", name: "Snap Inc.", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "UBER", name: "Uber Technologies, Inc.", exchange: "NYSE", sector: "Industrials" },
  { symbol: "ABNB", name: "Airbnb, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary" },
  { symbol: "SHOP", name: "Shopify Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "NET", name: "Cloudflare, Inc.", exchange: "NYSE", sector: "Technology" },
  { symbol: "DDOG", name: "Datadog, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "CRWD", name: "CrowdStrike Holdings, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "ZS", name: "Zscaler, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "OKTA", name: "Okta, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "TWLO", name: "Twilio Inc.", exchange: "NYSE", sector: "Technology" },
  { symbol: "ROKU", name: "Roku, Inc.", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "PINS", name: "Pinterest, Inc.", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "RBLX", name: "Roblox Corporation", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "HOOD", name: "Robinhood Markets, Inc.", exchange: "NASDAQ", sector: "Financials" },
  { symbol: "DKNG", name: "DraftKings Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary" },
  { symbol: "CVNA", name: "Carvana Co.", exchange: "NYSE", sector: "Consumer Discretionary" },
  { symbol: "ENPH", name: "Enphase Energy, Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "XOM", name: "Exxon Mobil Corporation", exchange: "NYSE", sector: "Energy" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", sector: "Financials" },
  { symbol: "WMT", name: "Walmart Inc.", exchange: "NYSE", sector: "Consumer Staples" },
  { symbol: "COST", name: "Costco Wholesale Corporation", exchange: "NASDAQ", sector: "Consumer Staples" },
  { symbol: "LLY", name: "Eli Lilly and Company", exchange: "NYSE", sector: "Health Care" },
  { symbol: "AVGO", name: "Broadcom Inc.", exchange: "NASDAQ", sector: "Technology" },
];

/**
 * One unusual-volume match. `close` and `lottery_flag` are common to every preset's rows; `ret_1`,
 * `rvol20` and `dollar_volume` are the columns this preset's criteria are stated in.
 */
const uv = (rank, symbol, ret_1, rvol20, close, dollar_volume, lottery_flag = false) => ({
  presetKey: "unusual-volume",
  rank,
  symbol,
  metrics: { ret_1, rvol20, close, dollar_volume, lottery_flag, is_large_mid: !lottery_flag },
});

/**
 * The unusual-volume matches, in the pipeline's own rank order (1 = strongest RVOL — the preset's
 * stated salience metric). 32 rows: exactly two pages at 25 a page.
 *
 * Ranks 1–3 are frozen (see the file comment). Ranks 4–8 complete the Desk's eight movers. Ranks
 * 9+ exist only on the table route, and that is where the awkward rows live.
 */
export const UNUSUAL_VOLUME = [
  // Frozen — the Desk's top three movers and the seeded briefing's prose both quote these numbers.
  uv(1, "SMCI", 0.184, 4.7, 41.2, 3_180_000_000),
  uv(2, "GME", -0.092, 3.3, 23.14, 1_240_000_000),
  uv(3, "PLTR", 0.061, 2.8, 28.9, 2_050_000_000),
  // The rest of the Desk's movers (ranks 4–8).
  uv(4, "TSLA", -0.047, 2.74, 246.8, 9_800_000_000),
  uv(5, "COIN", 0.088, 2.71, 198.35, 1_760_000_000),
  uv(6, "AMD", 0.033, 2.68, 152.4, 3_410_000_000),
  uv(7, "MARA", -0.121, 2.66, 17.62, 620_000_000),
  uv(8, "AFRM", 0.052, 2.64, 44.17, 410_000_000),
  // Rank 9 and below: table-only. The awkward rows live here, safely below the movers' cut of 8.
  uv(9, "SNDL", 0.212, 2.63, 1.84, 96_000_000, true), // lottery risk — sub-$5
  uv(10, "SNAP", -0.036, 2.61, 11.27, 540_000_000),
  uv(11, "HOOD", 0.074, 2.6, 26.83, 780_000_000),
  uv(12, "RIVN", -0.058, 2.59, 13.05, 690_000_000),
  uv(13, "PLUG", 0.166, 2.58, 2.41, 118_000_000, true), // lottery risk — sub-$5
  uv(14, "CVNA", 0.091, 2.57, 174.62, 830_000_000),
  // dollar_volume unknown: the pipeline coerces a NaN to null, never to zero. The table must sort
  // this LAST in both directions, and print "—" rather than inventing a figure.
  uv(15, "CHPT", -0.104, 2.56, 1.97, null, true),
  uv(16, "DKNG", 0.041, 2.55, 39.84, 460_000_000),
  uv(17, "ROKU", -0.067, 2.54, 62.19, 350_000_000),
  uv(18, "SOFI", 0.055, 2.53, 8.92, 520_000_000),
  uv(19, "LCID", -0.083, 2.52, 2.76, 140_000_000, true), // lottery risk — sub-$5
  uv(20, "PINS", 0.029, 2.51, 31.05, 290_000_000),
  uv(21, "RBLX", -0.044, 2.5, 47.33, 380_000_000),
  uv(22, "NET", 0.037, 2.49, 88.6, 470_000_000),
  uv(23, "TWLO", -0.051, 2.48, 68.24, 240_000_000),
  uv(24, "OKTA", 0.026, 2.47, 92.15, 210_000_000),
  uv(25, "ZS", -0.031, 2.46, 178.4, 260_000_000),
  // Page 2 begins here — e2e pages to the end and asserts the final symbol is reachable. That
  // assertion is the grave of the old dead "+ N more".
  uv(26, "DDOG", 0.048, 2.45, 121.77, 330_000_000),
  uv(27, "CRWD", -0.024, 2.44, 302.5, 540_000_000),
  uv(28, "SHOP", 0.062, 2.43, 74.19, 610_000_000),
  uv(29, "ENPH", -0.115, 2.42, 58.36, null), // dollar_volume unknown — the second null row
  uv(30, "ABNB", 0.022, 2.41, 132.88, 290_000_000),
  uv(31, "UBER", 0.028, 2.4, 71.45, 720_000_000),
  uv(32, "AVGO", 0.021, 2.39, 189.62, 1_120_000_000),
];

/** Near the 52-week high — large/mid only, so no lottery names can appear here by construction. */
const n52 = (rank, symbol, dist_52w_high, ret_1, rvol20, close) => ({
  presetKey: "near-52w-high",
  rank,
  symbol,
  metrics: { dist_52w_high, ret_1, rvol20, close, lottery_flag: false, is_large_mid: true },
});

export const NEAR_52W_HIGH = [
  n52(1, "LLY", -0.002, 0.014, 1.32, 892.4),
  n52(2, "COST", -0.004, 0.008, 1.18, 918.75),
  n52(3, "WMT", -0.006, 0.011, 1.24, 84.36),
  n52(4, "JPM", -0.008, 0.006, 1.09, 241.9),
  n52(5, "AVGO", -0.011, 0.019, 1.41, 189.62),
  n52(6, "MSFT", -0.013, 0.006, 1.2, 476.28),
  n52(7, "AAPL", -0.015, 0.021, 2.4, 214.41),
  n52(8, "XOM", -0.017, 0.004, 0.98, 118.55),
  n52(9, "SPY", -0.019, 0.011, 1.02, 606.6),
];

/** Gap of 3% or more — the folklore-graded preset. */
const gap = (rank, symbol, gap_pct, ret_1, rvol20, close, lottery_flag = false) => ({
  presetKey: "gap-3plus",
  rank,
  symbol,
  metrics: { gap_pct, ret_1, rvol20, close, lottery_flag, is_large_mid: !lottery_flag },
});

export const GAP_3PLUS = [
  gap(1, "SMCI", 0.121, 0.184, 4.7, 41.2),
  gap(2, "MARA", -0.094, -0.121, 2.66, 17.62),
  gap(3, "GME", -0.068, -0.092, 3.3, 23.14),
  gap(4, "SNDL", 0.057, 0.212, 2.63, 1.84, true),
  gap(5, "COIN", 0.049, 0.088, 2.71, 198.35),
  gap(6, "CVNA", 0.041, 0.091, 2.57, 174.62),
  gap(7, "ROKU", -0.034, -0.067, 2.54, 62.19),
];

/**
 * Fresh golden cross. The 50- and 200-day averages are stored verbatim as the pipeline computed
 * them — the app derives nothing from them, it only prints them (the numbers-are-pipeline-side rule).
 */
const gc = (rank, symbol, sma50, sma200, ret_20, close) => ({
  presetKey: "golden-cross-fresh",
  rank,
  symbol,
  metrics: { sma50, sma200, ret_20, close, lottery_flag: false, is_large_mid: true },
});

export const GOLDEN_CROSS_FRESH = [
  gc(1, "UBER", 70.18, 68.92, 0.064, 71.45),
  gc(2, "NET", 86.4, 85.71, 0.048, 88.6),
  gc(3, "PINS", 30.62, 30.44, 0.031, 31.05),
  gc(4, "SOFI", 8.71, 8.66, 0.022, 8.92),
];

/**
 * RSI extreme — deliberately EMPTY.
 *
 * A scan that ran and matched nothing is not a broken scan and not an empty shelf to apologise for.
 * It is a result: today, nothing crossed. The page says so in those words, and this zero-length
 * array is what keeps that rendering honest and pixel-locked.
 */
export const RSI_EXTREME = [];

export const SCAN_ROWS = [
  ...UNUSUAL_VOLUME,
  ...NEAR_52W_HIGH,
  ...GAP_3PLUS,
  ...GOLDEN_CROSS_FRESH,
  ...RSI_EXTREME,
];
