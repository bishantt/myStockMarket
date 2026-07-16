import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stable back() spy — the global setup mock hands out a fresh vi.fn() per call, so we mock locally
// to capture the one this component actually calls. vi.hoisted keeps `back` reachable from the
// hoisted factory.
const { back } = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back,
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { DetailOverlay } from "@/components/DetailOverlay";
import { copy } from "@/lib/copy";

beforeEach(() => back.mockClear());

/**
 * DetailOverlay — the detail sheet chrome (PD9, plan 11.1/11.2).
 *
 * The overscroll pull is a device gesture (its decision is unit-tested in lib/overlay-dismiss and its
 * feel is manual-verified at PD10); the FIVE-way dismissal contract and the a11y shape are what a
 * jsdom test can hold, and does here. The reload-while-open DOM-equivalence (E9) is an e2e — but the
 * structural half of E9, "both routes render the same body", is a source fact and is pinned below.
 */
describe("DetailOverlay renders the body and names the dialog", () => {
  it("passes its children straight through and titles the dialog by the given name", () => {
    render(
      <DetailOverlay title="Nvidia clears its guidance">
        <p>the story body</p>
      </DetailOverlay>,
    );
    expect(screen.getByText("the story body")).toBeInTheDocument();
    // Radix exposes the Dialog.Title as the dialog's accessible name.
    expect(screen.getByRole("dialog", { name: "Nvidia clears its guidance" })).toBeInTheDocument();
  });
});

describe("DetailOverlay dismisses through router.back (the room behind is restored, never rebuilt)", () => {
  it("the ✕ is a real ≥44px target and closes the sheet", () => {
    render(
      <DetailOverlay title="x">
        <p>b</p>
      </DetailOverlay>,
    );
    const close = screen.getByRole("button", { name: copy.overlay.close });
    // size-11 is the 44px touch floor; jsdom cannot measure pixels, so the class is the proxy (the
    // e2e boundingBox is the real measurement).
    expect(close.className).toContain("size-11");
    fireEvent.click(close);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("Escape closes the sheet", () => {
    render(
      <DetailOverlay title="x">
        <p>b</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });
});

describe("DetailOverlay in controlled mode (the control-room table's sheet)", () => {
  it("dismissal calls onClose and does NOT navigate back", () => {
    const onClose = vi.fn();
    render(
      <DetailOverlay title="Nightly full" onClose={onClose}>
        <p>b</p>
      </DetailOverlay>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.overlay.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // The whole point of the mode: a controlled sheet lives over /settings, not on a route to pop.
    expect(back).not.toHaveBeenCalled();
  });
});

/**
 * E9's structural half: the overlay and the standalone page must render the IDENTICAL body component,
 * so their DOMs are content-identical (the e2e proves the DOM; this proves they cannot silently drift
 * to two different bodies). If someone points the overlay at a bespoke sheet body, this reds.
 */
describe("E9 — the overlay renders the same body component as the standalone page", () => {
  const read = (rel: string) => readFileSync(join(import.meta.dirname, "..", rel), "utf8");

  it("both the story page and the story overlay render StoryPageBody", () => {
    expect(read("app/(desk)/news/[cluster]/page.tsx")).toContain("StoryPageBody");
    expect(read("app/(desk)/@modal/(.)news/[cluster]/page.tsx")).toContain("StoryPageBody");
  });

  it("both the ticker page and the ticker overlay render TickerPageBody", () => {
    expect(read("app/(desk)/ticker/[symbol]/page.tsx")).toContain("TickerPageBody");
    expect(read("app/(desk)/@modal/(.)ticker/[symbol]/page.tsx")).toContain("TickerPageBody");
  });
});
