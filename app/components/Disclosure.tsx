"use client";

import { useState } from "react";

import { Chevron } from "@/components/Chevron";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * Disclosure — the honesty-preserving collapse (APP-FEEL-PLAN §3.1, ruling M2).
 *
 * The app was a receipt: every room a single vertical column, everything stacked, nothing bounded.
 * The cure is to fold the tail of each module away — but folding is exactly how a product starts
 * lying by omission, so the rule came first and the component was built to it.
 *
 * **RULING M2: a caveat may collapse only ATOMICALLY with the claim it qualifies; a visible claim
 * may never have a hidden caveat.** A decay stamp may fold away with its base rate, because the two
 * travel together and neither is on screen without the other. A source-degradation line may NOT
 * fold, because the summary above it says "all reporting" — and a claim standing on screen with its
 * own refutation hidden underneath is the precise failure this rule exists to prevent. That case is
 * what `forceOpen` is for, and it renders no toggle at all: not a disclosure that happens to be
 * open, but a thing that cannot be closed.
 *
 * **The count is required by TYPE.** A disclosure that hides an unstated number of things is a
 * disclosure that can hide a miss, so `count` is not optional and an uncounted one does not compile.
 * The grammar changes with what is actually true:
 *
 *   collapsed, count > 0    →  "+ 12 more · through Jul 26"
 *   collapsed, count === 0  →  "none saved tonight"      — a zero is a state, not an offer of more
 *   open                    →  "12 · through Jul 26"     — nothing on screen may claim to hide what
 *                                                           it is showing
 *
 * Built on native `<details>`/`<summary>` — correct semantics and keyboard behaviour for free, and
 * already the pattern the setup cards use. It carries a four-line `useState` for one reason: the
 * summary's own words have to CHANGE when it opens ("+ 12 more" → "12 ·"), and that is not styling,
 * it is the M2 rule. Doing it with a CSS `group-open:` swap would render both sentences into the DOM
 * and leave the guard unable to tell which one the reader is actually looking at — a rule you cannot
 * test is a rule that will quietly rot.
 */

export type DisclosureProps = {
  /** What is behind the fold: "All movers", "Closed trades". */
  label: string;
  /** REQUIRED — the M2 contract. How many things this hides. */
  count: number;
  /** As-of or range context: "through Jul 26", "by rank", "none saved tonight". */
  context?: string;
  /**
   * M2: content that may not be hidden. Renders open, with NO toggle — used by SourceStatus the
   * moment any provider is degraded. The component enforces this, not the caller.
   */
  forceOpen?: boolean;
  defaultOpen?: boolean;
  /**
   * Opt IN to the 200ms content fade. Default false — instant.
   *
   * Never set this over a subtree containing a `data-p2` node. A money or probability figure fading
   * in is a money figure in motion, and the jsdom ancestor walk will fail the file for it. The
   * default is instant precisely so that the safe thing is the thing you get by not thinking.
   */
  fade?: boolean;
  children: React.ReactNode;
};

/** The summary row's count string, in whichever of the three states is true (M2). */
function countLine(count: number, context: string | undefined, open: boolean): string {
  if (count === 0) return context ?? "";
  if (open) return context ? `${count} · ${context}` : String(count);
  return fill(copy.disclosure.more, { n: count, context: context ?? "" }).replace(/ · $/, "");
}

export function Disclosure({
  label,
  count,
  context,
  forceOpen = false,
  defaultOpen = false,
  fade = false,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Not a <details> that happens to be open — a thing with no toggle at all. If the markup cannot
  // be closed, no future edit can accidentally close it.
  if (forceOpen) {
    return (
      <section className="flex flex-col">
        <h3 className="flex min-h-11 items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
          {label}
          {count > 0 ? (
            <span className="whitespace-nowrap font-normal normal-case tracking-normal text-muted">
              {countLine(count, context, true)}
            </span>
          ) : null}
        </h3>
        <div>{children}</div>
      </section>
    );
  }

  return (
    <details
      className="group flex flex-col"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      {/*
       * `list-none` AND the ::-webkit-details-marker rule in globals.css. Both, because older WebKit
       * ignores list-style on a summary and would render its own triangle beside our chevron. The
       * shipped setup-card pattern only ever had the first half; this closes the gap.
       */}
      <summary
        className={cx(
          "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3",
          "font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted",
          "touch-manipulation hover:text-ink-2",
        )}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {label}
          {/*
           * One non-breaking unit. At 320px the count wraps BELOW the label as a whole phrase
           * rather than shattering into "+ 12" / "more · through Jul 26" across two lines.
           */}
          <span className="whitespace-nowrap font-normal normal-case tracking-normal text-muted">
            {countLine(count, context, open)}
          </span>
        </span>
        <Chevron />
      </summary>

      <div className={cx(fade && "content-fade")}>{children}</div>
    </details>
  );
}
