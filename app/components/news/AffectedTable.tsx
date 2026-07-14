"use client";

import Link from "next/link";
import { useMemo } from "react";

import { DataTable } from "@/components/DataTable";
import { TickerChip } from "@/components/TickerChip";
import { copy } from "@/lib/copy";
import type { Column } from "@/lib/table";

/**
 * AffectedTable — the tickers a story touches, and their numbers at publish (plan 7.8).
 *
 * A client module because a Column's `value` accessor is a FUNCTION, and functions cannot cross the
 * server-to-client boundary. The story page stays a server component and does the read; this owns
 * the columns. Every table consumer in this app follows that split.
 *
 * THE NUMBERS ARE SNAPSHOTS, AND THAT IS THE WHOLE DESIGN. `ret1` and `rvol20` were frozen onto the
 * catalyst_link row at publish time. If this table recomputed them from live price tables, the feed
 * card and the story page could show two different values for the same fact within a single night —
 * the same number, twice, disagreeing. Freezing them means the front page and the story it opens
 * always tell the reader the same thing.
 *
 * THE SETUP-CARD DOORWAY IS GATED BY EVIDENCE, not by tidiness. It renders only where a setup card
 * actually exists (`hasSetupCard`), because a doorway into an empty room is worse than no doorway:
 * it promises evidence and delivers a shrug.
 */

export type AffectedRow = {
  symbol: string;
  name: string;
  ret1: number | null;
  rvol20: number | null;
  hasSetupCard: boolean;
};

export function AffectedTable({ rows }: { rows: AffectedRow[] }) {
  const columns = useMemo<Column<AffectedRow>[]>(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        kind: "mono",
        priority: 1,
        value: (row) => row.symbol,
        render: (row) => (
          <span className="flex flex-wrap items-center gap-2">
            {/* A DOOR here — nothing in a table cell is already interactive, so the symbol can be
             * the link it wants to be. This is the chip's natural habitat. */}
            <TickerChip symbol={row.symbol} door />
            {row.hasSetupCard ? (
              <Link href={`/ticker/${row.symbol}`} className="font-ui text-2xs text-accent-deep">
                {copy.news.setupCard} →
              </Link>
            ) : null}
          </span>
        ),
      },
      { key: "name", header: "Name", kind: "text", priority: 3, value: (row) => row.name },
      {
        key: "ret1",
        header: "1-day move",
        kind: "signedPercent",
        // The window rides the chip (PD6). This column is priority 1, and a priority-1 cell on the
        // phone card is drawn with NO header beside it — so without this, the story page's affected
        // tickers showed a bare signed percentage on every phone. PD5 fixed exactly this bug on the
        // news FEED and left it standing here, one component over, behind the table's private chip.
        window: "1D",
        align: "right",
        priority: 1,
        value: (row) => row.ret1,
      },
      {
        key: "rvol20",
        header: "RVOL · 20d",
        kind: "multiple",
        align: "right",
        priority: 2,
        value: (row) => row.rvol20,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      defaultSort={{ key: "ret1", dir: "desc", label: "1-day move" }}
      rowKey={(row) => row.symbol}
      ariaLabel={copy.news.affected}
    />
  );
}
