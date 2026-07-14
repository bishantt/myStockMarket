import { describe, expect, it } from "vitest";

import { splitVerified } from "@/lib/verified";

/**
 * The E5 contract: emphasis is earned by verification.
 *
 * These tests moved here from lib/news.test.ts when the N5 headline renderer became the general
 * KeyFigure splitter (PD5). The rule they pin is unchanged and is the app's, not the component's:
 * a figure is emphasized IF AND ONLY IF it appears, verbatim, in the allow-list the gate cleared.
 */
describe("splitVerified — the allow-list is the whole rule (E5)", () => {
  it("emphasizes a figure the gate cleared, and leaves the sentence around it alone", () => {
    const runs = splitVerified("SMCI jumps 18.4% on AI server demand", ["18.4%"]);

    expect(runs).toEqual([
      { kind: "text", text: "SMCI jumps " },
      { kind: "figure", figure: { value: "18.4%", verified: true } },
      { kind: "text", text: " on AI server demand" },
    ]);
  });

  it("leaves a number the gate never cleared as PLAIN TEXT — the app vouches for nothing it did not check", () => {
    // "4th" is a number-shaped token. It is not on the allow-list, so it gets no emphasis — and the
    // app never asks itself whether it "looks like" a figure. That question belongs to the gate.
    const runs = splitVerified("Fed holds rates for the 4th meeting", ["18.4%"]);

    expect(runs).toEqual([{ kind: "text", text: "Fed holds rates for the 4th meeting" }]);
  });

  it("emphasizes nothing when the gate cleared nothing", () => {
    const runs = splitVerified("Fed holds rates steady", []);

    expect(runs).toEqual([{ kind: "text", text: "Fed holds rates steady" }]);
  });

  it("prefers the LONGEST match, so a short key number cannot eat the front of a long one", () => {
    // Both "18" and "18.4%" are on the list. Emphasizing "18" would split the figure in half and
    // leave ".4%" as plain prose — a mono "18" followed by a serif ".4%" is a lie told in typography.
    const runs = splitVerified("SMCI jumps 18.4% today", ["18", "18.4%"]);

    expect(runs).toEqual([
      { kind: "text", text: "SMCI jumps " },
      { kind: "figure", figure: { value: "18.4%", verified: true } },
      { kind: "text", text: " today" },
    ]);
  });

  it("emphasizes every occurrence of a cleared figure, not just the first", () => {
    const runs = splitVerified("Up 2.0% today after 2.0% yesterday", ["2.0%"]);
    const figures = runs.filter((run) => run.kind === "figure");

    expect(figures).toHaveLength(2);
  });

  it("never edits the sentence — the runs concatenate back to the exact input", () => {
    // The one thing the app may never do to a verified sentence is rewrite it. A renderer that
    // dropped a run would be doing exactly that while looking like it was decorating.
    const text = "Nasdaq fell 1.2% as the VIX rose to 15.8, its highest since March.";
    const runs = splitVerified(text, ["1.2%", "15.8"]);

    const rebuilt = runs.map((run) => (run.kind === "figure" ? run.figure.value : run.text)).join("");
    expect(rebuilt).toBe(text);
  });
});
