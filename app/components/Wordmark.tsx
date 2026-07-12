import Link from "next/link";

/**
 * Wordmark — the gradient "M" tile and the product's name (D3).
 *
 * The name stays "myStockMarket". The mark is one of exactly TWO places in the entire app allowed
 * to use `--gradient-brand` — the other is the primary button. That scarcity is the point: a
 * gradient used twice is a signature, and a gradient used everywhere is a template.
 *
 * On a phone the wordmark shrinks to the tile alone. A 375px row has to hold five things, and the
 * product's name is the one thing the reader already knows.
 */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="myStockMarket — the Desk"
      className="flex min-h-11 shrink-0 items-center gap-2"
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-chip bg-[image:var(--gradient-brand)] font-mono text-sm font-semibold text-white"
      >
        M
      </span>
      <span className="hidden font-mono text-xs font-medium uppercase tracking-[0.12em] text-accent-deep sm:inline">
        myStockMarket
      </span>
    </Link>
  );
}
