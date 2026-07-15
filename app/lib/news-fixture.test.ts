/**
 * The seed must model what the PIPELINE writes — not what a plausible pipeline might write.
 *
 * THE BUG THIS EXISTS FOR. The seeded news night was hand-authored in N4, before the narrator
 * existed, and it guessed at two JSON shapes:
 *
 *   verification: { status: "dropped", flags: [<string>] }   ← the pipeline writes `dropped: true`
 *   key_numbers:  [{ id, label, value }]                     ← the pipeline writes { value_str, what }
 *
 * Neither shape has ever been emitted by `newsdesk/narrate.py`. The app reads the real ones, so it
 * silently found nothing: the story page told the reader the narrator had simply had nothing to add
 * (when in truth the gate had DELETED a line), and every headline number in the seeded room lost its
 * verified-figure emphasis. Both surfaces rendered perfectly. Both were wrong.
 *
 * This is the fabricated-fixture disease of N3 one level up: the lie is in the SHAPE rather than the
 * values, and **the app reads shapes**. A fixture that models a shape its producer does not emit is a
 * fixture that tests the app against a fiction — and hands you a green tick for it.
 *
 * So the seed is run through the app's own boundary reader here. If the pipeline's JSON ever changes
 * and the seed does not follow, this goes red — which is the only place that mismatch can be caught,
 * because there is no type across the language boundary and no local database to run the real thing.
 */

import { describe, expect, it } from "vitest";

import { NEWS_CLUSTERS } from "../prisma/fixtures/news.mjs";
import { toCard, type NewsClusterRow } from "./news";

/** The seed rows, read exactly the way the room reads a database row. */
const cards = (NEWS_CLUSTERS as unknown as NewsClusterRow[]).map((row) =>
  toCard({ ...row, image: null, links: [] }),
);

describe("the seeded night, read through the app's own boundary", () => {
  it("every cluster's extract summary survives the reader", () => {
    // If the extract shape drifts, `summary` silently becomes "" and the story page's "What
    // happened" section vanishes — with no error anywhere.
    const withSummary = cards.filter((card) => card.summary.length > 0);
    expect(withSummary.length).toBe(cards.length);
  });

  it("EVERY key number the seed declares survives the reader — none is silently dropped", () => {
    /*
     * The count is compared against the RAW fixture, and that is the whole point. `toCard` drops a
     * malformed key number on purpose (a half-parsed figure must never reach a card), so a test that
     * only asks "did any survive?" passes happily while the wrong-shaped ones vanish one by one.
     *
     * That is exactly what happened: the seed wrote `{id, label, value}` where the pipeline writes
     * `{value_str, what}`, so EVERY key number in the seeded room was being discarded, the mono
     * emphasis on a verified headline figure never fired, and both the room and its tests were green.
     *
     * The only way to see a silent drop is to count what went in and count what came out.
     */
    const declared = (NEWS_CLUSTERS as unknown as { extract?: { key_numbers?: unknown[] } }[]).reduce(
      (total, row) => total + (row.extract?.key_numbers?.length ?? 0),
      0,
    );
    const parsed = cards.reduce((total, card) => total + card.keyNumbers.length, 0);

    expect(declared, "the seed must actually declare some key numbers to test").toBeGreaterThan(0);
    expect(parsed, `${declared - parsed} key number(s) were silently dropped by the reader`).toBe(
      declared,
    );

    for (const card of cards) {
      for (const number of card.keyNumbers) {
        expect(number.value, `${card.id} has a key number with no value`).toBeTruthy();
      }
    }
  });

  it("the gate-DROPPED note is legible as dropped, not as an absent one", () => {
    // The seed plants exactly one: JPMorgan (a pre-PD7 v1 shape — `dropped: true`, no sections map).
    // A note the gate deleted and a note nobody wrote are different events, and the story page says
    // which. It can only do that if the seed records the decision the way the pipeline records it —
    // and the v1 `dropped` flag still resolves to a "dropped" why-it-matters verdict.
    const dropped = cards.filter((card) => card.sections.whyItMatters === "dropped");

    expect(dropped.map((card) => card.id)).toEqual(["nc-jpm-earnings"]);
    expect(dropped[0].whyItMatters).toBeNull();
  });

  it("carries all four PD7 insight shapes, and each absence answers for itself", () => {
    const byId = new Map(cards.map((card) => [card.id, card]));

    // Shape 1 — the full v2 insight: context prose, a cleared allow-list, two watch rows, model_meta.
    const full = byId.get("nc-fda-nonopioid")!;
    expect(full.sections.context).toBe("narrated");
    expect(full.context).not.toBeNull();
    expect(full.contextCleared.length).toBeGreaterThan(0);
    expect(full.watch.map((w) => w.code)).toEqual(["CPI", "FOMC"]);
    expect(full.modelMeta?.noteVersion).toBe(2);

    // Shape 2 — the gate DROPPED the context, and ONLY the context: the why-line beside it lived.
    const droppedContext = byId.get("nc-smci-earnings")!;
    expect(droppedContext.sections.context).toBe("dropped");
    expect(droppedContext.context).toBeNull();
    expect(droppedContext.sections.whyItMatters).toBe("narrated");
    expect(droppedContext.whyItMatters).not.toBeNull();

    // Shape 3 — an honest silence: a deep cluster whose narrator had nothing to add. Prints the
    // SAME nothing as shape 2; only the verdict tells them apart.
    const silent = byId.get("nc-amd-acquisition")!;
    expect(silent.sections.context).toBe("silent");
    expect(silent.context).toBeNull();

    // Shape 4 — a pre-PD7 row: no depth fields, no sections map. Every new absence is `null`.
    const preDepth = byId.get("nc-uber-expansion")!;
    expect(preDepth.sections.context).toBeNull();
    expect(preDepth.context).toBeNull();
    expect(preDepth.watch).toEqual([]);
    expect(preDepth.modelMeta).toBeNull();
  });

  it("the corroboration count equals the number of articles behind it, on every cluster", () => {
    // The seed refuses to load otherwise — this asserts the refusal is actually reachable, rather
    // than a guard nobody ever exercised.
    for (const card of cards) {
      expect(card.articles.length, `${card.id} claims ${card.sources} sources`).toBe(card.sources);
    }
  });
});
