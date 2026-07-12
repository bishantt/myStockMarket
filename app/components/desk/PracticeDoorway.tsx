"use client";

import { useRouter } from "next/navigation";

import { copy } from "@/lib/copy";

/**
 * PracticeDoorway — the setup card's link to the paper ticket (ruling M10, APP-FEEL-PLAN §4.3.6).
 *
 * THE TIMESTAMP IS STAMPED ON CLICK, IN THE READER'S BROWSER, AND THAT IS THE ENTIRE REASON THIS IS
 * A CLIENT COMPONENT.
 *
 * The obvious way to write this doorway is a plain `<Link>` in the server component, with
 * `signalViewedAt=${new Date().toISOString()}` interpolated into the href. It is also wrong, and
 * subtly so: the Desk is served from a cache now, so `new Date()` there is the moment the PAGE WAS
 * GENERATED — up to ten minutes before the reader ever laid eyes on it, and after a publish it could
 * be older still. The cooling-off window would then be measured from a clock that has nothing to do
 * with the reader.
 *
 * The whole point of `signalViewedAt` is "how long ago did this human see this signal". So it is
 * taken from this human, at the moment they act on it. Which also means the interstitial fires every
 * time this doorway is used — by construction, they are always inside the window — and that is the
 * correct, most protective reading of a link that sits directly beneath a base rate and points at an
 * order ticket.
 *
 * It is a plain link at footnote weight, never a button (M10's fourth condition).
 */
export function PracticeDoorway({ symbol }: { symbol: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        const viewedAt = new Date().toISOString();
        router.push(
          `/paper?symbol=${encodeURIComponent(symbol)}&signalViewedAt=${encodeURIComponent(viewedAt)}`,
        );
      }}
      // Styled as the footnote link it is. A button element is used only because the destination is
      // computed at the moment of the click; it must not LOOK like a call to action, and it does not.
      className="font-ui text-2xs text-ink-2 underline underline-offset-2 hover:text-accent"
    >
      {copy.paper.practiceDoorway}
    </button>
  );
}
