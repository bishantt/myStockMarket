import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";

import { AppWash } from "@/components/AppWash";
import { PageContainer } from "@/components/PageContainer";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { TabBar } from "@/components/desk/TabBar";

/**
 * The Academy — a reading room, not a tinted dashboard (D1/D4, §5.6).
 *
 * It shares the Desk's wash, tokens, and whichever theme is active — dark included. The old rule
 * that the Academy always stayed light was repealed by the user on 2026-07-12, and with it the warm
 * second palette. There is one material world now.
 *
 * So the room switch has to be felt entirely in the furniture, and it is:
 *
 *   · solid paper cards instead of glass — a reading room is not a control surface
 *   · serif kickers instead of numbered terminal mastheads
 *   · reading typography: a longer line, a taller line-height, more air
 *
 * The Desk says "instrument". The Academy says "book". Same light, different furniture.
 *
 * Two things carry over unchanged: the login wall, and the return rail back to the Desk. A doorway
 * always has a way home — never a trap.
 */
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh text-ink">
      <AppWash />

      <div className="relative z-10">
        <header className="surface-bar sticky top-0 z-30 border-b border-hairline pt-[env(safe-area-inset-top)]">
          <div className="bar-blur">
            <PageContainer
              as="nav"
              aria-label="Academy"
              className="flex items-center justify-between gap-6 py-3"
            >
              <Link
                href="/academy"
                className="flex min-h-11 items-center font-display text-title font-bold text-ink transition-colors duration-(--duration-quick) hover:text-accent-deep"
              >
                Academy
              </Link>

              <div className="flex shrink-0 items-center gap-3">
                {/*
                 * The return rail — always a way back to the Desk. It is hidden on phones, where the
                 * bottom tab bar's Desk tab already IS the way home: two doorways competing for one
                 * 375px row is one doorway too many (§4.2).
                 */}
                <Link
                  href="/"
                  className="hidden min-h-11 items-center font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep md:flex"
                >
                  ← Back to Desk
                </Link>

                {/* The same pair the Desk carries (CC3, §4.2): one-tap theme, then the gear. The
                 * Academy has no market state — a reading room is timeless — so it gets no pill. */}
                <ThemeToggleButton />
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-(--duration-quick) hover:text-accent-deep md:size-auto md:p-1"
                >
                  <SettingsIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </div>
            </PageContainer>
          </div>
        </header>

        <PageContainer
          as="main"
          className="py-10 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-16"
        >
          {children}
        </PageContainer>

        <TabBar />
      </div>
    </div>
  );
}
