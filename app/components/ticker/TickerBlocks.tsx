import Link from "next/link";

import { DeltaChip } from "@/components/DeltaChip";
import { OutcomeChip } from "@/components/OutcomeChip";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";
import { directionOf, multiple, price, signedPercent, timingLabel } from "@/lib/format";
import { unrealizedPnl } from "@/lib/ledger";
import type {
  TickerCalendarRow,
  TickerMentionData,
  TickerPaperData,
} from "@/lib/ticker-depth";
import { formatUtcDate } from "@/lib/time";

/**
 * The ticker page's PD8 display blocks (plan 10.1 blocks 4/6/7). Each renders what the schema serves,
 * marks nothing it cannot support, and the CALLER decides when to show it — an absent block is not an
 * apology (P9). Kept in one cohesive file: they are three small views of the same page's depth.
 */

/**
 * Block 4 — tonight's mention. The story headline as a door, plus the SNAPSHOT move and relative
 * volume frozen on the catalyst link at publish, so the ticker page and the feed can never show two
 * different numbers for the same fact. The move is `data-p2` (via DeltaChip): it is money, so it
 * does not animate.
 */
export function TickerMention({ mention }: { mention: TickerMentionData }) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/news/${mention.clusterId}`}
        className="flex min-h-11 items-center font-serif text-base text-ink hover:text-accent-deep"
      >
        {mention.headline} →
      </Link>
      {mention.ret1 !== null || mention.rvol20 !== null ? (
        <div className="flex flex-wrap items-center gap-2 font-ui text-sm text-muted">
          {mention.ret1 !== null ? (
            <DeltaChip
              value={signedPercent(mention.ret1)}
              direction={directionOf(mention.ret1)}
              window={copy.window.d1}
            />
          ) : null}
          {mention.rvol20 !== null ? (
            <span>{fill(copy.ticker.mentionRvol, { rvol: multiple(mention.rvol20) })}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Block 6 — on the calendar. This name's scheduled events as dated facts, never levels to watch (E4).
 * The chip is the pipeline's `code` vocabulary; the consensus/prior ride beside it when known.
 */
export function TickerCalendar({ rows }: { rows: TickerCalendarRow[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li
          key={`${row.code}-${row.date.toISOString()}-${row.title}`}
          className="flex flex-wrap items-baseline gap-2"
        >
          <Tag variant="catalyst">{row.code}</Tag>
          <span className="font-ui text-sm text-ink-2">{row.title}</span>
          <span className="font-mono text-2xs text-muted">
            {formatUtcDate(row.date)}
            {/* The raw code (bmo/amc/dmh) or a macro clock string, in the reader's words (CC9). */}
            {timingLabel(row.timing) ? ` · ${timingLabel(row.timing)}` : ""}
          </span>
          {row.consensus !== null ? (
            <span className="font-mono text-2xs text-muted">
              {fill(copy.ticker.calendarConsensus, {
                consensus: price(row.consensus),
                prior: row.prior === null ? "—" : price(row.prior),
              })}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Block 7 — the paper position. Open rows marked LIVE against last close (unrealized, directional),
 * plus a realized-history line. This is user state the app already owns; every number renders via
 * lib/format, never toFixed (rule 12). A position with no last close to mark against shows no
 * fabricated figure — it says so.
 */
export function TickerPaper({
  paper,
  lastCloseValue,
}: {
  paper: TickerPaperData;
  lastCloseValue: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {paper.open.map((trade) => {
        const unrealized = unrealizedPnl(trade, lastCloseValue);
        return (
          <div
            key={trade.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs"
          >
            <span className="uppercase tracking-[0.04em] text-ink">
              {trade.side} {trade.quantity} @ {price(trade.fillPrice)}
            </span>
            <span className="text-muted">{trade.bucket}</span>
            {unrealized !== null ? (
              <OutcomeChip
                tone={unrealized >= 0 ? "positive" : "negative"}
                label={copy.ticker.paperVsLastClose}
                figure={`${unrealized >= 0 ? "+" : "−"}${price(Math.abs(unrealized))}`}
              />
            ) : (
              <span className="text-muted">{copy.ticker.paperNoLastClose}</span>
            )}
          </div>
        );
      })}
      {paper.realized.count > 0 ? (
        <p className="font-mono text-2xs text-muted">
          {fill(copy.ticker.paperRealizedHistory, {
            value: `${paper.realized.total >= 0 ? "+" : "−"}${price(Math.abs(paper.realized.total))}`,
            n: paper.realized.count,
          })}
        </p>
      ) : null}
    </div>
  );
}
