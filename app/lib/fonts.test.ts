import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * fonts.test.ts — the load strategy of the four typefaces, pinned to the source (ruling R2, CC1).
 *
 * next/font's `display` value never reaches the DOM: it is compiled into the generated @font-face and
 * cannot be read from a rendered component. But it is the whole of ruling R2, and D1 is the proof of
 * what the wrong value costs — `optional` gives a face ~100ms and then keeps whatever fallback won
 * that race FOR THE WHOLE SESSION, so a cold cache or a post-deploy hash change ships the app in a
 * sans fallback until the next refresh (Bishan's "font renders wrong on some refreshes" bug). All
 * four families load `display: "swap"` now, and the only place that fact lives is the source — so the
 * source is what this pins, the same discipline the token sheet keeps (design-system.test.ts): a
 * contract a grep cannot see is a contract a test must guard.
 *
 * The regexes anchor on the trailing comma so they match the four real loader declarations and NOT
 * the prose in this file's own comments, which necessarily name both strings.
 */

const SOURCE = readFileSync(join(process.cwd(), "lib/fonts.ts"), "utf8");

describe("fonts.ts load strategy (R2)", () => {
  it('loads all four families with display: "swap" — never a whole session in the wrong voice', () => {
    const swaps = SOURCE.match(/display:\s*"swap",/g) ?? [];
    expect(swaps).toHaveLength(4);
  });

  it('gambles on display: "optional" nowhere (the D1 failure mode)', () => {
    expect(SOURCE).not.toMatch(/display:\s*"optional",/);
  });
});
