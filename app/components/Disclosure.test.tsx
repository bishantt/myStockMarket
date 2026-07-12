import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Disclosure } from "./Disclosure";

/**
 * Ruling M2, made mechanical: **a caveat may collapse only with the claim it qualifies; a visible
 * claim may never have a hidden caveat.**
 *
 * The count grammar is where that rule becomes code. A disclosure that hides an unstated number of
 * things is a disclosure that can hide a miss — so the count is required BY TYPE (an uncounted
 * disclosure does not compile) and it is rendered in all three states, each phrased for what is
 * actually true at that moment:
 *
 *   collapsed, count > 0   →  "+ 12 more · through Jul 26"   (there is more, and this much)
 *   collapsed, count === 0 →  "none saved tonight"           (a zero is a STATE, not an offer)
 *   open                   →  "12 · through Jul 26"          (no "more" — nothing on screen may
 *                                                              claim to hide what it is showing)
 */
describe("Disclosure — the M2 count grammar", () => {
  it("says how much it is hiding, and as of when, while collapsed", () => {
    render(
      <Disclosure label="All movers" count={12} context="through Jul 26">
        <p>hidden rows</p>
      </Disclosure>,
    );
    expect(screen.getByText("+ 12 more · through Jul 26")).toBeVisible();
  });

  it("reports a zero as a state, not as an offer of more", () => {
    // "+ 0 more" is a nonsense sentence and a small lie: it invites a tap that reveals nothing.
    render(
      <Disclosure label="Tonight's journal" count={0} context="none saved tonight">
        <p>the form</p>
      </Disclosure>,
    );
    expect(screen.getByText("none saved tonight")).toBeVisible();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("drops the word 'more' once open — nothing on screen may claim to hide what it is showing", () => {
    render(
      <Disclosure label="All movers" count={12} context="by rank" defaultOpen>
        <p>the rows</p>
      </Disclosure>,
    );
    expect(screen.getByText("12 · by rank")).toBeVisible();
    expect(screen.queryByText(/\+ 12 more/)).toBeNull();
  });

  it("opens on click and shows what it was hiding", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure label="All movers" count={2} context="by rank">
        <p>the hidden rows</p>
      </Disclosure>,
    );
    await user.click(screen.getByText("All movers"));
    expect(screen.getByText("the hidden rows")).toBeVisible();
  });

  it("forceOpen renders the content with NO way to collapse it (a degradation may not be hidden)", () => {
    // SourceStatus uses this: if any provider is degraded, the summary "all reporting" claim would
    // otherwise stand on screen with its own refutation folded away underneath it.
    const { container } = render(
      <Disclosure label="Per-provider detail" count={6} forceOpen>
        <p>marketaux degraded</p>
      </Disclosure>,
    );
    expect(screen.getByText("marketaux degraded")).toBeVisible();
    // No <details> at all — there is nothing to toggle, so there is no toggle.
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
  });

  it("does not fade by default — an instant reveal is what a data-p2 subtree requires", () => {
    const { container } = render(
      <Disclosure label="All movers" count={3}>
        <span data-p2="true">+4.20%</span>
      </Disclosure>,
    );
    // The fade class is opt-in. If it were the default, every disclosure over a money figure would
    // be animating that figure's arrival, and the P2 ancestor walk would (rightly) fail the file.
    expect(container.querySelector(".content-fade")).toBeNull();
  });

  it("keeps the summary a single ≥44px hit target", () => {
    render(
      <Disclosure label="All movers" count={3}>
        <p>rows</p>
      </Disclosure>,
    );
    // min-h-11 is the 44px token. On a phone this row is the whole affordance.
    expect(screen.getByText("All movers").closest("summary")?.className).toContain("min-h-11");
  });
});
