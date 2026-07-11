/**
 * lib/patterns.ts — human labels and one-line causes for the six patterns (plan Appendix F).
 *
 * The pipeline keys patterns in kebab-case; the Desk shows them in plain words. These labels and
 * the one-line cause phrases live here so a setup card, a scan row, and a lesson name a pattern
 * identically. Mechanical, sentence case (plan §3.9).
 */

/** Pattern key → display name. */
export const PATTERN_LABELS: Record<string, string> = {
  "golden-cross": "Golden cross",
  "52w-high-proximity": "Near the 52-week high",
  "gap-with-catalyst": "Gap with a catalyst",
  "rsi-extreme": "RSI extreme",
  "unusual-volume": "Unusual volume",
  "breadth-regime": "Breadth regime cross",
};

/** The one-line cause a card's row shows — what fired, in plain words. */
const PATTERN_CAUSE: Record<string, string> = {
  "golden-cross": "The 50-day average crossed above the 200-day.",
  "52w-high-proximity": "Price came within 2% of its 52-week high.",
  "gap-with-catalyst": "A 3%+ gap opened on matched news.",
  "rsi-extreme": "RSI crossed an extreme (30 or 70).",
  "unusual-volume": "Volume ran 2.5×+ its average on a 2%+ move.",
  "breadth-regime": "Market breadth crossed the 50% line.",
};

export function patternLabel(key: string): string {
  return PATTERN_LABELS[key] ?? key;
}

export function patternCause(key: string): string {
  return PATTERN_CAUSE[key] ?? "A pattern fired.";
}
