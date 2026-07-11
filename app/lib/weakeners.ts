/**
 * lib/weakeners.ts — the per-pattern weakener checklists (plan Appendix F, P4).
 *
 * A weakener is a condition that, if it applies, argues AGAINST acting on a fired signal. The user
 * ticks the ones they judge present; the card records the state. These are honest friction — the
 * point is to make the reader stop and check the case against the pattern, not just for it. The
 * items are contractual (Appendix F); extending them is a structural decision.
 */

export type Weakener = { key: string; label: string };

/** The weakeners per pattern key (Appendix F). 2–3 each, phrased as the condition to check for. */
export const WEAKENERS: Record<string, Weakener[]> = {
  "golden-cross": [
    { key: "extended", label: "Price is already more than 15% above its 200-day average (extended)." },
    { key: "against-breadth", label: "The signal runs against the current breadth regime." },
  ],
  "52w-high-proximity": [
    { key: "low-rvol", label: "Volume was light on the approach to the high." },
    { key: "earnings-in-window", label: "Earnings fall inside the horizon window." },
  ],
  "gap-with-catalyst": [
    { key: "gap-over-8", label: "The gap is already more than 8% (chase risk)." },
    { key: "analyst-only", label: "The catalyst is only an analyst note." },
  ],
  "rsi-extreme": [
    { key: "trend-against", label: "The trend runs strongly against the reversion." },
    { key: "earnings-in-window", label: "Earnings fall inside the horizon window." },
  ],
  "unusual-volume": [
    { key: "no-catalyst", label: "No catalyst was matched to the move." },
    { key: "sub-10", label: "The price is under $10 (lottery adjacency)." },
  ],
  "breadth-regime": [
    { key: "whipsaw", label: "This is the third breadth cross within 20 sessions (whipsaw)." },
  ],
};

/** The weakener items for a pattern, or an empty list for an unknown key. */
export function weakenersFor(patternKey: string): Weakener[] {
  return WEAKENERS[patternKey] ?? [];
}
