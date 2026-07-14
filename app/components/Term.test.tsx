import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Term, TermProse } from "@/components/Term";

/**
 * Term is a server component wrapping a client island. Under vitest both render synchronously, and
 * the request-scoped registry (React `cache`) is per-render — which is exactly the unit under test.
 */
describe("Term — the glossary doorway (§8.2.2)", () => {
  it("decorates a known term and opens it as a doorway", () => {
    render(
      <p>
        <Term term="rvol">RVOL</Term>
      </p>,
    );

    // The popover's trigger is a button — a doorway, reachable by keyboard.
    expect(screen.getByRole("button", { name: "RVOL" })).toBeInTheDocument();
  });

  it("is INK, not accent — a definition is not a call to act (E6)", () => {
    render(
      <p>
        <Term term="rvol">RVOL</Term>
      </p>,
    );

    const trigger = screen.getByRole("button", { name: "RVOL" });
    expect(trigger.className).toContain("decoration-dotted");
    // Accent is the colour of interactivity. An underline that promised a definition and looked
    // like a call to act would be spending the app's one interactive hue on a footnote.
    expect(trigger.className).not.toMatch(/\btext-accent\b/);
  });

  it("an unknown term renders as plain text — the word still reads, it just carries no doorway", () => {
    render(
      <p>
        <Term term="not-a-real-term">Fibonacci</Term>
      </p>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Fibonacci")).toBeInTheDocument();
  });
});

describe("TermProse — narrated prose, decorated automatically", () => {
  it("finds the terms in a sentence nobody hand-marked", () => {
    render(<TermProse text="Breadth was narrow and the VIX rose." />);

    expect(screen.getByRole("button", { name: "Breadth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "VIX" })).toBeInTheDocument();
  });

  it("THE BUDGET: at most two doorways in one paragraph, however many terms it contains", () => {
    render(<TermProse text="Breadth was narrow, the VIX rose, and RVOL stayed muted." />);

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("prints the sentence WHOLE — decorating a narrated sentence is allowed; rewriting one is not", () => {
    const text = "Breadth was narrow, the VIX rose, and RVOL stayed muted.";
    const { container } = render(<TermProse text={text} />);

    expect(container).toHaveTextContent(text);
  });

  it("decorates a repeated term ONCE — five mentions of RVOL in a paragraph is one doorway", () => {
    render(<TermProse text="RVOL was high, and RVOL stayed high all session." />);

    expect(screen.getAllByRole("button", { name: "RVOL" })).toHaveLength(1);
  });

  /**
   * THE SECOND DISCIPLINE IS NOT OBSERVABLE HERE, AND SAYING SO IS THE HONEST MOVE.
   *
   * First-occurrence-per-VIEW (a term dotted once across the whole page, not once per paragraph) is
   * enforced by the registry in components/Term.tsx, which React `cache`s to the request. `cache`
   * memoises only inside a Server Component render; under vitest's client render it hands back a
   * FRESH registry on every call, so a test asserting "two paragraphs, one doorway" passes or fails
   * on React's request scoping rather than on our rule. It fails — and the rule is still correct.
   *
   * So the discipline is pinned where it can actually be seen:
   *   · the registry itself, purely — lib/glossary.test.ts ("gap" → true, false, false);
   *   · the real thing, on a real server render — e2e/voice.spec.ts, which loads the Desk and counts
   *     the dotted terms on the brief.
   *
   * A unit test that cannot see the behaviour it names is worse than no test: it is a green light
   * wired to nothing.
   */
});
