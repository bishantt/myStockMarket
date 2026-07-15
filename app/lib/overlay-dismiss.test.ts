import { describe, expect, it } from "vitest";

import { pullDismisses, PULL_TO_DISMISS_THRESHOLD_PX } from "./overlay-dismiss";

/**
 * The overscroll-past-top decision (PD9). The touch physics are iOS-specific and manual-verified on
 * the device at PD10, but the yes/no they feed is a pure function and is pinned here — so a future
 * hand cannot quietly make the sheet close on a stray flick or refuse to close on a real pull.
 */
describe("pullDismisses — the sheet's overscroll-past-top gate", () => {
  it("dismisses only when the pull began AT THE TOP and travelled far enough", () => {
    expect(pullDismisses(true, PULL_TO_DISMISS_THRESHOLD_PX + 10)).toBe(true);
    expect(pullDismisses(true, PULL_TO_DISMISS_THRESHOLD_PX)).toBe(true); // the boundary counts
  });

  it("does NOT dismiss a pull that began mid-scroll, however far it travels", () => {
    // A downward drag once you are into the content is ordinary scrolling, not a dismiss intent.
    expect(pullDismisses(false, 500)).toBe(false);
  });

  it("does NOT dismiss a short pull from the top — the threshold is intent, not a twitch", () => {
    expect(pullDismisses(true, PULL_TO_DISMISS_THRESHOLD_PX - 1)).toBe(false);
    expect(pullDismisses(true, 0)).toBe(false);
  });

  it("never dismisses on an upward-only gesture (negative travel)", () => {
    expect(pullDismisses(true, -120)).toBe(false);
  });

  it("honours a custom threshold", () => {
    expect(pullDismisses(true, 40, 30)).toBe(true);
    expect(pullDismisses(true, 20, 30)).toBe(false);
  });
});
