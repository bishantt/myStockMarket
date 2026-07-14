import { describe, expect, it } from "vitest";
import { keyBackground, fitDisc, discAlpha, maskableGeometry, overBudget } from "./brand-geometry.mjs";

/**
 * The identity kit's arithmetic and pixel logic (plan 5.7).
 *
 * EVERY FIXTURE HERE IS SYNTHETIC, AND THAT IS THE POINT. Not one test reads
 * assets/brand/logo-source.png. A test that asserted against the real artwork would be asserting
 * that today's logo is today's logo — it would pass forever and prove nothing, and it would go red
 * the day the mark is redrawn, which is precisely the day it should stay green. These build their
 * own tiny worlds instead: a disc on a checkerboard, a disc with a shadow, a disc with a white hole
 * in the middle of it. Each one asks a question the generator has to get right about ANY logo.
 */

/**
 * Paint a synthetic master: a coloured disc, centred, on a painted grey-and-white checkerboard —
 * the same fake transparency the real master arrived with.
 *
 * Returns raw RGB (3 channels), exactly the shape sharp hands the generator.
 */
function paintMaster(
  size: number,
  radius: number,
  { discColour = [18, 19, 54], centre = [size / 2, size / 2] } = {},
): { data: Uint8Array; width: number; height: number; channels: number } {
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const inside = Math.hypot(x - centre[0], y - centre[1]) <= radius;
      // The checkerboard's two tones: light, and grey (r === g === b), just like the real one.
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 245 : 254;
      const [r, g, b] = inside ? discColour : [checker, checker, checker];
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
  }
  return { data, width: size, height: size, channels: 3 };
}

describe("keying the painted background out of the master", () => {
  it("removes the checkerboard and keeps the disc", () => {
    const { data, width, height, channels } = paintMaster(120, 40);
    const background = keyBackground(data, width, height, channels);

    // The four corners are background; the centre is the mark.
    expect(background[0]).toBe(1);
    expect(background[width - 1]).toBe(1);
    expect(background[(height - 1) * width]).toBe(1);
    expect(background[60 * width + 60]).toBe(0);

    // The kept area should be about the disc's area (pi r^2), within a pixel or two of rounding.
    const kept = background.reduce((n: number, v: number) => n + (v === 0 ? 1 : 0), 0);
    expect(kept).toBeGreaterThan(Math.PI * 40 * 40 * 0.97);
    expect(kept).toBeLessThan(Math.PI * 40 * 40 * 1.03);
  });

  /**
   * THE TEST THAT PROTECTS THE WHITE "M".
   *
   * The real mark's glyphs are near-white, and so is the checkerboard. A keyer that only asked "is
   * this pixel light?" would punch a hole straight through the letterform. The flood fill is what
   * makes that impossible: white in the MIDDLE of the mark is not connected to the border, so the
   * fill can never reach it, however light it is.
   */
  it("never eats a white shape inside the mark, because the fill starts at the border", () => {
    const size = 120;
    const { data, width, height, channels } = paintMaster(size, 40);
    // Punch a pure-white square into the middle of the disc — the "M".
    for (let y = 52; y < 68; y++) {
      for (let x = 52; x < 68; x++) {
        const i = (y * size + x) * 3;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      }
    }
    const background = keyBackground(data, width, height, channels);

    for (let y = 52; y < 68; y++) {
      for (let x = 52; x < 68; x++) {
        expect(background[y * width + x], `the glyph at ${x},${y} was keyed out`).toBe(0);
      }
    }
    expect(background[0]).toBe(1); // ...while the real background still goes.
  });
});

describe("fitting the mark's true circle", () => {
  it("finds the centre and a radius that contains the disc", () => {
    const { data, width, height, channels } = paintMaster(200, 60);
    const background = keyBackground(data, width, height, channels);
    const disc = fitDisc(background, width, height);

    expect(disc.cx).toBeCloseTo(100, 0);
    expect(disc.cy).toBeCloseTo(100, 0);
    expect(disc.radius).toBeGreaterThanOrEqual(59);
    expect(disc.radius).toBeLessThanOrEqual(62);
  });

  /**
   * THE TEST THAT CROPS THE DROP SHADOW.
   *
   * The real master carries a soft shadow hanging outside the ring on one side. It is dark, so the
   * keyer keeps it — correctly, it is not checkerboard. What sheds it is the disc fit: the radius is
   * the MEDIAN of how far the mark reaches along each ray out of the centre, so a smear that
   * lengthens a handful of rays never moves the middle one. If it could, every icon would silently
   * shrink to make room for it, and the maskable inset would be measured against the wrong thing.
   *
   * This test is the reason fitDisc works the way it does. The first version took a 99.9% quantile
   * over every kept pixel, which happens to crop the real logo's thin fringe — and this fixture,
   * whose shadow is fatter, walked straight through it. The fixture was right and the code was
   * lucky, so the code changed.
   */
  it("is not dragged outward by a shadow trailing off one side", () => {
    const size = 200;
    const { data, width, height, channels } = paintMaster(size, 60);
    // A dark smear from the disc's edge out to r+18, on the right only.
    for (let y = 95; y < 130; y++) {
      for (let x = 158; x < 178; x++) {
        const i = (y * size + x) * 3;
        data[i] = 40; data[i + 1] = 40; data[i + 2] = 50;
      }
    }
    const background = keyBackground(data, width, height, channels);
    const disc = fitDisc(background, width, height);

    // The shadow reaches 78px from centre. The fitted radius must ignore it and stay at the ring.
    expect(disc.radius).toBeLessThan(66);
  });
});

describe("cutting the alpha channel", () => {
  it("is transparent outside the disc, opaque inside it, and ramps at the rim", () => {
    const { data, width, height, channels } = paintMaster(120, 40);
    const background = keyBackground(data, width, height, channels);
    const disc = fitDisc(background, width, height);
    const alpha = discAlpha(background, width, height, disc);

    expect(alpha[0]).toBe(0); // corner
    expect(alpha[60 * width + 60]).toBe(255); // centre
    // A pixel well outside the fitted radius is transparent even if the keyer had kept it.
    const farOut = Math.round(disc.cy) * width + Math.round(disc.cx + disc.radius + 4);
    expect(alpha[farOut]).toBe(0);
  });
});

describe("the maskable icon's safe-zone arithmetic", () => {
  /**
   * Android guarantees only that a centred circle of radius 40% of the canvas survives its mask.
   * Our mark IS a circle, so the whole question is whether the mark's radius fits inside that.
   */
  it("keeps the mark inside the 40% safe zone at the sanctioned 77%", () => {
    const g = maskableGeometry(512);
    expect(g.mark).toBe(394); // 77% of 512
    expect(g.offset).toBe(59); // centred: (512 - 394) / 2
    expect(g.markRadius).toBe(197);
    expect(g.safeZoneRadius).toBeCloseTo(204.8, 1);
    expect(g.fitsSafeZone).toBe(true);
  });

  it("scales to 192 and still fits", () => {
    const g = maskableGeometry(192);
    expect(g.mark).toBe(148);
    expect(g.fitsSafeZone).toBe(true);
  });

  /**
   * The assertion that actually earns its keep. If someone later decides the mark "looks small" and
   * pushes the coverage up, the OS does not merely crop it tighter — it slices the ring off, and no
   * test in this repo reads an Android launcher. This one refuses at the source.
   */
  it("refuses a coverage that would let the OS clip the ring", () => {
    expect(maskableGeometry(512, { coverage: 0.9 }).fitsSafeZone).toBe(false);
    expect(maskableGeometry(512, { coverage: 0.78 }).fitsSafeZone).toBe(true);
    // 80% is the exact edge of the cliff — the mark's radius lands on the safe zone to the pixel
    // (0.8 x 256 = 204.8 = 40% of 512), and rounding tips it over. The sanctioned 77% is not a
    // round number chosen for looks; it is the last comfortable step before that edge.
    expect(maskableGeometry(512, { coverage: 0.8 }).fitsSafeZone).toBe(false);
  });
});

describe("the budget check", () => {
  it("names every file that is over, not just the first", () => {
    const over = overBudget([
      { file: "a.png", bytes: 100, budget: 200 },
      { file: "b.png", bytes: 300, budget: 200 },
      { file: "c.png", bytes: 900, budget: 400 },
    ]);
    expect(over.map((r: { file: string }) => r.file)).toEqual(["b.png", "c.png"]);
  });

  it("passes a set that is within budget", () => {
    expect(overBudget([{ file: "a.png", bytes: 10, budget: 20 }])).toEqual([]);
  });
});
