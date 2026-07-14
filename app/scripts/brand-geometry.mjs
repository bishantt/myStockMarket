/**
 * brand-geometry.mjs — the arithmetic and the pixel logic behind the identity kit, with no IO in it.
 *
 * This file exists so the hard parts of the generator can be TESTED. `brand-assets.mjs` does the
 * reading, the resizing and the writing; everything here is a pure function that takes numbers or
 * raw pixels and returns numbers or raw pixels. The unit suite runs it against small synthetic
 * fixtures — never against the real logo — so the tests keep meaning something even if the artwork
 * is redrawn tomorrow.
 *
 * See scripts/brand-assets.mjs for the artifact table these functions serve.
 */

/**
 * The relative luminance of a pixel, on the usual 0–255 scale.
 * Used to tell "light" from "dark", which is the first half of recognising the painted-on
 * checkerboard in the master (see keyBackground).
 */
export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How colourful a pixel is: the gap between its strongest and weakest channel. Grey is 0.
 * This is the second half of recognising the checkerboard — see keyBackground for why both
 * halves are needed.
 */
export function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * THE MASTER'S TRANSPARENCY IS PAINTED ON, AND THIS IS THE FUNCTION THAT DEALS WITH IT.
 *
 * `assets/brand/logo-source.png` arrived from an image tool that renders the transparency
 * *checkerboard* into the pixels instead of writing an alpha channel. The file therefore has no
 * alpha at all: it is a circular mark sitting on a painted grey-and-white checker. Drop it into an
 * icon as-is and every icon ships with a chequered box around the mark.
 *
 * So the background is keyed out here, and the method is chosen to be safe rather than clever:
 *
 *   1. A pixel is a CHECKER CANDIDATE if it is light AND grey. Both halves matter. The mark's own
 *      whites — the M, the book — are light too, but they are faintly blue (#ecedfd), so the
 *      chroma test separates them. The checker's two tones (~#f5f5f5 and ~#fefefe) are pure grey.
 *   2. The candidates are then FLOOD-FILLED from the image border. This is the safety net, and it
 *      is what makes the function trustworthy: even if some pixel of the white M were grey enough
 *      to fool the colour test, the M is in the middle of the mark and a fill starting at the edge
 *      can never reach it. Only background that is genuinely connected to the outside is removed.
 *
 * Returns a mask, one byte per pixel: 1 = background (make it transparent), 0 = keep.
 */
export function keyBackground(pixels, width, height, channels, { lightAbove = 205, greyBelow = 14 } = {}) {
  const isChecker = (p) => {
    const i = p * channels;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    return luminance(r, g, b) > lightAbove && chroma(r, g, b) < greyBelow;
  };

  const background = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  while (stack.length > 0) {
    const p = stack.pop();
    if (background[p] === 1 || !isChecker(p)) continue;
    background[p] = 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  return background;
}

/**
 * Find the disc that the mark actually occupies: its centre, and the radius of its rim.
 *
 * The mark is a circle, but it is DRAWN rather than computed, so its ring wobbles by about ten
 * pixels out of five hundred. It also carries a soft drop shadow that hangs outside the ring on one
 * side. Neither is a problem as long as the generator knows exactly where the circle is, because
 * every geometry in the artifact table is expressed against it ("the mark's circle at 77% of the
 * canvas" is meaningless until "the mark's circle" has an answer).
 *
 * The centre is the centroid of everything the keying kept.
 *
 * THE RADIUS IS A MEDIAN OVER ANGLES, AND THAT CHOICE IS THE WHOLE FUNCTION. Walk out along each of
 * `sectors` rays from the centre, note how far the mark reaches along each one, and take the MIDDLE
 * of those distances. A drop shadow smeared off one side lengthens the handful of rays that pass
 * through it and leaves the rest alone — so the median never sees it. A mean would be dragged
 * outward by it; a maximum would be defined by it. Either would inflate the circle, and because
 * every icon is then scaled to fit that circle, the visible mark would silently SHRINK inside all
 * ten of them to make room for a shadow nobody wanted.
 *
 * (The first version of this took a 99.9% quantile of every kept pixel's distance. It cropped the
 * real logo's shadow, which is a thin fringe, and it passed. It would not have survived a heavier
 * one — a unit test with a fatter synthetic shadow walked straight through it. The docstring was
 * making a promise the arithmetic could not keep, so the arithmetic changed.)
 */
export function fitDisc(background, width, height, { sectors = 72 } = {}) {
  let sumX = 0, sumY = 0, kept = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (background[y * width + x] === 1) continue;
      sumX += x;
      sumY += y;
      kept++;
    }
  }
  if (kept === 0) throw new Error("fitDisc: the keying removed every pixel — the master is not a mark on a background.");

  const cx = sumX / kept;
  const cy = sumY / kept;

  // How far the mark reaches along each ray out of the centre.
  const reach = new Float64Array(sectors);
  const TWO_PI = Math.PI * 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (background[y * width + x] === 1) continue;
      const dx = x - cx, dy = y - cy;
      const angle = Math.atan2(dy, dx);
      // atan2 returns -pi..pi; shift to 0..2pi so the bucket index is never negative.
      const bucket = Math.min(sectors - 1, Math.floor(((angle + TWO_PI) % TWO_PI) / TWO_PI * sectors));
      const d = Math.hypot(dx, dy);
      if (d > reach[bucket]) reach[bucket] = d;
    }
  }

  const sorted = Array.from(reach).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  return { cx, cy, radius: Math.round(median), kept };
}

/**
 * Turn the keyed mask and the fitted disc into a real alpha channel.
 *
 * Two things make a pixel transparent: the flood fill said it was background, or it lies outside
 * the disc (which is what finally sheds the drop shadow). The disc's edge gets a one-pixel ramp
 * rather than a hard cut — a hard cut on a circle produces visible stair-stepping, and the mark is
 * displayed as small as 16px, where a jagged rim is the whole silhouette.
 */
export function discAlpha(background, width, height, { cx, cy, radius }, { feather = 1 } = {}) {
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (background[p] === 1) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radius - feather) alpha[p] = 255;
      else if (d >= radius) alpha[p] = 0;
      else alpha[p] = Math.round(255 * (radius - d) / feather);
    }
  }
  return alpha;
}

/**
 * The maskable icon's geometry (artifact table row 4/5), and the one piece of arithmetic in this
 * phase that a person cannot check by looking at the picture.
 *
 * Android may crop a maskable icon to any shape it likes — circle, squircle, rounded square — and
 * it guarantees only that a centred circle of radius 40% of the canvas survives. That is the safe
 * zone. Our mark is itself a circle, so the rule is simply: the mark's circle must fit inside the
 * safe circle. At 77% of the canvas the mark's RADIUS is 38.5% — comfortably inside the 40% that is
 * promised, with the remaining 1.5% as the margin for a mask that is a hair tighter than the spec.
 *
 * Everything outside the mark is the brand field, so whatever shape the OS carves, it carves field.
 */
export function maskableGeometry(canvas, { coverage = 0.77 } = {}) {
  const mark = Math.round(canvas * coverage);
  const offset = Math.round((canvas - mark) / 2);
  const safeZoneRadius = canvas * 0.4;
  const markRadius = mark / 2;
  return {
    canvas,
    mark,
    offset,
    markRadius,
    safeZoneRadius,
    // The generator asserts this. If a future edit pushes the mark past the safe zone, the icon
    // does not merely look worse — the OS clips the ring off, and no test that reads pixels in this
    // repo would notice.
    fitsSafeZone: markRadius <= safeZoneRadius,
  };
}

/**
 * The budget check (artifact table, 5.2). Returns the rows that are over, so the caller can print
 * every failure at once rather than dying on the first.
 *
 * An icon set has no test that can fail; it just quietly gets heavier until someone notices the
 * page is slow. This is the thing that notices.
 */
export function overBudget(rows) {
  return rows.filter((row) => typeof row.budget === "number" && row.bytes > row.budget);
}
