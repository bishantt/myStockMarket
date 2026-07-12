/**
 * The Desk's route transition.
 *
 * A `template.tsx` remounts on every navigation within the segment (a `layout.tsx` would not), so
 * the fade class re-applies each time the reader moves between rooms. That is the whole mechanism —
 * no library, no experimental flag, one CSS animation.
 *
 * It is opacity-only, and that restriction is load-bearing rather than aesthetic. This is the ONE
 * sanctioned animation permitted to contain a probability visual (§3.6), and it is permitted
 * precisely because it contains no *relative* motion: the page arrives as a single settled sheet,
 * and every frame shows every base rate, interval and delta complete and unmoving with respect to
 * everything around it. Add a translateY and that stops being true — the numbers would slide into
 * place, and a sliding probability is a probability that looks like it is arriving.
 *
 * `prefers-reduced-motion` zeroes it globally, from globals.css.
 */
export default function DeskTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
