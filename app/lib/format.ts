/**
 * format.ts — the one place a number becomes a string the user reads.
 *
 * The rule (plan §4.3, and the project conventions): numbers render ONLY through this file and
 * components/BaseRate. Nothing else in the app calls toFixed or toLocaleString on a displayed
 * value. Two reasons. First, consistency: grouping, decimals, and the sign convention are decided
 * once here, so every figure on the Desk agrees. Second, honesty: the flat band in `directionOf`
 * keeps a sub-basis-point rounding wobble from rendering as a real up or down move — a decision
 * that belongs in one audited place, not scattered across components.
 *
 * A deliberate typographic choice runs through this file: negatives use the true minus sign
 * (U+2212, "−"), not the hyphen-minus ("-"). The minus is the same width as a digit, so a column
 * of signed numbers stays aligned; the hyphen is narrower and makes the column ragged.
 */

import type { Direction } from "@/components/StatFigure";

/** The true minus sign (U+2212). Used for every negative this file prints. */
const MINUS = "−";

/** Moves smaller than this fraction are treated as flat — below a tenth of a basis point. */
const FLAT_BAND = 1e-4;

/**
 * A plain price or index level: thousands grouped, always two decimals.
 * e.g. 17204.1 → "17,204.10".
 */
export function price(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A signed percent built from a FRACTION (0.0042 → "+0.42%"), always showing a leading sign and
 * two decimals. This is the day-change convention — a delta always declares its direction, and an
 * exact zero reads as "+0.00%" because no-change is itself a fact worth stating plainly.
 * Negatives use the typographic minus so signed columns stay aligned.
 */
export function signedPercent(fraction: number): string {
  const pct = fraction * 100;
  const sign = pct < 0 ? MINUS : "+";
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

/**
 * An unsigned percent from a FRACTION, whole by default (0.61 → "61%"). Used for breadth and for
 * context cells like the 10-year yield where the sign carries no meaning. Pass `decimals` when a
 * finer figure is wanted (percent(0.0454, 2) → "4.54%").
 */
export function percent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/**
 * Relative volume as an ×-suffixed multiple to one decimal (3.14 → "3.1×"). RVOL is the app's
 * recurring "is anyone actually trading this?" figure, and it always renders this way.
 */
export function multiple(value: number): string {
  return `${value.toFixed(1)}×`;
}

/**
 * Classify a change as up, down, or flat. The flat band (a tenth of a basis point) is what keeps a
 * rounding wobble from painting a false direction — a near-zero change is honestly flat, rendered
 * in ink with no triangle, rather than a misleading green tick.
 */
export function directionOf(delta: number): Direction {
  if (Math.abs(delta) < FLAT_BAND) return "flat";
  return delta > 0 ? "up" : "down";
}
