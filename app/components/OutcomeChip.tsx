import { cx } from "@/lib/cx";

/**
 * OutcomeChip — the one outcome chip in this app (PD6, plan §8.2).
 *
 * It says how something TURNED OUT: a signal hit or missed, a paper trade gained or lost, a manual
 * run succeeded or failed. It is the sibling of `DeltaChip`, and the difference between them is
 * worth stating once, here, because it is the reason there are two components and not one:
 *
 *   · A DELTA is a measurement. Its second atom is the WINDOW it was measured over — the number's
 *     unit ("▲ +8.2% · 1D"). Without it the figure means nothing.
 *   · An OUTCOME is a verdict. Its second atom is the WORD for the verdict ("hit", "loss"). The
 *     word is not decoration on the number; on the track record there IS no number, only the word.
 *
 * ── WHY THIS FILE EXISTS: THE PROMISE THAT WAS MADE THREE TIMES AND KEPT ONCE ────────────────────
 *
 * There were three copies of this chip — `TrackRecordTable`'s, `PaperLedger`'s and
 * `PipelinePanel`'s — and each carried its own comment promising the same thing in nearly the same
 * words: "the WORD is the primary channel and the colour is the redundant one; a hit and a miss
 * render at the same size and the same weight". The pipeline panel's copy went further and said
 * *"see the OutcomeChip on the track record, same rule"* — naming the duplication in a comment
 * instead of removing it.
 *
 * THEY HAD ALREADY DRIFTED. Two of the three painted a neutral outcome with `bg-band-outer`; the
 * third used `bg-band`, which is a SOLID mid-purple, under `text-ink-2`, which is nearly black — the
 * one chip in the app whose text did not clear its own background. Nothing failed. Nothing would
 * have. A promise repeated in three comments is not three guards; it is one promise and two places
 * for it to rot, and this is the same law that produced six delta chips.
 *
 * ── EQUAL WEIGHT IS THE HONESTY CLAIM, AND IT IS NOW STRUCTURAL ──────────────────────────────────
 *
 * This product publishes its misses. That is its central claim, and it survives exactly as long as a
 * miss is as loud as a hit. One component means a hit and a miss CANNOT differ except in hue: they
 * are the same element with one token swapped. `OutcomeChip.test.tsx` strips the colour classes off
 * both and asserts the remainder is identical, so a future edit that makes a win bolder fails the
 * build rather than the reader.
 */

/**
 * What KIND of outcome this is — never what colour to paint it.
 *
 * The names are deliberately not "up"/"down"/"green"/"red". A paper trade's gain and a signal's hit
 * are the same KIND of fact (it went the way we said) told about two different things, and the chip
 * should not have to know which room it is standing in. `neutral` is the honest third state: a
 * forecast the market never answered is not a miss, and painting it red would book an unanswered
 * question as a wrong one.
 */
export type OutcomeTone = "positive" | "negative" | "neutral";

const OUTCOME_TONE: Record<OutcomeTone, string> = {
  positive: "bg-up-wash text-up-text",
  negative: "bg-down-wash text-down-text",
  // The soft band wash, NOT `bg-band` — that one is a solid mid-purple, and `text-ink-2` on it was
  // the only chip in the app that failed to clear its own background.
  neutral: "bg-band-outer text-ink-2",
};

export type OutcomeChipProps = {
  tone: OutcomeTone;
  /** The verdict, in words: "hit", "miss", "gain", "loss", "succeeded", "unresolvable". */
  label: string;
  /**
   * The figure the verdict is about, ALREADY FORMATTED — "+$412.30". Optional: the track record and
   * the pipeline panel have a verdict and no figure, and that is not a gap to fill with something.
   *
   * When it IS present the chip is money, and the chip marks itself `data-p2` so the ancestor walk
   * polices everything above it. That is automatic on purpose — a caller cannot pass a money figure
   * and forget to say it is money.
   */
  figure?: string;
};

export function OutcomeChip({ tone, label, figure }: OutcomeChipProps) {
  return (
    <span
      // Money only. A bare verdict word is not a P2 figure, and marking it would point the ancestor
      // walk at surfaces (the pipeline panel's buttons) that it has no business freezing.
      data-p2={figure ? true : undefined}
      className={cx(
        // PD4's wrap contract, same as DeltaChip's: the chip wraps, its atoms never do.
        "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-chip px-2 py-0.5 font-mono text-2xs",
        OUTCOME_TONE[tone],
      )}
    >
      {figure ? <span className="whitespace-nowrap tabular-nums">{figure}</span> : null}
      <span className="whitespace-nowrap uppercase tracking-[0.08em]">{label}</span>
    </span>
  );
}
