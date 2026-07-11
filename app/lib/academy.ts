import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * lib/academy.ts — the Academy lesson manifest and frontmatter loader (plan Appendix B/H, P5).
 *
 * Lessons are MDX files under `content/academy/<module>/<slug>.mdx`, each with frontmatter
 * (module, slug, title, minutes, concepts, questions). This module reads that frontmatter to build
 * the curriculum map — WITHOUT rendering the bodies — and exposes the set of known slugs so a
 * briefing or setup-card learning link only renders a doorway to a lesson that actually exists.
 *
 * Server-only (it reads the filesystem). The manifest is read once, synchronously, and cached for
 * the process — the lessons are static content, and a synchronous read keeps `isKnownLesson` a plain
 * predicate (the briefing/card view-model builders call it inline, not through a promise).
 */

const CONTENT_ROOT = path.join(process.cwd(), "content", "academy");

/** The module titles (plan Appendix H — the seven modules M0–M6, in order). */
export const MODULE_TITLES: Record<string, string> = {
  M0: "How the app explains itself",
  M1: "The market, in plain terms",
  M2: "What trading actually costs",
  M3: "Risk before patterns",
  M4: "Reading the chart honestly",
  M5: "Indicators, and their evidence",
  M6: "Behaviour and accountability",
};

/** One retrieval question and its answer (frontmatter), shown at the end of a lesson. */
export type LessonQuestion = { q: string; a: string };

/** A lesson's frontmatter — everything the curriculum map needs without reading the body. */
export type LessonMeta = {
  module: string;
  slug: string;
  title: string;
  minutes: number;
  concepts: string[];
  questions: LessonQuestion[];
  order: number;
};

let cached: LessonMeta[] | null = null;

/** The full lesson manifest, sorted by module then intra-module order. Read once and cached. */
export function getLessonManifest(): LessonMeta[] {
  cached ??= readManifest();
  return cached;
}

function readManifest(): LessonMeta[] {
  const lessons: LessonMeta[] = [];
  let moduleDirs: string[];
  try {
    moduleDirs = readdirSync(CONTENT_ROOT);
  } catch {
    return []; // no content yet — the Academy renders its empty state
  }

  for (const moduleDir of moduleDirs) {
    const dir = path.join(CONTENT_ROOT, moduleDir);
    if (!safeIsDir(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".mdx")) continue;
      const { data } = matter(readFileSync(path.join(dir, file), "utf8"));
      lessons.push(toMeta(data, file.replace(/\.mdx$/, "")));
    }
  }
  return lessons.sort((a, b) => a.module.localeCompare(b.module) || a.order - b.order);
}

function safeIsDir(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** Normalise a lesson's frontmatter into LessonMeta, tolerating missing optional fields. */
function toMeta(data: Record<string, unknown>, fallbackSlug: string): LessonMeta {
  return {
    module: String(data.module ?? "M0"),
    slug: String(data.slug ?? fallbackSlug),
    title: String(data.title ?? fallbackSlug),
    minutes: Number(data.minutes ?? 3),
    concepts: Array.isArray(data.concepts) ? data.concepts.map(String) : [],
    questions: Array.isArray(data.questions)
      ? (data.questions as Record<string, unknown>[]).map((q) => ({ q: String(q.q ?? ""), a: String(q.a ?? "") }))
      : [],
    order: Number(data.order ?? 0),
  };
}

/** One lesson's frontmatter by slug, or null if unknown. */
export function getLessonMeta(slug: string): LessonMeta | null {
  return getLessonManifest().find((lesson) => lesson.slug === slug) ?? null;
}

/** Read one lesson's raw MDX source (frontmatter + body), or null if the slug is unknown. */
export function getLessonSource(slug: string): string | null {
  const meta = getLessonMeta(slug);
  if (!meta) return null;
  const file = path.join(CONTENT_ROOT, meta.module.toLowerCase(), `${slug}.mdx`);
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * True if a slug names a lesson that exists — the doorway gate. A briefing or setup-card learning
 * link renders a Learn doorway only when this returns true, so an unmatched slug simply carries no
 * doorway (which is how the early, lesson-less phases behaved with an empty manifest).
 */
export function isKnownLesson(slug: string): boolean {
  return getLessonManifest().some((lesson) => lesson.slug === slug);
}
