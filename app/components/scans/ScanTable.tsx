"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/DataTable";
import { Tag } from "@/components/Tag";
import type { RailPayload } from "@/components/rail/Rail";
import { copy } from "@/lib/copy";
import { directionOf, multiple, signedPercent } from "@/lib/format";
import { columnsFor, type ScanRow } from "@/lib/scan-table";

/**
 * ScanTable — one preset's full match set (APP-FEEL-PLAN §4.2).
 *
 * A client module, because a table Column's accessor is a FUNCTION and functions cannot cross the
 * server-to-client boundary. The page stays a server component and does the database read; this owns
 * the columns and the row behaviour, and receives only plain rows. That split is the shape every
 * table consumer in the app follows.
 */

export type ScanTableProps = {
  presetKey: string;
  rows: ScanRow[];
  /** True when the match set was cut at the 500-row cap — sorting is then disabled (M6). */
  capped: boolean;
};

export function ScanTable({ presetKey, rows, capped }: ScanTableProps) {
  const columns = useMemo(() => {
    const base = columnsFor(presetKey);

    // The lottery-risk flag hangs off the symbol cell rather than occupying a column of its own,
    // which would be a column of empty cells on every ordinary night. The pipeline sets the flag
    // (sub-$5, or a top-decile-skew name under $10) and it has never had anywhere to appear until
    // now — it is a real warning that has been sitting in the database, unread.
    return base.map((column) =>
      column.key === "symbol"
        ? {
            ...column,
            render: (row: ScanRow) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm text-ink">{row.symbol}</span>
                {row.lottery ? <Tag variant="catalyst">{copy.scans.lotteryChip}</Tag> : null}
              </span>
            ),
          }
        : column,
    );
  }, [presetKey]);

  /**
   * A row opens the rail (drill level 2) — the same slide-over the Desk's movers use, so the drill
   * ladder stays one ladder. Depth stays ≤ 3: glance → rail → /ticker.
   *
   * Note what is NOT here: a "Practice on paper" link. Ruling M10 forbids a doorway from a surface
   * with no evidence anatomy, and a scan row is a filter hit — no base rate, no interval, no
   * weakener list. The setup cards get that doorway; these rows never do.
   */
  function railPayload(row: ScanRow): RailPayload {
    const ret = row.metrics.ret_1 ?? null;
    const rvol = row.metrics.rvol20 ?? null;

    return {
      symbol: row.symbol,
      name: row.name,
      changePct: ret === null ? "—" : signedPercent(ret),
      direction: directionOf(ret ?? 0),
      rvol: rvol === null ? undefined : multiple(rvol),
      note: row.lottery
        ? "Flagged lottery risk: a low-priced or heavily skewed name, where large percentage moves are common and mean little."
        : undefined,
    };
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      // The pipeline's own rank, and the header says so in words. Never "top" (M1).
      defaultSort={{ key: "rank", dir: "asc", label: copy.scans.order }}
      rowKey={(row) => row.symbol}
      onRowPayload={railPayload}
      ariaLabel={`${presetKey} matches`}
      footnote={copy.scans.tableNote}
      // Above the cap the table shows a stated first-500. Sorting that silent subset by, say, 1-day
      // move would present "the biggest movers among the most salient" as "the biggest movers" — an
      // unlabelled subset ranking, which is the exact species M1 exists to kill.
      sortable={!capped}
    />
  );
}
