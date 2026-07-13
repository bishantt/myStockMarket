import { cx } from "@/lib/cx";

/**
 * StatFigure — a labelled number, and the rules that keep a number from lying.
 *
 * Anatomy (§4.1): an 11px uppercase Inter label, the value beneath it in JetBrains Mono at one of
 * three scales, and an optional delta chip.
 *
 * The delta encodes direction three ways at once — a triangle, an explicit sign, and colour —
 * because colour alone fails for roughly one man in twelve. The blue/orange pair is colourblind-safe,
 * but the redundancy is the actual guarantee, not the hue.
 *
 * The rule that matters most here, and the reason the hero variant exists as its own thing:
 *
 *     SEMANTIC COLOUR NEVER EXCEEDS --text-num-lg.
 *
 * The largest element on any screen is never emotional colour. The hero numeral — the S&P's level,
 * 64px, the single biggest thing on the Desk — renders in plain ink, and its direction lives beside
 * it in small type. A 64px red number is a mood; a 64px ink number with a small orange triangle is
 * a fact. (§3.3, and Research Report §9.7 on scarce colour.)
 *
 * P2 (§3.6): the root carries `data-p2`. This is a money/probability visual — it renders complete
 * on first paint, it never ticks or counts up, and no ancestor may animate or transform it. A jsdom
 * test walks up from every `[data-p2]` node to prove it.
 */

/** Which way the number moved. `flat` covers unchanged and doji — it renders in ink, no triangle. */
export type Direction = "up" | "down" | "flat";

type StatFigureProps = {
  /** The label above the number, e.g. "S&P 500". Rendered uppercase; pass sentence case. */
  label: string;
  /**
   * The value, already formatted. StatFigure never formats a number: formatting lives in
   * lib/format, and base rates render only through components/BaseRate (§1.2).
   */
  value: string;
  /**
   * `hero` is the 64px numeral. Exactly ONE per route may use it, and only `/` does — the
   * anti-drift checklist greps for violations at every phase exit.
   * `figure` is the 44px module-level key figure. `body` is everything else.
   */
  scale?: "hero" | "figure" | "body";
  delta?: {
    /** The delta, already formatted and signed, e.g. "+0.42%". */
    value: string;
    direction: Direction;
    /**
     * The period the delta covers, e.g. "1D" — a token from the closed `copy.window` set.
     *
     * It renders INSIDE the chip, beside the number, because that is the whole of ruling C2: a
     * window stated in a footnote is a window most readers never connect to the figure. "+0.42%" is
     * not a fact on its own — over what? — and "+0.42% · 1D" is.
     */
    window?: string;
  };
};

/** Value type sizes. The hero drops to 48px below 768px — the phone ritual column (§7.1). */
const VALUE_SCALE: Record<NonNullable<StatFigureProps["scale"]>, string> = {
  hero: "text-hero-mobile md:text-hero",
  figure: "text-num-lg",
  body: "text-lg",
};

/**
 * The delta chip: semantic text on its own soft wash. These are the `-text` variants, darkened to
 * clear AA at small sizes, because a delta is always small type — never the hero. Flat is ink on
 * nothing: no direction, no colour, no wash.
 */
const DELTA_CHIP: Record<Direction, string> = {
  up: "text-up-text bg-up-wash",
  down: "text-down-text bg-down-wash",
  flat: "text-ink",
};

/** The redundant, non-colour channel. Flat gets no triangle at all rather than a fake one. */
const DELTA_GLYPH: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  flat: "",
};

export function StatFigure({
  label,
  value,
  scale = "body",
  delta,
}: StatFigureProps) {
  return (
    <div data-p2 className="flex flex-col gap-1">
      <span className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>

      <div className="flex items-baseline gap-2">
        {/*
         * Always ink, at every scale. There is no variant of this component in which the number
         * itself carries the up/down colour — that is the whole point.
         */}
        <span className={cx("font-mono font-medium text-ink", VALUE_SCALE[scale])}>
          {value}
        </span>

        {delta ? (
          <span
            className={cx(
              "flex items-baseline gap-0.5 rounded-chip px-1.5 py-0.5 font-mono text-sm",
              DELTA_CHIP[delta.direction],
            )}
          >
            {/*
             * The triangle is decorative to a screen reader — the signed value that follows
             * already says "up" or "down" out loud, so announcing "black up-pointing triangle"
             * would just be noise.
             */}
            {delta.direction !== "flat" ? (
              <span aria-hidden="true">{DELTA_GLYPH[delta.direction]}</span>
            ) : null}
            {delta.value}
            {/*
             * The window, inside the chip. It is quieter than the number — it is the number's UNIT,
             * not a second number — but it is in the same chip, because a window that lives anywhere
             * else is a window the reader has to go and find (C2).
             *
             * QUIETER BY SIZE AND WEIGHT, NEVER BY OPACITY, and that is not a style preference.
             * This span carried `opacity-80` until N2, which composites the text toward its
             * background and dropped it under AA at this size — nine failing nodes on the Desk, all
             * of them window tokens. Drift rule 18 already says it: `faint` is for placeholders and
             * disabled states, never for information. And C2's whole claim is that the window IS
             * information — half the fact, not an annotation on it. A number's unit is not
             * decoration you may fade.
             */}
            {delta.window ? (
              <span className="pl-1 text-2xs font-normal">· {delta.window}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
