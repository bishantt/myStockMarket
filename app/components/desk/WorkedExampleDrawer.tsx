"use client";

import { useState } from "react";

import type { WorkedExample } from "@/lib/worked-example";

/**
 * WorkedExampleDrawer — the fixed three-step worked example, with numbered on-chart markers synced to
 * the steps (plan §3.5, §7 P5 step 4).
 *
 * A doorway on a setup card: it opens a short walk-through of the three steps, alongside a schematic
 * price path whose numbered markers line up with the steps. Hovering or focusing a step lights its
 * marker, so the prose and the annotation stay together. The path is a SCHEMATIC — deliberately not
 * this symbol's real prices — so the drawer teaches the shape of the reasoning without showing a live
 * price (the no-price rule holds even here). Calm-tech: hairlines, ink, no animation.
 */

// A fixed schematic path (a modest rise) with the three marker anchors along it. Not real data.
const PATH_D = "M 8 64 L 40 52 L 72 56 L 104 40 L 150 44 L 196 24";
const MARKER_POS: Record<number, { x: number; y: number }> = {
  1: { x: 40, y: 52 },
  2: { x: 104, y: 40 },
  3: { x: 196, y: 24 },
};

export function WorkedExampleDrawer({ example }: { example: WorkedExample }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="font-ui text-2xs uppercase tracking-[0.05em] text-ink underline underline-offset-2 hover:text-accent"
      >
        {open ? "Hide worked example" : "Worked example →"}
      </button>

      {open ? (
        <div className="mt-3 rounded-edge border border-hairline p-4" role="group" aria-label="Worked example">
          {/* The schematic price path with numbered markers. aria-hidden: the steps carry the meaning. */}
          <svg viewBox="0 0 208 80" className="h-20 w-full" aria-hidden="true">
            <path d={PATH_D} fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />
            {example.markers.map((marker) => {
              const pos = MARKER_POS[marker.n];
              const on = active === marker.step;
              return (
                <g key={marker.n}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={on ? 9 : 7}
                    fill={on ? "var(--color-accent)" : "var(--color-surface)"}
                    stroke={on ? "var(--color-accent)" : "var(--color-muted)"}
                    strokeWidth="1.5"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3}
                    textAnchor="middle"
                    fontSize="9"
                    fill={on ? "var(--color-surface)" : "var(--color-ink-2)"}
                  >
                    {marker.n}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="pt-1 text-center font-ui text-2xs uppercase tracking-[0.05em] text-muted">
            Schematic — not {example.symbol}&rsquo;s prices
          </p>

          <ol className="pt-3">
            {example.steps.map((step) => (
              <li
                key={step.n}
                onMouseEnter={() => setActive(step.n)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(step.n)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                className="max-w-[60ch] border-t border-hairline py-3 first:border-t-0 focus:outline-none"
              >
                <p className="flex items-baseline gap-2">
                  <span
                    className={
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-edge border font-mono text-2xs " +
                      (active === step.n ? "border-accent bg-accent text-surface" : "border-hairline text-ink-2")
                    }
                    aria-hidden="true"
                  >
                    {step.n}
                  </span>
                  <span className="font-ui text-2xs font-semibold uppercase tracking-[0.05em] text-ink">
                    {step.title}
                  </span>
                </p>
                <p className="pt-1.5 font-prose text-sm text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
