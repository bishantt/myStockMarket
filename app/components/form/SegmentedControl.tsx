"use client";

import { useState } from "react";

import { cx } from "@/lib/cx";

/**
 * SegmentedControl — a small, closed set of choices, shown all at once (APP-FEEL-PLAN §3.4).
 *
 * Real `<input type="radio">` elements under the hood, so the paper ticket keeps working as a plain
 * form post (its actions are `useActionState` form submissions — no fetch layer arrives with this
 * plan), and so keyboard and screen-reader behaviour come for free from the platform.
 *
 * **`defaultValue` IS OPTIONAL, AND THAT IS RULING M9.** Omit it and NO segment is pressed.
 *
 * That matters on exactly one control in the app: the paper ticket's Buy/Sell. Quantity, bucket and
 * price all keep helpful defaults, because they are PARAMETERS. Side is the DECISION — and the old
 * form quietly pre-selected "buy", on the one surface whose entire design language (the cooling-off
 * interstitial, the cost mirror) exists to slow that decision down. A default is a nudge, and this
 * is the one field where the product must not nudge. The cost is one tap.
 */

export type SegmentOption = {
  value: string;
  label: string;
  /** A quiet second line: "20bp", "60bp". Never a sales line. */
  detail?: string;
};

export type SegmentedControlProps = {
  name: string;
  legend: string;
  options: SegmentOption[];
  /** Omit for the no-default control (M9). */
  defaultValue?: string;
  required?: boolean;
};

export function SegmentedControl({ name, legend, options, defaultValue, required }: SegmentedControlProps) {
  const [selected, setSelected] = useState<string | undefined>(defaultValue);

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">{legend}</legend>

      <div className="flex gap-1 rounded-control border border-hairline p-1" role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <label
              key={option.value}
              className={cx(
                // ≥44px, and the whole pill is the hit target — not just the label text.
                "relative flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center rounded-control px-3 py-1.5 text-center touch-manipulation",
                // Chrome semantics, not data: the accent says "you can act here", which is the only
                // thing it is for. It never encodes an outcome.
                active ? "bg-accent-soft font-semibold text-accent-deep" : "text-ink-2 hover:text-ink",
              )}
            >
              {/*
               * A REAL radio, transparent, covering its whole pill — rather than `sr-only`.
               *
               * sr-only is the reflex here, and it costs you the hit target: a visually-hidden input
               * is a 1px box in the corner, so anything driving the control by its accessible role —
               * a test, or an assistive technology that clicks rather than activates — has nothing to
               * aim at. Stretching the input over the pill keeps the semantics identical (it is still
               * a native radio, still keyboard-operable, still announced correctly) and makes the
               * thing you can see the thing you can press.
               */}
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                required={required}
                onChange={() => setSelected(option.value)}
                className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
              />
              <span className="font-ui text-sm">{option.label}</span>
              {option.detail ? <span className="font-mono text-2xs text-muted">{option.detail}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
