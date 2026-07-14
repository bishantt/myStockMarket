import { describe, expect, it } from "vitest";

import { splitTerms, TERMS_PER_PARAGRAPH } from "@/lib/prose";

/** Rebuild the paragraph from its runs — the prose must survive decoration untouched. */
function rebuild(runs: ReturnType<typeof splitTerms>): string {
  return runs.map((run) => run.text).join("");
}

describe("splitTerms — the glossary doorways in a paragraph (§8.2.2)", () => {
  it("THE BUDGET: a paragraph with three terms decorates exactly two", () => {
    // The plan's guard, verbatim: "a paragraph fixture with 3 terms renders 2". An underline is a
    // promise that something is behind it; a paragraph making seven promises has communicated
    // nothing.
    const text = "Breadth was narrow, the VIX rose, and RVOL stayed muted.";
    const runs = splitTerms(text);

    const terms = runs.filter((run) => run.kind === "term");
    expect(terms).toHaveLength(TERMS_PER_PARAGRAPH);
    expect(rebuild(runs)).toBe(text);
  });

  it("decorates the terms the READER meets first, not the ones the glossary happens to list first", () => {
    // Position order, not seed order. The two doorways follow the eye through the sentence.
    const text = "Breadth was narrow, the VIX rose, and RVOL stayed muted.";
    const keys = splitTerms(text)
      .filter((run) => run.kind === "term")
      .map((run) => (run.kind === "term" ? run.key : ""));

    expect(keys).toEqual(["breadth", "vix"]);
  });

  it("matches a term at a word boundary, and never inside a longer word", () => {
    // "gap" is a glossary term. "gaping" is not a claim about gaps.
    const runs = splitTerms("The gaping hole in the argument");
    expect(runs.filter((run) => run.kind === "term")).toHaveLength(0);

    const hit = splitTerms("The gap closed by noon");
    expect(hit.filter((run) => run.kind === "term")).toHaveLength(1);
  });

  it("prefers the longest term, so '50-day average' never collapses into a vaguer neighbour", () => {
    const runs = splitTerms("Price crossed its 50-day average today.");
    const terms = runs.filter((run) => run.kind === "term");

    expect(terms).toHaveLength(1);
    expect(terms[0].kind === "term" && terms[0].key).toBe("50-day-average");
    expect(terms[0].text).toBe("50-day average");
  });

  it("keeps the NARRATOR's casing — the glossary supplies the definition, the writer the sentence", () => {
    const runs = splitTerms("Breadth was narrow.");
    const term = runs.find((run) => run.kind === "term");

    // Not "breadth" (the seed's own lowercase key) and not "Breadth" by luck — the prose's own word.
    expect(term?.text).toBe("Breadth");
  });

  it("decorates nothing in a paragraph the glossary cannot define, and returns the prose whole", () => {
    const text = "The company said it would open two new plants.";
    const runs = splitTerms(text);

    expect(runs).toEqual([{ kind: "text", text }]);
  });

  it("never edits the prose — every paragraph rebuilds to the exact input", () => {
    const text = "Breadth narrowed as the VIX rose; RVOL and the 50-day average both slipped.";
    expect(rebuild(splitTerms(text))).toBe(text);
  });

  it("a budget of zero is honoured — nothing is decorated", () => {
    const text = "Breadth was narrow.";
    expect(splitTerms(text, 0)).toEqual([{ kind: "text", text }]);
  });

  describe("aliases — the narrator does not write in our titles", () => {
    it("finds a term by the words the NARRATOR used, not only by its glossary title", () => {
      // The seeded brief says exactly this, and PD5's first run decorated nothing: the glossary
      // holds the title "RVOL", and the sentence says "relative volume".
      const runs = splitTerms("Shares rose 18.40% on relative volume of 4.7×.");
      const terms = runs.filter((run) => run.kind === "term");

      expect(terms).toHaveLength(1);
      expect(terms[0].kind === "term" && terms[0].key).toBe("rvol");
      expect(terms[0].text).toBe("relative volume");
    });

    it("ONE doorway per CONCEPT, not per wording — 'RVOL' and 'relative volume' are one thing", () => {
      // Otherwise a single concept written two ways would eat the whole per-paragraph budget.
      const runs = splitTerms("RVOL was high, and relative volume stayed high.");
      const terms = runs.filter((run) => run.kind === "term");

      expect(terms).toHaveLength(1);
      expect(terms[0].text).toBe("RVOL"); // the earliest occurrence wins
    });

    it("a plural is the same concept — 'gaps' opens the definition of a gap", () => {
      const runs = splitTerms("Most gaps do not fill.");
      const terms = runs.filter((run) => run.kind === "term");

      expect(terms).toHaveLength(1);
      expect(terms[0].kind === "term" && terms[0].key).toBe("gap");
      expect(terms[0].text).toBe("gaps"); // and the PROSE's word is what renders, not "Gap"
    });
  });
});
