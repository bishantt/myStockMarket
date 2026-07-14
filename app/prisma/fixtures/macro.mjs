/**
 * The seeded macro board — five household stats (NEWS-AND-CONTROL-PLAN Part 6).
 *
 * These are the cells that answer the questions a market number cannot: what does a mortgage cost,
 * what did prices do, what is gold worth, what is a dollar worth in rupees, and how is the market
 * feeling. Each one publishes on its OWN schedule, which is the entire reason they live in
 * macro_stat instead of as more market_context columns: the mortgage rate is weekly, CPI is
 * monthly, gold and FX are daily. Stamping a Thursday rate with tonight's date would be a lie, so
 * the as-of date is part of the key and `asOfLabel` is the window the reader actually sees.
 *
 * The seeded run date is 2026-07-09 (a Thursday), matching seed.mjs.
 *
 * ONE CELL IS DELIBERATELY STALE. Gold's row is dated Jul 2 — a week old against a daily cadence,
 * which is past the "cadence × 3" threshold, so the board must render it amber and word it "stale —
 * last Jul 2" (degradation rung 5, ruling C7). It is seeded that way because a board that only ever
 * renders its happy path has no test for the day a source goes quiet, and because it happens to be
 * true: the GoldAPI key is not provisioned yet (provisioning row P-5), so this IS gold's honest
 * state today. When the key lands, the cell goes fresh and this fixture changes with it.
 */

/*
 * Every date here derives from the seeded world's one anchor (fixtures/clock.mjs, drift rule 21).
 * This file used to keep its own copy of the run date, which made it a second clock — and two clocks
 * are how a fixture and the world it belongs to silently walk apart.
 */
import { monthStart, sessionAt, sessionPlus } from "./clock.mjs";

/** The session itself, at midnight — the as-of date for the two DAILY series. */
const runDay = sessionPlus(0); // 2026-07-09

/** When the seeded night fetched these — the same moment seed.mjs finishes its run. */
const FETCHED_AT = sessionAt("22:39"); // 2026-07-09T22:39Z

/**
 * The Mood gauge's components (ruling C8).
 *
 * The number may NEVER render without this table. That is not a style preference — it is the whole
 * argument for building our own gauge instead of borrowing CNN's: a sentiment number you cannot
 * take apart is a number you have to trust, and this app does not ask for trust. Each component
 * carries its raw value, the window it was measured over, and its percentile against its own
 * trailing history — so a reader can see exactly which input is doing the work.
 *
 * The score is the unweighted mean of the percentiles: (0.55 + 0.38 + 0.48 + 0.35 + 0.34) / 5
 * = 0.42 → 42, which falls in the 25–44 band, "leaning fearful". The arithmetic is stated here so
 * the pipeline's own computation (N3) can be checked against a number a human worked out.
 *
 * CORRECTED IN N3, AND THE CORRECTION IS THE POINT. `contributes` was written here by hand, and one
 * of them was already wrong: momentum sat at the 48th percentile — BELOW its own median, so pulling
 * the gauge downward — and was labelled "greedy". Nothing broke, because nothing was checking.
 *
 * The arrow is now DERIVED from the percentile in both the pipeline and the app, so the two cannot
 * disagree. The values below are kept in step with that rule and a fixture test asserts it, which is
 * the guard that would have caught the drift the day it was written.
 */
const MOOD_COMPONENTS = [
  {
    key: "breadth",
    label: "Breadth",
    value: 0.61,
    window: "% of universe above its 50-day average",
    percentile: 0.55,
    contributes: "greedy",
  },
  {
    key: "volatility",
    label: "Volatility (VIX)",
    value: 15.84,
    window: "last close",
    percentile: 0.38,
    // Inverted on purpose: a HIGH VIX is a FEARFUL reading, so a low percentile here means the
    // market is calm-ish but not calm enough to pull the gauge upward.
    contributes: "fearful",
  },
  {
    key: "momentum",
    label: "Momentum",
    value: 0.021,
    window: "S&P 500 vs its 125-session mean",
    percentile: 0.48,
    // 0.48 is BELOW the 50th percentile — below momentum's own median — so this component is pulling
    // the gauge DOWN, not up. It read "greedy" until N3. (The raw value is positive, which is
    // presumably where the mistake came from: the index does sit above its 125-day mean. But the
    // gauge does not ask "is momentum positive?" — it asks "is it strong FOR THIS MARKET, against
    // its own year?" — and the answer to that is no.)
    contributes: "fearful",
  },
  {
    key: "range",
    label: "Range position",
    value: 0.18,
    window: "share near 252-day highs minus share near lows",
    percentile: 0.35,
    contributes: "fearful",
  },
  {
    key: "credit",
    label: "Credit spreads",
    value: 3.12,
    window: "ICE BofA US High Yield OAS, last close",
    // Also inverted: wider spreads mean more fear.
    percentile: 0.34,
    contributes: "fearful",
  },
];

export const MACRO_STATS = [
  {
    seriesKey: "mortgage30us",
    asOfDate: runDay, // 2026-07-09
    value: 6.72,
    prior: 6.78,
    // Freddie Mac's survey is published for the week ENDING Thursday. The label says so, because
    // "6.72% as of tonight" would claim a freshness the source does not offer.
    asOfLabel: "wk of Jul 9",
    sourceKey: "fred",
    fetchedAt: FETCHED_AT,
    meta: null,
  },
  {
    seriesKey: "cpi_yoy",
    asOfDate: monthStart(1), // 2026-06-01 — June's print, stamped with the month it describes
    value: 2.7,
    prior: 2.9,
    // June's data, published mid-July. A monthly series in the middle of its cycle is not stale —
    // the label IS the honesty (degradation rung 2).
    asOfLabel: "Jun 2026",
    sourceKey: "fred",
    fetchedAt: FETCHED_AT,
    meta: null,
  },
  {
    seriesKey: "gold_usd",
    // A WEEK OLD, on purpose — see the file comment. This drives the amber "stale" cell.
    asOfDate: sessionPlus(-7), // 2026-07-02 — a week old, on purpose
    value: 4085.2,
    prior: 4071.9,
    asOfLabel: "Jul 2",
    sourceKey: "goldapi",
    fetchedAt: sessionPlus(-7, "22:39"), // 2026-07-02T22:39Z — the last night it answered
    meta: null,
  },
  {
    seriesKey: "usd_npr",
    asOfDate: runDay, // 2026-07-09
    // `value` carries the BUY side so a single-number consumer has a defined answer, but the cell
    // renders the pair: picking one side silently answers a question the reader never asked.
    value: 151.66,
    prior: 151.42,
    asOfLabel: "Jul 9",
    sourceKey: "nrb",
    fetchedAt: FETCHED_AT,
    meta: { buy: 151.66, sell: 152.26 },
  },
  {
    seriesKey: "mood",
    asOfDate: runDay, // 2026-07-09
    value: 42,
    prior: 47,
    asOfLabel: "Jul 9",
    // Ours. Not CNN's, and the surface says so in as many words (C8).
    sourceKey: "computed",
    fetchedAt: FETCHED_AT,
    meta: { score: 42, band: "leaning fearful", components: MOOD_COMPONENTS },
  },
];
