import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * design-system.test.ts — the token sheet, tested as the contract it is.
 *
 * Three things here cannot be caught by a grep and would each rot silently:
 *
 *  1. **The two dark blocks must stay identical.** `[data-theme="dark"]` (the explicit choice) and
 *     `[data-theme="system"]` (the OS following along) have to resolve to the same Midnight. They
 *     are two literal blocks in the CSS, because a custom property resolves at the nearest defining
 *     ancestor and there is no way to alias one to the other. Two literal blocks drift. This test
 *     parses the sheet and proves they have not.
 *
 *  2. **The contrast contract.** Every text/surface pair in §3.3 was hand-computed to clear WCAG AA
 *     (4.5:1, or 3:1 for figures ≥21px). A hand-computed number is a number that goes stale the
 *     first time someone nudges a hex. So the pairs are recomputed here from the sheet itself, and
 *     the build fails if one drops below its threshold. Drift-proof, not vibes-proof.
 *
 *     The honesty stake: `--color-muted` is the provenance colour — timestamps, sample sizes,
 *     sources, the "as of" stamps. The layer that tells the reader how much to trust a number must
 *     never be the least legible thing on the screen.
 *
 *  3. **The reserved region.** Amber–orange belongs to losses and the two alert consumers. A tier
 *     or grade colour that wanders into that hue range would drown the gate flag, so the hues are
 *     measured, not eyeballed.
 */

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

// ── reading the sheet ─────────────────────────────────────────────────────────────────────────

/** Pull one CSS block's body by its selector, e.g. `[data-theme="dark"]`. */
function block(selector: string): string {
  const start = CSS.indexOf(selector + " {");
  expect(start, `${selector} must exist in globals.css`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`${selector} is not closed`);
}

/** Every `--token: value;` declaration in a block, as a map. Comments and blank lines drop out. */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[match[1]] = match[2].trim().replace(/\s+/g, " ");
  }
  return out;
}

const LIGHT = declarations(block("@theme static"));
const DARK = declarations(block('[data-theme="dark"]'));
const SYSTEM = declarations(block('[data-theme="system"]'));

// ── colour maths (the smallest correct implementation, not a library) ─────────────────────────

type Rgb = { r: number; g: number; b: number };

/** Parse the two colour forms the sheet uses: `#rrggbb` and `rgb(r g b / a)`. */
function parseColor(value: string): Rgb | null {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  return null;
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Composite a possibly-translucent colour over an opaque backdrop, then measure contrast against
 * it. The surfaces in this system are glass — measuring text against `rgb(255 255 255 / 0.72)` as
 * if it were opaque white would flatter every pair by a little, and the whole point of the test is
 * to not flatter anything.
 */
function over(value: string, backdrop: Rgb): Rgb {
  const base = parseColor(value);
  if (base === null) throw new Error(`cannot parse colour: ${value}`);
  const alphaMatch = value.match(/\/\s*([\d.]+)\s*\)/);
  const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
  return {
    r: base.r * alpha + backdrop.r * (1 - alpha),
    g: base.g * alpha + backdrop.g * (1 - alpha),
    b: base.b * alpha + backdrop.b * (1 - alpha),
  };
}

function contrast(fg: Rgb, bg: Rgb): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** RGB → hue in degrees. Used only to police the reserved amber–orange region. */
function hue({ r, g, b }: Rgb): number {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// ── 1. the two dark blocks stay in lockstep ──────────────────────────────────────────────────

describe("the theme blocks", () => {
  it("keeps [data-theme='system'] byte-identical to [data-theme='dark']", () => {
    // If these two ever drift, a user on "System" in a dark OS sees a different Midnight from a
    // user who chose Dark explicitly — the same app, two palettes, and nobody would notice for
    // weeks. The duplication is unavoidable in CSS; the drift is not.
    expect(SYSTEM).toEqual(DARK);
  });

  it("overrides every colour token the light theme defines", () => {
    // A token defined in light but forgotten in dark keeps its LIGHT value under Midnight — which
    // is how you get one white card glowing in a dark room. Colours, gradients, shadows and orbs
    // are theme-scoped; type, shape, motion and layout tokens are not, by design.
    const themed = (name: string) =>
      name.startsWith("--color-") || name.startsWith("--gradient-") ||
      name.startsWith("--shadow-") || name.startsWith("--orb-");

    // The brand is the one deliberate exception. The mark, the primary button and the login panel
    // carry the SAME indigo→violet gradient in both themes — it is already midnight-toned (§5.7),
    // and a brand that changes colour with the lights is not a brand. What reads well ON that
    // gradient therefore does not change either, so its text and rule colours are invariant too.
    const THEME_INVARIANT = [
      "--gradient-brand",
      "--gradient-brand-grid",
      "--color-on-brand",
      "--color-on-brand-soft",
      "--color-on-brand-tile",
      "--color-on-brand-rule",
    ];

    const missing = Object.keys(LIGHT)
      .filter(themed)
      .filter((token) => !THEME_INVARIANT.includes(token))
      .filter((token) => !(token in DARK));

    expect(missing).toEqual([]);
  });
});

// ── 2. the contrast contract ─────────────────────────────────────────────────────────────────

/**
 * The pairs the design depends on. `min` is 4.5 for body text and 3.0 where the token is only ever
 * used at ≥21px (the semantic pair on figures) or as a non-text mark.
 */
const PAIRS: Array<{ fg: string; on: string; min: number; why: string }> = [
  { fg: "--color-ink", on: "--color-surface", min: 4.5, why: "primary text on a card" },
  { fg: "--color-ink", on: "--color-paper", min: 4.5, why: "primary text on the page" },
  { fg: "--color-ink-2", on: "--color-surface", min: 4.5, why: "secondary text" },
  { fg: "--color-muted", on: "--color-surface", min: 4.5, why: "PROVENANCE — the honesty layer" },
  { fg: "--color-muted", on: "--color-paper", min: 4.5, why: "provenance on the page plane" },
  { fg: "--color-accent-deep", on: "--color-surface", min: 4.5, why: "links and interactive text" },
  { fg: "--color-up-text", on: "--color-surface", min: 4.5, why: "a gain, in small type" },
  { fg: "--color-down-text", on: "--color-surface", min: 4.5, why: "a loss, in small type" },
  { fg: "--color-tier-strong", on: "--color-surface", min: 4.5, why: "tier word: strong" },
  { fg: "--color-tier-moderate", on: "--color-surface", min: 4.5, why: "tier word: moderate" },
  { fg: "--color-tier-weak", on: "--color-surface", min: 4.5, why: "tier word: weak" },
  { fg: "--color-grade-supported", on: "--color-surface", min: 4.5, why: "grade word: supported" },
  { fg: "--color-grade-mixed", on: "--color-surface", min: 4.5, why: "grade word: mixed" },
  { fg: "--color-grade-weak", on: "--color-surface", min: 4.5, why: "grade word: weak" },
  { fg: "--color-grade-folklore", on: "--color-surface", min: 4.5, why: "grade word: folklore" },
  { fg: "--color-alert", on: "--color-surface", min: 4.5, why: "the verification-gate flag" },
  { fg: "--color-up", on: "--color-surface", min: 3.0, why: "gain, chart stroke / ≥21px figure" },
  { fg: "--color-down", on: "--color-surface", min: 3.0, why: "loss, chart stroke / ≥21px figure" },
];

describe.each([
  { theme: "Morning (light)", tokens: LIGHT, paper: LIGHT["--color-paper"] },
  { theme: "Midnight (dark)", tokens: { ...LIGHT, ...DARK }, paper: DARK["--color-paper"] },
])("the contrast contract — $theme", ({ tokens, paper }) => {
  const backdrop = parseColor(paper)!;

  it.each(PAIRS)("$fg on $on clears $min:1 — $why", ({ fg, on, min }) => {
    // Surfaces are glass, so composite them over the page plane before measuring. Text is opaque.
    const surface = over(tokens[on], backdrop);
    const text = over(tokens[fg], surface);
    const ratio = contrast(text, surface);
    expect(
      Number(ratio.toFixed(2)),
      `${fg} on ${on} measured ${ratio.toFixed(2)}:1, below the ${min}:1 floor`,
    ).toBeGreaterThanOrEqual(min);
  });
});

// ── 3. the reserved amber–orange region ──────────────────────────────────────────────────────

describe("the reserved amber–orange region (§3.3, P11)", () => {
  /**
   * The band, in hue degrees. It is derived from the colours it protects, not guessed: the six
   * rightful occupants (the loss pair and the alert pair, in both themes) measure 17.5°–39.3°.
   */
  const RESERVED = (h: number) => h >= 17 && h <= 50;

  /** Losses, and amber's two alert consumers. Nothing else may sit here. */
  const OCCUPANTS = ["--color-alert", "--color-down", "--color-down-text"];

  /**
   * Tiers, module hues, and the two *middle* evidence grades are policed.
   *
   * `grade-weak` (rust, ~13-16°) and `grade-folklore` (red, 0°) are deliberately NOT policed: the
   * plan places them outside the amber band's centre by design, and both always render with their
   * word beside them, so neither can be mistaken for an alert even in peripheral vision. Policing
   * them would be the test fighting the palette rather than protecting it.
   */
  const policedTokens = (tokens: Record<string, string>) =>
    Object.keys(tokens).filter(
      (t) =>
        !t.endsWith("-wash") &&
        (t.startsWith("--color-tier-") ||
          t.startsWith("--color-module-") ||
          t === "--color-grade-supported" ||
          t === "--color-grade-mixed"),
    );

  it.each([
    { theme: "Morning", tokens: LIGHT },
    { theme: "Midnight", tokens: { ...LIGHT, ...DARK } },
  ])("$theme — no tier, module, or middle-grade hue trespasses into it", ({ tokens }) => {
    const trespassers = policedTokens(tokens).filter((token) => {
      const rgb = parseColor(tokens[token]);
      return rgb !== null && RESERVED(hue(rgb));
    });

    expect(
      trespassers,
      "a chip in the amber band drowns the gate flag, even with a different hex",
    ).toEqual([]);
  });

  it.each([
    { theme: "Morning", tokens: LIGHT },
    { theme: "Midnight", tokens: { ...LIGHT, ...DARK } },
  ])("$theme — the region's rightful occupants ARE in it", ({ tokens }) => {
    // The mirror of the rule above. If the alert colour drifted out of the amber band, the
    // reservation would be protecting an empty room.
    for (const token of OCCUPANTS) {
      const rgb = parseColor(tokens[token])!;
      expect(RESERVED(hue(rgb)), `${token} should sit in the amber–orange band`).toBe(true);
    }
  });
});
