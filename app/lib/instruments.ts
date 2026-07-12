"use server";

import { db } from "@/lib/db";

/**
 * lib/instruments.ts — the two reads behind the paper ticket's niceties (APP-FEEL-PLAN §3.4, §4.3).
 *
 * The `Instrument` table has sat in the database since P1 with a name for every symbol, and the
 * paper desk has been asking the reader to type tickers from memory into a bare text box the whole
 * time. These are the two server actions that close that gap.
 */

export type InstrumentHit = { symbol: string; name: string };

/** How many rows the combobox may ever show. Five, and the number is an iOS constraint (see below). */
export const MAX_INSTRUMENT_HITS = 5;

/**
 * Search active instruments by symbol prefix or by name.
 *
 * BOTH CLAUSES ARE CASE-INSENSITIVE, and that is not politeness — it is correctness on a phone.
 * `autocapitalize="characters"` only sets the keyboard's shift key; the reader can still type "sm",
 * and a case-sensitive prefix match would then fail to find SMCI while the reader is looking
 * straight at it.
 *
 * CAPPED AT FIVE. The listbox renders below its input, and on iOS the keyboard plus the QuickType
 * bar leave roughly 300–360px under a mid-page field. An eight-row list at 44px a row is guaranteed
 * to run underneath the keyboard, with no cue that it has done so and nothing to scroll it into
 * view. Five rows fit. (DECISIONS 2026-07-12.)
 */
export async function searchInstruments(query: string): Promise<InstrumentHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  try {
    return await db.instrument.findMany({
      where: {
        isActive: true,
        OR: [
          { symbol: { startsWith: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { symbol: "asc" },
      take: MAX_INSTRUMENT_HITS,
      select: { symbol: true, name: true },
    });
  } catch (error) {
    console.error("searchInstruments failed", error);
    return []; // an unreachable database means no suggestions, not a broken ticket
  }
}

export type LastClose = { close: number; date: Date };

/**
 * The most recent SERVED close for a symbol, with the date it belongs to — or null.
 *
 * THE DATE IS LOAD-BEARING, NOT DECORATION (P12, ruling M5). A served bar can be several days old
 * around a holiday or a data gap, and "last close" printed without its date is an implicit freshness
 * claim that the reader has no way to check. The chip's disclaimer ("a reference, not a quote")
 * covers LIVENESS; the date covers AGE. They are two different lies to prevent, and the chip carries
 * both cures.
 *
 * Null for the ~99% of the universe with no served bars — the chip simply does not render, rather
 * than rendering an apology.
 */
export async function lastServedClose(symbol: string): Promise<LastClose | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;

  try {
    const bar = await db.priceBar.findFirst({
      where: { symbol: normalized },
      orderBy: { date: "desc" },
      select: { close: true, date: true },
    });
    return bar ? { close: bar.close, date: bar.date } : null;
  } catch (error) {
    console.error(`lastServedClose failed for ${normalized}`, error);
    return null;
  }
}
