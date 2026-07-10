/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately eleven lines instead of a dependency. The app needs exactly this much of what
 * `clsx` does — conditional classes on a handful of primitives — and a class-name joiner is
 * not worth a package, a lockfile entry, and a supply-chain surface.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
