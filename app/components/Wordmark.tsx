import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

/**
 * Wordmark — the house mark and the product's name (D3).
 *
 * PD2 replaced the placeholder here. This used to be a gradient tile with a mono letter "M" set
 * inside it — a stand-in for a logo that did not exist yet. It does now, so the tile is gone and
 * the real mark takes its place at the same 28px. The NAME is untouched: same mono, same uppercase,
 * same tracking, same accent, still hidden below `sm`.
 *
 * That retirement cost `--gradient-brand` one of its two sanctioned consumers. The token's contract
 * is scarcity — a gradient used twice is a signature, a gradient used everywhere is a template — and
 * it now has exactly two again: the login panel and the primary button.
 *
 * On a phone the wordmark shrinks to the mark alone. A 375px row has to hold five things, and the
 * product's name is the one thing the reader already knows.
 */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="myStockMarket — the Desk"
      className="flex min-h-11 shrink-0 items-center gap-2"
    >
      <BrandMark size="bar" />
      <span className="hidden font-mono text-xs font-medium uppercase tracking-[0.12em] text-accent-deep sm:inline">
        myStockMarket
      </span>
    </Link>
  );
}
