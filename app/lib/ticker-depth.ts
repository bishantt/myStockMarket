/**
 * lib/ticker-depth.ts — the ticker page's PD8 depth reads (Part 10.1, blocks 2/4/6/7).
 *
 * The page grows from two queries to six, all served by the schema the census already inventoried —
 * no new providers, no invented fields. Each loader here answers ONE block and degrades to nothing
 * on a read failure (the block simply does not render), so a single dead query can never take the
 * page down. The 52-week strip is a PURE function so it is unit-tested without a database.
 *
 * MARKET CAP APPEARS NOWHERE, deliberately: the schema has no size data, and a page that faked one
 * would be the exact kind of confident-but-unfounded number this product exists to refuse.
 */

import { db } from "@/lib/db";
import { calendarFloor } from "@/lib/morning";
import type { PaperTradeRow } from "@/lib/ledger";
import { realizedPnl } from "@/lib/ledger";

// ── Block 2: the 52-week strip (pure) ────────────────────────────────────────────────────────────

/** A full year of US trading sessions. The strip's window is the trailing min(this, available). */
export const FULL_YEAR_SESSIONS = 252;
/** At/above this many sessions the window IS a year, so the strip may honestly say "52-week". */
export const YEAR_LABEL_THRESHOLD = 240;

export type RangeStripData = {
  /** The trailing window's low, current (last close), and high — all raw, formatted by the view. */
  low: number;
  high: number;
  current: number;
  /** Where `current` sits between low and high, 0..1 — a POSITION, never an angle (P13). */
  position: number;
  /** The actual number of sessions in the window (≤ 252). Stated out loud, so the claim is honest. */
  sessions: number;
  /** The last session the window runs through, as a bare trading-day ISO string. */
  through: string;
};

/**
 * The 52-week strip over a run of closes (oldest → newest).
 *
 * It states its window HONESTLY at any history length: the position is computed over the trailing
 * up-to-252 closes, and the caller labels it "52-week" only when the window really is about a year
 * (the seed's thin 22-session symbols get "Trading range" and the true count instead). Absent when
 * there are too few bars to draw a range, or when every close is identical (a zero-width range has
 * no position to show) — absence beats invention, the registry's own rule (PD7).
 */
export function computeRangeStrip(closes: number[], through: string): RangeStripData | null {
  if (closes.length < 2) return null;

  const window = closes.slice(-FULL_YEAR_SESSIONS);
  let low = window[0];
  let high = window[0];
  for (const close of window) {
    if (close < low) low = close;
    if (close > high) high = close;
  }
  if (high <= low) return null; // a flat range has no position to draw

  const current = window[window.length - 1];
  return {
    low,
    high,
    current,
    position: (current - low) / (high - low),
    sessions: window.length,
    through,
  };
}

// ── Block 4: tonight's mention ───────────────────────────────────────────────────────────────────

export type TickerMentionData = {
  clusterId: string;
  headline: string;
  eventType: string;
  /** The 1-day move and relative volume SNAPSHOTTED on the catalyst link — so the ticker page and
   *  the feed can never show two different numbers for the same fact. */
  ret1: number | null;
  rvol20: number | null;
};

/**
 * The most recent news cluster this symbol was linked to, with its snapshot numbers. Absent (null)
 * when the name is in no cluster — the block renders silently in that case.
 */
export async function getTickerMention(symbol: string): Promise<TickerMentionData | null> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const link = await db.catalystLink.findFirst({
      where: { symbol: normalized },
      orderBy: { cluster: { runDate: "desc" } },
      select: {
        clusterId: true,
        ret1: true,
        rvol20: true,
        cluster: { select: { headline: true, eventType: true } },
      },
    });
    if (!link) return null;
    return {
      clusterId: link.clusterId,
      headline: link.cluster.headline,
      eventType: link.cluster.eventType,
      ret1: link.ret1,
      rvol20: link.rvol20,
    };
  } catch (error) {
    console.error(`getTickerMention: could not load a mention for ${normalized}`, error);
    return null;
  }
}

// ── Block 6: the calendar (this name's dated events) ─────────────────────────────────────────────

export type TickerCalendarRow = {
  date: Date;
  code: string;
  title: string;
  timing: string | null;
  consensus: number | null;
  prior: number | null;
};

/** How many days ahead the ticker page's calendar looks (plan 10.1 block 6). */
const CALENDAR_HORIZON_DAYS = 30;

/**
 * This symbol's scheduled events in the next 30 days. Forward from the EDITION, never the wall clock
 * (the live.md rule: a surface derived from the edition is measured against the edition — between
 * midnight ET and the evening run the two disagree, and a wall-clock floor would hide seeded events).
 * Absent (empty) when the name has none.
 */
export async function getTickerCalendar(symbol: string): Promise<TickerCalendarRow[]> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const edition = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    const floor = calendarFloor(edition?.runDate ?? null, new Date());
    const ceiling = new Date(floor);
    ceiling.setUTCDate(ceiling.getUTCDate() + CALENDAR_HORIZON_DAYS);

    const rows = await db.calendarEvent.findMany({
      where: { symbol: normalized, date: { gte: floor, lte: ceiling } },
      orderBy: { date: "asc" },
      select: { date: true, code: true, kind: true, title: true, timing: true, consensus: true, prior: true },
    });
    return rows.map((row) => ({
      date: row.date,
      // The chip the reader sees is the pipeline's `code` vocabulary; `kind` is the raw class.
      code: row.code ?? row.kind,
      title: row.title,
      timing: row.timing,
      consensus: row.consensus,
      prior: row.prior,
    }));
  } catch (error) {
    console.error(`getTickerCalendar: could not load the calendar for ${normalized}`, error);
    return [];
  }
}

// ── Block 7: the paper position ──────────────────────────────────────────────────────────────────

export type TickerPaperData = {
  open: PaperTradeRow[];
  /** Realized history on this name — the total and the count of closed trades. */
  realized: { total: number; count: number };
};

/**
 * This symbol's paper positions — open rows (marked live against last close on the page) and a
 * realized-history summary. This is user state the app already owns; numbers render via lib/format,
 * never toFixed (rule 12). Absent when the reader holds nothing on this name.
 */
export async function getTickerPaper(symbol: string): Promise<TickerPaperData> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const rows = (await db.paperTrade.findMany({
      where: { symbol: normalized },
      orderBy: { openedAt: "desc" },
    })) as PaperTradeRow[];

    const open = rows.filter((row) => row.status === "open");
    const closed = rows.filter((row) => row.status === "closed");
    const total = closed.reduce((sum, trade) => sum + (realizedPnl(trade) ?? 0), 0);
    return { open, realized: { total, count: closed.length } };
  } catch (error) {
    console.error(`getTickerPaper: could not load paper trades for ${normalized}`, error);
    return { open: [], realized: { total: 0, count: 0 } };
  }
}
