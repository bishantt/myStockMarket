import Link from "next/link";
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
   * ── TermProse OVER MARKUP (PD6) ─────────────────────────────────────────────────────────────────
   *
   * The Academy's lessons are MDX, so a paragraph arrives as a TREE of strings and author elements,
   * not as one string. The walk is one level deep, and the first test below is the reason why: a
   * `Term` renders a popover BUTTON, and a button inside an anchor is invalid HTML whose browser
   * repair silently kills the outer link. Never descending makes that bug unreachable rather than
   * guarded — the same reasoning as TickerChip's door/label split (drift rule 26).
   */
  describe("over markup", () => {
    it("NEVER decorates inside the author's own link — a button in an anchor is invalid HTML", () => {
      render(
        <p>
          <TermProse
            text={[
              "Read about ",
              // A real lesson link, exactly as an MDX author writes one — the `a` in mdxComponents
              // maps to this. It is the hazard the walk exists to avoid.
              <Link key="a" href="/academy/volume-and-rvol">
                relative volume
              </Link>,
              " when you get a chance.",
            ]}
          />
        </p>,
      );

      // The anchor survives, and there is no doorway button anywhere inside it.
      const link = screen.getByRole("link", { name: "relative volume" });
      expect(link.querySelector("button")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("decorates the plain prose AROUND the author's markup, and leaves the markup alone", () => {
      render(
        <p>
          <TermProse
            text={["A ", <strong key="s">gap</strong>, " happens when relative volume spikes."]}
          />
        </p>,
      );

      // The author's <strong>gap</strong> keeps its own emphasis, untouched. The plain tail gets the
      // doorway — the machine decorates what the writer left plain, and never talks over them.
      expect(screen.getByText("gap").tagName).toBe("STRONG");
      expect(screen.getByRole("button", { name: "relative volume" })).toBeInTheDocument();
    });

    it("spends ONE budget across the whole paragraph, not one per string leaf", () => {
      // A paragraph broken in half by an author's <strong> is still one paragraph to the reader.
      // Giving each half its own budget of two would silently double the underlines in exactly the
      // paragraphs that are already the busiest.
      render(
        <p>
          <TermProse
            text={[
              "A gap and a base rate, ",
              <strong key="s">then</strong>,
              " relative volume and slippage.",
            ]}
          />
        </p>,
      );

      expect(screen.getAllByRole("button")).toHaveLength(2);
    });

    it("renders a plain string exactly as PD5 did — a string is the simplest tree", () => {
      render(
        <p>
          <TermProse text="A gap is a jump." />
        </p>,
      );
      expect(screen.getByRole("button", { name: "gap" })).toBeInTheDocument();
    });
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
