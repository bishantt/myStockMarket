import { describe, expect, it } from "vitest";

import { getLessonManifest, getLessonMeta, getLessonSource, isKnownLesson } from "@/lib/academy";

/**
 * Tests for lib/academy.ts — the frontmatter loader and the doorway gate (plan P5 step 1). These
 * read the real content/academy MDX files, so they also prove the M0 lessons parse.
 */

describe("the Academy manifest", () => {
  it("loads the authored M0 lessons with their frontmatter", () => {
    const manifest = getLessonManifest();
    const slugs = manifest.map((l) => l.slug);
    expect(slugs).toContain("how-this-app-explains-itself");
    expect(slugs).toContain("reading-a-base-rate-sentence");
    const first = getLessonMeta("how-this-app-explains-itself");
    expect(first?.module).toBe("M0");
    expect(first?.minutes).toBeGreaterThan(0);
    expect(first?.questions.length).toBeGreaterThanOrEqual(2); // 2–3 retrieval questions
  });

  it("orders lessons within a module by their frontmatter order", () => {
    const m0 = getLessonManifest().filter((l) => l.module === "M0");
    const orders = m0.map((l) => l.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("gates doorways on real lessons — known slug true, unknown false", () => {
    expect(isKnownLesson("reading-a-base-rate-sentence")).toBe(true);
    expect(isKnownLesson("a-lesson-that-does-not-exist")).toBe(false);
  });

  it("reads a lesson's raw source, and returns null for an unknown slug", () => {
    expect(getLessonSource("reading-a-base-rate-sentence")).toContain("reference class");
    expect(getLessonSource("nope")).toBeNull();
  });
});
