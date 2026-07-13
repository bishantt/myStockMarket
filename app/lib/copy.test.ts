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

/**
 * The app-feel additions (APP-FEEL-PLAN Appendix B), pinned like everything else in the deck.
 *
 * These are not labels. Each one is a rule in its final human form, and each is pinned so that a
 * well-meant rewording fails the build instead of quietly softening a warning:
 *
 *   · scans.tableNote is ruling M1 — the sentence that separates a scan table from a leaderboard.
 *   · scans.cap is the 500-row cut, which is an editorial as much as a limit.
 *   · disclosure.more is ruling M2 — a collapsed summary must say how much it hides, and as of when.
 *   · paper.lastClose carries its DATE, because "last close" without one is a freshness claim the
 *     reader cannot check.
 */
describe("the app-feel copy additions (Appendix B)", () => {
  it("says a scan table is not a forecast, and never ranks tomorrow", () => {
    expect(copy.scans.tableNote).toBe(
      "Matches are filter hits, not forecasts. Sorting re-orders today’s matches; it never ranks tomorrow.",
    );
  });

  it("names the pipeline's own order without ever calling it 'top' or 'best'", () => {
    expect(copy.scans.order).toBe("scan order");
    const forbidden = /\b(top|best|hottest|hot|winners)\b/i;
    expect(copy.scans.order).not.toMatch(forbidden);
    expect(copy.scans.preview).not.toMatch(forbidden);
    expect(copy.table.page).not.toMatch(forbidden);
  });

  it("states the 500-row cap as an editorial, and says sorting is off above it", () => {
    expect(copy.scans.cap).toContain("first 500");
    expect(copy.scans.cap).toContain("closer to noise than a signal");
    expect(copy.scans.cap).toContain("Sorting is off above the cap");
  });

  it("renders an empty scan as information rather than an apology", () => {
    expect(copy.scans.empty).toBe("0 matches today — the filter ran and found nothing. That is information.");
  });

  it("makes a collapsed disclosure state BOTH how much it hides and as of when (M2)", () => {
    expect(fill(copy.disclosure.more, { n: 12, context: "through Jul 26" })).toBe("+ 12 more · through Jul 26");
  });

  it("states a preview's cut, rather than calling it 'highlights' (M8)", () => {
    expect(fill(copy.scans.preview, { k: 3, n: 41 })).toBe("First 3 of 41 by scan order");
    expect(fill(copy.calendar.next, { k: 3, n: 15, date: "Jul 26" })).toBe("Next 3 of 15 · through Jul 26");
  });

  it("carries the DATE on the last-close chip — an undated price is a freshness claim", () => {
    const chip = fill(copy.paper.lastClose, { date: "Jul 9", price: "$210.00" });
    expect(chip).toBe("Use last close (Jul 9) · $210.00 — a reference, not a quote");
    expect(chip).toContain("not a quote");
  });

  it("asks for a side without nudging toward one (M9)", () => {
    expect(copy.paper.sideRequired).toBe("Choose buy or sell.");
  });

  it("frames the signal→ticket doorway as practice, mechanically (M10)", () => {
    expect(copy.paper.practiceDoorway).toBe("Practice on paper →");
    expect(copy.paper.practiceDoorway).not.toMatch(/\b(trade|buy|now|start)\b/i);
  });

  it("prints a table's position in words, never as a bar (P13)", () => {
    expect(fill(copy.table.page, { p: 2, t: 7, n: 312 })).toBe("Page 2 of 7 · 312 rows");
  });
});

describe("module 07 reads as a glance", () => {
  it("states the night's scan count as a figure, not a paragraph", () => {
    expect(fill(copy.desk.scanCount, { n: 214, k: 5 })).toBe("214 matches across 5 scans");
  });
});

/**
 * THE WINDOW VOCABULARY IS A CLOSED SET (ruling C2, NEWS-AND-CONTROL-PLAN Part 5.2, mechanism 1).
 *
 * C2 says every number states the period it covers. The failure mode of a rule like that is not
 * that people ignore it — it is that they obey it in six different dialects. One surface says "20d
 * avg", another "20-day average", a third "vs 20d", and the reader, who is learning what these words
 * MEAN, has to work out that all three are the same thing before they can learn anything else.
 *
 * So the vocabulary is closed, it lives in one place, and this test is the lock. Adding a window
 * phrase means adding it HERE — which is a decision someone makes on purpose, in a diff, rather than
 * a phrase that appears in a component because it read well that afternoon.
 */
describe("C2 — the window vocabulary", () => {
  it("is exactly the closed set the plan specifies, and nothing has crept in", () => {
    expect(Object.keys(copy.window).sort()).toEqual(
      [
        "asOf",
        "atClose",
        "avg20d",
        "avg50d",
        "d1",
        "d5",
        "m1",
        "m3",
        "m6",
        "monthOf",
        "rsi14",
        "vsPriorClose",
        // N3. The macro board's mortgage cell states its change against last week's SURVEY, and no
        // existing token said that truthfully — "5D" would have implied five trading days of quotes
        // where Freddie Mac publishes one weekly number.
        "vsPriorWeek",
        "weekOf",
        "y1",
        "y5",
      ].sort(),
    );
  });

  it("the strings themselves are the contract — a surface renders these, verbatim", () => {
    // P12: copy is contractual. These are the exact tokens the movers' chips, the watchlist's chips
    // and the scan tables' headers render, so changing one changes every surface at once — which is
    // the point of them living here.
    expect(copy.window.d1).toBe("1D");
    expect(copy.window.avg20d).toBe("20d avg");
    expect(copy.window.avg50d).toBe("50d avg");
  });

  it("every surface caption that promises a window actually names one", () => {
    // The captions that stand in for a per-row token, where all the rows share one window. Each one
    // must state a real period — a caption reading "Sparklines: recent closes" would satisfy the eye
    // and tell the reader nothing.
    const STATES_A_PERIOD = /\d+\s*((session|day|month|year)s?|[dw])\b/i;

    expect(copy.watchlist.sparkCaption).toMatch(STATES_A_PERIOD);
    expect(copy.watchlist.sparkCaption).toContain("30 sessions");

    // The ticker's chart caption states what the bars are AND through when.
    expect(copy.ticker.rangeCaption).toContain("Daily bars");
    expect(copy.ticker.rangeCaption).toContain("{date}");
    expect(copy.ticker.lastCloseWindow).toContain("prior close");
  });
});
