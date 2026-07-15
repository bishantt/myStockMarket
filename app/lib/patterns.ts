/**
 * lib/patterns.ts — human labels and one-line causes for the six patterns (plan Appendix F).
 *
 * The pipeline keys patterns in kebab-case; the Desk shows them in plain words. These labels and
 * the one-line cause phrases live here so a setup card, a scan row, and a lesson name a pattern
 * identically. Mechanical, sentence case (plan §3.9).
 *
 * TWO KEYSPACES REACH `patternLabel`, and CC1/D6 is what happens when it only knows one. A setup
 * card carries a DETECTOR key (`gap-with-catalyst`), from the base rates. An active signal carries a
 * SCAN PRESET key (`gap-3plus`): `signal_log.pattern_key` is written from `scans.py`'s `preset_key`
 * (nightly.py build_signal_logs), NOT the detector's. Both a card's label and a signal's label go
 * through `patternLabel`, so a key it does not recognise it echoed RAW — and a reader opening a name
 * with a fresh scan-fired signal saw "gap-3plus" where "Gap of 3% or more" belonged. So the label
 * lookup consults BOTH registries: the patterns below, then the scan presets (their one definition,
 * scan-presets.ts), before it gives up and returns the key.
 */

import { SCAN_PRESETS } from "@/lib/scan-presets";

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

/** The Academy lesson each pattern links to (Appendix H slugs). A card's Learn doorway lights up
 * automatically once that lesson is authored (the loader gates on the slug existing). */
const PATTERN_LESSON: Record<string, string> = {
  "golden-cross": "moving-averages-and-the-golden-cross",
  "52w-high-proximity": "support-resistance-and-round-numbers",
  "gap-with-catalyst": "gaps-what-the-data-says",
  "rsi-extreme": "rsi-and-oscillators",
  "unusual-volume": "volume-and-rvol",
  "breadth-regime": "reading-the-macro-pulse",
};

/** Scan-preset key → its title ("gap-3plus" → "Gap of 3% or more"), built once from the presets'
 * one definition so the two never drift. Two keys (`unusual-volume`, `rsi-extreme`) are shared
 * verbatim with the detector keyspace and resolve either way; the other three only live here. */
const SCAN_PRESET_LABELS: Record<string, string> = Object.fromEntries(
  SCAN_PRESETS.map((preset) => [preset.key, preset.label]),
);

/** The plain-words label for a pattern OR scan-preset key. Consults the detector patterns first,
 * then the scan presets, then returns the key itself — so a scan-fired signal never shows its raw
 * slug on the record (CC1/D6). */
export function patternLabel(key: string): string {
  return PATTERN_LABELS[key] ?? SCAN_PRESET_LABELS[key] ?? key;
}

/** The lesson slug a pattern's card links to, or null if none is mapped. */
export function patternLessonSlug(key: string): string | null {
  return PATTERN_LESSON[key] ?? null;
}

export function patternCause(key: string): string {
  return PATTERN_CAUSE[key] ?? "A pattern fired.";
}
