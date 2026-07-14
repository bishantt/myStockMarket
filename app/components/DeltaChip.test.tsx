import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeltaChip } from "@/components/DeltaChip";

describe("DeltaChip — the one delta chip, and its two atoms (PD4's wrap contract)", () => {
  it("carries the signed delta and its window, and marks itself as money", () => {
    const { container } = render(<DeltaChip value="+8.2%" direction="up" window="1D" />);

    expect(container.querySelector("[data-p2]")).not.toBeNull();
    expect(screen.getByText(/\+8\.2%/)).toBeInTheDocument();
    expect(screen.getByText("· 1D")).toBeInTheDocument();
  });

  it("THE ATOMS: the chip may break between the delta and its window, never inside one", () => {
    // This is the whole contract, and it is the bug PD4 shipped twice. A chip that wraps freely
    // shatters into "▲" / "+0.29%" / "· 1D" — three lines, one token each — which is not wrapping,
    // it is breaking. Each atom is nowrap; the chip is the thing that wraps.
    const { container } = render(
      <DeltaChip value="+0.29%" direction="up" window="vs prior week" />,
    );

    const chip = container.querySelector("[data-p2]")!;
    expect(chip.className).toContain("flex-wrap");
    expect(chip.className).toContain("max-w-full");

    const atoms = chip.querySelectorAll(":scope > span");
    expect(atoms).toHaveLength(2);
    for (const atom of atoms) {
      expect(atom.className, `atom "${atom.textContent}" must not break inside itself`).toContain(
        "whitespace-nowrap",
      );
    }
  });

  it("the direction is told THREE ways — glyph, sign, colour — so the hue is never the only channel (P7)", () => {
    const { container } = render(<DeltaChip value="-1.4%" direction="down" window="1D" />);

    expect(container).toHaveTextContent("▼");
    expect(container).toHaveTextContent("-1.4%");
    expect(container.querySelector("[data-p2]")!.className).toContain("text-down-text");
  });

  it("a flat move gets NO triangle — inventing a direction would be inventing a fact", () => {
    const { container } = render(<DeltaChip value="0.00%" direction="flat" window="1D" />);

    expect(container).not.toHaveTextContent("▲");
    expect(container).not.toHaveTextContent("▼");
  });

  it("the glyph is hidden from screen readers — the signed value already says 'up' out loud", () => {
    const { container } = render(<DeltaChip value="+8.2%" direction="up" window="1D" />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("▲");
  });

  it("NEVER moves: no transition, no animation, no transform (P2, §3.6)", () => {
    const { container } = render(<DeltaChip value="+8.2%" direction="up" window="1D" />);

    const classes = Array.from(container.querySelectorAll("*"))
      .flatMap((node) => Array.from(node.classList))
      .join(" ");

    expect(classes).not.toMatch(/\btransition|\banimate-|\bscale-|\btranslate-/);
  });

  describe("the two presentations of the one contract", () => {
    it("`chip` stands alone, so it brings its own wash", () => {
      const { container } = render(<DeltaChip value="+8.2%" direction="up" window="1D" />);

      const chip = container.querySelector("[data-p2]")!;
      expect(chip.className).toContain("bg-up-wash");
      expect(chip.className).toContain("rounded-chip");
    });

    it("`inline` sits inside another chip, so it brings only the colour — never a pill in a pill", () => {
      const { container } = render(
        <DeltaChip value="+8.2%" direction="up" window="1D" variant="inline" />,
      );

      const chip = container.querySelector("[data-p2]")!;
      expect(chip.className).toContain("text-up-text");
      expect(chip.className).not.toContain("bg-up-wash");
      expect(chip.className).not.toContain("rounded-chip");
    });
  });
});
