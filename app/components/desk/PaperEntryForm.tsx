"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { openPaperTrade, type PaperResult } from "@/app/(desk)/paper/paper-actions";
import { Combobox } from "@/components/form/Combobox";
import { SegmentedControl } from "@/components/form/SegmentedControl";
import { Stepper } from "@/components/form/Stepper";
import { Surface } from "@/components/Surface";
import { COOLING_OFF_MINUTES } from "@/lib/constants";
import { copy, fill } from "@/lib/copy";
import { percent, price } from "@/lib/format";
import { lastServedClose, searchInstruments } from "@/lib/instruments";
import { needsCoolingOff } from "@/lib/ledger";
import { halfKellyFraction } from "@/lib/paper";
import { formatUtcDate } from "@/lib/time";

/**
 * PaperEntryForm — the ticket (APP-FEEL-PLAN §4.3).
 *
 * It used to be five fields in a `flex flex-wrap` row, every one of them typed by hand: a free-text
 * symbol with no autocomplete (while the Instrument table sat there holding a name for every ticker
 * in the universe), two native `<select>`s, and a required reference price the reader had to go and
 * find somewhere else. At intermediate widths the fields drifted out of alignment, because that is
 * what wrapping rows do.
 *
 * Now it is a ticket: ONE COLUMN, at every width, inside the page's 62ch measure.
 *
 * One column is reasoned, not defaulted, and it supersedes the redesign's "2-col ≥md": five fields do
 * not amortise a grid — a two-column split saves two rows and buys a zigzag tab order; inside a 540px
 * measure two columns yield ~250px controls, too narrow for the combobox and for the stepper with its
 * presets; and the old form's misalignment was CAUSED by multi-field rows reflowing, which a single
 * column cannot do. One decision per row is also the pace this room is built for — the same design
 * language as the cooling-off pause.
 *
 * TWO THINGS HERE ARE HONESTY RULES, NOT ERGONOMICS.
 *
 * **SIDE HAS NO DEFAULT (ruling M9).** Quantity, bucket and price keep helpful defaults, because they
 * are parameters. Side is the DECISION. The old form quietly pre-selected "buy" — a nudge, on the one
 * surface whose entire design (the cost mirror, the cooling-off pause) exists to slow that decision
 * down. Submitting without a side is a plain validation message, not a shove. Cost: one tap.
 *
 * **THE LAST-CLOSE CHIP CARRIES ITS DATE, AND FILLS ONLY WHEN TAPPED.** A served bar can be days old
 * around a holiday or a data gap. "Last close" without its date is an implicit freshness claim the
 * reader cannot check: the disclaimer covers LIVENESS ("a reference, not a quote"), the date covers
 * AGE. Two different lies, two cures, both on the chip. It never auto-fills — the reference price is
 * the reader's own number, and the applied COST is the lesson, not the price's accuracy.
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
  const coolOffRef = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showCoolOff, setShowCoolOff] = useState(false);

  // The symbol in the field, and the last served bar for it (null for the ~99% of names with none).
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [lastClose, setLastClose] = useState<{ close: number; date: Date } | null>(null);
  const [referenceOpen, setReferenceOpen] = useState("");

  // Half-Kelly helper state (kept separate from the order — it is a calculator, not a field).
  const [winPct, setWinPct] = useState(55);
  const [payoff, setPayoff] = useState(1.5);
  const suggested = halfKellyFraction(winPct / 100, payoff);

  const coolingOff = signalViewedAt ? needsCoolingOff(new Date(signalViewedAt), new Date()) : false;

  // Look up the symbol's most recent served bar. Only the served set — the indices, the sector ETFs
  // and the watchlist — has bars, so for most names this finds nothing and no chip renders.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = symbol.trim() ? await lastServedClose(symbol) : null;
      if (!cancelled) setLastClose(found);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbol]);

  // Focus moves to the interstitial when it opens (redesign §4.3) — a pause you can tab past is not
  // a pause.
  useEffect(() => {
    if (showCoolOff) coolOffRef.current?.focus();
  }, [showCoolOff]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (coolingOff && !confirmed) {
      event.preventDefault();
      setShowCoolOff(true);
    }
  }

  function proceed() {
    setConfirmed(true);
    setShowCoolOff(false);
    // The reader has seen the pause and chosen anyway. That is their right; the pause was the point.
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return (
    <div className="flex max-w-[62ch] flex-col gap-5 pt-4">
      <Surface className="p-5">
        <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
          {signalViewedAt ? <input type="hidden" name="signalViewedAt" value={signalViewedAt} /> : null}

          <Combobox
            name="symbol"
            label="Symbol"
            defaultValue={defaultSymbol}
            search={searchInstruments}
            onSelect={setSymbol}
          />

          {/* No defaultValue. That absence IS ruling M9, and it is why this control exists. */}
          <SegmentedControl
            name="side"
            legend="Side"
            required
            options={[
              { value: "buy", label: "Buy" },
              { value: "sell", label: "Sell (short)" },
            ]}
          />

          {/* A parameter, so it keeps its default. */}
          <SegmentedControl
            name="bucket"
            legend="Bucket"
            defaultValue="large-mid"
            options={[
              { value: "large-mid", label: "Large / mid", detail: "20bp" },
              { value: "small", label: "Small", detail: "60bp" },
            ]}
          />

          <Stepper name="quantity" label="Quantity" defaultValue={10} min={1} presets={[10, 25, 50, 100]} />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="referenceOpen"
              className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted"
            >
              Reference open
            </label>
            <input
              id="referenceOpen"
              name="referenceOpen"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              value={referenceOpen}
              onChange={(event) => setReferenceOpen(event.target.value)}
              className="min-h-11 w-full rounded-control border border-hairline bg-surface px-3 font-mono text-input-touch text-ink"
            />

            {lastClose ? (
              <button
                type="button"
                onClick={() => setReferenceOpen(String(lastClose.close))}
                className="mt-1 flex min-h-11 w-fit items-center rounded-pill border border-hairline px-3 font-ui text-2xs text-ink-2 touch-manipulation hover:border-hairline-strong"
              >
                {fill(copy.paper.lastClose, {
                  date: formatUtcDate(lastClose.date),
                  price: price(lastClose.close),
                })}
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            className="min-h-11 w-full rounded-control bg-[image:var(--gradient-brand)] px-4 font-ui text-sm font-semibold text-white md:w-fit"
          >
            Place paper trade
          </button>

          {state.ok === false && state.error ? (
            <p role="alert" className="font-ui text-2xs text-down-text">
              {state.error}
            </p>
          ) : null}
        </form>
      </Surface>

      {/*
       * THE COOLING-OFF INTERSTITIAL — a pause, not a block.
       *
       * "Sit with it" is the PRIMARY button and "Proceed" is the quiet one. That inversion is the one
       * place in the app where the calm choice gets the loud treatment, and it is deliberate:
       * everywhere else the accent means "you can act here", and here, acting is the thing worth
       * hesitating over. Escape means "sit with it" too.
       *
       * Until F4 this mechanic had NO PRODUCER. Nothing in the product ever constructed the URL that
       * arms it — only the e2e test did. The setup-card doorway (ruling M10) is what finally makes it
       * fire for a reader who walks from a signal to a ticket inside the window.
       */}
      {showCoolOff ? (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" style={{ background: "var(--scrim)" }} />
          <div
            ref={coolOffRef}
            role="alertdialog"
            aria-label="Cooling-off"
            aria-modal="true"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowCoolOff(false);
            }}
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,52ch)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-hairline bg-surface-solid p-5 shadow-panel outline-none"
          >
            <p className="font-prose text-prose text-ink">
              {fill(copy.coolingOff.body, {
                min: COOLING_OFF_MINUTES,
                rate: "the one shown on the setup card",
              })}
            </p>
            <div className="flex flex-wrap gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowCoolOff(false)}
                className="min-h-11 flex-1 rounded-control bg-[image:var(--gradient-brand)] px-4 font-ui text-sm font-semibold text-white"
              >
                Sit with it
              </button>
              <button
                type="button"
                onClick={proceed}
                className="min-h-11 rounded-control border border-hairline px-4 font-ui text-sm text-ink-2 hover:border-hairline-strong"
              >
                Proceed
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/*
       * THE SIZING HELPER — a suggestion capped at half of Kelly, and a teaching device.
       *
       * Deliberately NOT wired to any base rate. The reader reads a card's interval and types its
       * LOWER bound in here themselves. That act is the lesson; auto-filling it would make the helper
       * a conviction dial, which is the one thing it must never be.
       */}
      <Surface level="tinted" className="p-4">
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink">Sizing helper</p>
        <p className="pt-1 font-prose text-sm text-ink-2">
          A size suggestion capped at half of Kelly, from a win rate (use the interval&rsquo;s lower
          bound) and a payoff ratio. It is a teaching device, never a conviction dial.
        </p>
        <div className="flex flex-wrap items-end gap-4 pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Win rate %</span>
            <input
              type="number"
              min="0"
              max="100"
              inputMode="decimal"
              value={winPct}
              onChange={(event) => setWinPct(Number(event.target.value))}
              className="min-h-11 w-24 rounded-control border border-hairline bg-surface px-3 font-mono text-input-touch text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Payoff ratio</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={payoff}
              onChange={(event) => setPayoff(Number(event.target.value))}
              className="min-h-11 w-24 rounded-control border border-hairline bg-surface px-3 font-mono text-input-touch text-ink"
            />
          </label>
          <p className="font-prose text-sm text-ink">
            Suggested: <span className="font-mono">{percent(suggested, 1)}</span> of capital
          </p>
        </div>
      </Surface>
    </div>
  );
}
