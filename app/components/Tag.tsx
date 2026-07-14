import { cx } from "@/lib/cx";

/**
 * Tag — the chips of the design system.
 *
 * The redesign relaxed one rule here and kept the other, and the difference between them is the
 * difference between taste and honesty:
 *
 *  1. RELAXED (§2.1 A4). Tiers used to be neutral grey squares, because a Desk full of coloured
 *     badges was the failure mode being guarded against. Colour is now allowed — soft washes, AA
 *     text — because the guard was aimed at the wrong thing. "Confetti" is colour without meaning;
 *     these carry meaning.
 *
 *  2. KEPT, and non-negotiable. **The word is always inside the chip.** A coloured dot is not a
 *     claim; the word beside it is. Colour is the redundant channel here, never the primary one,
 *     so a colourblind reader loses precisely nothing.
 *
 * And one rule that shapes the palette itself: **no tier, grade, or chip may sit in the
 * amber–orange region** (§3.3). Amber is RESERVED — its consumer list is short, closed, and
 * registered in `scripts/check-drift.mjs` (`ALERT_ALLOWED`), which is the truth; this comment
 * deliberately does not restate the count, because the count is what rots. The reservation is
 * perceptual, not hex-deep. A Desk full of amber-ish "moderate" chips would drown the gate flag
 * even if no chip shared its exact value. That is why "moderate" and "mixed" are teal: green →
 * teal → grey is an ordinal ramp, which is what an evidence scale wants anyway.
 */

/** The four evidence grades from the Research Report Part 4 ledger. */
export type EvidenceGrade = "supported" | "mixed" | "weak" | "folklore";

/** The three tendency tiers from the fixed lexicon. */
export type TierName = "strong" | "moderate" | "weak";

type TagProps =
  | {
      /** A tendency tier from the fixed lexicon. Coloured, with the word always inside. */
      variant: "tier";
      tier: TierName;
      children: React.ReactNode;
    }
  | {
      /** An evidence grade from the ledger: shown in Academy contexts, scan presets, decay stamps. */
      variant: "grade";
      grade: EvidenceGrade;
      children: React.ReactNode;
    }
  | {
      /** A catalyst type, a calendar code, a proxy marker. Neutral — it classifies, it does not rate. */
      variant: "catalyst";
      children: React.ReactNode;
    }
  | {
      /** Folklore, labelled as folklore. The word is not optional (§1.5, rule 5). */
      variant: "folklore";
    };

/** Tier chips: text colour on its own soft wash. Moderate is teal, never amber (see above). */
const TIER_CHIP: Record<TierName, string> = {
  strong: "border-tier-strong-wash bg-tier-strong-wash text-tier-strong",
  moderate: "border-tier-moderate-wash bg-tier-moderate-wash text-tier-moderate",
  weak: "border-tier-weak-wash bg-tier-weak-wash text-tier-weak",
};

/**
 * The evidence-grade dots. This is the ONLY place a grade colour is applied, and it is always
 * accompanied by the grade's name in text.
 */
const GRADE_DOT: Record<EvidenceGrade, string> = {
  supported: "bg-grade-supported",
  mixed: "bg-grade-mixed",
  weak: "bg-grade-weak",
  folklore: "bg-grade-folklore",
};

/**
 * The 6px dot that precedes a grade label.
 *
 * It was a 2px-radius square in the old system, when the app's only radius was 2px. It is round
 * now (the pill amendment, §4.1), and it is decorative — `aria-hidden`, because the word carries
 * the claim.
 */
function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cx("inline-block size-1.5 rounded-pill", className)} />;
}

/** The shared chip shell: mono, uppercase, tracked, 8px radius. */
const SHELL =
  "inline-flex items-center gap-1.5 rounded-chip border px-1.5 py-0.5 " +
  "font-mono text-2xs font-medium uppercase tracking-[0.04em]";

export function Tag(props: TagProps) {
  if (props.variant === "folklore") {
    return (
      <span className={cx(SHELL, "border-hairline bg-surface text-grade-folklore")}>
        <Dot className={GRADE_DOT.folklore} />
        FOLKLORE
      </span>
    );
  }

  if (props.variant === "grade") {
    return (
      <span className={cx(SHELL, "border-hairline bg-surface text-ink")}>
        <Dot className={GRADE_DOT[props.grade]} />
        {props.children}
      </span>
    );
  }

  if (props.variant === "tier") {
    return <span className={cx(SHELL, TIER_CHIP[props.tier])}>{props.children}</span>;
  }

  // catalyst — neutral by design: it names a kind of thing, it does not grade it.
  return <span className={cx(SHELL, "border-hairline bg-surface text-ink-2")}>{props.children}</span>;
}
