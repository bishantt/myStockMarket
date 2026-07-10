import { describe, expect, it } from "vitest";
import { copy, fill } from "./copy";

/**
 * These tests pin the copy deck to plan Appendix J, character for character.
 *
 * Appendix J is a contract, not a suggestion: §1.3.3 makes any change to it a structural
 * decision. The point of asserting the strings verbatim here is that a well-intentioned
 * rewording — softening "likely noise", trimming the vol-band caveat, turning "watch only"
 * into something more encouraging — fails CI instead of quietly weakening a guardrail.
 *
 * If one of these tests fails, the question to ask is not "how do I fix the test". It is
 * "did I mean to make a structural change, and did I log it".
 */

describe("the copy deck matches Appendix J verbatim", () => {
  it("renders the canonical base-rate sentence", () => {
    expect(copy.baseRate.sentence).toBe(
      "In the past {years} years, this pattern appeared {n} times on {refClass}. Price was higher {h} trading days later in {wins} of {n} cases ({pct}).",
    );
  });

  it("renders the N < 30 suppression line", () => {
    expect(copy.baseRate.insufficient).toBe(
      "Insufficient history (N = {n}) — treat as anecdote.",
    );
  });

  it("renders the always-up baseline line", () => {
    expect(copy.baseRate.baseline).toBe(
      "Unconditional {h}-day up-rate ≈ {pct} — read this against that baseline.",
    );
  });

  it("maps every tier to an observational action, never an acquisitional verb", () => {
    expect(copy.tier.strong).toBe("worth a closer look");
    expect(copy.tier.moderate).toBe("note it; check the weakeners");
    expect(copy.tier.weak).toBe("watch only");

    // The guardrail behind the strings: no tier may tell the reader to transact.
    const forbidden = /\b(buy|sell|short|enter|exit|trade)\b/i;
    for (const action of [copy.tier.strong, copy.tier.moderate, copy.tier.weak]) {
      expect(action).not.toMatch(forbidden);
    }
  });

  it("renders the vol-band label and its inseparable regime-break caveat", () => {
    expect(copy.volband.label).toBe(
      "In the past, 8 in 10 {h}-day paths from here stayed inside this range.",
    );
    expect(copy.volband.caveat).toBe(
      "Ranges assume the recent regime holds — sudden stress can exceed them.",
    );
  });

  it("renders the honest no-catalyst line for movers", () => {
    expect(copy.mover.noNews).toBe(
      "No news found — most moves this size have no identifiable cause; likely noise.",
    );
  });

  it("renders 'no clear edge' as a valid outcome rather than an apology", () => {
    expect(copy.calendar.noEdge).toBe(
      "No clear edge either way — that is a valid outcome.",
    );
  });

  it("renders the briefing-unavailable banner", () => {
    expect(copy.brief.unavailable).toBe(
      "Briefing unavailable tonight — scan results below are complete and verified.",
    );
  });

  it("renders the offline ribbon", () => {
    expect(copy.offline.ribbon).toBe(
      "Offline — showing the last synced briefing ({date}).",
    );
  });

  it("renders the scope line and the decision-point disclaimer", () => {
    expect(copy.scope.line).toBe("A tendency, not a prediction.");
    expect(copy.decision.disclaimer).toBe("Historical tendency — verify before acting.");
  });

  it("renders the cooling-off body", () => {
    expect(copy.coolingOff.body).toBe(
      "You are entering a paper trade within {min} minutes of seeing this signal. The historical base rate is {rate} with the interval shown; costs are certain. Proceed, or sit with it until tomorrow’s brief?",
    );
  });

  it("renders the Brier anchor", () => {
    expect(copy.brier.anchor).toBe("0.25 = coin flip");
  });

  it("renders the FRED attribution exactly as the licence requires", () => {
    expect(copy.attribution.fred).toBe(
      "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.",
    );
  });

  it("renders the degraded-source, offline-save and update-ready lines", () => {
    expect(copy.degraded.source).toBe(
      "{source} unavailable tonight — this section is running without it.",
    );
    expect(copy.save.offline).toBe("Reconnect to save.");
    expect(copy.update.ready).toBe("Updated — refresh when convenient.");
  });

  it("keeps the mechanical voice: no first person, no exclamation marks", () => {
    const strings = JSON.stringify(copy);
    expect(strings).not.toMatch(/!/);
    expect(strings).not.toMatch(/\bI think\b|\bwe believe\b|\bI\b/i);
  });
});

describe("fill", () => {
  it("substitutes every placeholder", () => {
    expect(
      fill(copy.baseRate.sentence, {
        years: 5,
        n: 110,
        refClass: "US large caps",
        h: 10,
        wins: 62,
        pct: "56%",
      }),
    ).toBe(
      "In the past 5 years, this pattern appeared 110 times on US large caps. Price was higher 10 trading days later in 62 of 110 cases (56%).",
    );
  });

  it("substitutes a placeholder that appears more than once", () => {
    // {n} appears twice in the canonical sentence; both must be filled.
    const result = fill(copy.baseRate.sentence, {
      years: 5,
      n: 110,
      refClass: "US large caps",
      h: 10,
      wins: 62,
      pct: "56%",
    });
    expect(result).not.toContain("{n}");
    expect(result.match(/110/g)).toHaveLength(2);
  });

  it("throws rather than leaving a raw {placeholder} on screen", () => {
    expect(() => fill(copy.offline.ribbon, {})).toThrow(/missing value\(s\) for: date/);
  });

  it("throws when given a value with no matching placeholder, which means a rename went wrong", () => {
    expect(() => fill(copy.scope.line, { unexpected: "x" })).toThrow(
      /no placeholder for: unexpected/,
    );
  });

  it("handles a template with no placeholders at all", () => {
    expect(fill(copy.brier.anchor)).toBe("0.25 = coin flip");
  });
});
