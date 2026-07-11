"use client";

import { useActionState, useRef, useState } from "react";

import { openPaperTrade, type PaperResult } from "@/app/(desk)/paper/paper-actions";
import { needsCoolingOff } from "@/lib/ledger";
import { halfKellyFraction } from "@/lib/paper";
import { COOLING_OFF_MINUTES } from "@/lib/constants";
import { copy, fill } from "@/lib/copy";

/**
 * PaperEntryForm — placing a paper trade, with two friction surfaces (plan §7 P6 step 2).
 *
 * The cooling-off interstitial fires when the order follows a fired signal viewed less than the
 * cooling-off window ago: it does not block, it makes the reader pause and confirm. The half-Kelly
 * sizing helper turns a win rate and payoff ratio into a suggested fraction, capped at half-Kelly —
 * a teaching device, never a conviction dial. A client component because both are interactive.
 */
export function PaperEntryForm({
  defaultSymbol,
  signalViewedAt,
}: {
  defaultSymbol: string;
  signalViewedAt: string | null;
}) {
  const [state, formAction] = useActionState<PaperResult, FormData>(openPaperTrade, { ok: true });
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showCoolOff, setShowCoolOff] = useState(false);

  // Half-Kelly helper state (kept separate from the order — it is a calculator, not a field).
  const [winPct, setWinPct] = useState(55);
  const [payoff, setPayoff] = useState(1.5);
  const suggested = halfKellyFraction(winPct / 100, payoff);

  const coolingOff = signalViewedAt ? needsCoolingOff(new Date(signalViewedAt), new Date()) : false;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (coolingOff && !confirmed) {
      event.preventDefault();
      setShowCoolOff(true);
    }
  }

  function proceed() {
    setConfirmed(true);
    setShowCoolOff(false);
    // Let React set state, then submit the underlying form.
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return (
    <div className="pt-4">
      <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
        {signalViewedAt ? <input type="hidden" name="signalViewedAt" value={signalViewedAt} /> : null}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Symbol</span>
            <input
              name="symbol"
              defaultValue={defaultSymbol}
              required
              className="w-28 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm uppercase text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Side</span>
            <select name="side" className="rounded-edge border border-hairline bg-surface px-2 py-1 font-ui text-sm text-ink">
              <option value="buy">Buy</option>
              <option value="sell">Sell (short)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Bucket</span>
            <select name="bucket" className="rounded-edge border border-hairline bg-surface px-2 py-1 font-ui text-sm text-ink">
              <option value="large-mid">Large / mid (20bp)</option>
              <option value="small">Small (60bp)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Quantity</span>
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue="10"
              required
              className="w-24 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Reference open</span>
            <input
              name="referenceOpen"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="w-28 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
            />
          </label>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-edge border border-hairline px-4 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-ink hover:border-accent"
          >
            Place paper trade
          </button>
        </div>

        {state.ok === false && state.error ? (
          <p className="font-ui text-2xs text-down">{state.error}</p>
        ) : null}
        {state.ok && "error" in state === false && confirmed ? null : null}
      </form>

      {/* COOLING-OFF INTERSTITIAL — a pause, not a block (Appendix J coolingOff.body). */}
      {showCoolOff ? (
        <div role="alertdialog" aria-label="Cooling-off" className="mt-3 max-w-[60ch] rounded-edge border border-hairline bg-surface p-4">
          <p className="font-prose text-sm text-ink">
            {fill(copy.coolingOff.body, { min: COOLING_OFF_MINUTES, rate: "the one shown on the setup card" })}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={proceed}
              className="rounded-edge border border-hairline px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-ink hover:border-accent"
            >
              Proceed
            </button>
            <button
              type="button"
              onClick={() => setShowCoolOff(false)}
              className="px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-muted hover:text-ink"
            >
              Sit with it
            </button>
          </div>
        </div>
      ) : null}

      {/* HALF-KELLY SIZING HELPER — a suggestion, capped at half-Kelly (plan §8.1). */}
      <div className="mt-5 max-w-[60ch] rounded-edge border border-hairline p-4">
        <p className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-ink">Sizing helper</p>
        <p className="pt-1 font-prose text-sm text-ink-2">
          A size suggestion capped at half of Kelly, from a win rate (use the interval&rsquo;s lower
          bound) and a payoff ratio. It is a teaching device, never a conviction dial.
        </p>
        <div className="flex flex-wrap items-end gap-4 pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Win rate %</span>
            <input
              type="number"
              min="0"
              max="100"
              value={winPct}
              onChange={(e) => setWinPct(Number(e.target.value))}
              className="w-24 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Payoff ratio</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={payoff}
              onChange={(e) => setPayoff(Number(e.target.value))}
              className="w-24 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
            />
          </label>
          <p className="font-prose text-sm text-ink">
            Suggested: <span className="font-mono">{(suggested * 100).toFixed(1)}%</span> of capital
          </p>
        </div>
      </div>
    </div>
  );
}
