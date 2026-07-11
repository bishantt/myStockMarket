import { describe, expect, it } from "vitest";

import { buildBrief, parseBriefDraft } from "@/lib/briefing";

/**
 * Tests for lib/briefing.ts — the briefing zod parser and the pure view-model builder.
 *
 * The plan's mandatory unit suite (§7.4) requires "zod parsers reject malformed briefing JSON".
 * buildBrief is the pure layer that numbers the news-backed citations, drops stat-only citations
 * from the footnotes, holds the article on a "held" status, and omits the Learn doorway for a slug
 * the (empty until P5) Academy manifest does not know.
 */

function validDraft() {
  return {
    today_focus: {
      headline: "A quiet session before earnings",
      body: "Breadth was mixed as the market waited on Acme.",
      citations: ["news-1", "stat-breadth"],
      no_edge_flag: false,
    },
    items: [
      {
        what_happened: "Acme reported revenue of $1.2B.",
        why_it_matters: "First read on the sector this quarter.",
        by_the_numbers: "Revenue $1.2B.",
        yes_but: "One quarter is not a trend.",
        citations: ["news-1", "news-2"],
      },
    ],
    calendar_notes: ["CPI is due Thursday."],
    learning_link_slug: "reading-a-base-rate-sentence",
  };
}

const RESOLVE = (id: string) =>
  id === "news-1"
    ? { url: "https://reuters.com/a", source: "reuters.com" }
    : id === "news-2"
      ? { url: "https://ft.com/b", source: "ft.com" }
      : null; // stat ids resolve to no URL

describe("parseBriefDraft", () => {
  it("accepts a well-formed draft", () => {
    expect(parseBriefDraft(validDraft())).not.toBeNull();
  });

  it("rejects a draft missing today_focus", () => {
    const bad = { ...validDraft() } as Record<string, unknown>;
    delete bad.today_focus;
    expect(parseBriefDraft(bad)).toBeNull();
  });

  it("rejects a draft with a non-array items field", () => {
    expect(parseBriefDraft({ ...validDraft(), items: "nope" })).toBeNull();
  });

  it("rejects a draft with more than five items", () => {
    const one = validDraft().items[0];
    expect(parseBriefDraft({ ...validDraft(), items: [one, one, one, one, one, one] })).toBeNull();
  });

  it("rejects a today_focus with a wrong-typed flag", () => {
    const bad = validDraft();
    (bad.today_focus as Record<string, unknown>).no_edge_flag = "true";
    expect(parseBriefDraft(bad)).toBeNull();
  });

  it("rejects entirely non-object input", () => {
    expect(parseBriefDraft("briefing")).toBeNull();
    expect(parseBriefDraft(null)).toBeNull();
  });
});

describe("buildBrief", () => {
  it("numbers only the news-backed citations and lists them as footnotes", () => {
    const view = buildBrief({
      status: "published",
      draft: validDraft(),
      resolveCitation: RESOLVE,
      isKnownLesson: () => true,
    });
    expect(view.status).toBe("published");
    // news-1 → 1, news-2 → 2; stat-breadth is not a footnote.
    expect(view.footnotes).toEqual([
      { n: 1, url: "https://reuters.com/a", source: "reuters.com" },
      { n: 2, url: "https://ft.com/b", source: "ft.com" },
    ]);
    expect(view.todayFocus.citationNumbers).toEqual([1]); // stat-breadth dropped
    expect(view.items[0].citationNumbers).toEqual([1, 2]);
  });

  it("holds the article when the status is held", () => {
    const view = buildBrief({
      status: "held",
      draft: validDraft(),
      resolveCitation: RESOLVE,
      isKnownLesson: () => true,
    });
    expect(view.status).toBe("held");
  });

  it("treats an unparseable draft as held", () => {
    const view = buildBrief({
      status: "published",
      draft: { garbage: true },
      resolveCitation: RESOLVE,
      isKnownLesson: () => true,
    });
    expect(view.status).toBe("held");
  });

  it("omits the Learn doorway for a slug the manifest does not know", () => {
    const view = buildBrief({
      status: "published",
      draft: validDraft(),
      resolveCitation: RESOLVE,
      isKnownLesson: () => false, // manifest empty until P5
    });
    expect(view.learnSlug).toBeNull();
  });

  it("keeps a known Learn slug", () => {
    const view = buildBrief({
      status: "published",
      draft: validDraft(),
      resolveCitation: RESOLVE,
      isKnownLesson: (slug) => slug === "reading-a-base-rate-sentence",
    });
    expect(view.learnSlug).toBe("reading-a-base-rate-sentence");
  });
});
