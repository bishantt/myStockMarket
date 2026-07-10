import { cx } from "@/lib/cx";

/**
 * Tag — the only coloured chip that exists in this app.
 *
 * Where a conventional product would scatter coloured badges, this one sets an uppercase
 * typographic label inside a hairline box (plan §3.6). Tags are information, never decoration:
 * if a tag is not telling the reader something they could act on, it should not be there.
 *
 * Two rules the design depends on, both enforced by the type signature below:
 *
 *  1. A tier tag NEVER uses amber. Amber has exactly two consumers in the whole app (§3.3),
 *     and neither is a tier. Ten setup cards firing at once must not turn the Desk amber, so
 *     tiers render as a neutral grey square plus the lexicon word (Research Report §9.7).
 *
 *  2. An evidence-grade square never appears alone. A coloured square is not a claim; the word
 *     beside it is. So `grade` renders its label as text, always.
 */

/** The four evidence grades from the Research Report Part 4 ledger. */
export type EvidenceGrade = "supported" | "mixed" | "weak" | "folklore";

type TagProps =
  | {
      /** A tendency tier from the fixed lexicon. Neutral grey, by law. */
      variant: "tier";
      children: React.ReactNode;
    }
  | {
      /** An evidence grade from the ledger: shown in Academy contexts, scan presets, decay stamps. */
      variant: "grade";
      grade: EvidenceGrade;
      children: React.ReactNode;
    }
  | {
      /** A catalyst type — earnings, analyst, macro. Plain, no square. */
      variant: "catalyst";
      children: React.ReactNode;
    }
  | {
      /** Folklore, labelled as folklore. The word is not optional (plan §1.5, rule 5). */
      variant: "folklore";
    };

/**
 * The evidence-grade colours. Note these are the ONLY place a grade colour is applied, and
 * they are always accompanied by the grade's name in text — colour is the redundant channel
 * here, not the primary one, so a colourblind reader loses nothing.
 */
const GRADE_SQUARE: Record<EvidenceGrade, string> = {
  supported: "bg-grade-supported",
  mixed: "bg-grade-mixed",
  weak: "bg-grade-weak",
  folklore: "bg-grade-folklore",
};

/**
 * The small square that precedes a tier or grade label.
 *
 * The plan calls this a "dot". It is rendered as a 6px square with the app's 2px radius rather
 * than a circle, for two reasons: it matches the IconArray's squares (§3.6), and a
 * `rounded-full` utility would trip the anti-drift grep that bans radii above 2px (§3.10).
 */
function Square({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block size-1.5 rounded-edge", className)}
    />
  );
}

export function Tag(props: TagProps) {
  // Uppercase with tracking, not synthesized small-caps: Archivo ships no `smcp` feature, and
  // faking it produces the wrong stroke weights (plan §3.1).
  const shell =
    "inline-flex items-center gap-1.5 rounded-edge border border-hairline " +
    "px-1.5 py-0.5 font-ui text-2xs font-medium uppercase tracking-[0.04em] text-ink";

  if (props.variant === "folklore") {
    return (
      <span className={shell}>
        <Square className={GRADE_SQUARE.folklore} />
        FOLKLORE
      </span>
    );
  }

  if (props.variant === "grade") {
    return (
      <span className={shell}>
        <Square className={GRADE_SQUARE[props.grade]} />
        {props.children}
      </span>
    );
  }

  if (props.variant === "tier") {
    return (
      <span className={shell}>
        <Square className="bg-muted" />
        {props.children}
      </span>
    );
  }

  return <span className={shell}>{props.children}</span>;
}
