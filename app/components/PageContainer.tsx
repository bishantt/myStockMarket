import { cx } from "@/lib/cx";

/**
 * PageContainer — the one door for the room container (PD3, §6.4).
 *
 * Every room in this app sits inside the same measured column: centred, capped at 1360px, widened
 * to 1500px in the `wide` band, with 16px gutters that step up to 32px at `desk`. That is one
 * design decision. It was written out by hand in FIVE places — the Desk's `<main>` and its top bar,
 * the Academy's `<main>` and its top bar, and the styleguide — and the five had to be kept in step
 * by hand.
 *
 * They were, so far. That is not the same as being safe. The `wide:max-w-[1500px]` step exists in
 * all five today because one session added it to all five in one sitting; the next change to this
 * column is a five-file sweep where forgetting one file produces a room that is subtly narrower
 * than every other room, on one breakpoint, which nobody would ever notice by looking. A shared
 * measurement that lives in five places is a measurement that has not been decided — it has been
 * agreed to five times, and agreements drift.
 *
 * So: one door. check-drift rule 25 fails the build if the container's literal reappears anywhere
 * else, which is the same lock this codebase already puts on the table (DataTable), the news
 * imagery (NewsImage) and the brand mark (BrandMark).
 *
 * WHAT IT DELIBERATELY DOES NOT OWN: vertical rhythm. The Desk's `<main>` clears the phone's tab
 * bar with a safe-area-aware bottom pad; the Academy's adds its own top padding; the top bars are
 * flex rows with their own gaps. Those are the rooms' business, not the container's, and they come
 * in through `className`. The container owns the horizontal measure and nothing else — the one
 * thing every room genuinely shares.
 */
export function PageContainer({
  as: Element = "div",
  className,
  children,
  ...rest
}: {
  /**
   * The element to render. A room's content column is a `main`; a top bar's inner row is a `nav`;
   * the styleguide's is a plain `div`. The container does not decide which — it only ever supplies
   * the measure — so the caller says what this thing IS and the tag follows.
   */
  as?: "main" | "nav" | "div" | "header" | "footer";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Element
      className={cx("mx-auto max-w-[1360px] px-4 wide:max-w-[1500px] desk:px-8", className)}
      {...rest}
    >
      {children}
    </Element>
  );
}
