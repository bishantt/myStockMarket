/**
 * lib/glossary.ts — the 40-term glossary seed and the first-occurrence-per-view registry
 * (plan §7 P5 step 3, Appendix I).
 *
 * Every term a beginner meets on the Desk has one honest, price-free definition here. A GlossaryTerm
 * popover reads this seed; the `lesson` field, when set, points at the Academy lesson that teaches the
 * term in full, so a one-line tip always has a "Full lesson →" doorway.
 *
 * The registry enforces the "first occurrence per view" discipline: a term is dotted and made
 * interactive only the first time it appears in a single render, so a page that mentions "RVOL" five
 * times underlines it once. The registry is a plain, pure object so it is trivially unit-testable; the
 * server wrapper in components/GlossaryTerm.tsx scopes one instance per request via React `cache`.
 */

/** One glossary entry. `short` is the hover tip; `long` is the popover body; `lesson` is the slug of
 * the Academy lesson that teaches it in full, if one exists. No live prices in any field (§1.5). */
export type GlossaryEntry = {
  term: string;
  short: string;
  long: string;
  lesson?: string;
  /**
   * Other ways the SAME concept is written in prose (PD5).
   *
   * The display `term` is a title — "RVOL", "50-day average". Prose is not written in titles. The
   * pipeline's narrator writes "relative volume", because that is what a person would say, and a
   * matcher that only knew the title would walk straight past it. The Desk's seeded brief proved it
   * on PD5's first run: the lede said "relative volume of 4.7×" and the glossary, holding the term
   * "RVOL", found nothing to define.
   *
   * So an entry may list the words it ACTUALLY appears as. Plurals go here too — a paragraph about
   * "gaps" is a paragraph about a gap.
   *
   * These are matched at word boundaries and longest-first, exactly like the display term, and they
   * are only ever used by lib/prose.ts's auto-decorator. An explicit `<Term term="rvol">` names its
   * key directly and needs none of this.
   */
  aliases?: string[];
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  ticker: {
    term: "Ticker",
    short: "The short symbol that names a listed security.",
    long: "A ticker is the short letter code that identifies a stock or ETF on an exchange. It names the security; it says nothing about its quality.",
    lesson: "nyse-nasdaq-and-tickers",
  },
  "bid-ask-spread": {
    term: "Bid–ask spread",
    short: "The gap between the best buy and sell prices — a real cost.",
    long: "The bid is the highest price a buyer will pay; the ask is the lowest a seller will take. The gap between them is paid on every round trip, and it is widest in the first thirty minutes of trading.",
    lesson: "order-types-and-the-spread",
    aliases: ["bid-ask spread", "bid/ask spread"],
  },
  "market-order": {
    term: "Market order",
    short: "An order to trade now at whatever price is available.",
    long: "A market order fills immediately at the best available price, so it pays the full spread and any slippage. At the US open, where spreads are widest, that cost is largest.",
    lesson: "order-types-and-the-spread",
    aliases: ["market orders"],
  },
  "limit-order": {
    term: "Limit order",
    short: "An order that trades only at a price you set or better.",
    long: "A limit order sets the worst price you will accept. It may not fill, but it never pays more than you chose — the sensible default for a small investor.",
    lesson: "order-types-and-the-spread",
    aliases: ["limit orders"],
  },
  "pre-market": {
    term: "Pre-market",
    short: "Trading before the 9:30 AM ET open — thin and wide.",
    long: "The pre-market session runs before the 9:30 AM ET regular open. Volume is thin and spreads are wide, so prices there are less reliable than during regular hours.",
    lesson: "the-us-trading-day",
    aliases: ["premarket"],
  },
  "after-hours": {
    term: "After-hours",
    short: "Trading after the 4:00 PM ET close — thin and wide.",
    long: "The after-hours session runs after the 4:00 PM ET regular close. Like the pre-market, it has thin volume and wide spreads, which is why earnings reactions there can look larger than they settle at.",
    lesson: "the-us-trading-day",
  },
  gap: {
    term: "Gap",
    short: "An open that jumps away from the prior close.",
    long: "A gap is a difference between today's open and yesterday's close. The folklore that gaps 'always fill' points the wrong way: the careful evidence finds momentum in the gap's direction, not reversal.",
    lesson: "gaps-what-the-data-says",
    aliases: ["gaps"],
  },
  rvol: {
    term: "RVOL",
    short: "Relative volume — today's volume against its average.",
    long: "Relative volume compares today's trading volume to its recent average. Unusual volume carries some information, but it is concentrated in small, wide-spread names — information, not a strategy.",
    lesson: "volume-and-rvol",
    aliases: ["relative volume"],
  },
  breadth: {
    term: "Breadth",
    short: "How broadly a move is shared across the market.",
    long: "Breadth measures how many names participate in a move — for example, the share of stocks above their 50-day average. It is context for the day, not a signal to trade.",
    lesson: "reading-the-macro-pulse",
  },
  "advance-decline": {
    term: "Advance/decline",
    short: "The count of rising versus falling stocks.",
    long: "The advance/decline count is how many stocks rose versus fell on the day. A rally on narrow breadth — few advancers — is a different picture from a broad one.",
    lesson: "reading-the-macro-pulse",
    aliases: ["advancers", "decliners"],
  },
  "50-day-average": {
    term: "50-day average",
    short: "The average closing price over the last 50 days.",
    long: "The 50-day moving average smooths the last fifty closes into one line. It describes recent trend; on its own it is not a demonstrated edge.",
    lesson: "moving-averages-and-the-golden-cross",
    aliases: ["50-day moving average"],
  },
  "200-day-average": {
    term: "200-day average",
    short: "The average closing price over the last 200 days.",
    long: "The 200-day moving average smooths roughly a year of closes. It is a common trend reference, but rules built on it have not survived honest out-of-sample testing net of costs.",
    lesson: "moving-averages-and-the-golden-cross",
    aliases: ["200-day moving average"],
  },
  "golden-cross": {
    term: "Golden cross",
    short: "The 50-day average crossing above the 200-day.",
    long: "A golden cross is the 50-day average crossing above the 200-day. Its evidence grade is weak: the classic moving-average rules worked in-sample and vanished out-of-sample after a data-snooping correction.",
    lesson: "moving-averages-and-the-golden-cross",
  },
  rsi: {
    term: "RSI",
    short: "A 0–100 oscillator of recent up versus down moves.",
    long: "The relative strength index scales recent gains against recent losses onto a 0–100 range. At standard settings it shows no significant net profit in developed markets — graded weak.",
    lesson: "rsi-and-oscillators",
  },
  macd: {
    term: "MACD",
    short: "The gap between two moving averages, and its signal line.",
    long: "MACD tracks the difference between a fast and a slow moving average against a signal line. Like other oscillators, it is a description of momentum, not a demonstrated edge.",
    lesson: "rsi-and-oscillators",
  },
  atr: {
    term: "ATR",
    short: "Average true range — a stock's typical daily swing.",
    long: "The average true range measures how much a stock typically moves in a day. It is useful for sizing a stop to a stock's own noise rather than a round number.",
    lesson: "stops-and-invalidation",
  },
  "bollinger-bands": {
    term: "Bollinger bands",
    short: "A moving average with volatility bands around it.",
    long: "Bollinger bands draw a moving average with bands set a number of standard deviations away. They describe how stretched price is; they do not forecast direction.",
    lesson: "rsi-and-oscillators",
  },
  "52-week-high": {
    term: "52-week high",
    short: "The highest price over the past year.",
    long: "The 52-week high is the top price of the last year. Proximity to it is a mixed-grade context signal — and note that new highs historically preceded continuation, so 'new highs are bearish' is backwards.",
    lesson: "support-resistance-and-round-numbers",
  },
  "base-rate": {
    term: "Base rate",
    short: "How often something happened in a stated group before.",
    long: "A base rate is the historical frequency of an outcome within a stated reference class — the app's core unit. It is a tendency, never a prediction, and it always carries its sample size and interval.",
    lesson: "reading-a-base-rate-sentence",
    aliases: ["base rates"],
  },
  "reference-class": {
    term: "Reference class",
    short: "The specific group a base rate was measured on.",
    long: "The reference class is the group of stocks a base rate was counted over — for example, US large- and mid-cap names. A frequency means nothing until you know what it was measured on.",
    lesson: "reading-a-base-rate-sentence",
  },
  "confidence-interval": {
    term: "Confidence interval",
    short: "The honest range around a measured rate.",
    long: "A confidence interval is the range the true rate plausibly sits in, given the sample. A wide interval means the count is small and the number is uncertain.",
    lesson: "how-our-base-rates-are-computed",
    aliases: ["confidence intervals"],
  },
  "wilson-interval": {
    term: "Wilson interval",
    short: "The interval the app uses for a proportion.",
    long: "The Wilson score interval is a statistically honest range for a proportion that behaves well at small samples. The app shows it beside any base rate with a sample of 100 or more.",
    lesson: "how-our-base-rates-are-computed",
  },
  "always-up-baseline": {
    term: "Always-up baseline",
    short: "How often price rose anyway, over the same horizon.",
    long: "The always-up baseline is the unconditional up-rate over the same horizon — how often price rose regardless of the pattern. If a base rate's interval overlaps it, the pattern has not been shown to beat simply holding.",
    lesson: "how-our-base-rates-are-computed",
  },
  "tendency-tiers": {
    term: "Tendency tiers",
    short: "Observational labels — weak, moderate, strong.",
    long: "The tendency tiers describe how a historical pattern looks — weak ('watch only'), moderate ('note it; check the weakeners'), strong ('worth a closer look'). Every tier is observational; none says 'buy'.",
    lesson: "the-probability-lexicon",
    aliases: ["tendency tier"],
  },
  "evidence-grade": {
    term: "Evidence grade",
    short: "How well the research supports a technique.",
    long: "The evidence grade — supported, mixed, weak, or folklore — records how well the peer-reviewed record supports a technique. It sits beside the tier so recent data and long-run evidence are read together.",
    lesson: "the-myth-vs-evidence-ledger",
    aliases: ["evidence grades"],
  },
  folklore: {
    term: "Folklore",
    short: "A claim the evidence does not support, labelled plainly.",
    long: "Folklore is a technique with no real support in the careful record — 'gaps always fill', Fibonacci levels, Elliott Wave. The app labels it rather than omitting it, because the label is information.",
    lesson: "the-myth-vs-evidence-ledger",
  },
  "decay-stamp": {
    term: "Decay stamp",
    short: "Publication date plus the expected post-publication haircut.",
    long: "A decay stamp records when a pattern was published and how much its edge is expected to have shrunk since, so a 'proven strategy' arrives pre-shrunk rather than at its in-sample best.",
    lesson: "how-our-base-rates-are-computed",
  },
  "implied-move": {
    term: "Implied move",
    short: "The move size options are pricing in for an event.",
    long: "The implied move, read from the at-the-money straddle, is a roughly unbiased estimate of how large a move an event may bring — its size, never its direction.",
    aliases: ["implied moves"],
  },
  "bmo-amc": {
    term: "BMO / AMC",
    short: "Before market open / after market close — earnings timing.",
    long: "BMO and AMC mark whether a company reports before the open or after the close. The timing tells you when the reaction will land, not which way it will go.",
  },
  fomc: {
    term: "FOMC",
    short: "The Federal Reserve's rate-setting meetings.",
    long: "The Federal Open Market Committee sets US interest-rate policy. Its meetings are scheduled events; the famous pre-FOMC drift decayed after about 2015, so it is not a live edge.",
    lesson: "reading-the-macro-pulse",
  },
  cpi: {
    term: "CPI",
    short: "The monthly consumer-price inflation report.",
    long: "The consumer price index is a scheduled monthly inflation print. It spikes intraday volatility sharply for a few minutes, but its direction is not predictable from the headline surprise.",
    lesson: "reading-the-macro-pulse",
  },
  "jobs-report": {
    term: "Jobs report",
    short: "The monthly US employment release.",
    long: "The monthly employment report (non-farm payrolls) is a scheduled macro print. Markets react to revisions and composition, not the headline number alone.",
    lesson: "reading-the-macro-pulse",
  },
  vix: {
    term: "VIX",
    short: "The market's expected 30-day volatility, in index form.",
    long: "The VIX reads expected 30-day volatility off S&P 500 option prices. It is a gauge of how much movement the market is pricing in — a context reading, not a direction.",
    lesson: "reading-the-macro-pulse",
  },
  drawdown: {
    term: "Drawdown",
    short: "The drop from a peak to a trough.",
    long: "A drawdown is the decline from a high-water mark to the low that follows. Its arithmetic is unforgiving: a 50% loss needs a 100% gain to recover.",
    lesson: "expectancy-and-drawdown-math",
    aliases: ["drawdowns"],
  },
  expectancy: {
    term: "Expectancy",
    short: "Average profit per trade, wins and losses combined.",
    long: "Expectancy is the win rate times the average win minus the loss rate times the average loss. A high win rate can still lose money if the losses are large.",
    lesson: "expectancy-and-drawdown-math",
  },
  "half-kelly": {
    term: "Half-Kelly",
    short: "A cautious cap on position size.",
    long: "Half-Kelly is half the position size the Kelly criterion would suggest, computed from the lower bound of the win-rate interval. The app caps paper sizing here — a teaching device, never a conviction dial.",
    lesson: "position-sizing-before-patterns",
  },
  "brier-score": {
    term: "Brier score",
    short: "A score for how good probability forecasts are.",
    long: "The Brier score measures the accuracy of probability forecasts — lower is better, and 0.25 is a coin flip. The app scores its own flags and the user's forecasts the same way.",
    lesson: "journaling-and-the-pm-scorecard",
  },
  calibration: {
    term: "Calibration",
    short: "Whether your 70% calls happen about 70% of the time.",
    long: "Calibration asks whether outcomes you called 70% likely actually happen about 70% of the time. It is the honest test of a forecaster, and the track-record page charts it openly.",
    lesson: "journaling-and-the-pm-scorecard",
  },
  "paper-trading": {
    term: "Paper trading",
    short: "Practising with simulated money and real friction.",
    long: "Paper trading records trades without real money, but with the same spread, slippage, and cooling-off friction. It is the app's default stance — the censuses price the tuition of learning with real dollars.",
    aliases: ["paper trade", "paper trades"],
  },
  slippage: {
    term: "Slippage",
    short: "The gap between the expected and the filled price.",
    long: "Slippage is the difference between the price you expected and the price you got, worst in thin or fast markets. With the spread and taxes, it is part of the drag that sinks active trading.",
    lesson: "slippage-taxes-and-drag",
  },
};

/** The glossary keys, in seed order. */
export const GLOSSARY_KEYS = Object.keys(GLOSSARY);

/** One term's entry by key, or null if the key is unknown. */
export function lookupTerm(key: string): GlossaryEntry | null {
  return GLOSSARY[key] ?? null;
}

/** A first-occurrence tracker scoped to a single view. `firstOccurrence(key)` is true only the first
 * time a key is asked for, so a term is decorated once per render no matter how often it appears. */
export type GlossaryRegistry = { firstOccurrence: (key: string) => boolean };

export function createGlossaryRegistry(): GlossaryRegistry {
  const seen = new Set<string>();
  return {
    firstOccurrence(key: string): boolean {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
}
