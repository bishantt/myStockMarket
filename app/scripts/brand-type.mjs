/**
 * brand-type.mjs — sets the OG card's two lines of type, as outlines.
 *
 * THE PROBLEM THIS SOLVES, because the obvious approach fails silently and that is the dangerous
 * kind of failure. sharp can render text (it has Pango inside it), and it accepts a `fontfile`
 * option, so the natural thing is to point it at the app's own fonts and be done. It does not work:
 * measured in PD2, the same string at the same size rendered to exactly 1135x159 pixels with our
 * MONOSPACE font, with our PROPORTIONAL font, and with no font named at all. Three different fonts
 * cannot set one string to one width — Pango was ignoring the file and quietly substituting
 * whatever the machine happened to have installed. The card would have shipped in a system font,
 * and it would have shipped in a DIFFERENT system font on the next person's machine, and nothing
 * anywhere would have said so.
 *
 * So no font is ever "resolved" here. The two strings are converted to VECTOR OUTLINES straight
 * from the vendored TTFs — the glyphs become <path> data, and the resulting SVG carries no font
 * reference at all. It renders identically on this Mac, on a CI runner, and on a machine with no
 * fonts installed, because by the time anything is rasterised there is no text left, only shapes.
 *
 * The fonts live in assets/brand/fonts/ — outside app/public/, like the logo master, so they are
 * build-time inputs and never ship to a browser. Both are SIL Open Font License; the licences are
 * committed beside them, which is what that licence asks in return.
 */
import opentype from "opentype.js";
import { readFileSync } from "node:fs";

/**
 * Load a font once, so a caller that sets several lines does not re-parse the file each time.
 * Keyed by path; the generator is a short-lived script, so there is nothing to invalidate.
 *
 * `parse` on bytes we read ourselves, not `loadSync` — opentype 2 deprecated the latter, and this
 * is the form it asks for.
 */
const cache = new Map();

export function loadFont(path) {
  if (!cache.has(path)) cache.set(path, opentype.parse(readFileSync(path)));
  return cache.get(path);
}

/**
 * Set one line of text as SVG path data, with optional letter-spacing.
 *
 * opentype's own `getPath` cannot letter-space — it lays out the string using the font's advance
 * widths and nothing else. The wordmark needs tracking (0.08em, the same tracking the in-app
 * wordmark carries), so the glyphs are walked by hand: take each character's path, shift it by the
 * distance travelled so far, and add the extra tracking to the advance. That is all letter-spacing
 * is.
 *
 * Returns the path data and the total advance width, because the caller has to know how wide the
 * line came out in order to place the next one under it.
 *
 * @param {object} font   an opentype.js font, from loadFont
 * @param {string} text   the string to set
 * @param {number} size   font size in px
 * @param {number} x      left edge (the pen's starting position)
 * @param {number} y      the BASELINE, not the top — this is type, not a box
 * @param {number} tracking  extra space after each glyph, in px
 */
export function setLine(font, text, { size, x, y, tracking = 0 }) {
  const scale = size / font.unitsPerEm;
  let pen = x;
  const parts = [];

  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(pen, y, size);
    const data = path.toPathData(3);
    // A space has no outline; it still has to move the pen.
    if (data) parts.push(data);
    pen += glyph.advanceWidth * scale + tracking;
  }

  return {
    d: parts.join(" "),
    // The final glyph does not need trailing tracking — the line ends at its right edge.
    width: pen - x - (text.length > 0 ? tracking : 0),
  };
}

/**
 * The width a line WOULD take, without setting it. Used to centre or right-align without
 * rendering twice.
 */
export function measureLine(font, text, { size, tracking = 0 }) {
  return setLine(font, text, { size, x: 0, y: 0, tracking }).width;
}
