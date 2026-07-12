"use client";

import { useActionState } from "react";

import { closePaperTrade, type PaperResult } from "@/app/(desk)/paper/paper-actions";
import { realizedPnl, type PaperTradeRow } from "@/lib/ledger";

/**
 * PaperLedger — the open and closed paper trades (plan §7 P6 step 1).
 *
 * Open trades carry a small close form (an exit reference price → a simulated closing fill). Closed
 * trades show their realized P&L, the misses first-class beside the wins. Mono numerals, hairlines,
 * no colour on the money except the tiny directional sign — the calm-tech money rule (§3).
 */
export function PaperLedger({ open, closed }: { open: PaperTradeRow[]; closed: PaperTradeRow[] }) {
  return (
    <div className="flex flex-col gap-6 pt-3">
      <div>
        <p className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Open</p>
        {open.length === 0 ? (
          <p className="pt-2 font-ui text-sm text-muted">— No open paper trades.</p>
        ) : (
          <ul className="pt-2">
            {open.map((trade) => (
              <li key={trade.id} className="flex flex-wrap items-center gap-3 border-b border-hairline py-2">
                <span className="font-mono text-sm text-ink">{trade.symbol}</span>
                <span className="font-ui text-2xs uppercase tracking-[0.05em] text-ink-2">
                  {trade.side} {trade.quantity} @ {trade.fillPrice.toFixed(2)}
                </span>
                <span className="font-ui text-2xs text-muted">cost {trade.costBps.toFixed(0)}bp</span>
                <CloseForm tradeId={trade.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Closed</p>
        {closed.length === 0 ? (
          <p className="pt-2 font-ui text-sm text-muted">— No closed paper trades yet.</p>
        ) : (
          <ul className="pt-2">
            {closed.map((trade) => {
              const pnl = realizedPnl(trade) ?? 0;
              return (
                <li key={trade.id} className="flex flex-wrap items-center gap-3 border-b border-hairline py-2">
                  <span className="font-mono text-sm text-ink">{trade.symbol}</span>
                  <span className="font-ui text-2xs uppercase tracking-[0.05em] text-ink-2">
                    {trade.side} {trade.quantity} @ {trade.fillPrice.toFixed(2)} →{" "}
                    {trade.exitFillPrice?.toFixed(2)}
                  </span>
                  <span className="font-mono text-sm text-ink">
                    {pnl >= 0 ? "+" : "−"}
                    {Math.abs(pnl).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CloseForm({ tradeId }: { tradeId: string }) {
  const [state, formAction] = useActionState<PaperResult, FormData>(closePaperTrade, { ok: true });
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tradeId" value={tradeId} />
      <input
        name="exitReferenceOpen"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="exit"
        required
        className="min-h-11 w-20 rounded-control border border-hairline bg-surface px-2 py-0.5 font-mono text-input-touch md:text-sm text-ink"
      />
      <button
        type="submit"
        className="min-h-11 rounded-control border border-hairline px-2 py-0.5 font-ui text-2xs uppercase tracking-[0.05em] text-ink hover:border-accent"
      >
        Close
      </button>
      {state.ok === false && state.error ? <span className="font-ui text-2xs text-down">{state.error}</span> : null}
    </form>
  );
}
