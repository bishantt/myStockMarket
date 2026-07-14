import manifest from "./routes-manifest.json";

/**
 * routes.ts — the typed door onto routes-manifest.json (GATE-EFFICIENCY-PLAN G3).
 *
 * The manifest is JSON because three different toolchains have to read it: the .mjs budget scripts,
 * the TypeScript e2e specs, and vitest. JSON is the only format all three read without ceremony.
 * The .mjs scripts parse it straight off disk. The TypeScript side comes through here, and gets a
 * declared shape rather than whatever TypeScript happens to infer from the literal — inference over
 * a heterogeneous JSON array is a guess, and a guess that silently narrows `sweeps: []` to `never[]`
 * would make a perfectly correct spec fail to compile for a reason nobody could read.
 *
 * So the shape is DECLARED, and then CHECKED at import — because a declaration that is never checked
 * is a comment. If somebody hand-edits the manifest into a shape the tools cannot use, this throws
 * on the spot, naming the entry, rather than letting a sweep quietly walk a shorter list.
 */

/** The whole-app rules that walk a room. Empty means no sweep goes there, and the note says why. */
export type Sweep = "touch" | "scroll" | "axe";

/** What check-nav.mjs does with the room. See the manifest's `about` block for each. */
export type NavBudget = "gated" | "control" | "pending" | "none";

export interface RouteEntry {
  /** A concrete URL a tool can open. For a dynamic family, its canonical seeded instance. */
  readonly path: string;
  /** The route as the App Router sees it, brackets and all — `/news/[cluster]`. */
  readonly family: string;
  /** True when the URL only EXISTS if the database carries the synthetic morning. */
  readonly seeded: boolean;
  readonly sweeps: readonly Sweep[];
  readonly navBudget: NavBudget;
  /** The slug vrt.spec.ts's generated room loop shoots, or null if it has no generated shot. */
  readonly vrtRoom: string | null;
  /**
   * Does this room get a 1512x982 pixel lock — the 16" MacBook Pro the reader actually uses (PD3)?
   *
   * False for most rooms, on purpose. 1512 sits INSIDE the `desk:` band and the container caps at
   * 1360px, so a room whose composition is decided by the breakpoint renders the same content box at
   * 1512 as at 1366 — a second picture of an answered question. True for the rooms where CONTENT
   * HEIGHT decides the layout, which is where Law 1 lives and where the dead gap used to open.
   */
  readonly mbp16: boolean;
  /** Why this room is here, and why its flags say what they say. Every entry defends itself. */
  readonly note: string;
}

const SWEEPS: readonly string[] = ["touch", "scroll", "axe"];
const NAV_BUDGETS: readonly string[] = ["gated", "control", "pending", "none"];

/**
 * Check one entry from the JSON before anybody relies on it.
 *
 * This is the boundary. Everything downstream — the sweeps, the pixel oracle, the nav budget — trusts
 * these fields completely, so they are checked once, here, where a bad value can still be pointed at.
 */
function validate(entry: unknown, index: number): RouteEntry {
  const where = `lib/routes-manifest.json: routes[${index}]`;
  const r = entry as Record<string, unknown>;

  const text = (field: string) => {
    const value = r[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${where} — "${field}" must be a non-empty string, got ${JSON.stringify(value)}`);
    }
    return value;
  };

  if (typeof r.seeded !== "boolean") {
    throw new Error(`${where} — "seeded" must be true or false, got ${JSON.stringify(r.seeded)}`);
  }
  if (!Array.isArray(r.sweeps) || r.sweeps.some((s) => !SWEEPS.includes(s as string))) {
    throw new Error(`${where} — "sweeps" may only contain ${SWEEPS.join(", ")}; got ${JSON.stringify(r.sweeps)}`);
  }
  if (!NAV_BUDGETS.includes(r.navBudget as string)) {
    throw new Error(`${where} — "navBudget" must be one of ${NAV_BUDGETS.join(", ")}; got ${JSON.stringify(r.navBudget)}`);
  }
  if (r.vrtRoom !== null && typeof r.vrtRoom !== "string") {
    throw new Error(`${where} — "vrtRoom" must be a room slug or null, got ${JSON.stringify(r.vrtRoom)}`);
  }
  if (typeof r.mbp16 !== "boolean") {
    throw new Error(`${where} — "mbp16" must be true or false, got ${JSON.stringify(r.mbp16)}`);
  }

  return {
    path: text("path"),
    family: text("family"),
    seeded: r.seeded,
    sweeps: r.sweeps as Sweep[],
    navBudget: r.navBudget as NavBudget,
    vrtRoom: r.vrtRoom as string | null,
    mbp16: r.mbp16,
    // An entry with no note is an entry nobody has had to defend. The manifest says so; this enforces it.
    note: text("note"),
  };
}

/** Every product room, in the order the manifest lists them. */
export const ROUTES: readonly RouteEntry[] = manifest.routes.map(validate);

/** The rooms a given sweep walks. */
export function sweptBy(sweep: Sweep): readonly RouteEntry[] {
  return ROUTES.filter((r) => r.sweeps.includes(sweep));
}

/**
 * The rooms with a generated pixel baseline, as vrt.spec.ts wants them: `{ path, name }`.
 *
 * `flatMap` rather than `filter` + `map` so the null case narrows honestly instead of being asserted
 * away — the compiler should be able to see that every room here really does have a slug.
 */
export const VRT_ROOMS: readonly { path: string; name: string; mbp16: boolean }[] = ROUTES.flatMap(
  (r) => (r.vrtRoom === null ? [] : [{ path: r.path, name: r.vrtRoom, mbp16: r.mbp16 }]),
);

/**
 * Does the room at this path carry a 16-inch lock?
 *
 * The bespoke shots in vrt.spec.ts (the ticker's, which are taken at /ticker/AAPL because the Range
 * Ladder needs seeded vol bands) cannot go through VRT_ROOMS, so they ask here instead — against the
 * manifest, rather than against a second hand-kept list in the spec. That is the whole point of the
 * manifest: there is one list, and everything reads it.
 */
export function locksAt16Inches(path: string): boolean {
  return ROUTES.some((r) => r.path === path && r.mbp16);
}
