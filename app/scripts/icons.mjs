/**
 * icons.mjs — generates every app icon from the single source, public/mark.svg.
 *
 *     node scripts/icons.mjs
 *
 * Run it whenever the mark changes. One glyph in, the whole icon set out, so the icons can
 * never drift from each other or from the nav logo. The plan (§5.1) calls for 192/512 plus a
 * 512 maskable and a 96 monochrome; iOS additionally needs a 180 apple-touch-icon and the
 * browser tab wants a favicon.
 *
 * Colour comes from the tokens, not from the SVG: mark.svg is drawn in `currentColor`, and this
 * script substitutes the real ink and bone at render time. That is why the same glyph can be
 * ink-on-bone here and inherit the nav's text colour there.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The two brand values, mirrored from globals.css / lib/tokens.ts. This script and those two
// files are the only places a hex colour is allowed (plan §3.10). Bone is the icon background;
// ink is the mark.
const INK = "#141511";
const BONE = "#f4f5f3";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const publicDir = join(appRoot, "public");
const iconsDir = join(publicDir, "icons");

/** The glyph, with `currentColor` bound to a concrete colour so sharp can rasterise it. */
async function markSvg(color) {
  const raw = await readFile(join(publicDir, "mark.svg"), "utf8");
  return Buffer.from(raw.replaceAll("currentColor", color));
}

/**
 * Renders one icon: the mark, scaled to `coverage` of the canvas and centred, over a solid
 * background (or transparent).
 *
 * `coverage` is the fraction of the icon's width the glyph spans. A normal icon fills most of
 * the tile; a maskable icon must keep its glyph inside the safe zone (the outer 20% can be
 * clipped to a circle or squircle by the OS), so it uses a smaller coverage and more padding.
 *
 * @param size      output width and height in pixels
 * @param coverage  0..1, how much of the width the glyph occupies
 * @param glyphColor the mark's colour
 * @param background a hex colour, or null for a transparent field (monochrome icons)
 */
async function renderIcon({ size, coverage, glyphColor, background }) {
  const glyphSize = Math.round(size * coverage);
  // density scales the SVG raster crisply to the target — 512px from a 96-unit viewBox needs it.
  const glyph = await sharp(await markSvg(glyphColor), { density: 512 })
    .resize(glyphSize, glyphSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  return canvas.composite([{ input: glyph, gravity: "centre" }]).png().toBuffer();
}

/**
 * Every icon the app ships, with a one-line reason each. Paths are relative to public/.
 * `coverage` encodes the plan's padding rules: normal icons ~0.66, the maskable icon 0.56 so
 * the glyph clears the safe zone, apple-touch a touch tighter because iOS rounds the corners.
 */
const ICONS = [
  { file: "icons/icon-192.png", size: 192, coverage: 0.66, glyphColor: INK, background: BONE, note: "Android home screen" },
  { file: "icons/icon-512.png", size: 512, coverage: 0.66, glyphColor: INK, background: BONE, note: "splash / high-res" },
  { file: "icons/icon-maskable-512.png", size: 512, coverage: 0.56, glyphColor: INK, background: BONE, note: "maskable — glyph inside the safe zone" },
  { file: "icons/icon-monochrome-96.png", size: 96, coverage: 0.72, glyphColor: INK, background: null, note: "monochrome — ink glyph, transparent field" },
  { file: "apple-touch-icon.png", size: 180, coverage: 0.62, glyphColor: INK, background: BONE, note: "iOS home screen" },
  { file: "favicon.png", size: 48, coverage: 0.78, glyphColor: INK, background: BONE, note: "browser tab" },
];

await mkdir(iconsDir, { recursive: true });

for (const icon of ICONS) {
  const png = await renderIcon(icon);
  await writeFile(join(publicDir, icon.file), png);
  console.log(`  ${String(icon.size).padStart(3)}px  ${icon.file.padEnd(32)} ${icon.note}`);
}

console.log(`\nGenerated ${ICONS.length} icons from public/mark.svg.`);
