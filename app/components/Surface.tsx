import { cx } from "@/lib/cx";

/**
 * Surface — the card, at last a component instead of a class string repeated in thirty files.
 *
 * The design system has exactly five surface levels (UI-REDESIGN-PLAN §3.4), and this component
 * owns four of them. The fifth (L3, the sticky bars) belongs to the nav and the tab bar, which are
 * structural rather than content, and applies `.surface-bar` directly.
 *
 *   card    L1  translucent glass, hairline border. Every Desk module.
 *   raised  L2  more opaque, soft shadow. Stat cards; cards the layout wants to lift.
 *   tinted  —   an accent-washed nested panel. Base-rate panels, cost mirrors, helper boxes.
 *   solid   —   opaque paper, no glass at all. The Academy's material, and every decision moment
 *               (the cooling-off interstitial): when a reader is deciding, the surface stops
 *               being atmospheric and becomes a page.
 *
 * The recipes live in globals.css, not here, because they are shared with the plain-CSS surfaces
 * the shell needs. This component's job is to make the choice explicit and greppable.
 *
 * On blur: L1 and L2 NEVER blur (§3.4). Stacked backdrop-filters are a GPU tax that shows up as
 * scroll jank on mid-range phones, and over a static wash, translucency alone looks near-identical.
 * Blur is spent only where it earns its cost: the bars and the overlays.
 */

export type SurfaceLevel = "card" | "raised" | "tinted" | "solid";

type SurfaceProps = {
  level?: SurfaceLevel;
  /**
   * The element to render. Defaults to `section`, because a Desk module is a section.
   *
   * `footer` joined the list in N2: on a night a data source fails, the source-status footer keeps
   * its card at full strength (the bad night is the whole reason that surface exists), and it is
   * genuinely a footer — so it should say so to a screen reader rather than pretending to be a
   * section for the sake of a type.
   */
  as?: "section" | "div" | "article" | "aside" | "li" | "footer";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

const LEVEL_CLASS: Record<SurfaceLevel, string> = {
  card: "surface",
  raised: "surface-raised",
  tinted: "surface-tinted",
  solid: "surface-solid",
};

export function Surface({
  level = "card",
  as: Element = "section",
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Element className={cx(LEVEL_CLASS[level], className)} {...rest}>
      {children}
    </Element>
  );
}
