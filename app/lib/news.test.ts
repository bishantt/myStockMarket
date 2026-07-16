/**
 * Tests for lib/news.ts — the Front Page's view model (NEWS-AND-CONTROL-PLAN Part 7.7).
 *
 * The rules that matter here are editorial, not visual, which is why they live in a pure module
 * with tests rather than inside a component:
 *
 *   - the lead slot is a POSITION, not a reward for the size of a move (C4);
 *   - a filter row may not hide a story it cannot reach (M8's cousin);
 *   - an active filter restates itself in the count line, so a filtered page never looks like a
 *     complete one;
 *   - a headline number is emphasized ONLY when the verification gate cleared it.
 */

import { describe, expect, it } from "vitest";

import {
  CATALYST_CHIPS,
  type NewsCard,
  activeCatalystChips,
  activeSectorChips,
  bylineSourceCount,
  catalystLabel,
  countLine,
  filterCards,
  formatModel,
  inRange,
  leadAndRest,
  noStoryMovers,
  toCard,
} from "./news";

const SESSION = new Date("2026-07-09T00:00:00.000Z");

function card(over: Partial<NewsCard> = {}): NewsCard {
  return {
    id: "c1",
    headline: "A thing happened",
    eventType: "macro",
    sectors: ["Broad market"],
    themes: [],
    significance: 0.5,
    sources: 1,
    firstSeen: new Date("2026-07-09T18:00:00.000Z"),
    isNew: false,
    whyItMatters: null,
    affectedNote: null,
    sections: { whyItMatters: null, affectedNote: null, context: null, watch: null },
    context: null,
    contextCleared: [],
    watch: [],
    tickers: [],
    keyNumbers: [],
    summary: "",
    image: null,
    articles: [],
    modelMeta: null,
    ...over,
  };
}

describe("the lead slot is a position, not a prize", () => {
  it("gives the lead to the most significant story, not the biggest move", () => {
    // The seeded night's whole argument: SMCI rose 18.4% and does NOT lead. A Fed hold that moved
    // nothing at all does, because significance is not excitement (ruling C1/C4).
    const fed = card({ id: "fed", significance: 0.8, tickers: [] });
    const smci = card({
      id: "smci",
      significance: 0.62,
      tickers: [{ symbol: "SMCI", ret1: 0.184, rvol20: 4.7, hasSetupCard: true }],
    });

    const { lead, rest } = leadAndRest([fed, smci]);

    expect(lead?.id).toBe("fed");
    expect(rest.map((c) => c.id)).toEqual(["smci"]);
  });

  it("has no lead when the feed is empty, rather than inventing one", () => {
    expect(leadAndRest([]).lead).toBeNull();
  });
});

describe("the filter rows", () => {
  const earnings = card({ id: "e", eventType: "earnings", sectors: ["Technology"] });
  const fda = card({ id: "f", eventType: "fda", sectors: ["Health care"] });
  const macro = card({ id: "m", eventType: "macro", sectors: ["Broad market"], themes: ["AI"] });

  it("is OR within a row", () => {
    const out = filterCards([earnings, fda, macro], { types: ["earnings", "fda"], sectors: [] });
    expect(out.map((c) => c.id)).toEqual(["e", "f"]);
  });

  it("is AND across the rows", () => {
    const out = filterCards([earnings, fda, macro], { types: ["earnings"], sectors: ["Health care"] });
    expect(out).toEqual([]); // an earnings story in health care: none tonight
  });

  it("matches a theme in the sector row, because a theme filters the same way a sector does", () => {
    const out = filterCards([earnings, fda, macro], { types: [], sectors: ["AI"] });
    expect(out.map((c) => c.id)).toEqual(["m"]);
  });

  it("shows everything when nothing is selected", () => {
    const out = filterCards([earnings, fda, macro], { types: [], sectors: [] });
    expect(out).toHaveLength(3);
  });

  it("offers a chip for EVERY story on the page, including the ones the plan's list forgot", () => {
    // The classifier's escape hatch is "other", and the plan's chip list does not name it. A filter
    // row that cannot reach a story sitting on the page is a cut nobody stated: the reader sees 40
    // catalysts, adds up the chips, and gets 37. Chips are derived from the feed, so this cannot
    // drift away from the data again.
    const other = card({ id: "o", eventType: "other" });

    const chips = activeCatalystChips([earnings, fda, macro, other]);
    const reachable = new Set(chips.flatMap((chip) => chip.types));

    expect(reachable).toContain("other");
    for (const c of [earnings, fda, macro, other]) {
      expect(reachable.has(c.eventType)).toBe(true);
    }
  });

  it("does not offer a chip for a catalyst type that is not on the page", () => {
    const chips = activeCatalystChips([earnings]);
    expect(chips.map((chip) => chip.key)).toEqual(["earnings"]);
  });

  it("keeps the plan's chip order rather than the order stories happened to arrive in", () => {
    const chips = activeCatalystChips([macro, fda, earnings]);
    const planOrder = CATALYST_CHIPS.map((chip) => chip.key);
    const got = chips.map((chip) => chip.key);
    expect(got).toEqual(planOrder.filter((key) => got.includes(key)));
  });

  it("folds Fed and macro into one chip, because they are one thing to a reader", () => {
    const fed = card({ id: "fed2", eventType: "fed" });
    const chips = activeCatalystChips([fed, macro]);
    expect(chips).toHaveLength(1);
    expect(chips[0].types).toEqual(expect.arrayContaining(["fed", "macro"]));
  });

  it("lists sector chips before theme chips, in the taxonomy's own order", () => {
    const chips = activeSectorChips([macro, fda, earnings]);
    expect(chips).toEqual(["Technology", "Health care", "Broad market", "AI"]);
  });
});

describe("the count line restates the filters", () => {
  it("says only the count when nothing is filtered", () => {
    expect(countLine(6, { types: [], sectors: [] })).toBe("6 catalysts");
  });

  it("names every active filter, so a filtered page never reads as a complete one", () => {
    const line = countLine(2, { types: ["fda"], sectors: ["Health care"] });
    expect(line).toBe("2 catalysts · FDA · Health care");
  });

  it("says 1 catalyst, not 1 catalysts", () => {
    expect(countLine(1, { types: [], sectors: [] })).toBe("1 catalyst");
  });
});

describe("Today and This week", () => {
  const today = card({ id: "t", firstSeen: new Date("2026-07-09T18:02:00.000Z") });
  const yesterday = card({ id: "y", firstSeen: new Date("2026-07-08T14:00:00.000Z") });

  it("Today is the stories that broke this session", () => {
    const out = [today, yesterday].filter((c) => inRange(c, "today", SESSION));
    expect(out.map((c) => c.id)).toEqual(["t"]);
  });

  it("This week keeps the older ones", () => {
    const out = [today, yesterday].filter((c) => inRange(c, "week", SESSION));
    expect(out.map((c) => c.id)).toEqual(["t", "y"]);
  });

  it("counts a story filed after midnight UTC as today's, because the session is not the clock", () => {
    // Job A runs at 6:37pm ET. An article published at 9:30pm ET is already tomorrow in UTC, and it
    // is plainly still tonight's news. A naive UTC date compare would file it under a session that
    // has not happened yet.
    const lateTonight = card({ id: "late", firstSeen: new Date("2026-07-10T01:30:00.000Z") });
    expect(inRange(lateTonight, "today", SESSION)).toBe(true);
  });

  it("drops a story older than the week", () => {
    const stale = card({ id: "s", firstSeen: new Date("2026-07-01T14:00:00.000Z") });
    expect(inRange(stale, "week", SESSION)).toBe(false);
  });
});

// The emphasis tests moved to lib/verified.test.ts at PD5, with the renderer itself. The rule
// they pin (E5 — a figure is emphasised only if the gate cleared it) is not a news rule; it is
// the app's, and it now guards every narrated surface through one door.

describe("moved without a story (C9)", () => {
  it("names only the movers no catalyst explains", () => {
    const cards = [card({ id: "c", tickers: [{ symbol: "SMCI", ret1: 0.184, rvol20: 4.7, hasSetupCard: false }] })];
    const movers = [
      { symbol: "SMCI", ret1: 0.184 },
      { symbol: "PLTR", ret1: 0.061 },
      { symbol: "MARA", ret1: -0.055 },
    ];

    expect(noStoryMovers(movers, cards).map((m) => m.symbol)).toEqual(["PLTR", "MARA"]);
  });

  it("shows at most three, because this is a caveat and not a second feed", () => {
    const movers = ["A", "B", "C", "D", "E"].map((symbol) => ({ symbol, ret1: 0.05 }));
    expect(noStoryMovers(movers, [])).toHaveLength(3);
  });
});

describe("catalyst labels", () => {
  it("uses the reader's words, not the pipeline's", () => {
    expect(catalystLabel("ma")).toBe("M&A");
    expect(catalystLabel("fda")).toBe("FDA");
    expect(catalystLabel("macro")).toBe("Fed/Macro");
    expect(catalystLabel("other")).toBe("Other");
  });
});

describe("the byline's source count (CC5)", () => {
  // The count moves into the byline and speaks ONLY when it outranks the default. One source is the
  // overwhelming case (D5's "1 SOURCE on every card" noise), and one outlet saying a thing is the
  // baseline — nothing to remark on. Two or more IS the news: corroboration is what a count buys.
  it("says nothing when a single outlet carried the story", () => {
    expect(bylineSourceCount(1)).toBeNull();
  });

  it("says nothing for a story with no kept articles rather than printing '0 sources'", () => {
    expect(bylineSourceCount(0)).toBeNull();
  });

  it("names the count the moment corroboration exists", () => {
    expect(bylineSourceCount(2)).toBe("2 sources");
    expect(bylineSourceCount(5)).toBe("5 sources");
  });
});

describe("the database boundary", () => {
  const row = {
    id: "c1",
    headline: "A thing happened",
    eventType: "macro",
    sectors: ["Broad market"],
    themes: [],
    significance: 0.5,
    sources: 2,
    firstSeen: new Date("2026-07-09T18:00:00.000Z"),
    whyItMatters: null,
    affectedNote: null,
    extract: {},
    verification: {},
    articles: [],
    context: null,
    watch: [],
    modelMeta: null,
    image: null,
    links: [],
  };

  it("survives the rows that are ALREADY in production", () => {
    // Every cluster published before the narrator existed carries `extract: {}` and a verification
    // record from an older shape. Those rows are in the live table right now. A cast would turn one
    // of them into a crash on a page the reader asked for.
    const card = toCard({ ...row, extract: {}, verification: { narrated: false, reason: "x" } });

    expect(card.keyNumbers).toEqual([]);
    expect(card.summary).toBe("");
    // A pre-PD7 row has no sections map and no depth fields — every one absent, and honestly so.
    expect(card.sections).toEqual({
      whyItMatters: null,
      affectedNote: null,
      context: null,
      watch: null,
    });
    expect(card.context).toBeNull();
    expect(card.watch).toEqual([]);
    expect(card.modelMeta).toBeNull();
  });

  it("tags a card 'new' when first seen after the prior edition's press time, and not otherwise (CC10, R8)", () => {
    // The fixture's firstSeen is 2026-07-09 18:00. A prior edition that went to press BEFORE that ⇒ new.
    expect(toCard(row, new Date("2026-07-09T00:00:00.000Z")).isNew).toBe(true);
    // A prior edition that went to press AFTER it ⇒ carried over, not new.
    expect(toCard(row, new Date("2026-07-09T20:00:00.000Z")).isNew).toBe(false);
    // No prior edition, or the story sheet (which passes nothing) ⇒ never tagged.
    expect(toCard(row).isNew).toBe(false);
  });

  it("reads the key numbers the gate cleared", () => {
    const card = toCard({
      ...row,
      extract: { summary: "The FOMC held.", key_numbers: [{ value_str: "4.5%", what: "target" }] },
    });

    expect(card.keyNumbers).toEqual([{ value: "4.5%", what: "target" }]);
    expect(card.summary).toBe("The FOMC held.");
  });

  it("drops a malformed key number rather than rendering half of one", () => {
    const card = toCard({ ...row, extract: { key_numbers: [{ what: "no value" }, "junk", null] } });
    expect(card.keyNumbers).toEqual([]);
  });

  it("knows the difference between a note the gate DELETED and one never written", () => {
    // On the card both are silence. On the story page they are different sentences, because a
    // reader who opened one story to find out why it matters is owed the reason there is no answer.
    // The v2 sections map answers per field; the v1 `dropped` flag is honoured as a fallback for
    // why_it_matters, because a pre-PD7 production row carries only that.
    expect(toCard({ ...row, verification: { dropped: true } }).sections.whyItMatters).toBe("dropped");
    expect(toCard({ ...row, verification: { narrated: false } }).sections.whyItMatters).toBeNull();

    // A v2 row: each field carries its own verdict, and the gate-dropped CONTEXT is distinguished
    // from the narrator's honest silence — the whole reason the sections map exists.
    const v2 = toCard({
      ...row,
      context: null,
      verification: {
        sections: {
          why_it_matters: { status: "narrated" },
          affected_note: { status: "silent" },
          context: { status: "dropped", cleared: [] },
          watch: { status: "silent" },
        },
      },
    });
    expect(v2.sections).toEqual({
      whyItMatters: "narrated",
      affectedNote: "silent",
      context: "dropped",
      watch: "silent",
    });
  });

  it("reads the context prose, its cleared allow-list, and the snapshotted watch rows", () => {
    const card = toCard({
      ...row,
      context: "The move is 2.3x its normal range and 71.4% up the year.",
      watch: [
        { stat_id: "cal:CPI:next", key: "CPI", code: "CPI", kind: "macro", title: "CPI", date: "2026-07-12" },
        // A malformed row (no date) is dropped, never rendered as a dead calendar link.
        { stat_id: "cal:X:next", key: "X", code: "X", kind: "macro", title: "No date" },
      ],
      verification: {
        sections: { context: { status: "narrated", cleared: ["2.3x", "71.4%"] } },
      },
      modelMeta: { model_extract: "claude-haiku-4-5", model_synth: "claude-sonnet-5", note_version: 2 },
    });

    expect(card.context).toBe("The move is 2.3x its normal range and 71.4% up the year.");
    expect(card.contextCleared).toEqual(["2.3x", "71.4%"]);
    expect(card.watch).toEqual([
      { statId: "cal:CPI:next", key: "CPI", code: "CPI", kind: "macro", title: "CPI", date: "2026-07-12" },
    ]);
    expect(card.modelMeta).toEqual({
      modelExtract: "claude-haiku-4-5",
      modelSynth: "claude-sonnet-5",
      extractCount: null,
      noteVersion: 2,
    });
  });

  it("sorts the articles oldest first, whatever order the pipeline wrote them in", () => {
    const card = toCard({
      ...row,
      articles: [
        { source: "CNBC", url: "u2", headline: "b", published: "2026-07-09T18:30:00.000Z" },
        { source: "Reuters", url: "u1", headline: "a", published: "2026-07-09T18:02:00.000Z" },
      ],
    });

    expect(card.articles.map((a) => a.source)).toEqual(["Reuters", "CNBC"]);
  });

  it("refuses an article with no date rather than printing an Invalid Date", () => {
    const card = toCard({
      ...row,
      articles: [{ source: "Reuters", url: "u", headline: "h", published: "not a date" }],
    });
    expect(card.articles).toEqual([]);
  });
});

describe("formatModel — the provenance footer's model name (PD8, 9.5)", () => {
  it("turns a model id into a reader-facing name, version digits joined by dots", () => {
    expect(formatModel("claude-haiku-4-5")).toBe("Claude Haiku 4.5");
    expect(formatModel("claude-sonnet-5")).toBe("Claude Sonnet 5");
    expect(formatModel("claude-opus-4-8")).toBe("Claude Opus 4.8");
  });

  it("is structural, not a lookup table — an id it does not know is title-cased, never mangled", () => {
    // The whole point: no per-model table to rot the day a new model ships.
    expect(formatModel("some-new-model-9")).toBe("Some New Model 9");
    expect(formatModel("")).toBe("");
  });
});
