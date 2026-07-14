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

  /**
   * ── THE TOUCH TARGET (PD6) ──────────────────────────────────────────────────────────────────────
   *
   * A door is a CONTROL, and every control in this app is at least 44px on touch. The chip shipped at
   * 34×21px, and the phone sweep — which exists precisely to catch this — had been passing it for a
   * whole phase, because the ONE story page it visits has zero affected tickers in the seeded world,
   * so it never rendered a door to measure.
   *
   * jsdom computes no layout, so this test cannot measure 44 pixels. It asserts the CLASS that
   * produces them, on the anchor, which is the thing that was missing — and it lives here, next to
   * the component, rather than depending on a browser sweep reaching a page where a door happens to
   * be rendered. A guard that only fires when a fixture cooperates is not a guard.
   */
  it("gives the DOOR a 44px hit area, while the chip you SEE stays small", () => {
    render(<TickerChip symbol="AAPL" door />);

    const link = screen.getByRole("link", { name: /AAPL/ });
    expect(link.className).toContain("min-h-11");

    // And the visual chip is a separate, inner box — it must NOT have grown to 44px, or every table
    // cell in the app would be holding a pill twice the height of its own text.
    const chip = link.firstElementChild!;
    expect(chip.className).toContain("rounded-chip");
    expect(chip.className).not.toContain("min-h-11");
  });

  it("gives the LABEL no hit area at all — it is not a control, and must not pretend to be one", () => {
    const { container } = render(<TickerChip symbol="AAPL" />);
    expect(container.querySelector(".min-h-11")).toBeNull();
  });
});
