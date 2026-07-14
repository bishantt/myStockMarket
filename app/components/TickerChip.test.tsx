import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TickerChip } from "@/components/TickerChip";

describe("TickerChip — one symbol, one treatment (§8.2.1)", () => {
  it("is a DOOR to the ticker page when asked", () => {
    render(<TickerChip symbol="AAPL" door />);

    expect(screen.getByRole("link", { name: /AAPL/ })).toHaveAttribute("href", "/ticker/AAPL");
  });

  it("is NOT a link by default — because three of its five consumers cannot legally nest one", () => {
    // A news card is one big <Link>; a movers row is a <button>. An anchor inside either is invalid
    // HTML, and the browser's repair for it silently kills the outer control. So the chip is a plain
    // span unless someone asks for a door.
    render(<TickerChip symbol="AAPL" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("URL-encodes the symbol — a database row is not a promise about URL-safe characters", () => {
    render(<TickerChip symbol="BRK.B" door />);

    expect(screen.getByRole("link", { name: /BRK\.B/ })).toHaveAttribute("href", "/ticker/BRK.B");
  });

  it("carries its move as a P2 figure (Q-G4-1's ruling), with the window inside it (C2)", () => {
    const { container } = render(
      <TickerChip symbol="SMCI" move={{ value: "+18.4%", direction: "up", window: "1D" }} />,
    );

    // The delta is money. It is marked, so the ancestor walk protects it.
    expect(container.querySelector("[data-p2]")).not.toBeNull();
    expect(screen.getByText("+18.4%")).toBeInTheDocument();
    expect(screen.getByText("· 1D")).toBeInTheDocument();
  });

  it("NEVER transitions — a hovered door may wash, but the number it carries does not react", () => {
    // The seam Q-G4-1 asked us to find: a hoverable element and a P2 figure in one piece of UI. The
    // hover is a background and a border; nothing in this subtree animates, and drift rule 6 fails
    // the build if a `transition` class ever appears in the file.
    const { container } = render(
      <TickerChip symbol="SMCI" door move={{ value: "+18.4%", direction: "up", window: "1D" }} />,
    );

    const classes = Array.from(container.querySelectorAll("*"))
      .flatMap((node) => Array.from(node.classList))
      .join(" ");

    expect(classes).not.toMatch(/\btransition|\banimate-|\bscale-|\btranslate-/);
  });

  it("renders no delta at all when there is no move — a symbol is not a figure", () => {
    const { container } = render(<TickerChip symbol="AAPL" door />);

    expect(container.querySelector("[data-p2]")).toBeNull();
  });
});
