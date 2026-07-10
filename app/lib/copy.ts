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

  mover: {
    /** The honest alternative to inventing a reason. A mover renders this or a real catalyst. */
    noNews: "No news found — most moves this size have no identifiable cause; likely noise.",
  },

  calendar: {
    /** "No edge" is a first-class outcome with its own rendering, never an apology. */
    noEdge: "No clear edge either way — that is a valid outcome.",
  },

  brief: {
    /** When the verification gate holds the briefing, this is what ships. It beats a guess. */
    unavailable: "Briefing unavailable tonight — scan results below are complete and verified.",
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
