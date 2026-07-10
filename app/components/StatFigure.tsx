import { cx } from "@/lib/cx";

/**
 * StatFigure — a labelled number, and the rules that keep a number from lying.
 *
 * Anatomy (plan §3.6): an 11px uppercase Archivo label, the value beneath it in IBM Plex Mono
 * at one of three scales, and an optional delta.
 *
 * The delta encodes direction three ways at once — a triangle, an explicit sign, and colour —
 * because colour alone fails for roughly one man in twelve. The Wong palette (§3.3) is
 * colourblind-safe, but redundancy is the actual guarantee.
 *
 * The rule that matters most here, and the reason the hero variant exists as its own thing:
 *
 *     Wong colour NEVER exceeds --text-num-lg.
 *
 * The largest element on any screen is never emotional colour. The hero numeral — the S&P's
 * day change, 64px, the single biggest thing on the Desk — renders in plain ink, and its
 * direction lives beside it in small type. A 64px red number is a mood; a 64px ink number with
 * a small red triangle is a fact. (§3.6, and Research Report §9.7 on scarce colour.)
 */

/** Which way the number moved. `flat` covers unchanged and doji — it renders in ink, no triangle. */
export type Direction = "up" | "down" | "flat";

type StatFigureProps = {
  /** The label above the number, e.g. "S&P 500". Rendered uppercase; pass sentence case. */
  label: string;
  /**
   * The value, already formatted. StatFigure never formats a number: formatting lives in
   * lib/format, and base rates render only through components/BaseRate (plan §4.3).
   */
  value: string;
  /**
   * `hero` is the 64px numeral. Exactly ONE per route may use it, and only `/` does — the
   * anti-drift checklist (§3.10, rule 2) greps for violations at every phase exit.
   * `figure` is the 44px module-level key figure. `body` is everything else.
   */
  scale?: "hero" | "figure" | "body";
  delta?: {
    /** The delta, already formatted and signed, e.g. "+0.42%". */
    value: string;
    direction: Direction;
  };
};

/** Value type sizes. The hero drops to 48px below 768px — the phone ritual column (§3.8). */
const VALUE_SCALE: Record<NonNullable<StatFigureProps["scale"]>, string> = {
  hero: "text-hero-mobile md:text-hero",
  figure: "text-num-lg",
  body: "text-lg",
};

/**
 * Delta colours. These are the `-text` Wong variants, darkened to clear AA at small sizes,
 * because a delta is always small type — never the hero. Flat is ink: no direction, no colour.
 */
const DELTA_COLOUR: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
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
    <div className="flex flex-col gap-1">
      <span className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
        {label}
      </span>

      <div className="flex items-baseline gap-2">
        {/*
         * Always ink, at every scale. There is no variant of this component in which the
         * number itself carries the up/down colour — that is the whole point.
         */}
        <span className={cx("font-mono font-medium text-ink", VALUE_SCALE[scale])}>
          {value}
        </span>

        {delta ? (
          <span
            className={cx(
              "flex items-baseline gap-0.5 font-mono text-sm",
              DELTA_COLOUR[delta.direction],
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
          </span>
        ) : null}
      </div>
    </div>
  );
}
