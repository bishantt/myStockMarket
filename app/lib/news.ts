/**
 * lib/news.ts — the Front Page's view model (NEWS-AND-CONTROL-PLAN Part 7.7).
 *
 * The room's editorial rules live here, in pure functions, rather than inside the components that
 * render them. That is deliberate: "the lead slot is a position, not a prize" is not a layout
 * detail, it is the claim the whole room makes, and a claim that matters is a claim that gets a
 * test. A component can be reviewed by eye; only a function can be held by a gate.
 *
 * What the pipeline decides and this module must never re-decide: the ORDER. `significance` is
 * computed in `newsdesk/rank.py` from evidence — scope, corroboration, the size of the move a story
 * explains, the class of catalyst, and how recent it is — and no behavioural signal (clicks, views,
 * "most read") is ingested anywhere in this system. Nothing here re-ranks. The feed is served in
 * the order the pipeline set, filters remove rows without reordering them, and the lead is simply
 * whatever sits first.
 */

import { copy, fill } from "@/lib/copy";

/** One ticker a story is linked to, with its numbers SNAPSHOTTED at publish (see CatalystLink). */
export type CatalystTicker = {
  symbol: string;
  ret1: number | null;
  rvol20: number | null;
  hasSetupCard: boolean;
};

/** One figure the extractor pulled from the article, and the gate cleared. */
export type KeyNumber = { value: string; what: string };

/**
 * One article behind a story — snapshotted at publish (news_cluster.articles).
 *
 * This is what "3 sources" is a count OF. Until N5 the count existed and the articles did not, so
 * corroboration — the second-heaviest term in the ranking formula — was a number the reader had to
 * take on trust. A number that cannot be opened is exactly the kind of claim this app argues
 * against making.
 */
export type NewsArticle = { source: string; url: string; headline: string; published: Date };

/** The image a card renders, when the ladder found one (L1/L2). Null falls to L3/L4. */
export type NewsCardImage = {
  urlCard: string;
  urlThumb: string;
  urlFull: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  attributionSource: string | null;
  attributionUrl: string | null;
};

/**
 * The gate's per-field verdict (PD7, plan 9.3). A section can be absent for FOUR distinct reasons,
 * and the story page owes the reader which one it was:
 *   · narrated      — the section was written and cleared (present, not absent).
 *   · dropped       — the narrator wrote it and the gate DELETED it (a number traced to no source).
 *   · silent        — a deep cluster whose narrator honestly had nothing to add.
 *   · out_of_budget — the cluster sat outside the depth budget's top 8; nobody ever asked for it.
 * `null` here means the row predates the sections map entirely (a pre-PD7 production row).
 */
export type SectionStatus = "narrated" | "dropped" | "silent" | "out_of_budget";

/** The gate's verdict for each narratable field (PD7). */
export type SectionVerdicts = {
  whyItMatters: SectionStatus | null;
  affectedNote: SectionStatus | null;
  context: SectionStatus | null;
  watch: SectionStatus | null;
};

/**
 * One dated calendar fact a story flags as worth knowing is coming (PD7 `watch`, plan 9.3).
 *
 * SNAPSHOTTED at publish, exactly as the narrator selected it from the calendar rows it was shown —
 * the LLM picks which dated facts are relevant, it can never author one (E4). Because it is a
 * snapshot of a real `calendar_event`, it can never disagree with the calendar the reader lands on.
 */
export type WatchRow = {
  /** The registry stat id it resolved from, e.g. "cal:CPI:next". Kept for provenance, not shown. */
  statId: string;
  key: string;
  /** The calendar's chip vocabulary — CPI, FOMC, JOBS, EARNINGS … — the reader sees this. */
  code: string;
  kind: string;
  title: string;
  /** A bare trading-day ISO string ("2026-07-12"). Formatted from its UTC parts, never in ET. */
  date: string;
};

/**
 * What the models actually cost this story (PD7, plan 9.5). Null on pre-PD7 rows, where the footer
 * falls back to the honest "no extract" wording rather than a hardcoded model name it cannot know.
 */
export type NewsModelMeta = {
  modelExtract: string | null;
  modelSynth: string | null;
  extractCount: number | null;
  noteVersion: number | null;
};

/** One story, as the room renders it. */
export type NewsCard = {
  id: string;
  headline: string;
  eventType: string;
  sectors: string[];
  themes: string[];
  significance: number;
  sources: number;
  firstSeen: Date;
  /** The verified one-liner, or null. A null prints NOTHING on a card — never a placeholder (P9). */
  whyItMatters: string | null;
  affectedNote: string | null;
  /**
   * The gate's verdict for every narratable field (PD7). The card ignores it; the story page reads
   * it to say WHY a section is absent — a line the gate DELETED is a different event from a line the
   * narrator never wrote, and a reader who opened one story is owed which one it was. This SUPERSEDES
   * the old `noteDropped` boolean: it distinguishes four absences, not two, and per section.
   */
  sections: SectionVerdicts;
  /**
   * The v2 insight's context prose (PD7, plan 9.3) — 2–3 mechanical sentences placing tonight's move,
   * narrated ONLY from cited registry stats. Null is the COMMON case (dropped, silent, out of budget,
   * or a pre-PD7 row); `sections.context` says which. A null prints nothing — never a placeholder.
   */
  context: string | null;
  /**
   * The figures the gate CLEARED inside the context prose (PD7, Q-PD5-1). This is the KeyFigure
   * allow-list for the context section and nothing else (E5): a number is set in mono if and only if
   * it is in here. An empty list emphasizes nothing, which is the honest default.
   */
  contextCleared: string[];
  /** The dated calendar facts the narrator flagged, snapshotted (PD7). Empty = no dated events. */
  watch: WatchRow[];
  tickers: CatalystTicker[];
  keyNumbers: KeyNumber[];
  summary: string;
  image: NewsCardImage | null;
  /** The articles behind the story, oldest first. The card prints the first one's outlet. */
  articles: NewsArticle[];
  /** What the models cost this story (PD7). Null on pre-PD7 rows. Powers the provenance footer. */
  modelMeta: NewsModelMeta | null;
};

export type NewsFilters = { types: string[]; sectors: string[] };
export type NewsRange = "today" | "week";

/** A mover with no catalyst behind it (C9). */
export type NoStoryMover = { symbol: string; ret1: number | null };

/**
 * The catalyst filter chips, in the plan's order (Appendix B / 7.7).
 *
 * A chip maps to a SET of pipeline event types, because the pipeline's vocabulary and the reader's
 * are not the same one. "Fed" and "macro" are two classes to `rank.py` and one thing to a person
 * reading a newspaper, so they share a chip.
 *
 * "Other" is here and is NOT in the plan's list, and that gap was worth closing. The classifier
 * keeps an `other` escape hatch precisely so it never has to force a bad fit — which means real
 * stories carry it, and on the recorded feed a good many do. Ship the plan's list verbatim and the
 * reader sees forty catalysts, adds up the chips, and reaches thirty-seven, with no way to open the
 * missing three. A filter row that cannot reach a story sitting on the page is a cut nobody stated
 * (the same disease as ruling M8's unlabelled slice).
 */
export const CATALYST_CHIPS: { key: string; label: string; types: string[] }[] = [
  { key: "earnings", label: "Earnings", types: ["earnings"] },
  { key: "guidance", label: "Guidance", types: ["guidance"] },
  { key: "ma", label: "M&A", types: ["ma"] },
  { key: "fda", label: "FDA", types: ["fda"] },
  { key: "macro", label: "Fed/Macro", types: ["macro", "fed"] },
  { key: "analyst", label: "Analyst", types: ["analyst"] },
  { key: "filing", label: "Filings", types: ["filing"] },
  { key: "legal", label: "Legal", types: ["legal"] },
  { key: "product", label: "Product", types: ["product"] },
  { key: "other", label: "Other", types: ["other"] },
];

/**
 * The sector vocabulary, in the pipeline taxonomy's own order, then the themes.
 *
 * Order is not alphabetical and should not be: it mirrors `newsdesk/taxonomy.py`, so the room and
 * the pipeline name the world in the same sequence. "Broad market" comes last of the sectors — it
 * is the honest default for a story that resists classification, not a sector.
 */
export const SECTOR_ORDER = [
  "Technology",
  "Financials",
  "Health care",
  "Energy",
  "Industrials",
  "Consumer discretionary",
  "Consumer staples",
  "Utilities",
  "Materials",
  "Real estate",
  "Communications",
  "Broad market",
] as const;

/** The themes a story can carry. Additive: a story may be AI and Defense and Technology at once. */
export const THEME_ORDER = ["AI", "Defense"] as const;

/**
 * Catalyst → Academy doorway (Appendix E's map).
 *
 * The doorway teaches the MECHANISM, not the story: a reader who has just read that an FDA approval
 * gapped a stock open is one tap from the lesson on what gaps actually do, which is the only claim
 * this app is willing to make about what happens next.
 *
 * Two absences are deliberate. `product` and `other` have no entry, because no authored lesson is
 * about them, and a doorway into a room that does not exist is worse than no doorway. And
 * earnings/guidance point at the trading-day lesson rather than an earnings lesson — because there
 * is no earnings lesson yet. Appendix E says so itself ("if/when authored"), and pointing at a
 * plausible-sounding slug nobody has written would produce a 404 dressed as a promise.
 *
 * Every slug here is checked against the Academy manifest before it renders (`isKnownLesson`), so a
 * lesson that is renamed or removed silently closes its doorway instead of breaking a page.
 */
export const ACADEMY_DOORWAY: Record<string, string> = {
  earnings: "the-us-trading-day",
  guidance: "the-us-trading-day",
  ma: "order-types-and-the-spread",
  fda: "gaps-what-the-data-says",
  macro: "reading-the-macro-pulse",
  fed: "reading-the-macro-pulse",
  analyst: "why-base-rates-beat-anecdotes",
  filing: "the-track-record-page",
  legal: "the-track-record-page",
};

/** How many "moved without a story" rows the room will print. A caveat, not a second feed. */
const NO_STORY_CAP = 3;

/** The room's window, in days, for "This week". */
const WEEK_DAYS = 7;

/** The reader's word for each pipeline event type. */
export function catalystLabel(eventType: string): string {
  const chip = CATALYST_CHIPS.find((candidate) => candidate.types.includes(eventType));
  return chip ? chip.label : "Other";
}

/**
 * The lead story and the rest, in the pipeline's order.
 *
 * THE LEAD IS A POSITION, NOT A PRIZE (ruling C4). It is simply whatever the evidence put first.
 * The seeded night exists to prove this: SMCI rose 18.4% — the largest move on the tape — and it
 * ranks third, behind a Fed statement that moved nothing at all. If a future change ever lets the
 * big number float to the top, the e2e that asserts this ordering goes red.
 */
export function leadAndRest(cards: NewsCard[]): { lead: NewsCard | null; rest: NewsCard[] } {
  if (cards.length === 0) return { lead: null, rest: [] };
  return { lead: cards[0], rest: cards.slice(1) };
}

/** Filters are OR within a row, AND across the two rows (7.7). Nothing selected shows everything. */
export function filterCards(cards: NewsCard[], filters: NewsFilters): NewsCard[] {
  const types = new Set(filters.types);
  const sectors = new Set(filters.sectors);

  return cards.filter((card) => {
    if (types.size > 0 && !types.has(card.eventType)) return false;
    if (sectors.size > 0) {
      const carried = [...card.sectors, ...card.themes];
      if (!carried.some((name) => sectors.has(name))) return false;
    }
    return true;
  });
}

/** The catalyst chips worth showing: the ones some story on the page actually carries. */
export function activeCatalystChips(cards: NewsCard[]): { key: string; label: string; types: string[] }[] {
  const present = new Set(cards.map((card) => card.eventType));
  return CATALYST_CHIPS.filter((chip) => chip.types.some((type) => present.has(type)));
}

/** The sector and theme chips worth showing, sectors first, each in the taxonomy's order. */
export function activeSectorChips(cards: NewsCard[]): string[] {
  const present = new Set(cards.flatMap((card) => [...card.sectors, ...card.themes]));
  return [
    ...SECTOR_ORDER.filter((sector) => present.has(sector)),
    ...THEME_ORDER.filter((theme) => present.has(theme)),
  ];
}

/**
 * The count line, restating every active filter.
 *
 * "6 catalysts" and "6 catalysts · Pharma · FDA" are different claims, and a page showing the
 * second while saying the first is a page hiding its own subset. The restatement is what keeps a
 * filtered view from reading as a complete one.
 */
export function countLine(count: number, filters: NewsFilters): string {
  const noun = count === 1 ? "catalyst" : "catalysts";
  const names = [
    ...filters.types.map((type) => catalystLabel(type)),
    ...filters.sectors,
  ];
  const suffix = names.length > 0 ? ` · ${names.join(" · ")}` : "";
  return `${count} ${noun}${suffix}`;
}

/**
 * Is this story inside the chosen window?
 *
 * THE SESSION IS NOT THE CLOCK, and this is the second time that has mattered in this build. Job A
 * runs at 6:37pm ET, and an article published at 9:30pm ET is already TOMORROW in UTC while being
 * plainly still tonight's news. A naive same-UTC-day comparison would file it under a session that
 * has not happened yet and quietly drop it out of "Today". So "today" is everything from the start
 * of the session's UTC day ONWARD, with no upper bound — there is no such thing as a story from the
 * future on a page assembled after the close.
 */
export function inRange(card: NewsCard, range: NewsRange, sessionDate: Date): boolean {
  const sessionStart = Date.UTC(
    sessionDate.getUTCFullYear(),
    sessionDate.getUTCMonth(),
    sessionDate.getUTCDate(),
  );
  const seen = card.firstSeen.getTime();

  if (range === "today") return seen >= sessionStart;
  return seen >= sessionStart - (WEEK_DAYS - 1) * 24 * 60 * 60 * 1000;
}

/*
 * THE HEADLINE EMPHASIS RENDERER LIVED HERE UNTIL PD5. It is now lib/verified.ts —
 * `splitVerified`, rendered by components/KeyFigure.tsx.
 *
 * It moved because it was never really about headlines. The rule it encodes (E5: a figure is
 * set in mono IF AND ONLY IF the gate cleared it) applies to every narrated surface this app
 * has — a why-it-matters line, an insight paragraph, a brief. Leaving it in `lib/news` meant
 * the app's one honesty-of-emphasis rule was reachable only from the news room, and any other
 * surface that wanted an emphasised number would have hand-rolled its own — which is exactly
 * how a rule becomes a suggestion.
 */

/**
 * The movers no catalyst explains (ruling C9).
 *
 * They are never images, never ranked among the catalysts, and never more than three — they are the
 * page's caveat about itself, not a second feed. The standing noise line travels with them: most
 * moves this size have no identifiable cause.
 */
export function noStoryMovers(movers: NoStoryMover[], cards: NewsCard[]): NoStoryMover[] {
  const explained = new Set(cards.flatMap((card) => card.tickers.map((t) => t.symbol)));
  return movers.filter((mover) => !explained.has(mover.symbol)).slice(0, NO_STORY_CAP);
}

/** The zero-result sentence, naming the filter that emptied the page. */
export function zeroStateLine(filters: NewsFilters): string {
  const names = [...filters.types.map(catalystLabel), ...filters.sectors];
  return fill(copy.news.zeroState, { filter: names.join(" · ") || "matching" });
}

/** "3 sources" — or "1 source", because corroboration is the number and grammar is not optional. */
export function sourcesLine(sources: number): string {
  return sources === 1 ? copy.news.oneSource : fill(copy.news.sources, { n: sources });
}

// ---------------------------------------------------------------------------------------------
// The boundary: a database row becomes a card
// ---------------------------------------------------------------------------------------------

/** The shape the room's query returns. `extract`, `verification` and `articles` are Json columns. */
export type NewsClusterRow = {
  id: string;
  headline: string;
  eventType: string;
  sectors: string[];
  themes: string[];
  significance: number;
  sources: number;
  firstSeen: Date;
  whyItMatters: string | null;
  affectedNote: string | null;
  extract: unknown;
  verification: unknown;
  articles: unknown;
  /** PD7 depth columns. `context` is a plain string column; `watch` and `modelMeta` are Json. */
  context: string | null;
  watch: unknown;
  modelMeta: unknown;
  image: NewsCardImage | null;
  links: CatalystTicker[];
};

/**
 * One database row into one card, defensively.
 *
 * THE JSON COLUMNS ARE NOT TRUSTED, and not because the pipeline is careless. `extract`,
 * `verification` and `articles` are written by a job that has been rewritten five times this month,
 * they carry no schema at the database level, and rows written by an OLDER version of that job are
 * still sitting in the table — the `{}` extract every cluster published with before the narrator
 * existed is in production right now. A cast would turn any one of those into a crash on a page the
 * reader asked for. So every field is read through a check and every absence has an answer.
 */
export function toCard(row: NewsClusterRow): NewsCard {
  const extract = isRecord(row.extract) ? row.extract : {};
  const verification = isRecord(row.verification) ? row.verification : {};

  return {
    id: row.id,
    headline: row.headline,
    eventType: row.eventType,
    sectors: row.sectors,
    themes: row.themes,
    significance: row.significance,
    sources: row.sources,
    firstSeen: row.firstSeen,
    whyItMatters: row.whyItMatters,
    affectedNote: row.affectedNote,
    sections: readSections(verification),
    context: typeof row.context === "string" && row.context.length > 0 ? row.context : null,
    contextCleared: readSectionCleared(verification, "context"),
    watch: readWatch(row.watch),
    tickers: row.links,
    keyNumbers: readKeyNumbers(extract.key_numbers),
    summary: typeof extract.summary === "string" ? extract.summary : "",
    image: row.image,
    articles: readArticles(row.articles),
    modelMeta: readModelMeta(row.modelMeta),
  };
}

/** The four verdicts the gate may record for a section (PD7). Anything else is not a status. */
const SECTION_STATUSES: ReadonlySet<string> = new Set([
  "narrated",
  "dropped",
  "silent",
  "out_of_budget",
]);

/** The `verification.sections.<field>` sub-record, or null when the row has no sections map. */
function sectionRecord(
  verification: Record<string, unknown>,
  field: string,
): Record<string, unknown> | null {
  const sections = isRecord(verification.sections) ? verification.sections : null;
  if (!sections) return null;
  return isRecord(sections[field]) ? sections[field] : null;
}

/**
 * The gate's verdict for one field — the v2 `sections` map, with ONE documented v1 fallback.
 *
 * PD7 shipped the `sections` map ALONGSIDE the old `verification.dropped` boolean, because a
 * pre-PD7 production row carries `dropped` and no sections map at all. This is the single reader
 * that reconciles the two: it prefers the per-section verdict, and only when there is none does it
 * fall back to the old whole-note `dropped` flag — and only for `why_it_matters`, the one field the
 * v1 shape knew about. So `verification.dropped` is read in EXACTLY one place, as a version
 * fallback, rather than by two live readers competing (which PD7 warned against retiring into).
 */
function readSectionStatus(
  verification: Record<string, unknown>,
  field: string,
): SectionStatus | null {
  const section = sectionRecord(verification, field);
  const status = section?.status;
  if (typeof status === "string" && SECTION_STATUSES.has(status)) {
    return status as SectionStatus;
  }
  // v1 fallback: a pre-PD7 row recorded only whether the WHOLE note was gate-dropped.
  if (field === "why_it_matters" && verification.dropped === true) return "dropped";
  return null;
}

function readSections(verification: Record<string, unknown>): SectionVerdicts {
  return {
    whyItMatters: readSectionStatus(verification, "why_it_matters"),
    affectedNote: readSectionStatus(verification, "affected_note"),
    context: readSectionStatus(verification, "context"),
    watch: readSectionStatus(verification, "watch"),
  };
}

/** The figures the gate cleared inside one section — the KeyFigure allow-list (E5). None if absent. */
function readSectionCleared(verification: Record<string, unknown>, field: string): string[] {
  const cleared = sectionRecord(verification, field)?.cleared;
  if (!Array.isArray(cleared)) return [];
  return cleared.filter((value): value is string => typeof value === "string" && value.length > 0);
}

/** The snapshotted watch rows, defensively. A row missing its title or date is dropped, not shown. */
function readWatch(value: unknown): WatchRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { stat_id, key, code, kind, title, date } = entry;
    if (typeof title !== "string" || title.length === 0) return [];
    if (typeof date !== "string" || date.length === 0) return [];
    return [
      {
        statId: typeof stat_id === "string" ? stat_id : "",
        key: typeof key === "string" ? key : "",
        code: typeof code === "string" ? code : "",
        kind: typeof kind === "string" ? kind : "",
        title,
        date,
      },
    ];
  });
}

/** The model provenance, or null when the row predates it (pre-PD7). A shell with no fields is null. */
function readModelMeta(value: unknown): NewsModelMeta | null {
  if (!isRecord(value)) return null;
  const modelExtract = typeof value.model_extract === "string" ? value.model_extract : null;
  const modelSynth = typeof value.model_synth === "string" ? value.model_synth : null;
  const extractCount = typeof value.extract_count === "number" ? value.extract_count : null;
  const noteVersion = typeof value.note_version === "number" ? value.note_version : null;
  if (modelExtract === null && modelSynth === null && extractCount === null && noteVersion === null) {
    return null;
  }
  return { modelExtract, modelSynth, extractCount, noteVersion };
}

/**
 * A model id ("claude-sonnet-5") as a reader-facing name ("Claude Sonnet 5") for the provenance
 * footer. There is deliberately NO per-model lookup table — a table is a thing that rots the day a
 * new model ships, and this build has been bitten by hardcoded model names before. The transform is
 * STRUCTURAL: words are title-cased, and the trailing version digits join with dots. An id it cannot
 * make sense of is returned unchanged rather than mangled.
 */
export function formatModel(id: string): string {
  const parts = id.split("-").filter((part) => part.length > 0);
  if (parts.length === 0) return id;

  const words: string[] = [];
  const version: string[] = [];
  for (const part of parts) {
    // A pure-digit part AFTER the name words is a version segment ("4", "5"); a leading digit is a
    // word (nothing we ship starts with one, but "gpt-4o" would keep "4o" as a word, not a version).
    if (/^\d+$/.test(part) && words.length > 0) version.push(part);
    else words.push(part);
  }

  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return version.length > 0 ? `${name} ${version.join(".")}` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The extractor's key numbers, or none. A malformed entry is dropped, never rendered half-formed. */
function readKeyNumbers(value: unknown): KeyNumber[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const number = entry.value_str;
    const what = entry.what;
    if (typeof number !== "string" || number.length === 0) return [];
    return [{ value: number, what: typeof what === "string" ? what : "" }];
  });
}

/** The articles behind the story, oldest first — the thing the corroboration count counts. */
function readArticles(value: unknown): NewsArticle[] {
  if (!Array.isArray(value)) return [];
  const articles = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { source, url, headline, published } = entry;
    if (typeof source !== "string" || typeof url !== "string") return [];
    const at = new Date(typeof published === "string" || published instanceof Date ? published : "");
    if (Number.isNaN(at.getTime())) return [];
    return [{ source, url, headline: typeof headline === "string" ? headline : "", published: at }];
  });
  return articles.sort((a, b) => a.published.getTime() - b.published.getTime());
}
