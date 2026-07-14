import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KeyFigure, VerifiedProse } from "@/components/KeyFigure";
import { splitVerified } from "@/lib/verified";
import type { VerifiedFigure } from "@/lib/verified";

/** The only legitimate way to obtain one: mint it from the gate's allow-list. */
function mint(value: string): VerifiedFigure {
  const runs = splitVerified(value, [value]);
  const figure = runs.find((run) => run.kind === "figure");
  if (!figure || figure.kind !== "figure") throw new Error("fixture did not mint a figure");
  return figure.figure;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("KeyFigure — emphasis is earned (E5)", () => {
  it("sets a verified figure in mono, marks it P2, and adds no colour", () => {
    const { container } = render(<KeyFigure figure={mint("18.4%")} />);
    const node = container.querySelector("[data-p2]")!;

    expect(node).toHaveTextContent("18.4%");
    expect(node.className).toContain("font-mono");
    // The emphasis is the TYPEFACE. A hue would have to mean something, and E6 keeps a short
    // dictionary that has no entry for "verified".
    expect(node.className).not.toMatch(/text-up|text-down|text-accent|bg-/);
  });

  // ---- The guard, both halves. E5: "throws in dev, renders plain in prod, and the test pins both."

  it("THROWS in development when handed a value the gate never cleared", () => {
    vi.stubEnv("NODE_ENV", "development");
    // The compiler stops this first — VerifiedFigure has exactly one mint. This is the boundary the
    // compiler cannot see: a row out of a JSON parse, an `any`, a caller in plain JavaScript.
    const forged = { value: "99.9%", verified: false } as unknown as VerifiedFigure;

    expect(() => render(<KeyFigure figure={forged} />)).toThrow(/E5|unverified/i);
  });

  it("renders PLAIN TEXT in production instead — the number reads, and claims nothing", () => {
    vi.stubEnv("NODE_ENV", "production");
    const forged = { value: "99.9%", verified: false } as unknown as VerifiedFigure;

    const { container } = render(<KeyFigure figure={forged} />);

    // Deleting it would be worse: the sentence would stop making sense. It simply carries no receipt.
    expect(container).toHaveTextContent("99.9%");
    expect(container.querySelector("[data-p2]")).toBeNull();
    expect(container.querySelector(".font-mono")).toBeNull();
  });
});

describe("VerifiedProse — the N5 headline renderer, generalized", () => {
  it("emphasizes only the cleared figure and leaves the rest of the sentence in prose", () => {
    const { container } = render(
      <VerifiedProse text="SMCI jumps 18.4% on AI server demand" allowed={["18.4%"]} />,
    );

    expect(container.querySelectorAll("[data-p2]")).toHaveLength(1);
    expect(screen.getByText("18.4%")).toBeInTheDocument();
    expect(container).toHaveTextContent("SMCI jumps 18.4% on AI server demand");
  });

  it("emphasizes NOTHING when the gate cleared nothing — and still prints the sentence", () => {
    const { container } = render(
      <VerifiedProse text="Fed holds rates for the 4th meeting" allowed={[]} />,
    );

    expect(container.querySelectorAll("[data-p2]")).toHaveLength(0);
    expect(container).toHaveTextContent("Fed holds rates for the 4th meeting");
  });
});
