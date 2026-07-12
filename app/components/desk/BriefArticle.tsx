import { SectionMasthead } from "@/components/SectionMasthead";
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
 * amber: amber has exactly two consumers in this app (§3.3), and a whole-briefing hold is neither.
 */

const SLOTS: ReadonlyArray<{ key: keyof BriefItemView; label: string }> = [
  { key: "whatHappened", label: "What happened" },
  { key: "whyItMatters", label: "Why it matters" },
  { key: "byTheNumbers", label: "By the numbers" },
  { key: "yesBut", label: "Yes, but" },
];

export function BriefArticle({ asOf, brief }: { asOf: Date; brief: BriefView }) {
  return (
    <section aria-label="Daily brief">
      <SectionMasthead index={2} title="Daily brief" asOf={asOf} />

      {brief.status === "held" ? (
        <HeldState />
      ) : (
        <div className="pt-4">
          {/* Today's focus — the display-italic headline and the lede paragraph. */}
          <h3 className="max-w-[64ch] font-prose text-xl italic text-ink">
            {brief.todayFocus.headline}
            <Superscripts numbers={brief.todayFocus.citationNumbers} footnotes={brief.footnotes} />
          </h3>
          <p className="max-w-[66ch] pt-3 font-prose text-prose text-ink-2">{brief.todayFocus.body}</p>

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
              <a href={`/academy/${brief.learnSlug}`} className="font-ui text-sm text-ink underline underline-offset-2 hover:text-accent">
                Learn: how to read this →
              </a>
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
              {item[key]}
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
 * The held state — designed, not merely worded.
 *
 * When the verification gate holds tonight's briefing (an LLM sentence carried a number the gate
 * could not verify against the database), the module does NOT collapse to a one-line apology. It
 * renders the full slot skeleton — every slot masthead, in faint, with a quiet rule where the prose
 * would sit — and the honest line beneath the first.
 *
 * The reason is pedagogical. The briefing's structure IS part of what it teaches: a market note has
 * a what-happened, a why-it-might-matter, a by-the-numbers, and a yes-but. A reader who sees that
 * shape on a held night still learns the shape, and still sees exactly what is missing. An empty
 * paragraph teaches nothing.
 *
 * It is never amber. A held briefing is the gate WORKING — the system refusing to print a number it
 * could not check — and the two amber consumers are spoken for (§3.3, P11).
 */
function HeldState() {
  return (
    <div className="pt-4">
      <p className="max-w-[62ch] font-prose text-base text-ink-2">{copy.brief.unavailable}</p>

      <div aria-hidden="true" className="flex flex-col gap-4 pt-6">
        {SLOTS.map(({ key, label }) => (
          <div key={String(key)} className="flex flex-col gap-2">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-faint">
              {label}
            </span>
            <div className="h-px w-full bg-hairline" />
            <div className="h-px w-3/4 bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  );
}
