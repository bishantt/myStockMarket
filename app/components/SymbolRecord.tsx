import { BaseRate } from "@/components/BaseRate";
import { OutcomeChip } from "@/components/OutcomeChip";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";
import type { SymbolRecord as Record } from "@/lib/record";
import { formatUtcDate } from "@/lib/time";

/**
 * SymbolRecord — our own ledger's evidence on one name (PD8, plan 9.6 block 7 / 10.1 block 5).
 *
 * The story page and the ticker page both open a window into `signal_log` / `setup_card` for a
 * symbol, and both must render it the SAME way — so it is one component, fed by one loader
 * (`lib/record.ts`). It is REUSE of the honesty furniture, not new probability UI: the base rate
 * renders through `BaseRate` (the N-gate, the interval and the WEAK cap travel with it), and the
 * resolved outcomes render through `OutcomeChip`, where a hit and a miss are the same element with
 * one token swapped — equal weight, structurally.
 *
 * WHY THE SETUP CARD IS READ-ONLY HERE. The Desk's interactive `SetupCards` carries weakener
 * checkboxes that WRITE through a server action scoped to the Desk. Rendering that action off the
 * Desk would revalidate a path this page is not — the exact cache hazard this build has been bitten
 * by more than once. So the record shows the base-rate EVIDENCE (which is the honesty requirement:
 * "N-gates and CI displays intact"); the weakener interactivity stays a Desk affordance.
 *
 * The CALLER owns the empty state (`hasRecord`) and the section heading — this renders the body, and
 * an empty record renders nothing at all (P9).
 */
export function SymbolRecord({ record }: { record: Record }) {
  const { activeSignals, setupCard, resolved } = record;
  const resolvedTotal = resolved.hits + resolved.misses;

  return (
    <div className="flex flex-col gap-3">
      {setupCard ? (
        <Surface level="tinted" className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base text-ink">{setupCard.patternLabel}</span>
            <Tag variant="tier" tier={setupCard.tier}>
              {copy.tier[setupCard.tier]}
            </Tag>
          </div>
          <p className="font-serif text-sm text-ink-2">{setupCard.cause}</p>
          <BaseRate data={setupCard.baseRate} />
        </Surface>
      ) : null}

      {activeSignals.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {activeSignals.map((signal) => (
            <li
              key={`${signal.patternKey}-${signal.firedDate.toISOString()}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <span className="font-ui text-sm text-ink">{signal.patternLabel}</span>
              <span className="font-mono text-2xs text-muted">
                {fill(copy.record.firedResolves, {
                  fired: formatUtcDate(signal.firedDate),
                  resolves: formatUtcDate(signal.resolvesOn),
                })}
                {" · "}
                {fill(copy.record.horizon, { n: signal.horizonDays })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {resolvedTotal > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            {copy.record.resolvedHere}
          </span>
          {resolved.hits > 0 ? (
            <OutcomeChip
              tone="positive"
              label={fill(
                resolved.hits === 1 ? copy.record.hitCount : copy.record.hitCountPlural,
                { n: resolved.hits },
              )}
            />
          ) : null}
          {resolved.misses > 0 ? (
            <OutcomeChip
              tone="negative"
              label={fill(
                resolved.misses === 1 ? copy.record.missCount : copy.record.missCountPlural,
                { n: resolved.misses },
              )}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
