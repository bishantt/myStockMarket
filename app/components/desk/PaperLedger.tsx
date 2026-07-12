"use client";

import { useActionState, useMemo } from "react";

import { closePaperTrade, type PaperResult } from "@/app/(desk)/paper/paper-actions";
import { DataTable } from "@/components/DataTable";
import { Disclosure } from "@/components/Disclosure";
import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { decimal, price } from "@/lib/format";
import { realizedPnl, type PaperTradeRow } from "@/lib/ledger";
import type { Column } from "@/lib/table";

/**
 * PaperLedger — the open and closed paper trades (APP-FEEL-PLAN §4.3).
 *
 * Two `<ul>`s became two tables, and the whole surface stopped calling `.toFixed()` on money. That
 * second part is the honesty change: every figure in this room now goes through `lib/format`, which
 * means the minus sign on a loss is a TRUE minus (U+2212) and not a hyphen, and prices are grouped
 * and aligned the way they are everywhere else in the app. Drift rule 12 seals that door behind us.
 *
 * **REALIZED P&L RENDERS AS AN OUTCOME CHIP, WITH THE WORD IN IT.** Not a coloured number — a chip
 * that says "gain" or "loss" beside the figure. Colour is the redundant channel, never the primary
 * one (P7): a loss reads as a loss for the ~1-in-12 readers who cannot rely on the hue, and it reads
 * as a loss in a grey-scale screenshot. A gain and a loss render at the same size and the same
 * weight; only the word and the hue differ.
 *
 * P&L is also never a hero figure (§3.10-2). It sits at the row's text size, like everything else.
 */

type LedgerRow = PaperTradeRow & { pnl: number | null };

export function PaperLedger({ open, closed }: { open: PaperTradeRow[]; closed: PaperTradeRow[] }) {
  const openRows: LedgerRow[] = useMemo(() => open.map((t) => ({ ...t, pnl: null })), [open]);
  const closedRows: LedgerRow[] = useMemo(
    () => closed.map((t) => ({ ...t, pnl: realizedPnl(t) })),
    [closed],
  );

  /** Open trades: what you hold, what it cost you to get there, and a way out. */
  const openColumns: Column<LedgerRow>[] = useMemo(
    () => [
      { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (t) => t.symbol },
      { key: "side", header: "Side", kind: "text", priority: 2, value: (t) => t.side },
      { key: "quantity", header: "Qty", kind: "int", priority: 2, value: (t) => t.quantity },
      { key: "fillPrice", header: "Fill", kind: "price", priority: 1, value: (t) => t.fillPrice },
      {
        key: "costBps",
        header: "Cost",
        kind: "int",
        priority: 2,
        value: (t) => t.costBps,
        // The cost is the lesson of this room, so it is spelled out in its own unit rather than left
        // as a bare integer the reader has to decode.
        render: (t) => <span className="font-mono tabular-nums">{decimal(t.costBps, 0)} bp</span>,
      },
      {
        key: "close",
        header: "Close",
        kind: "text",
        priority: 1,
        sortable: false,
        value: () => "",
        render: (t) => <CloseForm tradeId={t.id} />,
      },
    ],
    [],
  );

  /** Closed trades: the record, gains and losses at the same weight. */
  const closedColumns: Column<LedgerRow>[] = useMemo(
    () => [
      { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (t) => t.symbol },
      {
        key: "pnl",
        header: "Realized",
        kind: "text",
        priority: 1,
        value: (t) => t.pnl,
        render: (t) => <OutcomeChip pnl={t.pnl ?? 0} />,
      },
      { key: "side", header: "Side", kind: "text", priority: 2, value: (t) => t.side },
      { key: "quantity", header: "Qty", kind: "int", priority: 2, value: (t) => t.quantity },
      {
        key: "fills",
        header: "Fill → Exit",
        kind: "text",
        priority: 2,
        sortable: false,
        value: (t) => t.fillPrice,
        render: (t) => (
          <span className="font-mono tabular-nums">
            {price(t.fillPrice)} → {t.exitFillPrice === null ? "—" : price(t.exitFillPrice)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6 pt-3">
      <section aria-label="Open paper trades">
        <h3 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">Open</h3>
        {openRows.length === 0 ? (
          <p className="pt-2 font-ui text-sm text-muted">— No open paper trades.</p>
        ) : (
          <div className="pt-2">
            <DataTable
              columns={openColumns}
              rows={openRows}
              defaultSort={{ key: "symbol", dir: "asc" }}
              rowKey={(t) => t.id}
              ariaLabel="Open paper trades"
              perPage={25}
            />
          </div>
        )}
      </section>

      {/*
       * Closed trades fold away, and that is legal under ruling M2 because nothing up here CLAIMS
       * anything about them: the disclosure states its own count, and no summary above it says "all
       * trades" or reports a win rate that the folded rows would contradict. A caveat may collapse
       * with its claim; a claim may never have a hidden caveat. There is no claim here to hide.
       */}
      <section aria-label="Closed paper trades">
        {closedRows.length === 0 ? (
          <>
            <h3 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">Closed</h3>
            <p className="pt-2 font-ui text-sm text-muted">— No closed paper trades yet.</p>
          </>
        ) : (
          <Disclosure label={copy.paper.closedTrades} count={closedRows.length} context="all time">
            <div className="pt-2">
              <DataTable
                columns={closedColumns}
                rows={closedRows}
                // Recency of closing is neutral bookkeeping, not a ranking.
                defaultSort={{ key: "symbol", dir: "asc" }}
                rowKey={(t) => t.id}
                ariaLabel="Closed paper trades"
                perPage={25}
              />
            </div>
          </Disclosure>
        )}
      </section>
    </div>
  );
}

/**
 * The realized-P&L chip. The WORD is the primary channel; the colour is the redundant one (P7).
 *
 * `data-p2`: this is money, so nothing may animate it — and because the DataTable is P2-bearing by
 * construction, nothing in that file animates anything.
 */
function OutcomeChip({ pnl }: { pnl: number }) {
  const gain = pnl >= 0;
  return (
    <span
      data-p2="true"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 font-mono text-2xs tabular-nums",
        gain ? "bg-up-wash text-up-text" : "bg-down-wash text-down-text",
      )}
    >
      <span>
        {gain ? "+" : "−"}
        {price(Math.abs(pnl))}
      </span>
      <span className="uppercase tracking-[0.08em]">{gain ? "gain" : "loss"}</span>
    </span>
  );
}

/** The way out of an open trade: an exit reference price → a simulated closing fill. */
function CloseForm({ tradeId }: { tradeId: string }) {
  const [state, formAction] = useActionState<PaperResult, FormData>(closePaperTrade, { ok: true });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tradeId" value={tradeId} />
      <input
        name="exitReferenceOpen"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="exit"
        required
        inputMode="decimal"
        aria-label="Exit reference price"
        className="min-h-11 w-24 rounded-control border border-hairline bg-surface px-2 font-mono text-input-touch text-ink"
      />
      <button
        type="submit"
        className="min-h-11 rounded-control border border-hairline px-3 font-ui text-2xs uppercase tracking-[0.05em] text-ink touch-manipulation hover:border-accent"
      >
        Close
      </button>
      {state.ok === false && state.error ? (
        <span role="alert" className="font-ui text-2xs text-down-text">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
