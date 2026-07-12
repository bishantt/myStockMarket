/**
 * AppWash — the morning light. The layer the whole design is named after.
 *
 * A fixed lavender gradient with two soft orbs glowing in from the corners, sitting behind
 * everything at z-0. Mount it once per room layout as the first child, with all content in a
 * sibling `relative z-10` wrapper.
 *
 * Three things about it are load-bearing (UI-REDESIGN-PLAN §3.4, §1.3 #14):
 *
 *  1. It is a fixed-position LAYER, never `background-attachment: fixed`. That property is broken
 *     on iOS Safari: it repaints the gradient on every scroll frame, and the installed PWA would
 *     judder its way down the page.
 *  2. The orbs are viewport-anchored ambience, not wallpaper. They were re-derived for a
 *     long-scrolling two-column product rather than traced from the Figma's short single-column
 *     frame; on phones they halve in size and opacity. Light belongs to the viewport. Content
 *     belongs to the page.
 *  3. It takes no props and knows nothing about the theme. `data-theme` lives on <html> (D1), so
 *     the wash simply reads whichever `--gradient-wash` is active — one component, both rooms,
 *     both themes.
 *
 * It is `aria-hidden` and `pointer-events: none`: it is light, and light is not content.
 */
export function AppWash() {
  return <div aria-hidden="true" className="app-wash" />;
}
