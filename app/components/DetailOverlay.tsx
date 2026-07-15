"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { copy } from "@/lib/copy";
import { pullDismisses } from "@/lib/overlay-dismiss";

/**
 * DetailOverlay — the @modal detail sheet (PD9, plan 11.1 / 11.2).
 *
 * It wraps a server-rendered page body (StoryPageBody / TickerPageBody) and presents it OVER the
 * live room: below `md` a bottom sheet (92dvh, a grabber, `--radius-card` top corners), at and above
 * `md` a centered overlay (max-w 720px, 85vh) — both in the house L4 material (`.surface-overlay`,
 * the same glass the command palette and the rail already speak, 0.2.7). Because the body is the
 * exact same component the standalone page renders, the sheet's DOM and the deep-link page's DOM are
 * content-identical (E9); the reload-while-open e2e proves it.
 *
 * THE MOTION IS OPACITY ONLY, AND THAT IS A LAW, NOT A TASTE (E7). The sheet opens over probability
 * and money figures, so a `[data-p2]` node has this overlay as an ancestor. A slide-up would put a
 * `translateY` above a price, and a moving price is a price that looks like it is HAPPENING — the one
 * feeling this whole product is built not to manufacture. So the sheet and its scrim fade in together
 * as one settled layer (`.sheet-fade`, opacity only), and `p2-motion.test.tsx` admits that one class
 * by name. Reduced motion makes the fade instant (the global media block zeroes the duration).
 *
 * FIVE WAYS OUT, and each returns the reader to exactly where they were (the room never unmounts, so
 * restoration is free): the ✕ (first focusable, ≥44px, top-right), Esc, a scrim tap, the
 * hardware/gesture back button, and an overscroll-past-top pull on mobile — the one lawful motion
 * over P2 content, because the rubber band is the scroll container's own native overscroll, not a JS
 * transform. Every one routes through `router.back()`, which pops the history entry the in-app tap
 * pushed and lands on the untouched room.
 *
 * Radix Dialog is the house pattern (as in RailDialog): it traps focus inside, marks the room behind
 * unreadable, locks body scroll while open, and restores focus to the launcher on close.
 */

type DetailOverlayProps = {
  /** The dialog's accessible name — the story headline or the ticker symbol. */
  title: string;
  children: React.ReactNode;
};

export function DetailOverlay({ title, children }: DetailOverlayProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // The control that launched the sheet — captured so focus can come home to it on close (WCAG
  // 2.4.3). A useState initializer runs during the FIRST render, ahead of every effect including
  // Radix's autofocus, so `document.activeElement` is still the card or chip that was activated, not
  // the ✕ Radix is about to focus. It lives in the never-unmounted room, so it is still there to
  // receive focus after we navigate back.
  const [launcher] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  // Pull-to-dismiss bookkeeping. Refs, not state: this tracks a gesture in progress and must never
  // trigger a re-render mid-drag (a re-render of a sheet full of P2 figures is exactly what E7 is
  // about). The pure decision lives in lib/overlay-dismiss so the threshold is unit-tested.
  const dragStartY = useRef<number | null>(null);
  const startedAtTop = useRef(false);
  const maxDownward = useRef(0);

  // Every dismissal routes here. `router.back()` pops the history entry the in-app navigation pushed,
  // which unmounts this intercepting route and reveals the room exactly as it was left.
  const dismiss = () => router.back();

  // Return focus to the launcher on UNMOUNT — every dismissal ends here, including the hardware/gesture
  // back button, which never runs through `dismiss()`. Because we close by navigating (not by Radix's
  // own open→false), Radix's focus restore never fires, and Next moves focus on a route change — so we
  // re-take it after the navigation settles. A frame is enough to win the race with Next's own
  // focus handling; the launcher lives in the never-unmounted room, so it is still there to receive it.
  useEffect(() => {
    return () => {
      if (launcher && typeof launcher.focus === "function") {
        requestAnimationFrame(() => launcher.focus());
      }
    };
  }, [launcher]);

  // Radix reports Esc, a scrim tap, and the ✕ as `open → false`. We never set `open` ourselves (it
  // stays true until navigation unmounts us), so the one job here is to turn "closed" into a back.
  const onOpenChange = (open: boolean) => {
    if (!open) dismiss();
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const el = scrollRef.current;
    startedAtTop.current = !!el && el.scrollTop <= 0;
    dragStartY.current = event.touches[0]?.clientY ?? null;
    maxDownward.current = 0;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const el = scrollRef.current;
    const atTop = !!el && el.scrollTop <= 0;
    const downward = (event.touches[0]?.clientY ?? dragStartY.current) - dragStartY.current;
    // Only a pull that is STILL against the top counts — once the reader scrolls into the content,
    // downward finger travel is ordinary scrolling, not a dismiss. No preventDefault: the native
    // overscroll bounce is the only feedback E7 permits, so we let the browser draw it.
    if (startedAtTop.current && atTop && downward > maxDownward.current) {
      maxDownward.current = downward;
    }
  };

  const onTouchEnd = () => {
    const shouldDismiss = pullDismisses(startedAtTop.current, maxDownward.current);
    dragStartY.current = null;
    if (shouldDismiss) dismiss();
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* The scrim — fades in with the sheet as one layer, and a tap on it is dismissal #3. */}
        <Dialog.Overlay
          className="sheet-fade fixed inset-0 z-40"
          style={{ background: "var(--scrim)" }}
        />

        {/*
         * The positioning layer. Flexbox centers the panel with NO transform — a `-translate-1/2`
         * centering trick would put a transform above the P2 figures inside, which E7 forbids. Below
         * `md` the panel sits at the bottom (a sheet); at and above it, dead centre (an overlay).
         * `pointer-events-none` lets taps in the empty margin fall through to the scrim behind.
         */}
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <Dialog.Content
            aria-describedby={undefined}
            className={[
              "sheet-fade surface-overlay pointer-events-auto flex w-full flex-col outline-none",
              // Below md: a bottom sheet, card-radius top corners, flush to the bottom edge.
              "max-h-[92dvh] rounded-t-card rounded-b-none",
              // md and up: a centred overlay, panel-radius all round, its own max width and height.
              "md:w-auto md:max-w-[720px] md:max-h-[85vh] md:rounded-panel",
            ].join(" ")}
          >
            {/* The top zone: a grabber (mobile affordance) and the ✕. The ✕ is FIRST in the DOM so
                Radix's autofocus lands on it — the plan's "first focusable" — even though it sits
                top-right. It is a Dialog.Close, so a tap is dismissal #1. */}
            <div className="relative flex shrink-0 items-center justify-center">
              <Dialog.Close
                aria-label={copy.overlay.close}
                className="absolute right-1.5 top-1.5 z-10 flex size-11 items-center justify-center rounded-control text-muted hover:text-accent-deep focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>

              {/* The grabber — a ≥44px touch zone with a small pill, mobile only. Decorative to a
                  screen reader (the ✕ is the announced control); it signals the sheet can be pulled. */}
              <div aria-hidden="true" className="flex h-6 w-full items-center justify-center pt-2 md:hidden">
                <span className="h-1.5 w-10 rounded-pill bg-hairline-strong" />
              </div>
            </div>

            {/*
             * The scroll container. `overscroll-y-contain` keeps its overscroll to itself (it must
             * not fight Safari's left-edge swipe-back, and it must not scroll the room behind), and
             * `env(safe-area-inset-bottom)` keeps the last line off the iPhone's home indicator. The
             * pull-to-dismiss handlers ride here: a downward pull that begins at the top is dismissal
             * #5. The Dialog.Title is visually hidden but names the dialog for assistive tech.
             */}
            <div
              ref={scrollRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              data-testid="overlay-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6"
            >
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              {children}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
