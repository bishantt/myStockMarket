# new-lesson

**Status:** MINTED at P5 step 2 (2026-07-11), after the first two M0 lessons. Follow it for every
Academy lesson — from here they are a production line.

**When to use:** authoring any Academy lesson MDX under `content/academy/<module>/<slug>.mdx`.

## Steps
1. **File + path:** `content/academy/<module-lowercase>/<slug>.mdx`, where `<slug>` is the
   contractual Appendix H slug (do not invent slugs — the 25 are fixed) and `<module>` is m0–m6.
2. **Frontmatter (YAML), every field:**
   ```
   ---
   module: M0            # M0–M6, uppercase
   slug: <appendix-H-slug>
   title: <sentence case, plain>
   minutes: 3            # 3–5, honest reading time
   concepts: [glossary-key, ...]   # the glossary terms this lesson teaches (Appendix I keys)
   order: 1             # position within the module
   questions:            # 2–3 retrieval questions (Appendix H requirement)
     - q: <a question the reader should be able to answer after reading>
       a: <the answer, one or two sentences>
   ---
   ```
   `slug` and `module` are what the loader (`lib/academy.ts`) reads for the curriculum map and the
   doorway gate; a lesson's slug becoming known lights up any brief/card learning link to it
   automatically (no code change).
3. **Body (MDX → markdown):** mechanical-honest third person (plan §3.9); short sentences, plain
   words; **no live prices, ever** (§1.5). A myth-vs-evidence lesson **cites its Research Report
   Part 4/5/6 verdict and shows the evidence grade** — name the ledger finding, don't hand-wave.
   Use `##` for sections, `**bold**` for the term being defined, `>` for a worked sentence, and
   plain internal links (`/track-record`, `/academy/<other-slug>`) for doorways. The mdxComponents
   map in `app/academy/[slug]/page.tsx` styles these into Newsreader prose at 65ch.
4. **The lesson TEACHES the app's own honesty:** where a concept has a guardrail (base rate → N-gate
   + baseline + interval; vol band → regime caveat; folklore → labelled), the lesson explains WHY the
   guardrail exists, not just what the term means.
5. **Register nothing** — the loader discovers the file. But add each new `concepts` key to the
   glossary seed (P5 step 3) so the terms resolve.
6. **Verify:** `npx vitest run lib/academy.test.ts` (frontmatter parses), then load `/academy` and
   the lesson in the app — the questions render, the prose measures ~65ch, no price appears.

## Verification
- The lesson appears on `/academy` under its module, links, and reads with its retrieval questions.
- A myth lesson names its RR ledger verdict + grade. No live prices. Voice is mechanical third person.

## Worked example — the first two (P5 step 2)
`content/academy/m0/how-this-app-explains-itself.mdx` and `reading-a-base-rate-sentence.mdx` — each
teaches the base-rate honesty machinery (N-gate, always-up baseline, Wilson interval, the WEAK cap)
and closes with 2 retrieval questions. `lib/academy.test.ts` proves they parse; `e2e/academy.spec.ts`
proves the room and a lesson render.
