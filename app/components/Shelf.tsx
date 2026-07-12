import { cx } from "@/lib/cx";

/**
 * Shelf — a horizontal rail of glanceable cards, for phones (APP-FEEL-PLAN §3.2, ruling M3).
 *
 * IT IS NOT A CAROUSEL. No dots, no arrows, no autoplay, no looping, no "peeking nudge" to teach
 * you it moves (M7 — modularity earns no engagement mechanics). The reader pushes it; it never
 * pushes itself.
 *
 * **Why a shelf is allowed to hold money figures at all**, given that money figures never move
 * (P2): because the READER moving the paper is not the paper moving. The page already scrolls
 * vertically past every price on the Desk, and nobody has ever read that as the number moving. A
 * shelf is that same gesture, turned sideways. The line is INITIATION — motion with no initiating
 * gesture (autoplay, auto-advance, a programmatic scrollTo, `scroll-behavior: smooth`) is the
 * interface moving the paper itself, and that is banned and grepped (drift rule 15). Snap settle is
 * allowed, because it is the decaying tail of the reader's own flick, not a new motion.
 *
 * This reading of the constitution is logged as a structural interpretation and flagged [VETO?] for
 * the user (Part 0.4). If it is vetoed, the one shelf in the app reverts to its grid and nothing
 * else in the plan changes.
 *
 * **The count line is required by type** — the sibling of Disclosure's required `count`. A shelf
 * that does not say what is off the edge of the screen is a shelf that hides an unstated number of
 * things (M8: a preview states its rule).
 *
 * Phone ergonomic only. Consumers render the Shelf below `md` and their real layout above it —
 * desktop has the width, and a horizontal scroller there is a toy.
 */

export type ShelfProps = {
  /** The group's accessible name: "Macro figures". */
  label: string;
  /** REQUIRED (M8) — what is on the shelf and how to reach it: "5 figures — swipe". */
  countLine: string;
  /** The cards. Each is wrapped in a snap-aligned <li> below. */
  children: React.ReactNode;
  className?: string;
};

export function Shelf({ label, countLine, children, className }: ShelfProps) {
  return (
    <section role="group" aria-label={label} className={cx("flex flex-col gap-2", className)}>
      {/*
       * The mask sits on this STATIC wrapper, never on the scroller inside it. WebKit mis-composites
       * a mask on a scrolling box (see globals.css). Do not merge these two elements.
       */}
      <div className="shelf-frame -mx-4">
        <ul className="shelf no-scrollbar">{children}</ul>
      </div>

      <p className="px-1 font-mono text-2xs uppercase tracking-[0.08em] text-faint">{countLine}</p>
    </section>
  );
}

/**
 * One item on a shelf.
 *
 * `scroll-snap-align: start` ONLY — no `scroll-margin-inline`. The two would double-count against
 * the scroller's `scroll-padding-inline` and shift the whole snap grid by 32px after the first
 * swipe, which reads as the shelf drifting out of alignment as you use it.
 */
export function ShelfItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={cx("shrink-0 snap-start", className)}>
      {children}
    </li>
  );
}
