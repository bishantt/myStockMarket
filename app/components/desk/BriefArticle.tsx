import Link from "next/link";
import { SectionMasthead } from "@/components/SectionMasthead";
import { TermProse } from "@/components/Term";
import { ExternalLink } from "@/components/ExternalLink";
import { copy } from "@/lib/copy";
import type { BriefItemView, BriefFootnote, BriefView } from "@/lib/briefing";

/**
 * BriefArticle — Desk module 02, the editorial centrepiece (plan §3.6 BriefArticle, §9.2).
 *
 * Newsreader prose over the Desk's ink-and-hairline frame. The "Today's focus" headline is set in
 * display italic — the one literary flourish the whole app allows. Each of the up-to-five items
 * fills its labeled slots (WHAT HAPPENED / WHY IT MATTERS / BY THE NUMBERS / YES, BUT as small
 * caps side-labels), and every claim's sources render as superscript links to the article behind
 * them. Exactly one Academy doorway sits at the end — and only when the lesson manifest knows the
 * slug (empty until P5, so early briefs carry none).
 *
 * When the verification gate held the briefing, none of that renders: the module shows the calm
 * "briefing unavailable" line over the verified scans below. That is the honesty rule in its final
 * form — a withheld briefing beats a fabricated sentence. The unavailable line is neutral ink, not
 * amber: amber is reserved for something DEGRADED (§3.3 — the consumer register is
 * `scripts/check-drift.mjs`'s `ALERT_ALLOWED`), and a whole-briefing hold is not that. It is a calm,
 * honest, working state, like the offline ribbon.
 */

/**
 * The prose slots of a brief item — every key of BriefItemView EXCEPT `citationNumbers`, which is a
 * number[] rather than a sentence. The old type here was `keyof BriefItemView`, which was wide
 * enough to include it; nothing noticed, because the old renderer just interpolated `{item[key]}`
 * and an array stringifies quietly. Handing that array to a component that expects prose is what
 * finally made the compiler say so.
 */
type SlotKey = Exclude<keyof BriefItemView, "citationNumbers">;

const SLOTS: ReadonlyArray<{ key: SlotKey; label: string }> = [
  { key: "whatHappened", label: "What happened" },
  { key: "whyItMatters", label: "Why it matters" },
  { key: "byTheNumbers", label: "By the numbers" },
  { key: "yesBut", label: "Yes, but" },
];

export function BriefArticle({
  asOf,
  editionAsOf,
  brief,
}: {
  asOf: Date;
  /** The edition's own stamp, for the as-of matches/differs treatment (CC4). */
  editionAsOf?: Date;
  brief: BriefView;
}) {
  return (
    <section aria-label="Daily brief">
      <SectionMasthead index={2} title="Daily brief" asOf={asOf} editionAsOf={editionAsOf} />

      {brief.status === "held" ? (
        <HeldState />
      ) : (
        <div className="pt-4">
          {/* Today's focus — the display-italic headline and the lede paragraph. */}
          <h3 className="max-w-[64ch] font-prose text-xl italic text-ink">
            {brief.todayFocus.headline}
            <Superscripts numbers={brief.todayFocus.citationNumbers} footnotes={brief.footnotes} />
          </h3>
          {/*
           * THE LEDE CARRIES GLOSSARY DOORWAYS (PD5, §8.2.2), and NOT emphasised figures. The
           * difference is the whole of ruling E5, and it is worth stating here because the omission
           * looks like a gap and is not.
           *
           * A term can be decorated safely: an underline promises a DEFINITION, and the definition
           * comes from our own glossary, so the app is only ever vouching for itself.
           *
           * A FIGURE cannot — not yet, and not honestly. Emphasis says "the gate checked this
           * number", and for a news cluster the app can prove that: the pipeline stores
           * `key_numbers`, the list of figures the gate CLEARED, and KeyFigure emphasises exactly
           * those. The briefing stores no such list. Its verification record holds the FLAGS — the
           * entities that FAILED — and a published brief may still carry up to two of them (the gate
           * holds outright only on a Today's-focus flag or more than two flags total).
           *
           * So the only way to emphasise a brief number today would be to invert the record: mono
           * everything number-shaped EXCEPT the flagged ones. That requires the APP to decide what
           * counts as a number — its own regex, its own opinion on whether "Q3" or "2.1x" is a
           * figure — and `briefing/verify.py` already answers that question. Its own header says what
           * a second answer costs: "Two definitions of that would be one too many: the day they
           * drifted apart, one of the two surfaces would start publishing numbers the other would
           * have refused, and nobody would find out from a test."
           *
           * The brief's numbers therefore read as plain prose, which claims nothing — the honest
           * default. Publishing the gate's CLEARED list alongside its flags is a pipeline change, and
           * it is booked for PD7 (Q-PD5-1).
           */}
          <p className="max-w-[66ch] pt-3 font-prose text-prose text-ink-2">
            <TermProse text={brief.todayFocus.body} />
          </p>

          {/* The items — up to five, each filling the labeled slots that are present. */}
          {brief.items.length > 0 ? (
            <ol className="pt-6">
              {brief.items.map((item, index) => (
                <li key={index} className="border-t border-hairline py-4 first:border-t-0">
                  <BriefItem item={item} footnotes={brief.footnotes} />
                </li>
              ))}
            </ol>
          ) : null}

          {/* Calendar notes — plain forward-looking lines, no consensus arithmetic. */}
          {brief.calendarNotes.length > 0 ? (
            <ul className="max-w-[66ch] pt-4">
              {brief.calendarNotes.map((note, index) => (
                <li key={index} className="pt-1 font-prose text-base text-ink-2">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}

          {/* The sources — the numbered footnotes the superscripts point at. */}
          {brief.footnotes.length > 0 ? (
            <ol className="pt-6" aria-label="Sources">
              {brief.footnotes.map((note) => (
                <li key={note.n} className="pt-1 font-ui text-2xs text-muted">
                  <span className="pr-1 text-ink-2">{note.n}.</span>
                  <ExternalLink href={note.url} className="text-ink">
                    {note.source}
                  </ExternalLink>
                </li>
              ))}
            </ol>
          ) : null}

          {/* The one Academy doorway — only when the lesson manifest knows the slug. */}
          {brief.learnSlug ? (
            <p className="pt-6">
              <Link href={`/academy/${brief.learnSlug}`} className="font-ui text-sm text-ink underline underline-offset-2 hover:text-accent">
                Learn: how to read this →
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function BriefItem({ item, footnotes }: { item: BriefItemView; footnotes: BriefFootnote[] }) {
  return (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr]">
      {SLOTS.map(({ key, label }) =>
        item[key] ? (
          <div key={key} className="contents">
            <div className="pt-0.5 font-ui text-2xs uppercase tracking-wide text-muted">{label}</div>
            <p className="max-w-[62ch] font-prose text-base text-ink-2">
              {/* ≤2 doorways per paragraph, first occurrence per view — the budget and the registry,
               * composing. See lib/prose.ts. A slot the reader has already met a term in renders it
               * plain, which is why a paragraph can honestly show fewer than two. */}
              <TermProse text={item[key]} />
              {key === "byTheNumbers" ? (
                <Superscripts numbers={item.citationNumbers} footnotes={footnotes} />
              ) : null}
            </p>
          </div>
        ) : null,
      )}
    </div>
  );
}

/** The superscript source markers after a claim — each a small link to its numbered footnote's
 * article. Renders nothing when a claim's only citations were computed stats (no URL to link). */
function Superscripts({ numbers, footnotes }: { numbers: number[]; footnotes: BriefFootnote[] }) {
  if (numbers.length === 0) return null;
  return (
    <sup className="ml-0.5 font-ui text-2xs text-ink-2">
      {numbers.map((n, index) => {
        const note = footnotes.find((f) => f.n === n);
        return (
          <span key={n}>
            {index > 0 ? "," : ""}
            {note ? (
              <ExternalLink href={note.url} className="text-ink-2">
                {n}
              </ExternalLink>
            ) : (
              n
            )}
          </span>
        );
      })}
    </sup>
  );
}

/**
 * The held state — one calm line, and nothing else (CC1, the no-shimmer-on-empty law).
 *
 * When the verification gate holds tonight's briefing (an LLM sentence carried a number the gate
 * could not verify against the database), the module shows the neutral "briefing unavailable" line
 * over the verified scans below — and no more.
 *
 * It USED to render the full slot skeleton — every slot masthead in faint, over empty hairline
 * rules — on a pedagogical argument: the shape of a market note is part of what the briefing
 * teaches. CC1 retires that. A skeleton is a promise that content is arriving; on a held night the
 * run happened and the content is deliberately NOT coming, so the skeleton promises something that
 * is false. That is the same law that governs EmptyModule (an empty state is information, not an
 * apology, and never a shimmer): the calm sentence is the whole honest truth of a held night.
 *
 * It is never amber. A held briefing is the gate WORKING — the system refusing to print a number it
 * could not check — and the two amber consumers are spoken for (§3.3, P11).
 */
function HeldState() {
  return (
    <div className="pt-4">
      <p className="max-w-[62ch] font-prose text-base text-ink-2">{copy.brief.unavailable}</p>
    </div>
  );
}
