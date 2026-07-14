/**
 * brand-assets.mjs — the whole visual identity, generated from one master.
 *
 *     npm run brand        (npm run icons is an alias — there is one generator now)
 *
 * One file goes in: assets/brand/logo-source.png, the circular mark. Every icon, every favicon,
 * every in-app lockup and the link-preview card come out. Run it whenever the mark changes, and
 * nothing can drift from anything else, because nothing is drawn twice.
 *
 * It replaces scripts/icons.mjs, which generated six icons from the old gradient-"M" tile
 * (public/mark.svg). That tile is retired. Its glyph-only sibling, public/mark-glyph.svg, is NOT:
 * Android's monochrome themed icon must be a single flat colour on transparency, which a rendered
 * logo cannot be, so row 6 still comes from the glyph. That is the one place the old letterform
 * survives, and it survives on purpose (plan 5.1).
 *
 * THE MASTER IS NOT WHAT THE PLAN EXPECTED, and the difference is handled rather than hidden.
 * Plan PP-1 describes "the circular mark on transparency". The file that arrived has NO alpha
 * channel at all — the image tool that produced it painted the transparency CHECKERBOARD into the
 * pixels. Left alone, every icon in this app would ship with a grey-and-white chequered box around
 * the mark. scripts/brand-geometry.mjs keys that background out and fits the mark's true circle;
 * see keyBackground() and fitDisc() there for how, and why it is safe. Logged in DECISIONS.md.
 *
 * DETERMINISM. Same master in, same bytes out, on any machine. Nothing here resolves a system font
 * or reaches the network: the OG card's type is converted to vector outlines from the two TTFs
 * vendored in assets/brand/fonts/ (see brand-type.mjs, which explains why the obvious approach —
 * handing sharp a fontfile — silently does not work).
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { keyBackground, fitDisc, discAlpha, maskableGeometry, overBudget } from "./brand-geometry.mjs";
import { loadFont, setLine } from "./brand-type.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "..");
const publicDir = join(appRoot, "public");
const iconsDir = join(publicDir, "icons");
const brandDir = join(repoRoot, "assets", "brand");
const MASTER = join(brandDir, "logo-source.png");

/**
 * THE FIELD COLOUR — the mark's own navy, and the only brand hex this script may state.
 *
 * It is not chosen, it is MEASURED: sampled from the master's centre-left region (inside the ring,
 * left of the M's stroke), where the field is undisturbed. The value below is what that sample
 * returned on the committed master, and the script asserts the sample still matches it before it
 * generates anything.
 *
 * That assertion is the point. Swap the master for a differently-tinted logo and this script does
 * not quietly re-tint every maskable icon and the OG card to a colour nobody chose — it stops and
 * says the field moved. A build that changes twenty files because one file changed should have to
 * announce itself.
 *
 * Hex discipline (plan 5.1): a brand hex may appear in app/globals.css, lib/tokens.ts, the mark
 * SVGs, and here. Anti-drift rule 23 enforces the "and here" — see scripts/check-drift.mjs.
 */
const BRAND_FIELD = "#121336";
/** How far the sample may drift before we call it a different logo. The field is a soft gradient,
 *  so a few levels of wobble is the artwork, not a new brand. */
const FIELD_TOLERANCE = 12;

/** The mark's own off-white, for the monochrome glyph. Not a brand colour — just white. */
const WHITE = "#ffffff";

/**
 * THE PNG ENCODER SETTINGS, AND THEY ARE LOAD-BEARING.
 *
 * The mark this app replaced was flat vector art: the old 512px icon was 19KB. This one is a
 * rendered illustration with gradients and a soft shadow, and encoded straight it is 300KB — a
 * single icon, two and a half times the whole icon set's 120KB budget (plan 5.2). The budget check
 * at the bottom of this file caught that on the first run, which is the entire reason it exists.
 *
 * Palette quantisation is what closes the gap, and it is safe HERE for a reason worth stating: the
 * artwork has a small true palette — a navy field, a violet ring, near-white glyphs — so an indexed
 * palette reproduces it almost exactly.
 *
 * If the artwork is ever replaced with something photographic, this is the first thing that breaks,
 * and the budget check is what will tell you.
 *
 * Two settings, because the two jobs are different. ICON_PNG caps the palette at 128 entries, which
 * is what finally brings the icon set inside its budget (the 512px icon: 300KB straight, 84KB at
 * 256 colours, 31KB at 128 — and at 128 the only difference a person can find is a faint dither in
 * the field, at a size no one inspects). CARD_PNG keeps the full 256, because the OG card carries
 * TYPE, and quantising letterforms is where banding actually becomes visible. The card has a 300KB
 * budget of its own and spends a fifth of it, so there is nothing to buy by squeezing it.
 */
const ICON_PNG = { palette: true, colours: 128, effort: 10, compressionLevel: 9 };
const CARD_PNG = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };

const FONTS = {
  mono: join(brandDir, "fonts", "JetBrainsMono-Medium.ttf"),
  sans: join(brandDir, "fonts", "Inter-Regular.ttf"),
};

// ── the master ────────────────────────────────────────────────────────────────────────────────

/**
 * Read the master, check it is the logo we think it is, and cut it out of its painted background.
 *
 * Returns the mark as a square RGBA buffer, trimmed to its own circle: the disc touches all four
 * edges. Everything downstream can then say "the mark at 77% of the canvas" and mean it, because
 * "the mark" now has exactly one meaning.
 */
async function loadMark() {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  if (width !== height) throw new Error(`the master must be square; it is ${width}x${height}`);
  if (width < 1024) throw new Error(`the master must be at least 1024px; it is ${width}px`);

  const background = keyBackground(data, width, height, channels);
  const disc = fitDisc(background, width, height);

  // A sanity check on the keying itself. The mark is a disc: it should occupy roughly pi/4 (79%)
  // of its own bounding square, and the master frames it with a margin, so it lands near 55-65% of
  // the whole image. Far outside that and the keying has eaten the mark or kept the background,
  // and generating twenty icons from it would be worse than stopping.
  const coverage = disc.kept / (width * height);
  if (coverage < 0.35 || coverage > 0.85) {
    throw new Error(
      `the keyed mark covers ${(coverage * 100).toFixed(1)}% of the master — expected 35-85%. ` +
        `The background did not key cleanly; look at the master before trusting this run.`,
    );
  }

  assertFieldColour(data, info, disc);

  const alpha = discAlpha(background, width, height, disc);
  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    rgba[p * 4] = data[p * channels];
    rgba[p * 4 + 1] = data[p * channels + 1];
    rgba[p * 4 + 2] = data[p * channels + 2];
    rgba[p * 4 + 3] = alpha[p];
  }

  // Crop to the fitted disc's exact bounding square, so the returned mark IS the circle.
  const size = Math.round(disc.radius * 2);
  const left = Math.round(disc.cx - disc.radius);
  const top = Math.round(disc.cy - disc.radius);
  const mark = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: size, height: size })
    .png()
    .toBuffer();

  return { mark, disc, coverage };
}

/**
 * Sample the field and compare it with BRAND_FIELD. See the constant for why this exists.
 * The sample sits at 73% of the radius to the left of centre — inside the ring, clear of the M.
 */
function assertFieldColour(data, info, disc) {
  const { width, channels } = info;
  const { cx, cy, radius } = disc;
  const x0 = Math.round(cx - radius * 0.80), x1 = Math.round(cx - radius * 0.66);
  const y0 = Math.round(cy - radius * 0.12), y1 = Math.round(cy + radius * 0.12);

  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  const sampled = [r / n, g / n, b / n].map((v) => Math.round(v));
  const expected = [1, 3, 5].map((i) => parseInt(BRAND_FIELD.slice(i, i + 2), 16));
  const drift = Math.max(...sampled.map((v, i) => Math.abs(v - expected[i])));

  const hex = "#" + sampled.map((v) => v.toString(16).padStart(2, "0")).join("");
  if (drift > FIELD_TOLERANCE) {
    throw new Error(
      `the master's field colour is ${hex}, but BRAND_FIELD says ${BRAND_FIELD} (drift ${drift}). ` +
        `Either the logo changed — in which case update BRAND_FIELD, globals.css and lib/tokens.ts ` +
        `together — or the wrong file is at assets/brand/logo-source.png.`,
    );
  }
  console.log(`  field sampled ${hex}  matches BRAND_FIELD ${BRAND_FIELD}  (drift ${drift})`);
}

// ── the geometries ────────────────────────────────────────────────────────────────────────────

/** The mark, edge to edge, on transparency. The mark IS circular, so it needs no frame. */
async function fullBleed(mark, size) {
  return sharp(mark).resize(size, size, { fit: "fill", kernel: "lanczos3" }).png(ICON_PNG).toBuffer();
}

/**
 * The mark inset on an opaque brand field, for the masks an OS may carve.
 *
 * `coverage` is the mark's diameter as a share of the canvas. See maskableGeometry() for the
 * arithmetic and for what the 40% safe zone actually promises.
 */
async function onField(mark, size, coverage) {
  const geometry = maskableGeometry(size, { coverage });
  if (!geometry.fitsSafeZone) {
    throw new Error(
      `at ${(coverage * 100).toFixed(0)}% the mark's radius is ${geometry.markRadius}px on a ${size}px ` +
        `canvas, outside the ${geometry.safeZoneRadius}px safe zone — the OS would clip the ring off.`,
    );
  }
  const inner = await sharp(mark)
    .resize(geometry.mark, geometry.mark, { fit: "fill", kernel: "lanczos3" })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_FIELD } })
    .composite([{ input: inner, top: geometry.offset, left: geometry.offset }])
    .png(ICON_PNG)
    .toBuffer();
}

/**
 * iOS applies its own corner mask to an opaque square and renders transparency as BLACK, so the
 * apple-touch icon must carry its own field. It is not a maskable icon — iOS only rounds the
 * corners — so the mark can sit much larger than the 77% the Android safe zone demands.
 */
async function appleTouch(mark, size) {
  const inner = Math.round(size * 0.88);
  const offset = Math.round((size - inner) / 2);
  const scaled = await sharp(mark).resize(inner, inner, { fit: "fill", kernel: "lanczos3" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_FIELD } })
    .composite([{ input: scaled, top: offset, left: offset }])
    .png(ICON_PNG)
    .toBuffer();
}

/** The old glyph alone, white on transparent — Android tints this one itself (plan 5.1). */
async function monochrome(size) {
  const raw = await readFile(join(publicDir, "mark-glyph.svg"), "utf8");
  const svg = raw.replaceAll("currentColor", WHITE);
  return sharp(Buffer.from(svg), { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(ICON_PNG)
    .toBuffer();
}

/**
 * The in-app lockup, at the size it is actually displayed. A 64px file for a 28px mark is not
 * waste — it is the 2x screen the user is almost certainly reading this on.
 */
async function brandmark(mark, size, format) {
  const pipe = sharp(mark).resize(size, size, { fit: "fill", kernel: "lanczos3" });
  return format === "webp"
    ? pipe.webp({ quality: 90, effort: 6 }).toBuffer()
    : pipe.png(ICON_PNG).toBuffer();
}

// ── the OG card (plan 5.6) ────────────────────────────────────────────────────────────────────

/**
 * The link-preview card: 1200x630, the size every unfurler wants.
 *
 * This is the ONLY public face the product has — every page is behind the login wall — so it says
 * what the app is and nothing else. No data, no numbers, no screenshot of the UI. A screenshot goes
 * stale the day the interface moves, and it would be advertising a page nobody can open.
 *
 * The composition echoes the login panel deliberately: the mark, the wordmark in mono, one line of
 * Inter. Someone who sees the card in Slack and then signs in should recognise where they landed.
 */
async function ogCard(mark) {
  const W = 1200, H = 630;
  const MARK_SIZE = 420;
  const MARK_X = 120;
  const TEXT_X = MARK_X + MARK_SIZE + 72;

  const mono = loadFont(FONTS.mono);
  const sans = loadFont(FONTS.sans);

  // The wordmark: uppercase mono, tracked to 0.08em — the same treatment the in-app wordmark and
  // every masthead in the product carry. It is the house voice, set once, large.
  const wordSize = 46;
  const word = setLine(mono, "MYSTOCKMARKET", {
    size: wordSize,
    x: TEXT_X,
    y: H / 2 - 8,
    tracking: wordSize * 0.08,
  });

  // One line, in the product's own voice: what it is, and when.
  const tagline = setLine(sans, "US equities, after the close.", {
    size: 30,
    x: TEXT_X,
    y: H / 2 + 48,
  });

  // The violet ring's own colour, taken from the mark, as a 2px rule along the bottom edge — the
  // single accent on the card, and the only thing on it that is not the mark or the words.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BRAND_FIELD}"/>
    <path d="${word.d}" fill="#ffffff"/>
    <path d="${tagline.d}" fill="#b9b6e8"/>
    <rect x="0" y="${H - 2}" width="${W}" height="2" fill="#6d4df6"/>
  </svg>`;

  const scaled = await sharp(mark).resize(MARK_SIZE, MARK_SIZE, { fit: "fill", kernel: "lanczos3" }).toBuffer();
  return sharp(Buffer.from(svg))
    .composite([{ input: scaled, top: Math.round((H - MARK_SIZE) / 2), left: MARK_X }])
    .png(CARD_PNG)
    .toBuffer();
}

// ── the artifact table (plan 5.2) ─────────────────────────────────────────────────────────────

/**
 * Every file this phase ships, with the budget it must come in under and the consumer that reads
 * it. This IS the artifact table from the plan; the printed output below is the phase's evidence.
 *
 * The budgets are not decoration. An icon set has no failing test — it just quietly gets heavier
 * until someone notices the app is slow — so the weights are asserted here, and the script exits
 * non-zero if one is missed.
 */
async function artifacts(mark) {
  const rows = [
    { file: "favicon.ico", budget: 20_000, consumer: "browser tab", make: async () =>
      pngToIco([await fullBleed(mark, 16), await fullBleed(mark, 32), await fullBleed(mark, 48)]) },
    { file: "icons/icon-192.png", budget: 20_000, consumer: "manifest (any)", make: () => fullBleed(mark, 192) },
    { file: "icons/icon-512.png", budget: 60_000, consumer: "manifest (any) / splash", make: () => fullBleed(mark, 512) },
    { file: "icons/icon-maskable-512.png", budget: 40_000, consumer: "manifest (maskable)", make: () => onField(mark, 512, 0.77) },
    { file: "icons/icon-maskable-192.png", budget: 12_000, consumer: "manifest (maskable)", make: () => onField(mark, 192, 0.77) },
    { file: "icons/icon-monochrome-96.png", budget: 4_000, consumer: "manifest (monochrome)", make: () => monochrome(96) },
    { file: "apple-touch-icon.png", budget: 20_000, consumer: "iOS home screen", make: () => appleTouch(mark, 180) },
    // WEBP ONLY, AND THE PLAN'S PNG FALLBACK IS DELIBERATELY NOT HERE (logged in DECISIONS.md).
    // Plan 5.2 rows 8-9 pair each brandmark with a PNG "fallback". It would be dead weight: WebP has
    // been supported by every browser since Safari 14 (2020), and this app cannot render at all in a
    // browser older than that — it is built on Tailwind v4 (@property, oklch) and dvh units, which
    // arrived years later. The fallback would serve a browser that could never display the page,
    // and it costs 20KB of a 120KB budget the icon set does not have to spare.
    { file: "icons/brandmark-64.webp", budget: 4_000, consumer: "BrandMark — top bar (28px)", make: () => brandmark(mark, 64, "webp") },
    { file: "icons/brandmark-192.webp", budget: 12_000, consumer: "BrandMark — login (96px)", make: () => brandmark(mark, 192, "webp") },
    { file: "icons/og-card.png", budget: 300_000, group: "og", consumer: "openGraph + twitter", make: () => ogCard(mark) },
  ];

  for (const row of rows) {
    row.buffer = await row.make();
    row.bytes = row.buffer.length;
  }
  return rows;
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────

/** The icon set's group budget: everything except the OG card must fit in 120KB together. */
const ICON_GROUP_BUDGET = 120_000;

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

console.log(`\nbrand-assets — generating the identity from assets/brand/logo-source.png\n`);

const { mark, disc, coverage } = await loadMark();
console.log(
  `  mark fitted: centre (${disc.cx.toFixed(1)}, ${disc.cy.toFixed(1)}) radius ${disc.radius}px ` +
    `— covers ${(coverage * 100).toFixed(1)}% of the master`,
);

await mkdir(iconsDir, { recursive: true });
const rows = await artifacts(mark);

for (const row of rows) {
  await writeFile(join(publicDir, row.file), row.buffer);
}

console.log(`\n  ${"file".padEnd(32)} ${"bytes".padStart(9)}  ${"budget".padStart(8)}   consumer`);
console.log(`  ${"-".repeat(32)} ${"-".repeat(9)}  ${"-".repeat(8)}   ${"-".repeat(28)}`);
for (const row of rows) {
  const over = row.bytes > row.budget;
  console.log(
    `  ${row.file.padEnd(32)} ${kb(row.bytes).padStart(9)}  ${kb(row.budget).padStart(8)} ${over ? "!!" : " ok"}  ${row.consumer}`,
  );
}

const icons = rows.filter((r) => r.group !== "og");
const iconTotal = icons.reduce((sum, r) => sum + r.bytes, 0);
const og = rows.find((r) => r.group === "og");

console.log(`\n  icon set (rows 1-9): ${kb(iconTotal)} of ${kb(ICON_GROUP_BUDGET)} budget`);
console.log(`  og card:             ${kb(og.bytes)} of ${kb(og.budget)} budget`);

const failures = overBudget(rows);
if (iconTotal > ICON_GROUP_BUDGET) {
  console.error(`\nFAIL: the icon set is ${kb(iconTotal)}, over its ${kb(ICON_GROUP_BUDGET)} budget.`);
  process.exit(1);
}
if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} file(s) over budget:`);
  for (const row of failures) console.error(`  ${row.file}: ${kb(row.bytes)} > ${kb(row.budget)}`);
  process.exit(1);
}

console.log(`\nGenerated ${rows.length} files from one master. Every budget met.\n`);
