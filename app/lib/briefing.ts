import { z } from "zod";

/**
 * lib/briefing.ts — the briefing zod parser and the pure view-model builder for the BriefArticle.
 *
 * The briefing JSON is written by the Python pipeline (Appendix G shape) and stored on the briefing
 * table. The app never trusts it blind: parseBriefDraft validates it at the boundary, and a draft
 * that does not match the schema is treated as held — "briefing unavailable" beats rendering a
 * malformed brief. This is the app-side half of the honesty rules; the deterministic gate already
 * ran in the pipeline, and this refuses anything that would render wrong.
 *
 * buildBrief is pure so it is unit-tested without a database. It numbers the citations that resolve
 * to a real news article (stat-only citations carry no URL and are not footnoted), holds the whole
 * article on a "held" status or an unparseable draft, and omits the Academy doorway for a
 * learning_link_slug the lesson manifest does not know (the manifest is empty until P5, so early
 * briefs simply carry no Learn link — by design, not by error).
 */

// The Appendix G synthesis schema, mirrored in zod. Kept strict (no extra keys) so a shape drift
// fails the parse rather than rendering a half-briefing.
const TodayFocusSchema = z
  .object({
    headline: z.string(),
    body: z.string(),
    citations: z.array(z.string()),
    no_edge_flag: z.boolean(),
  })
  .strict();

const BriefItemSchema = z
  .object({
    what_happened: z.string(),
    why_it_matters: z.string(),
    by_the_numbers: z.string(),
    yes_but: z.string(),
    citations: z.array(z.string()),
  })
  .strict();

const BriefDraftSchema = z
  .object({
    today_focus: TodayFocusSchema,
    items: z.array(BriefItemSchema).max(5),
    calendar_notes: z.array(z.string()),
    learning_link_slug: z.string().nullable(),
  })
  .strict();

export type BriefDraft = z.infer<typeof BriefDraftSchema>;

/** Parse a stored briefing JSON, returning the validated draft or null if it is malformed. */
export function parseBriefDraft(raw: unknown): BriefDraft | null {
  const parsed = BriefDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** A numbered source footnote — the superscript that links a claim to the article behind it. */
export type BriefFootnote = { n: number; url: string; source: string };

/** The Today's-focus block, with its citations resolved to footnote numbers. */
export type TodayFocusView = { headline: string; body: string; citationNumbers: number[] };

/** One briefing item's labeled slots, with its citations resolved to footnote numbers. */
export type BriefItemView = {
  whatHappened: string;
  whyItMatters: string;
  byTheNumbers: string;
  yesBut: string;
  citationNumbers: number[];
};

/** The whole BriefArticle view-model. `status` "held" renders the unavailable banner; otherwise the
 * article renders. `learnSlug` is null unless the manifest knows it. */
export type BriefView = {
  status: "published" | "held";
  todayFocus: TodayFocusView;
  items: BriefItemView[];
  calendarNotes: string[];
  learnSlug: string | null;
  footnotes: BriefFootnote[];
};

/** The empty article body used when the briefing is held or unparseable — the component reads the
 * status and shows the "briefing unavailable" copy, so the body is never seen, but the shape stays
 * uniform for any consumer. */
const HELD_VIEW = (): BriefView => ({
  status: "held",
  todayFocus: { headline: "", body: "", citationNumbers: [] },
  items: [],
  calendarNotes: [],
  learnSlug: null,
  footnotes: [],
});

/**
 * Build the BriefArticle view-model from a stored briefing.
 *
 * `resolveCitation` maps a citation id to the article behind it (url + source label), or null for a
 * computed-stat citation with no URL. `isKnownLesson` gates the Academy doorway against the lesson
 * manifest. A held status, or a draft that fails to parse, yields the held view.
 */
export function buildBrief(input: {
  status: string;
  draft: unknown;
  resolveCitation: (id: string) => { url: string; source: string } | null;
  isKnownLesson: (slug: string) => boolean;
}): BriefView {
  if (input.status === "held") return HELD_VIEW();
  const draft = parseBriefDraft(input.draft);
  if (draft === null) return HELD_VIEW();

  // Assign footnote numbers to news-backed citations in order of first appearance across the brief.
  const numbers = new Map<string, number>();
  const footnotes: BriefFootnote[] = [];
  const numberFor = (id: string): number | null => {
    if (numbers.has(id)) return numbers.get(id)!;
    const resolved = input.resolveCitation(id);
    if (resolved === null) return null; // a stat citation — verified, but nothing to link
    const n = footnotes.length + 1;
    numbers.set(id, n);
    footnotes.push({ n, url: resolved.url, source: resolved.source });
    return n;
  };
  const citationNumbers = (ids: string[]): number[] =>
    ids.map(numberFor).filter((n): n is number => n !== null);

  const learn = draft.learning_link_slug;
  return {
    status: "published",
    todayFocus: {
      headline: draft.today_focus.headline,
      body: draft.today_focus.body,
      citationNumbers: citationNumbers(draft.today_focus.citations),
    },
    items: draft.items.map((item) => ({
      whatHappened: item.what_happened,
      whyItMatters: item.why_it_matters,
      byTheNumbers: item.by_the_numbers,
      yesBut: item.yes_but,
      citationNumbers: citationNumbers(item.citations),
    })),
    calendarNotes: draft.calendar_notes,
    learnSlug: learn !== null && input.isKnownLesson(learn) ? learn : null,
    footnotes,
  };
}
