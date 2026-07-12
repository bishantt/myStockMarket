import { formatAsOf } from "@/lib/time";

/**
 * SectionMasthead — "01 — MACRO PULSE", a hairline rule, and the module's data timestamp.
 *
 * This one component carries half the app's identity (§4.1), so it is built first and reused
 * everywhere. Every Desk module opens with one, without exception, and that consistency is what
 * makes the Desk read as a broadsheet rather than a dashboard.
 *
 * Two deliberate choices:
 *
 * **The masthead is MUTED, not accent.** Indigo belongs to interactive text and the small in-card
 * slot labels. Eight indigo mastheads down the Desk would teach the reader that indigo means
 * "chrome" as often as it means "you can act here", and the accent would stop meaning anything.
 * (The Figma got this right; an earlier draft of the plan inverted it and was corrected.)
 *
 * **The timestamp is the app's signature gesture** (§3.6). A timestamp is provenance, and this
 * product's whole argument is that provenance should be cheap to check. So the stamp is
 * interactive: hover or tap it and the full chain appears inline — "FRED · prior close · fetched
 * 8:41 PM ET". It is motionless by default, it is chrome rather than a probability visual, and it
 * turns the honesty obsession into the most-touched thing on the page. Specified once here; every
 * module inherits it.
 */

type SectionMastheadProps = {
  /** The module's position in the ritual order, 1 through 8. Rendered zero-padded: "01". */
  index: number;
  /** The module name. Rendered uppercase; pass it in sentence case. */
  title: string;
  /**
   * When this module's data was computed. Omit only for modules that show no data at all
   * (the styleguide, for instance) — never to hide a stale timestamp.
   */
  asOf?: Date;
  /**
   * The full provenance chain behind this module's numbers, e.g. "FRED · prior close". Revealed
   * from the timestamp on hover or tap. Optional: a module with no external source has no chain.
   */
  provenance?: string;
  /** An optional right-hand affordance, e.g. a "view all" link. Sits left of the timestamp. */
  action?: React.ReactNode;
};

export function SectionMasthead({
  index,
  title,
  asOf,
  provenance,
  action,
}: SectionMastheadProps) {
  return (
    <header className="pt-3">
      <div className="flex items-baseline justify-between gap-4 pb-2">
        {/*
         * Mono, uppercase, tracked — the terminal voice, in muted. The index number is part of
         * the typography, not a list marker, so this is not a real <ol>: it names the module's
         * fixed place in the daily ritual, which is the same on every visit.
         *
         * The em dash is NOT aria-hidden. Hiding it collapsed the accessible name to "01Macro
         * pulse" — the surrounding spaces went with it — so a screen reader announced the index
         * and the title as one run-on word. Left visible, the dash is silent in every major
         * screen reader while the spaces around it survive.
         */}
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
          <span className="tabular-nums text-faint">{String(index).padStart(2, "0")}</span>
          <span> — </span>
          {title}
        </h2>

        <div className="flex shrink-0 items-baseline gap-3">
          {action}
          {asOf ? (
            /*
             * The provenance reveal. A CSS-only group hover/focus, so it costs no JavaScript and
             * works on touch (the chip is focusable, and a tap focuses it). The chain fades in;
             * nothing moves, and nothing here is a probability visual.
             */
            <span className="group relative inline-flex items-baseline">
              {provenance ? (
                <span
                  role="note"
                  className="pointer-events-none absolute right-0 bottom-full mb-1 whitespace-nowrap rounded-chip border border-hairline bg-surface-solid px-2 py-1 font-mono text-2xs text-muted opacity-0 transition-opacity duration-(--duration-quick) ease-(--ease-quiet) group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {provenance}
                </span>
              ) : null}
              <time
                dateTime={asOf.toISOString()}
                tabIndex={provenance ? 0 : undefined}
                className="rounded-chip font-mono text-2xs text-muted transition-colors duration-(--duration-quick) hover:text-ink-2 focus-visible:text-ink-2"
              >
                {formatAsOf(asOf)}
              </time>
            </span>
          ) : null}
        </div>
      </div>

      {/*
       * The rule. It was 2px of ink in the old system; it is a 1px tinted hairline now — the
       * structure is identical, the voice is quieter. It is still a border, never a shadow.
       */}
      <div className="h-px bg-hairline-strong" />
    </header>
  );
}
