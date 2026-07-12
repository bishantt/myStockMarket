import Link from "next/link";

/**
 * The Academy room — the warm, literary counterpart to the cool Desk (plan §3, P5).
 *
 * A deliberate room switch: warm paper (academy-bg), Newsreader prose, a calm 65ch measure, and no
 * live prices anywhere. The one thing that carries over is the login wall (proxy.ts) and a return
 * rail back to the Desk — a doorway with a way home, never a trap. The Academy explains the terms
 * the Desk uses; it never shows the Desk's numbers.
 */
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-hairline">
        <nav
          aria-label="Academy"
          className="mx-auto flex max-w-[1360px] items-center justify-between gap-6 px-5 py-3 desk:px-8"
        >
          <Link href="/academy" className="font-ui text-sm font-bold uppercase tracking-[0.08em]">
            Academy
          </Link>
          {/* The return rail — always a way back to the Desk (plan §9.1, doorways + return rails). */}
          <Link href="/" className="font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
            ← Back to Desk
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1360px] px-5 py-8 desk:px-8">{children}</main>
    </div>
  );
}
