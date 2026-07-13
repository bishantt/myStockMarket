import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RangeControl, RANGE_CONTROL_SURFACES } from "@/components/RangeControl";

/**
 * RangeControl — and ruling C3, which is the reason it is built the way it is.
 *
 * C3: EVIDENCE HORIZONS ARE PROPERTIES, NOT PREFERENCES.
 *
 * A base rate's horizon ("higher 10 trading days later"), a vol band's horizon, a signal's
 * resolves-on date — these are fixed, evidence-bound properties of the pattern they belong to. If a
 * reader can slide a control across horizons until one of them flatters a pattern, the app has
 * built a p-hacking machine with a nice segmented control on the front. That is the single most
 * dangerous thing a UI can do to a product whose entire claim is honest base rates.
 *
 * So the firewall is not a convention, a lint rule, or a code review. It is the TYPE. The component
 * physically cannot mount on a surface outside its allowlist: the `surface` prop is a closed union,
 * so a forbidden surface does not compile — and if someone reaches past the type at runtime, the
 * component renders nothing at all.
 *
 * The allowlist is exactly two: the ticker chart (daily bars, ~5y of history — a range here changes
 * the VIEW) and the news feed (Today / This week). Every other surface's "range" would change the
 * DEFINITION of the number rather than the view of it, which is a different thing entirely.
 */

const OPTIONS = [
  { label: "1M", value: "1m", available: true },
  { label: "6M", value: "6m", available: true },
  { label: "5Y", value: "5y", available: false, reason: "Less than 4 years of history for this symbol" },
];

afterEach(() => {
  window.sessionStorage.clear();
});

describe("C3 — the allowlist is the firewall", () => {
  it("is exactly two surfaces, and this test is the lock on that", () => {
    // If this array ever grows, someone is adding a range control to a surface that did not have
    // one — and every surface that does not have one, does not have one for a REASON written down in
    // the plan's Part 5.3 table. Growing it is a structural decision, not a UI tweak.
    expect([...RANGE_CONTROL_SURFACES].sort()).toEqual(["news-feed", "ticker-chart"]);
  });

  it("renders NOTHING on a surface outside the allowlist, even if the type is bypassed", () => {
    // The type stops this at compile time. This asserts the runtime belt: a cast, a JSON round trip,
    // a `any` in a hurry — none of them get a range control onto a base rate.
    const { container } = render(
      // @ts-expect-error — deliberately bypassing the closed union, which is the whole point
      <RangeControl surface="setup-cards" options={OPTIONS} value="6m" onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("RangeControl — the control itself", () => {
  it("renders its options as a radio group, so a keyboard drives it", () => {
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={() => {}} />);

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1M" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "6M" })).toBeChecked();
  });

  it("reports a change to its caller", async () => {
    const onChange = vi.fn();
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "1M" }));
    expect(onChange).toHaveBeenCalledWith("1m");
  });

  it("an unavailable option is DISABLED AND EXPLAINED — never silently missing", () => {
    // The rule the plan draws, and it is a real distinction: an option that can never exist for this
    // SURFACE is omitted (there is no "1D" on an end-of-day chart, and offering one would be a lie).
    // An option that exists but not for THIS ITEM is shown, disabled, with the reason — because a
    // reader who knows 5Y exists and cannot find it will assume the app is broken, and a reader who
    // is told "less than 4 years of history for this symbol" has learned something true.
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={() => {}} />);

    const fiveYear = screen.getByRole("radio", { name: "5Y" });
    expect(fiveYear).toBeDisabled();
    expect(screen.getByTitle("Less than 4 years of history for this symbol")).toBeInTheDocument();
  });

  it("does not fire onChange for a disabled option", async () => {
    const onChange = vi.fn();
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "5Y" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("RangeControl — stillness (P2)", () => {
  it("never animates, because it frames a money visual", () => {
    // The chart it controls is a money visual, and no ancestor or sibling of one may animate. A
    // range control that slid its active pill would be motion attached to a price chart changing —
    // which reads as the price DOING something, at the exact moment it is doing nothing at all.
    const { container } = render(
      <RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={() => {}} />,
    );
    expect(container.innerHTML).not.toMatch(/transition|animate-|duration-/);
  });
});

describe("RangeControl — the reader's frame persists within a session", () => {
  it("remembers the choice per surface, for the session only", async () => {
    const onChange = vi.fn();
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "1M" }));

    // A return visit within the session keeps the reader's frame. A FRESH session returns to the
    // default — deliberately: the default is part of the editorial statement, and a stale persisted
    // range quietly becomes the new default without anyone deciding that it should.
    expect(window.sessionStorage.getItem("msm-range:ticker-chart")).toBe("1m");
  });

  it("keeps each surface's frame separate", async () => {
    render(<RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: "1M" }));

    expect(window.sessionStorage.getItem("msm-range:ticker-chart")).toBe("1m");
    expect(window.sessionStorage.getItem("msm-range:news-feed")).toBeNull();
  });
});

/**
 * THE C3 NEGATIVE TESTS — the ones that prove the firewall is real.
 *
 * A rule that is only ever tested by asserting the allowed cases work is not a rule; it is a
 * feature with an opinion. These assert the FORBIDDEN cases, which is the half that matters: the
 * evidence surfaces — base rates, setup cards, vol bands, the track record — must contain no time
 * control of any kind, and must be structurally incapable of gaining one.
 *
 * Why this is the most important guard in the file: a reader who can slide a base rate's horizon
 * around until it flatters a pattern is a reader the app has taught to p-hack. The control would not
 * even look wrong. It would look like a thoughtful piece of UI.
 */
describe("C3 — the evidence surfaces have no range control, and cannot get one", () => {
  it("the allowlist contains NO evidence surface", () => {
    // Stated as a list rather than a count, so that the failure message names the trespasser.
    const FORBIDDEN = ["setup-cards", "base-rate", "vol-band", "track-record", "brier", "scans", "movers"];
    const trespassers = FORBIDDEN.filter((s) =>
      (RANGE_CONTROL_SURFACES as readonly string[]).includes(s),
    );

    expect(
      trespassers,
      "a range control on an evidence surface is a p-hacking machine with a segmented control on the front",
    ).toEqual([]);
  });

  it("rendering it on an evidence surface produces nothing at all — not a smaller control, NOTHING", () => {
    for (const surface of ["setup-cards", "base-rate", "vol-band", "track-record"]) {
      const { container } = render(
        // @ts-expect-error — the type already forbids this; this proves the runtime does too
        <RangeControl surface={surface} options={OPTIONS} value="6m" onChange={() => {}} />,
      );
      expect(container.firstChild, `${surface} must render no range control`).toBeNull();
    }
  });

  it("the guard can fail — an allowed surface DOES render, so the null above means something", () => {
    // The negative control on the negative control. If RangeControl returned null unconditionally,
    // every assertion above would pass while the component did nothing at all. This is what proves
    // the nulls are a decision rather than a bug.
    const { container } = render(
      <RangeControl surface="ticker-chart" options={OPTIONS} value="6m" onChange={() => {}} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
