"use client";

import { cx } from "@/lib/cx";

/**
 * RangeControl — the ONLY time-range control in this application, and the list of places it is
 * allowed to appear is two entries long (NEWS-AND-CONTROL-PLAN Part 5.3, ruling C3).
 *
 * WHY A COMPONENT NEEDS A GUEST LIST.
 *
 * Ruling C3: evidence horizons are properties, not preferences. A base rate's horizon ("higher 10
 * trading days later"), a vol band's horizon, a signal's resolves-on date, the Brier resolution
 * window — every one of those is a fixed, evidence-bound property of the pattern it describes.
 *
 * Put a range control on any of them and you have built a p-hacking machine with a tasteful
 * segmented control on the front: a reader slides across horizons until one of them flatters the
 * pattern, and the app has taught them to fish. For a product whose entire claim is honest base
 * rates, that is the most dangerous single control it could ship. It would not even look wrong. It
 * would look like a feature.
 *
 * So the firewall is not a convention or a code review. It is the TYPE.
 *
 *   · `surface` is a CLOSED UNION. A forbidden surface does not compile.
 *   · And if someone reaches past the type — a cast, a JSON round trip, an `any` in a hurry — the
 *     component renders NOTHING. Belt and braces, because this is the rule that matters most.
 *   · A unit test asserts the allowlist is exactly two entries, so growing it is a deliberate,
 *     reviewable act rather than an import someone added on a Friday.
 *
 * WHERE IT IS ALLOWED, AND WHY ONLY THERE (the plan's Part 5.3 table, in one line each):
 *
 *   ticker-chart  — daily bars over ~5 years of served history. Changing the range changes the VIEW
 *                   of a record. Nothing about the data's meaning moves.
 *   news-feed     — Today / This week. Same: a window onto a set of articles.
 *
 * Everywhere else, a "range" would change the DEFINITION of the number rather than the view of it —
 * an RVOL is 20-day by definition, a mover is 1-day by definition — and that is a different thing
 * entirely, wearing the same clothes.
 *
 * NO LOADING STATE EXISTS, BY DESIGN. Both consumers already hold their full data range in the
 * initial payload and slice it client-side. Switching is a synchronous re-render: no fetch, no
 * skeleton, no cache interplay, nothing to keep fast because nothing ever got slow.
 */

/** The two surfaces where a time range is a view, not a definition. Growing this is structural. */
export const RANGE_CONTROL_SURFACES = ["ticker-chart", "news-feed"] as const;

export type RangeSurface = (typeof RANGE_CONTROL_SURFACES)[number];

export type RangeOption = {
  label: string;
  value: string;
  /**
   * Whether this range exists for THIS item.
   *
   * The distinction the plan draws, and it is a real one: an option that can never exist for the
   * surface at all is OMITTED (there is no "1D" on an end-of-day chart, and offering one would be a
   * lie about what the product holds). An option that exists but not for this particular item is
   * SHOWN, DISABLED, WITH ITS REASON — because a reader who knows 5Y exists and cannot find it will
   * conclude the app is broken, and a reader told "less than 4 years of history for this symbol"
   * has instead learned something true about the symbol.
   */
  available: boolean;
  /** Why it is unavailable. Renders as the option's title, and it is required when disabled. */
  reason?: string;
};

/** Where a reader's chosen frame lives for the rest of the session. */
export function rangeStorageKey(surface: RangeSurface): string {
  return `msm-range:${surface}`;
}

export function RangeControl({
  surface,
  options,
  value,
  onChange,
  legend = "Range",
}: {
  surface: RangeSurface;
  options: RangeOption[];
  value: string;
  onChange: (value: string) => void;
  legend?: string;
}) {
  // The runtime half of C3's firewall. The type already refuses this; a cast should not get past it.
  if (!RANGE_CONTROL_SURFACES.includes(surface)) return null;

  function select(option: RangeOption) {
    if (!option.available) return;

    /*
     * The reader's frame persists for the SESSION, and only the session.
     *
     * A return visit within the session keeps the window they were looking at — losing it on every
     * navigation would be its own small hostility. But a fresh session returns to the default, and
     * that is deliberate: the default is part of the editorial statement (6M on the ticker is long
     * enough to show a regime, short enough that the last month is still readable). A persisted
     * range quietly becomes the new default without anybody having decided that it should.
     */
    try {
      window.sessionStorage.setItem(rangeStorageKey(surface), option.value);
    } catch {
      // A browser with storage disabled still gets a working control. The frame simply does not
      // survive the navigation, which is a smaller loss than a crash.
    }

    onChange(option.value);
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
        {legend}
      </legend>

      {/*
       * The house form-kit grammar: real radios under the hood, so a keyboard drives it and an
       * assistive technology announces it correctly. No transitions anywhere in this file — it
       * frames a price chart, which is a money visual, and a sliding active pill would be motion
       * attached to a price changing, at the exact moment the price is doing nothing at all.
       */}
      <div
        className="flex flex-wrap gap-1 rounded-control border border-hairline p-1"
        role="radiogroup"
        aria-label={legend}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <label
              key={option.value}
              title={option.available ? undefined : option.reason}
              className={cx(
                "relative flex min-h-11 flex-1 items-center justify-center rounded-control px-3 text-center",
                // The faint is scoped to the DISABLED state by a variant rather than a ternary, and
                // that matters: `faint` is a 2.2:1 grey and drift rule 18 forbids it on anything
                // carrying information. WCAG explicitly exempts disabled controls — and a disabled
                // control that looked enabled would be the worse lie — so this is the one place the
                // token is legitimate. Saying it with the variant is what lets the guard see that.
                "cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:text-faint",
                // Chrome semantics: the accent says "you can act here". It never encodes an outcome.
                active && option.available
                  ? "bg-accent-soft font-semibold text-accent-deep"
                  : option.available
                    ? "text-ink-2 hover:text-ink"
                    : "",
              )}
            >
              {/*
               * A real radio, transparent, stretched over its whole pill — the same choice the
               * SegmentedControl makes, for the same reason: `sr-only` would leave a 1px hit box in
               * the corner, so anything driving the control by its role has nothing to aim at.
               */}
              <input
                type="radio"
                name={`range-${surface}`}
                value={option.value}
                checked={active}
                disabled={!option.available}
                onChange={() => select(option)}
                className="absolute inset-0 m-0 cursor-inherit appearance-none opacity-0"
              />
              {/* 16px at every width: below `md` a smaller focused control makes iOS zoom in — and
                  it does not zoom back out. `whitespace-nowrap` so a two-word label like "This week"
                  stays on one line inside its pill rather than breaking to two (D10). */}
              <span className="whitespace-nowrap font-mono text-base md:text-sm">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
