/**
 * copy.ts — the canonical copy deck (plan Appendix J).
 *
 * Every reader-facing sentence that carries a guardrail lives here, verbatim. Components import
 * from this file; they never inline a sentence of their own. That is not a style preference —
 * these strings ARE the honesty rules in their final, human form:
 *
 *   - "A tendency, not a prediction."      keeps a base rate from reading as a forecast.
 *   - "No news found — ... likely noise."  is what stops a bare +8% from inviting a chase.
 *   - "Insufficient history ..."           is the N < 30 suppression, spoken.
 *
 * Changing any string in this file is a STRUCTURAL decision (plan §1.3.3): Appendix J changes
 * are never local edits. A unit test pins every one of them to the Appendix, so a well-meant
 * rewording fails the build rather than quietly softening a warning.
 *
 * Voice (plan §3.9, Research Report §9.4): mechanical third person. "The pattern has
 * historically been followed by..." — never "I think". Sentence case. No exclamation marks.
 * Curly quotes and em dashes are deliberate; this is a broadsheet.
 */

/**
 * Placeholders are written as {name} and filled by `fill()` below. They are left unfilled here
 * so the deck stays greppable: searching for a rendered sentence in the codebase finds exactly
 * one hit, in this file.
 */
export const copy = {
  baseRate: {
    /** The canonical natural-frequency sentence. Never render a base rate any other way. */
    sentence:
      "In the past {years} years, this pattern appeared {n} times on {refClass}. Price was higher {h} trading days later in {wins} of {n} cases ({pct}).",
    /** N < 30. The percentage is suppressed entirely — not shrunk, not hedged. Suppressed. */
    insufficient: "Insufficient history (N = {n}) — treat as anecdote.",
    /** The always-up baseline, shown beside every base rate so 56% cannot masquerade as an edge. */
    baseline: "Unconditional {h}-day up-rate ≈ {pct} — read this against that baseline.",
    /** N 30–99: the wide-interval note that MUST accompany the natural-frequency form (Appendix J
     * addition, 2026-07-11 — the plan mandates the note but left the wording to compose; logged in
     * DECISIONS). Renders in place of the CI numerals, which are suppressed at this sample size. */
    wideInterval: "Sample still small — the true rate could sit some way either side of this.",
  },

  /**
   * Tier actions come from a fixed lexicon, and every one of them is observational. No tier
   * ever maps to an acquisitional verb — "worth a closer look", never "buy". (RR §9.4.)
   */
  tier: {
    strong: "worth a closer look",
    moderate: "note it; check the weakeners",
    weak: "watch only",
  },

  volband: {
    label: "In the past, 8 in 10 {h}-day paths from here stayed inside this range.",
    /** Never rendered without the label. A band without its caveat is a forecast. (§1.5 rule 1.) */
    caveat: "Ranges assume the recent regime holds — sudden stress can exceed them.",
  },

  /** The dot array inside BaseRate. Every dot is one case — the misses are the point. */
  dotarray: {
    caption: "Each dot is one historical case. Misses are intentionally visible.",
  },

  /** The quantile dotplot: 20 dots, each one-in-twenty of the historical outcomes. */
  dotplot: {
    caption: "Each dot: 1 in 20 past outcomes.",
  },

  /**
   * The macro strip (redesign §6.1). These four strings exist because an ETF is not its index:
   * SPY traded near 755 while the S&P 500 was near 6,800, and the Desk printed the former under
   * the latter's name. The levels now come from FRED; where no free index series exists (the
   * Russell 2000), the slot still shows an ETF — and says, on the surface, that it is showing one.
   */
  macro: {
    provenance: "Index levels · FRED · prior close",
    proxyChip: "ETF proxy",
    proxyNote: "{symbol} is an ETF whose price tracks this group; it is not the index level.",
    indexUnavailable: "Index level unavailable — showing {symbol} (ETF proxy).",
  },

  desk: {
    edition: "The Desk — Evening Edition",
    status: "Markets {state} · data as of {close} · updated {stamp}",
  },

  mover: {
    /** The honest alternative to inventing a reason. A mover renders this or a real catalyst. */
    noNews: "No news found — most moves this size have no identifiable cause; likely noise.",
    /** The empty Desk: no mover cleared the bar. Information, not an apology. */
    quiet: "No moves cleared the catalyst-or-noise bar today.",
    relvolNote:
      'RelVol = volume ÷ 20-day average. "No clear catalyst" usually means noise; a cause sometimes surfaces later — absence of news is not a reason to act.',
  },

  calendar: {
    /** "No edge" is a first-class outcome with its own rendering, never an apology. */
    noEdge: "No clear edge either way — that is a valid outcome.",
    /** The word beside a high-importance row's dot — outcome never rides on colour alone. */
    importanceHigh: "high",
    /**
     * The empty calendar is a signature, not a failure. The allowlist drops every non-catalyst
     * FRED release, so a genuinely quiet fortnight now renders as one — and says why.
     */
    empty: "A quiet stretch — no scheduled catalysts in the next 14 days.",
    emptySub: "Curated from the full FRED release feed; the rest was noise.",
    /** M8 (app-feel): the cut is named — the reader is told what they are seeing and through when. */
    next: "Next {k} of {n} · through {date}",
  },

  brief: {
    /** When the verification gate holds the briefing, this is what ships. It beats a guess. */
    unavailable: "Briefing unavailable tonight — scan results below are complete and verified.",
  },

  /**
   * The login wall. Even the marketing-flavoured lines obey the one-deck rule and the mechanical
   * voice — the first page a reader ever sees is not the place to start over-promising.
   */
  login: {
    headline: "Your personal broadsheet for the market.",
    subline:
      "Not a prediction oracle. Not a signal feed. A daily record of what happened, why it might matter, and what the base rates actually say — including the misses.",
    quote: "“An investor who has all the answers doesn’t even understand the questions.”",
    quoteAttribution: "— Sir John Templeton",
    /** The licensing reason the wall exists at all. */
    wall: "This app stays behind a login because its market data is licensed for personal use only.",
    submit: "Open my desk →",
  },

  /** The Academy's closing pull quote. One fixed quote — a rotating one is a slot machine. */
  academy: {
    quote:
      "“The first step to understanding markets is understanding that no one fully understands markets.”",
    /** Position, stated as a count — never a progress bar (P13: position over area). */
    readCount: "{read} of {n} read",
  },

  palette: {
    hint: "⌘K",
    placeholder: "Go to a room, lesson, or ticker…",
  },

  offline: {
    ribbon: "Offline — showing the last synced briefing ({date}).",
  },

  scope: {
    /** Sits on every setup card. Four words doing most of the product's ethical work. */
    line: "A tendency, not a prediction.",
  },

  decision: {
    /** Rendered at the decision point, never in a page footer. (RR §9.4.) */
    disclaimer: "Historical tendency — verify before acting.",
  },

  coolingOff: {
    body: "You are entering a paper trade within {min} minutes of seeing this signal. The historical base rate is {rate} with the interval shown; costs are certain. Proceed, or sit with it until tomorrow’s brief?",
  },

  brier: {
    /** A Brier score means nothing to a beginner without this anchor beside it. */
    anchor: "0.25 = coin flip",
  },

  attribution: {
    /** A licence condition of using the FRED API, not a courtesy. */
    fred: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.",
  },

  degraded: {
    /** A source can fail without the run failing — and the reader is told which. */
    source: "{source} unavailable tonight — this section is running without it.",
  },

  save: {
    /** There is no offline write queue in v1, so a write that cannot happen says so. */
    offline: "Reconnect to save.",
  },

  update: {
    /** The service worker's update prompt. Calm: a footer line, never a toast or a modal. */
    ready: "Updated — refresh when convenient.",
  },

  /**
   * The app-feel additions (APP-FEEL-PLAN Appendix B). Same rule as everything above: these are
   * not labels, they are the honesty rules in their final human form.
   */
  scans: {
    /**
     * Ruling M1, spoken. It is the sentence that separates a scan table from a leaderboard, and it
     * has exactly one home: under the table, as the DataTable's footnote.
     */
    tableNote:
      "Matches are filter hits, not forecasts. Sorting re-orders today’s matches; it never ranks tomorrow.",
    /** The name of the pipeline's own order. Never "top", never "best". */
    order: "scan order",
    /** M8: a preview states its rule. Never "highlights", never an unlabelled slice. */
    preview: "First {k} of {n} by scan order",
    allMatches: "All {n} matches →",
    /**
     * The 500-row cap. It is an honest editorial as much as a limit: a filter that matches this
     * many names out of ~6,000 has stopped filtering. Sorting is disabled above it, because sorting
     * a silent subset would present "the biggest movers among the most salient" as "the biggest
     * movers" — an unlabelled ranking, which is the exact species ruling M1 exists to kill.
     */
    cap: "Showing the first 500 of {n} by scan order — a filter matching this many names is closer to noise than a signal. Sorting is off above the cap.",
    /** An empty scan is a result, not a shelf to apologise for. */
    empty: "0 matches today — the filter ran and found nothing. That is information.",
    lotteryChip: "lottery risk",
  },

  table: {
    /** M6: position as words, never a progress bar (P13). */
    page: "Page {p} of {t} · {n} rows",
    sortHint: "Sort",
  },

  disclosure: {
    /**
     * M2's contract in one string: a collapsed summary must always say HOW MUCH it is hiding and
     * as of WHEN. A disclosure that hides an unstated number of things is a disclosure that can
     * hide a miss.
     */
    more: "+ {n} more · {context}",
    calendar: "Full calendar",
    movers: "All movers",
    watchlist: "Full watchlist",
    sources: "Per-provider detail",
  },

  pulse: {
    /** M8, for the shelf: the reader is told what is off-screen and how to reach it. */
    swipe: "5 figures — swipe",
  },

  journal: {
    /** A collapsed journal still reports its state honestly — a zero is state, not an offer. */
    savedNone: "none saved tonight",
    savedOne: "1 saved tonight",
  },

  sources: {
    allOk: "{n} sources · all reporting · ran {window}",
  },

  paper: {
    /**
     * The date is load-bearing, not decoration. A served bar can be days old around a holiday or a
     * data gap, and "last close" without its date is an implicit freshness claim the reader cannot
     * check. The disclaimer covers liveness; the date covers age. They are different lies to prevent.
     */
    lastClose: "Use last close ({date}) · {price} — a reference, not a quote",
    /** M9: side has no default, so missing it is a plain validation message, not a nudge. */
    sideRequired: "Choose buy or sell.",
    /** Ruling M10: mechanical, practice-framed, and never styled as a button. */
    practiceDoorway: "Practice on paper →",
    closedTrades: "Closed trades",
  },
} as const;

/** The values a copy template can be filled with. Numbers are stringified as-is. */
export type CopyValues = Readonly<Record<string, string | number>>;

/**
 * Substitutes {placeholders} in a copy-deck string.
 *
 * Deliberately strict in both directions, because a half-rendered guardrail is worse than a
 * crash: a missing value throws rather than leaving a literal "{n}" on screen, and an extra
 * value throws rather than being silently ignored (which is almost always a renamed
 * placeholder and a sentence that now says something subtly different).
 *
 * @param template a string from the `copy` deck above — never a string literal from a component
 * @param values   one entry per {placeholder} in the template, no more and no fewer
 */
export function fill(template: string, values: CopyValues = {}): string {
  const required = new Set(
    [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
  );
  const provided = new Set(Object.keys(values));

  const missing = [...required].filter((key) => !provided.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Copy template is missing value(s) for: ${missing.join(", ")}. Template: "${template}"`,
    );
  }

  const unused = [...provided].filter((key) => !required.has(key));
  if (unused.length > 0) {
    throw new Error(
      `Copy template got value(s) it has no placeholder for: ${unused.join(", ")}. ` +
        `This usually means a placeholder was renamed. Template: "${template}"`,
    );
  }

  return template.replaceAll(/\{(\w+)\}/g, (_match, key: string) =>
    String(values[key]),
  );
}
