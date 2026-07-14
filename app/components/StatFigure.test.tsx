import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatFigure } from "./StatFigure";

/**
 * StatFigure tests — the WRAP CONTRACT (PD4 §7.2), and the hero-colour rule it must never break.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE, STATED UP FRONT BECAUSE IT MATTERS.
 *
 * jsdom has no layout engine. It will happily tell you an element is 0×0 and mean nothing by it. So
 * nothing here can prove that a figure FITS its cell — that is a question about pixels, and the only
 * honest witness for it is a real browser (e2e/hardening.spec.ts sweeps every room at 360px and at
 * Pixel-7 width, and the VRT baselines photograph the result).
 *
 * What this file CAN prove is that the classes which make wrapping possible are present. That is a
 * weaker claim, and it is still worth pinning: the bug PD4 fixed was a MISSING `flex-wrap`, and a
 * future edit that drops it again would sail through every other test in this repo. The pixel truth
 * lives downstream; this is the tripwire on the mechanism.
 *
 * The history is the argument for testing something so small. `/ticker`'s Range Ladder rendered one
 * word per line on a phone, in production, for months — the cause was `flex-1` (a flex-basis of ZERO,
 * which can never make its line wrap, only be crushed) — and the VRT baselines were committed
 * PHOTOGRAPHS of the broken page, passing on every run. An exact baseline can still be wrong. A class
 * contract cannot photograph a bug and call it correct.
 */

/** The row that holds the value and its delta chip — the element the whole contract is about. */
function valueRow(): HTMLElement {
  const row = screen.getByText("44,326.02").parentElement;
  if (!row) throw new Error("the value+chip row is missing");
  return row;
}

describe("StatFigure — the wrap contract (§7.2)", () => {
  it("lets the chip WRAP below the value instead of overflowing the cell", () => {
    render(
      <StatFigure
        label="Dow"
        value="44,326.02"
        delta={{ value: "-0.55%", direction: "down", window: "1D" }}
      />,
    );

    const row = valueRow();

    // `flex-wrap` IS the fix. Without it the value and the chip are locked to one line, and a mono
    // numeral has no wrap opportunity inside itself — so the row cannot shrink, and it overflows its
    // card instead. This is the exact shape that made the Desk's phone cards spill sideways.
    expect(row.className).toContain("flex-wrap");

    // And the row may shrink to its container rather than forcing it open.
    expect(row.className).toContain("min-w-0");
  });

  it("never truncates, ellipsizes or clips a number — the three dishonest fixes", () => {
    render(
      <StatFigure
        label="Dow"
        value="44,326.02"
        delta={{ value: "-0.55%", direction: "down", window: "1D" }}
      />,
    );

    const row = valueRow();
    const value = screen.getByText("44,326.02");

    // Truncating a figure is LYING about it: "44,326.0…" is not a number, and neither is a figure with
    // its last digit under the edge of a card. Wrapping is just typography. So none of the three
    // escape hatches may appear on the value or the row that holds it.
    for (const el of [row, value]) {
      expect(el.className).not.toContain("truncate");
      expect(el.className).not.toContain("text-ellipsis");
      expect(el.className).not.toContain("overflow-hidden");
      expect(el.className).not.toContain("whitespace-nowrap");
    }
  });

  it("breaks the chip only BETWEEN its two atoms — never inside one", () => {
    render(
      <StatFigure
        label="30-yr mortgage"
        value="6.72%"
        delta={{ value: "-0.06%", direction: "down", window: "vs prior week" }}
      />,
    );

    // THE CHIP HAS TWO ATOMS: the signed delta ("▼ -0.06%") and its window ("· vs prior week"). The
    // chip may break BETWEEN them — dropping the window to a second line whole — and may never break
    // INSIDE either.
    //
    // THIS IS THE THIRD VERSION OF THIS ROW. Each wrong one was found by LOOKING, never by a test:
    //
    //   v1 — no wrap. The chip overflowed its card and sat under the card next door.
    //   v2 — flex-wrap, no atoms. It shattered into "▼" / "-0.06%" / "· vs" / "prior" / "week" — one
    //        token per line, which is EXACTLY the Range Ladder bug PD3 spent a phase killing. Every
    //        guard passed: no sideways scroll, class contract satisfied, numbers all correct.
    //   v3 — this. Wrap between the atoms; nowrap within them.
    //
    // "Wrapping is honest, truncating is not" is a claim about a SENTENCE. A phrase broken one word
    // per line has not been wrapped — it has been shattered, and a shattered figure is no more
    // readable than a truncated one.
    const delta = screen.getByText("-0.06%");
    const window_ = screen.getByText(/vs prior week/);

    expect(delta.className).toContain("whitespace-nowrap");
    expect(window_.className).toContain("whitespace-nowrap");

    // The chip itself may wrap — that is how the window gets its own line instead of spilling — and
    // it stays bounded to the cell it lives in.
    const chip = delta.parentElement!;
    expect(chip.className).toContain("flex-wrap");
    expect(chip.className).toContain("max-w-full");
  });
});

describe("StatFigure — the row layout (PD4)", () => {
  it("puts the label and the number on one baseline, and still wraps rather than spills", () => {
    render(
      <StatFigure
        label="Nasdaq Composite"
        value="22,345.67"
        scale="dense"
        layout="row"
        delta={{ value: "+0.29%", direction: "up", window: "1D" }}
      />,
    );

    // The row exists because three figure CARDS do not fit across a phone: measured, each cell leaves
    // 74–91px of interior while an index level is ~81px and its chip ~95px. A row spends the phone's
    // one abundant axis instead of fighting over its scarcest.
    const root = screen.getByText("Nasdaq Composite").parentElement!;
    expect(root.className).toContain("justify-between");

    // And it keeps the safety net: a long label beside a long figure wraps to a second line, it never
    // pushes past the edge of the card.
    expect(root.className).toContain("flex-wrap");
  });

  it("keeps `data-p2` on the root at every layout — a money visual is a money visual", () => {
    render(<StatFigure label="Dow" value="44,326.02" layout="row" />);

    // P2 (§3.6): this is a money/probability visual. It renders complete on first paint, it never
    // ticks, and no ancestor may animate it. A new layout may not become a hole in that rule.
    const root = screen.getByText("Dow").parentElement!;
    expect(root.hasAttribute("data-p2")).toBe(true);
  });
});

describe("StatFigure — the dense scale (PD4)", () => {
  it("shrinks the CHIP with the value, not just the value", () => {
    render(
      <StatFigure
        label="Dow"
        value="44,326.02"
        scale="dense"
        delta={{ value: "-0.55%", direction: "down", window: "1D" }}
      />,
    );

    // A dense cell is narrow by definition. Shrinking the figure and leaving the chip at `text-sm`
    // would mean the value fits and the chip does not — the same overflow bug, one size down.
    //
    // The size lives on the CHIP, not on the delta text inside it: the delta is an atom span (see the
    // wrap contract above), so the chip is its parent.
    expect(screen.getByText("44,326.02").className).toContain("text-base");
    expect(screen.getByText("-0.55%").parentElement!.className).toContain("text-xs");
  });

  it("still renders the number in INK — the hero rule holds at every scale", () => {
    render(<StatFigure label="Dow" value="44,326.02" scale="dense" delta={{ value: "-0.55%", direction: "down", window: "1D" }} />);

    // There is no variant of this component in which the number itself carries the up/down colour.
    // `dense` is a size, and a size may never become a licence to colour a figure.
    const value = screen.getByText("44,326.02");
    expect(value.className).toContain("text-ink");
    expect(value.className).not.toContain("text-down");
    expect(value.className).not.toContain("text-up");
  });
});
