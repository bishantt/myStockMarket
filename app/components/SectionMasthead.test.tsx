import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionMasthead } from "./SectionMasthead";
import { formatAsOf } from "@/lib/time";

/**
 * SectionMasthead tests — the CC4 hierarchy grammar and the as-of matches/differs treatment (D4).
 *
 * jsdom has no layout engine, so this pins the CLASSES that carry the grammar, not the pixels. Two
 * things matter here and nothing else can see them at the unit level:
 *
 *  1. The section header is the CC4 grammar — mono 600, ink-2 (up from muted). A future edit that
 *     drops it back to muted/medium would sail through every other test.
 *  2. The as-of is INFORMATION only when it differs from the edition (the morning edition makes that
 *     real at CC9); when it matches, it recedes. The plan said "faint when it matches", but faint is
 *     a 2.2:1 grey that drift rule 18 and axe both forbid on a timestamp — so matching is `muted`
 *     (the receding grey) and differing is `ink-2` (it comes forward). The hierarchy the plan wants
 *     is preserved; the a11y floor is kept. This test is where the two renderings are proven to
 *     differ (the plan's guard for the treatment).
 */

const EDITION = new Date("2026-07-14T23:36:00Z"); // 7:36 PM ET
const SAME_MINUTE = new Date("2026-07-14T23:36:40Z"); // still 7:36 PM ET
const A_MINUTE_LATER = new Date("2026-07-14T23:41:00Z"); // 7:41 PM ET

function timeEl(asOf: Date): HTMLElement {
  return screen.getByText(formatAsOf(asOf));
}

describe("SectionMasthead — the CC4 grammar", () => {
  it("sets the section header in mono 600, ink-2 (up from muted)", () => {
    render(<SectionMasthead index={4} title="Movers" />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.classList.contains("font-semibold")).toBe(true);
    expect(heading.classList.contains("text-ink-2")).toBe(true);
    expect(heading.classList.contains("text-muted")).toBe(false);
  });
});

describe("SectionMasthead — the as-of matches/differs treatment", () => {
  it("recedes to muted when the module's stamp matches the edition's", () => {
    render(<SectionMasthead index={1} title="Macro pulse" asOf={SAME_MINUTE} editionAsOf={EDITION} />);
    const stamp = timeEl(SAME_MINUTE);
    expect(stamp.classList.contains("text-muted")).toBe(true);
    expect(stamp.classList.contains("text-ink-2")).toBe(false);
  });

  it("comes forward to ink-2 when the module's stamp differs from the edition's", () => {
    render(<SectionMasthead index={1} title="Macro pulse" asOf={A_MINUTE_LATER} editionAsOf={EDITION} />);
    const stamp = timeEl(A_MINUTE_LATER);
    expect(stamp.classList.contains("text-ink-2")).toBe(true);
    expect(stamp.classList.contains("text-muted")).toBe(false);
  });

  it("recedes to muted when there is no edition to compare against (safe default)", () => {
    render(<SectionMasthead index={1} title="Macro pulse" asOf={EDITION} />);
    const stamp = timeEl(EDITION);
    expect(stamp.classList.contains("text-muted")).toBe(true);
    expect(stamp.classList.contains("text-ink-2")).toBe(false);
  });

  it("never renders the as-of in faint (drift rule 18 / axe)", () => {
    render(<SectionMasthead index={1} title="Macro pulse" asOf={SAME_MINUTE} editionAsOf={EDITION} />);
    expect(timeEl(SAME_MINUTE).classList.contains("text-faint")).toBe(false);
  });
});
