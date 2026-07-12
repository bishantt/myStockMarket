"use client";

import { useState } from "react";


/**
 * Stepper — a quantity, without typing (APP-FEEL-PLAN §3.4).
 *
 * A number input flanked by − and +, plus a row of preset chips. The input stays the source of
 * truth: typing always wins, and the buttons are a convenience laid over it, never a replacement.
 *
 * Two details that are ergonomics, not decoration:
 *
 *   · At the minimum or the maximum, the corresponding button renders genuinely `disabled`. On a
 *     touch screen there is no hover state to explain why a button did nothing, so a silently
 *     no-op'ing − reads as a broken control rather than as a boundary.
 *   · `touch-action: manipulation` on the buttons. Stepping + + + is a literal double-tap, and iOS
 *     would otherwise smart-zoom the page out from under the reader's thumb mid-tap.
 *
 * The preset chips SET the value; they never submit. A chip that submitted a form would be the
 * fastest possible path to an unintended order, on the surface built to slow orders down.
 */

export type StepperProps = {
  name: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  /** Tap-to-set shortcuts: 10 · 25 · 50 · 100. */
  presets?: number[];
};

export function Stepper({ name, label, defaultValue, min = 1, max = 100_000, presets = [] }: StepperProps) {
  /**
   * The field holds RAW TEXT while the reader is typing, and is only clamped when they leave it.
   *
   * Clamping on every keystroke sounds tidier and is unusable: clearing the box to type a new
   * quantity fires a change with "", which clamps to the minimum, which puts a "1" back in the field
   * — so typing "42" into an emptied box leaves you with "142". The input is the source of truth
   * (typing wins); the clamp is a boundary, not a running correction.
   */
  const [raw, setRaw] = useState(String(defaultValue));

  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const parsed = Number(raw);
  const value = Number.isFinite(parsed) && raw.trim() !== "" ? parsed : defaultValue;
  const atMin = value <= min;
  const atMax = value >= max;
  const setValue = (next: number) => setRaw(String(clamp(next)));

  const buttonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-hairline font-mono text-base text-ink-2 touch-manipulation disabled:text-faint";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setValue(value - 1)}
          disabled={atMin}
          aria-disabled={atMin}
          aria-label="Decrease quantity"
          className={buttonClass}
        >
          −
        </button>

        <input
          id={name}
          name={name}
          type="number"
          // The numeric keypad, explicitly. `type=number` alone does not reliably produce it on iOS.
          inputMode="numeric"
          min={min}
          max={max}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          // Clamp when the reader LEAVES the field, not while they are still in it.
          onBlur={() => setRaw(String(clamp(value)))}
          // text-input-touch: ≥16px below md. iOS zooms into a smaller focused field and does NOT
          // zoom back out — the standing rule, and the whole reason this token exists.
          className="min-h-11 w-24 rounded-control border border-hairline bg-surface px-3 text-center font-mono text-input-touch tabular-nums text-ink"
        />

        <button
          type="button"
          onClick={() => setValue(value + 1)}
          disabled={atMax}
          aria-disabled={atMax}
          aria-label="Increase quantity"
          className={buttonClass}
        >
          +
        </button>
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-1">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(preset)}
              className="min-h-11 rounded-pill border border-hairline px-3 font-mono text-2xs text-ink-2 touch-manipulation hover:border-hairline-strong"
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
