/**
 * icons.mjs — generates every app icon from the single source, public/mark.svg.
 *
 *     npm run icons
 *
 * Run it whenever the mark changes. One glyph in, the whole icon set out, so the icons can never
 * drift from each other or from the nav's logo.
 *
 * The mark (D3) is the brand-gradient tile with a white "M". Because the tile IS the icon — it
 * already has its own rounded background — most sizes render it edge to edge rather than
 * compositing a glyph onto a coloured field. Two exceptions:
 *
 *   · the MASKABLE icon, where the OS may clip the outer 20% to a circle or a squircle. Its own
 *     rounded corners would be cropped into something lumpy, so the tile is inset inside a solid
 *     brand-coloured field: whatever shape the OS carves, it carves brand colour.
 *   · the MONOCHROME icon, which Android tints itself and therefore must be a single colour on a
 *     transparent field. It uses the glyph-only source instead.
 *
 * The four brand values below are mirrored from globals.css. This script, globals.css,
 * lib/tokens.ts and the two mark SVGs are the only places a hex colour may appear.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** The gradient's first stop — the solid field behind the maskable icon's safe zone. */
const BRAND = "#4f46e5";
const WHITE = "#ffffff";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const publicDir = join(appRoot, "public");
const iconsDir = join(publicDir, "icons");

/** Rasterise an SVG file at a given size, optionally binding `currentColor` to a real colour. */
async function raster(file, size, color) {
  const raw = await readFile(join(publicDir, file), "utf8");
  const svg = color ? raw.replaceAll("currentColor", color) : raw;
  // density scales the SVG crisply to the target — 512px from a 96-unit viewBox needs the hint.
  return sharp(Buffer.from(svg), { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** The tile, edge to edge. Its own rounded corners are the icon's shape. */
async function fullBleed(size) {
  return raster("mark.svg", size);
}

/**
 * The tile, inset inside a solid brand field so the OS's mask has colour to bite into.
 *
 * `coverage` of 0.72 keeps every corner of the tile inside the safe zone (the outer 20%), so a
 * circular mask never clips the letter and never exposes a bare corner.
 */
async function maskable(size) {
  const inner = await raster("mark.svg", Math.round(size * 0.72));
  const field = sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  });
  return field.composite([{ input: inner, gravity: "centre" }]).png().toBuffer();
}

/** The glyph alone, in white, on transparent — Android tints this one itself. */
async function monochrome(size) {
  const glyph = await raster("mark-glyph.svg", Math.round(size * 0.72), WHITE);
  const field = sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  return field.composite([{ input: glyph, gravity: "centre" }]).png().toBuffer();
}

/**
 * Every icon the app ships, with a one-line reason each. The filenames are unchanged from the
 * previous mark on purpose: the manifest and the service worker's precache list both reference
 * them by path, and churning the paths would churn the precache for no reason.
 */
const ICONS = [
  { file: "icons/icon-192.png", size: 192, render: fullBleed, note: "Android home screen" },
  { file: "icons/icon-512.png", size: 512, render: fullBleed, note: "splash / high-res" },
  { file: "icons/icon-maskable-512.png", size: 512, render: maskable, note: "maskable — 20% safe zone" },
  { file: "icons/icon-monochrome-96.png", size: 96, render: monochrome, note: "monochrome — OS-tinted" },
  { file: "apple-touch-icon.png", size: 180, render: fullBleed, note: "iOS home screen" },
  { file: "favicon.png", size: 48, render: fullBleed, note: "browser tab" },
];

await mkdir(iconsDir, { recursive: true });

for (const icon of ICONS) {
  const png = await icon.render(icon.size);
  await writeFile(join(publicDir, icon.file), png);
  console.log(`  ${String(icon.size).padStart(3)}px  ${icon.file.padEnd(32)} ${icon.note}`);
}

console.log(`\nGenerated ${ICONS.length} icons from public/mark.svg.`);
