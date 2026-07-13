import { RUN_ACTIONS, type RunAction } from "@/lib/constants";
import { db } from "@/lib/db";
import { freshness, type CompletedRun } from "@/lib/freshness";
import { findRun, getRun, isDispatchConfigured, ledgerStatus } from "@/lib/github";
import type { ManualRunRow } from "@/lib/pipeline-control";
import { toTradingDate } from "@/lib/pipeline";

/**
 * pipeline-runs.ts — the control room's database side: read the ledger, reconcile it with GitHub,
 * and hand the pure state machine (lib/pipeline-control.ts) everything it needs.
 *
 * The split matters. `pipeline-control.ts` decides what the reader may press and what they are told
 * instead — it is pure, and every state it can produce is pinned by a unit test. This file is the
 * messy half: Prisma, `fetch`, a clock, and an external service that can be down. Keeping them apart
 * is what makes the decisions testable at all.
 */

/** The history list the panel shows (plan 8.5: "the panel's history list — last 10"). */
const HISTORY_LIMIT = 10;

/**
 * What the panel needs — RAW, not decided.
 *
 * THE STATE IS COMPUTED IN THE BROWSER, AGAINST THE READER'S CLOCK, and this shape is what makes
 * that possible. It sends the facts (the ledger, the last completed run, whether the token exists)
 * and lets the client run `controlPanel()` — the pure function — over them.
 *
 * IT USED TO DECIDE HERE, ON THE SERVER, AND THE PIXEL ORACLE CAUGHT IT. The first VRT baseline
 * photographed the panel saying **"Markets are open — today's closing data doesn't exist until
 * 4:00pm ET"** directly underneath a nav bar reading **"MARKET CLOSED"**. The nav grades in the
 * browser; the panel was grading on the server; CI happened to run at 3pm ET. One page, two clocks,
 * two answers.
 *
 * That is N4's bug wearing a new surface — a Desk built at 3:55pm told readers "markets open" long
 * past the close — and it had a second head here: **the baseline would have rotted on its own.** The
 * panel's states turn on what time it is, so the picture would change with the hour CI happened to
 * run and start failing with nobody having touched a line of code.
 *
 * The Desk's freshness strip already solved this and says so in its own comment: it reads the
 * browser's clock deliberately. There is one clock in this app that matters, and it is the reader's.
 */
export type PanelData = {
  runs: ManualRunRow[];
  lastRun: CompletedRun | null;
  configured: boolean;
};

/** A ledger row as Prisma hands it back. `mode` IS the action name for all five actions. */
function toManualRunRow(row: {
  id: string;
  mode: string;
  requestedAt: Date;
  status: string;
  ghRunId: bigint | null;
  finishedAt: Date | null;
}): ManualRunRow | null {
  // Never trust a stored string to be one of our five. A row written by an older build (or by hand)
  // must not crash the settings page; it is simply not something this panel knows how to show.
  if (!RUN_ACTIONS.includes(row.mode as RunAction)) return null;

  return {
    id: row.id,
    action: row.mode as RunAction,
    requestedAt: row.requestedAt,
    status: row.status as ManualRunRow["status"],
    // BigInt -> string AT THE BOUNDARY. `JSON.stringify` throws on a bigint, and this row is
    // serialized by the polling route on every tick — it would have died on the first found run.
    ghRunId: row.ghRunId === null ? null : String(row.ghRunId),
    finishedAt: row.finishedAt,
  };
}

/**
 * Bring the ledger up to date with what GitHub actually did.
 *
 * THIS IS THE FUNCTION THAT KEEPS A BUTTON HONEST. The dispatch API answers 204 with an empty body
 * (see lib/github.ts), so the app never learns the run id at dispatch time — it has to come back and
 * hunt for it. A row with no `ghRunId` is a run we have not found YET; this is where we look.
 *
 * Every GitHub call is caught PER ROW. A GitHub outage must cost the panel its live status and
 * nothing else — it may not take the settings page down, and it may not throw away the ledger. The
 * row simply stays as it was, and the panel keeps counting: if it stays unfound long enough, the
 * state machine reports it as lost rather than pretending it is still on its way.
 */
async function reconcile(rows: ManualRunRow[]): Promise<ManualRunRow[]> {
  const inFlight = rows.filter(
    (r) => r.status === "requested" || r.status === "queued" || r.status === "running",
  );
  if (inFlight.length === 0 || !isDispatchConfigured()) return rows;

  const updated = new Map<string, ManualRunRow>();

  await Promise.all(
    inFlight.map(async (row) => {
      try {
        // No run id yet: find it by matching the request id in the run's name — the only way there
        // is. Once found, it is stored, so we never have to hunt for the same run twice.
        const gh = row.ghRunId === null ? await findRun(row.action, row.id) : await getRun(row.ghRunId);
        if (!gh) return; // not created yet, or gone. The state machine decides which.

        const status = ledgerStatus(gh);
        const finishedAt = status === "succeeded" || status === "failed" ? new Date() : null;

        await db.manualRun.update({
          where: { id: row.id },
          data: { ghRunId: BigInt(gh.id), status, finishedAt },
        });

        updated.set(row.id, { ...row, ghRunId: gh.id, status, finishedAt });
      } catch (error) {
        // Logged, not swallowed silently, and not raised: one unreachable GitHub costs this row its
        // freshness and costs the reader nothing else.
        console.error(`pipeline-runs: could not reconcile run ${row.id}`, error);
      }
    }),
  );

  return rows.map((r) => updated.get(r.id) ?? r);
}

/** The newest COMPLETED pipeline run — the edition actually on screen. */
async function lastCompletedRun(): Promise<CompletedRun | null> {
  const run = await db.pipelineRun.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { runDate: "desc" },
    select: { runDate: true, finishedAt: true },
  });
  if (!run?.finishedAt) return null;

  // A @db.Date is a DAY. `toTradingDate` is what turns it into the bare "2026-07-14" that
  // freshness() demands — and freshness() throws loudly if anyone hands it a full timestamp instead,
  // because a silent Invalid Date here poisons every calculation downstream of it.
  return { runDate: toTradingDate(run.runDate), finishedAt: run.finishedAt };
}

/**
 * Everything the panel needs to render — the FACTS, reconciled with GitHub. It decides nothing.
 *
 * The deciding happens in the browser (see PanelData above): the pure `controlPanel()` runs there,
 * against the reader's own clock, so the panel and the nav can never disagree about whether the
 * market is open.
 */
export async function readPanel(): Promise<PanelData> {
  const configured = isDispatchConfigured();

  const [ledger, lastRun] = await Promise.all([
    db.manualRun.findMany({
      orderBy: { requestedAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, mode: true, requestedAt: true, status: true, ghRunId: true, finishedAt: true },
    }),
    lastCompletedRun(),
  ]);

  const rows = ledger.map(toManualRunRow).filter((r): r is ManualRunRow => r !== null);

  return { runs: await reconcile(rows), lastRun, configured };
}

/**
 * The freshness the panel and the Desk strip BOTH read (plan 8.6).
 *
 * One function, so the strip and the panel can never disagree about how old the data is. Two copies
 * of "is this current?" is one copy too many, and the day they drift apart one surface starts
 * reassuring the reader while the other one worries.
 */
export async function readFreshness(now: Date = new Date()) {
  return freshness(await lastCompletedRun(), now);
}
