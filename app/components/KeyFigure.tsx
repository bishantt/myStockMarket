import { splitVerified } from "@/lib/verified";
import type { VerifiedFigure } from "@/lib/verified";

/**
 * KeyFigure — a verified number inside prose (PD5, plan §8.2.3, ruling E5).
 *
 * Set in JetBrains Mono 500, at the SIZE OF THE SURROUNDING TEXT, in ink. No colour, no highlight,
 * no size bump. The emphasis is the TYPEFACE, and the typeface is a receipt: it says *this figure
 * was checked against its source by the deterministic gate.*
 *
 * Everything this component refuses to do is as designed as what it does:
 *
 *   · NO COLOUR. A hue would have to mean something (E6 keeps a short dictionary, and "verified" is
 *     not in it). Direction already owns the up/down pair; a third meaning painted onto a figure in
 *     a headline would dilute the two that carry real information.
 *   · NO BOLD. The type system loads Newsreader in roman and italic and NOTHING ELSE, so a bold
 *     inside prose would be SYNTHESIZED by the browser — fake bold, banned by the type system's own
 *     reasoning. Mono 500 is a weight that actually exists in the files we ship.
 *   · NO SIZE CHANGE beyond the optical correction below. A number that grew would be shouting, and
 *     a verified number is not more important than the sentence around it — it is just checkable.
 *
 * `text-[0.92em]` is the one liberty, and it is not emphasis: JetBrains Mono runs optically larger
 * than Newsreader and Inter at the same nominal size, so a mono figure dropped into a serif sentence
 * bulges. The 8% correction is what makes it sit level with the prose — it is there to make the
 * figure LESS conspicuous, not more.
 *
 * ── THE GUARD (E5) ───────────────────────────────────────────────────────────────────────────────
 *
 * This component accepts a `VerifiedFigure` and nothing else. That type has exactly one mint —
 * `splitVerified`, which checks candidates against the allow-list the pipeline's gate produced — so
 * emphasizing an arbitrary string is a TYPE ERROR before it is anything else.
 *
 * The runtime check below is for the boundary the compiler cannot see: a row out of a JSON parse, an
 * `any`, a future caller in plain JavaScript. In development it THROWS, loudly, naming the value —
 * because a mis-emphasized figure is the app vouching for a number nobody checked, and that is a
 * defect, not a cosmetic slip. In production it renders the value as PLAIN TEXT: the reader still
 * sees the number (deleting it would be worse — the sentence would stop making sense), it simply
 * carries no claim. Fail loud in dev, fail HONEST in prod.
 */
export function KeyFigure({ figure }: { figure: VerifiedFigure }) {
  if (figure?.verified !== true) {
    const value = typeof figure?.value === "string" ? figure.value : String(figure);
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `KeyFigure received an unverified value (${value}). Emphasis is earned by verification ` +
          `(E5): a figure may be set in mono only if the deterministic gate cleared it. Mint it ` +
          `with splitVerified() against the gate's allow-list — never by hand.`,
      );
    }
    // Production: the number reads, and claims nothing.
    return <>{value}</>;
  }

  return (
    // data-p2: a verified figure is a market number, and market numbers do not move (§3.6). The
    // ancestor walk in p2-motion.test.tsx proves nothing above it animates.
    <span data-p2 className="font-mono text-[0.92em] font-medium text-ink">{figure.value}</span>
  );
}

/**
 * A whole sentence, with its verified figures set in mono and everything else left alone.
 *
 * This is the shape almost every consumer wants — a headline, a why-it-matters line, an insight
 * paragraph — and it is the N5 headline renderer, generalized. Before PD5 that logic lived INSIDE
 * NewsCard as an inline `.map` over `emphasizeVerifiedNumbers`, which meant the rule "emphasis is
 * earned" was enforced in exactly one component and re-implementable by hand in every other.
 *
 * `allowed` is the gate's list of cleared figures for THIS text — a news cluster's `key_numbers`.
 * Pass an empty list and nothing is emphasized, which is the honest default rather than a failure.
 */
export function VerifiedProse({ text, allowed }: { text: string; allowed: readonly string[] }) {
  const runs = splitVerified(text, allowed);

  return (
    <>
      {runs.map((run, index) =>
        run.kind === "figure" ? (
          <KeyFigure key={index} figure={run.figure} />
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
