import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutcomeChip } from "./OutcomeChip";

/**
 * The outcome chip's contract — and the first test is the one the whole component exists to make
 * impossible to break.
 *
 * A LEDGER THAT MAKES ITS HITS PRETTIER THAN ITS MISSES IS A LEDGER THAT IS LYING. The track record
 * is this product's central honesty claim: it publishes its misses. That claim survives only if a
 * miss is as loud as a hit — same size, same weight, same padding, same shape — with the hue as the
 * REDUNDANT channel and the word as the primary one (P7).
 *
 * Three files used to promise that in three separate comments (the track record's, the paper
 * ledger's, the pipeline panel's), and they had already drifted apart: two used `bg-band-outer` for
 * the neutral case and one used `bg-band` — a solid mid-purple under dark text. Nothing failed. A
 * promise made in a comment is not a guard, and three copies of a promise is not three guards; it is
 * one promise and two places for it to rot.
 *
 * So equal weight is asserted STRUCTURALLY here: the two chips must differ in nothing but their hue.
 */
describe("OutcomeChip", () => {
  it("renders a win and a loss at IDENTICAL weight — only the hue may differ (P7)", () => {
    const { container: win } = render(<OutcomeChip tone="positive" label="hit" />);
    const { container: loss } = render(<OutcomeChip tone="negative" label="miss" />);

    const strip = (node: Element) =>
      node.className
        .split(" ")
        .filter((c) => !/^(bg|text)-(up|down|ink|band)/.test(c))
        .sort()
        .join(" ");

    // Every class that is not a colour is the same class. Size, weight, padding, radius, casing,
    // tracking, the wrap contract — all of it. If a future edit makes a hit bolder than a miss, this
    // is the line that stops it.
    expect(strip(win.firstElementChild!)).toBe(strip(loss.firstElementChild!));
  });

  it("says the outcome IN WORDS — the colour is never the only channel", () => {
    render(<OutcomeChip tone="negative" label="miss" />);
    expect(screen.getByText("miss")).toBeVisible();
  });

  it("carries data-p2 when it holds a FIGURE, and not when it holds only a word", () => {
    // A figure is money, and money does not move (P2). A bare word is not a figure, and marking it
    // would point the ancestor walk at surfaces it has no business policing.
    const { container: withFigure } = render(
      <OutcomeChip tone="positive" label="gain" figure="+$412.30" />,
    );
    const { container: wordOnly } = render(<OutcomeChip tone="positive" label="hit" />);

    expect(withFigure.querySelector("[data-p2]")).not.toBeNull();
    expect(wordOnly.querySelector("[data-p2]")).toBeNull();
  });

  it("keeps the figure and the word as ATOMS — it may break between them, never inside one", () => {
    // PD4's law, and PD5 had to relearn it: a phrase broken one word per line has not been wrapped,
    // it has been SHATTERED. Each atom is nowrap; the chip itself wraps.
    const { container } = render(<OutcomeChip tone="negative" label="loss" figure="−$1,204.55" />);
    const atoms = container.querySelectorAll(".whitespace-nowrap");
    expect(atoms).toHaveLength(2);
    expect(atoms[0]).toHaveTextContent("−$1,204.55");
    expect(atoms[1]).toHaveTextContent("loss");
    expect(container.firstElementChild!.className).toContain("flex-wrap");
  });

  it("gives an unresolvable outcome a NEUTRAL chip — not a quiet failure painted as a loss", () => {
    // "unresolvable" means the market never answered, which is not a miss. Colouring it red would
    // book an unanswered question as a wrong one.
    const { container } = render(<OutcomeChip tone="neutral" label="unresolvable" />);
    expect(container.firstElementChild!.className).not.toMatch(/bg-(up|down)-wash/);
  });
});
