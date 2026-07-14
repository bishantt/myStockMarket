import type { Prisma } from "@prisma/client";
import type { APIRequestContext } from "@playwright/test";

import { VRT_RESET_SECRET } from "../playwright.config";

/**
 * thin-night.ts — the sparse edition, applied and taken back (PD3, §6.3).
 *
 * THE DEFECT THIS EXISTS TO PHOTOGRAPH. The Desk's dead gap is not a breakpoint bug. It only ever
 * appeared on a THIN night: the Brief renders its short held state while the Calendar beside it
 * renders a full session, and the difference used to become an empty hole under the Brief. The
 * seeded morning is a FULL night — every module fat with data — so the seeded Desk could never show
 * the defect, and no baseline in the suite ever had a chance of catching it. A human did.
 *
 * So the oracle grows a thin night: the briefing HELD, three movers instead of eight, no setup cards
 * at all. That is the exact shape the user photographed, and it is now a picture the build compares
 * against on every run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A TRANSFORMATION AND NOT A SEED VARIANT — a deliberate deviation from the plan's
 * letter (§6.3 says "the seed grows a deliberately sparse edition"), booked in DECISIONS.md.
 *
 * The Desk serves the LATEST edition. One database therefore holds exactly one night, so a full
 * night and a thin night cannot coexist in it — a "seed variant" would mean a SECOND seeded
 * database, which means a second Postgres service and a second build in CI, to take one screenshot.
 * That is a large, permanent bill for one picture.
 *
 * Instead the oracle does what this file's neighbour already does for lesson progress: it
 * establishes the state it intends to photograph, and puts it back. The plan's gate is unchanged and
 * fully met — the thin-night shot is baselined, and the no-dead-gap walk runs against it.
 *
 * THE SAFETY ARGUMENT, because mutating the database a pixel oracle reads from is not a small thing:
 *
 *   · IT SNAPSHOTS BEFORE IT TOUCHES. Every row it is about to change or delete is read into memory
 *     first, and the restore writes those exact rows back — it does not re-derive them from the seed
 *     and hope the seed agrees.
 *   · IT VERIFIES THE RESTORE. After putting everything back it re-counts, and throws if the numbers
 *     do not match what it started with. A restore that silently half-worked would poison every
 *     later shot in the leg with a partial night, and the failure would look like a styling bug.
 *   · IT TOUCHES NOTHING INSERT-ONLY. `signal_log` and `resolution` are the ledgers this product may
 *     never rewrite. Nothing here goes near them: it changes one `briefing.status`, and it deletes
 *     and restores rows from two derived tables that the nightly rebuilds from scratch anyway.
 *   · IT RUNS LAST. The two specs that use it (grid, vrt) call it inside a try/finally, and in the
 *     mbp16 leg vrt.spec is the last file to run. Even a total failure to restore could not reach a
 *     shot that had already been taken.
 *
 * ⚠ ONE DATABASE PER PLAYWRIGHT PROJECT. THIS IS A REQUIREMENT, NOT A PREFERENCE.
 *
 * Two tests thinning the same database at the same time will corrupt each other, and the symptom is
 * not subtle — a duplicate-primary-key error inside the restore, which reads like a broken layout
 * and is not. It happened on this file's first real run.
 *
 * CI IS STRUCTURALLY SAFE and needs nothing from you: every matrix leg is a separate runner with its
 * own Postgres service container, and `workers: 1` makes each leg strictly serial. Two legs cannot
 * see each other's rows. `test.describe.configure({ mode: "serial" })` in grid.spec.ts closes the
 * remaining door — two thin-night tests inside ONE leg.
 *
 * THE TRAP IS LOCAL. `npm run e2e:local` runs EVERY project against the ONE database on your machine,
 * in parallel workers. If you have a seeded local Postgres, the thin-night tests in the desktop,
 * phone and mbp16 projects will thin it simultaneously and fight. Run ONE project at a time locally
 * (`--project=mbp16`), or accept that a red thin-night test on a multi-project local run is telling
 * you about your database and not about the app.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

/** How many movers a thin night keeps. Eight is a full night; three is a quiet one. */
const MOVERS_KEPT = 3;

/** The preset the Movers module reads. Its top rows ARE the movers (lib/morning.ts, loadMovers). */
const MOVERS_PRESET = "unusual-volume";

/**
 * Make the night thin. Returns the function that puts it back.
 *
 * The caller MUST run the returned restore in a `finally`, so that a failing assertion cannot leave
 * a half-empty edition behind for the next shot to photograph.
 */
export async function applyThinNight(request: APIRequestContext): Promise<() => Promise<void>> {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  // ── snapshot ────────────────────────────────────────────────────────────────────────────────
  //
  // Read everything we are about to disturb, in full, before disturbing any of it.

  const briefing = await db.briefing.findFirst({
    orderBy: { runDate: "desc" },
    select: { runDate: true, status: true },
  });
  if (briefing === null) {
    await db.$disconnect();
    throw new Error("thin night: no briefing in the database — this needs the seeded morning");
  }

  const setupCards = await db.setupCard.findMany({ where: { runDate: briefing.runDate } });

  // The movers come from the LATEST unusual-volume rows, whatever date those carry — which is not
  // necessarily the briefing's date, and assuming it was would silently thin nothing at all.
  const topRow = await db.scanResult.findFirst({
    where: { presetKey: MOVERS_PRESET },
    orderBy: { runDate: "desc" },
    select: { runDate: true },
  });
  const surplusMovers =
    topRow === null
      ? []
      : await db.scanResult.findMany({
          where: { presetKey: MOVERS_PRESET, runDate: topRow.runDate, rank: { gt: MOVERS_KEPT } },
        });

  const before = {
    status: briefing.status,
    setupCards: setupCards.length,
    scanRows: await db.scanResult.count(),
  };

  // ── thin it ─────────────────────────────────────────────────────────────────────────────────

  await db.briefing.update({
    where: { runDate: briefing.runDate },
    data: { status: "held" },
  });
  await db.setupCard.deleteMany({ where: { runDate: briefing.runDate } });
  await db.scanResult.deleteMany({
    where: { id: { in: surplusMovers.map((row) => row.id) } },
  });

  await bustTheCache(request);

  // ── the restore ─────────────────────────────────────────────────────────────────────────────

  return async () => {
    try {
      await db.briefing.update({
        where: { runDate: briefing.runDate },
        data: { status: before.status },
      });
      // The rows go back EXACTLY as they came out, ids and all. The casts are Prisma's read/write
      // asymmetry and nothing more: a `Json` column reads back as `JsonValue` (which admits null)
      // and writes as `InputJsonValue` (which does not). These are rows this very function read out
      // of that very table moments ago, so the value is whatever it always was.
      if (setupCards.length > 0) {
        await db.setupCard.createMany({
          data: setupCards.map((row) => ({
            ...row,
            state: row.state as Prisma.InputJsonValue,
            weakeners: row.weakeners as Prisma.InputJsonValue,
          })),
        });
      }
      if (surplusMovers.length > 0) {
        await db.scanResult.createMany({
          data: surplusMovers.map((row) => ({
            ...row,
            metrics: row.metrics as Prisma.InputJsonValue,
          })),
        });
      }

      // A restore that silently half-worked is worse than no restore, because the next shot in the
      // leg would photograph a partial night and the diff would read as a styling bug. So it counts.
      const after = {
        setupCards: await db.setupCard.count({ where: { runDate: briefing.runDate } }),
        scanRows: await db.scanResult.count(),
      };
      if (after.setupCards !== before.setupCards || after.scanRows !== before.scanRows) {
        throw new Error(
          `thin night: the restore did not put the edition back — ` +
            `setup cards ${after.setupCards}/${before.setupCards}, ` +
            `scan rows ${after.scanRows}/${before.scanRows}`,
        );
      }

      await bustTheCache(request);
    } finally {
      await db.$disconnect();
    }
  };
}

/**
 * Deleting the rows is not enough, and this is the part that is easy to forget.
 *
 * The Desk is an ISR route. The render that is already cached does not care what the database now
 * says — it keeps showing the full night until something busts it. (The VRT suite learned this the
 * hard way with the Academy's checkmark: the row was gone and the checkmark stayed.)
 */
async function bustTheCache(request: APIRequestContext): Promise<void> {
  await request.post(`/api/revalidate?secret=${VRT_RESET_SECRET}`);
}
