import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { EmptyModule } from "./EmptyModule";

/**
 * EmptyModule — the Law 2 contract (PD3, §6.2 and §6.5).
 *
 * Three things are worth a test here, and they are the three that break silently.
 *
 * A NOTE ON WHAT THESE TESTS CANNOT SEE. jsdom has no layout engine: every element in it is 0×0,
 * so no unit test in this repo can assert that the band comes in under ~112px. That number is
 * measured in a real browser and recorded in docs/pd-evidence/pd3-grid.md, and it is pinned by the
 * mbp16 pixel baselines. What a unit test CAN do — and what actually protects the law — is assert
 * that nothing in this component RESERVES height. Height reservation is a class, and a class is
 * something jsdom can see.
 */
describe("EmptyModule", () => {
  /**
   * LAW 2, THE WHOLE OF IT: a module with no content takes only the height it earns.
   *
   * `min-h-*`, a fixed `h-*` and an `aspect-*` box are the three ways to promise a reader that
   * content is coming to fill a space. On the night the pipeline did not run, that promise is a lie
   * told in whitespace, and the reader scrolls past it either way.
   *
   * THE LAW IS ABOUT THE SURFACE, and the ban lands where the law puts it. The Surface — the box the
   * layout actually measures — may not reserve height in any of the three ways. Descendants may not
   * carry `min-h-`, which is the one form that pads an empty state out from the inside no matter how
   * small the element is. (`min-h-11`, the 44px touch floor, is a REQUIREMENT elsewhere in the app —
   * there is no control in this band, so nothing here needs it, and if a control ever arrives the
   * exemption is argued in check-drift rule 24 rather than smuggled in here.)
   *
   * The band's height in PIXELS is measured where pixels exist: e2e/grid.spec.ts opens a real browser
   * on a thin night and holds it to the plan's ~112px budget. It comes in at ~104px.
   */
  it("its Surface reserves no height — no min-h, no fixed height, no aspect box", () => {
    const { container } = render(
      <EmptyModule index={6} title="Setup cards" note="Setup cards arrive with the nightly base rates." />,
    );

    const surface = container.firstElementChild as HTMLElement;
    expect(surface.className, "the module Surface reserves height — Law 2 forbids it").not.toMatch(
      /(^|\s)(min-h-|h-\d|h-full|aspect-)/,
    );

    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      const classes = el.className;
      if (typeof classes !== "string") continue;
      expect(classes, `${el.tagName.toLowerCase()} pads the band from the inside`).not.toMatch(
        /(^|\s)min-h-/,
      );
    }
  });

  /**
   * THE VOICE: information, not an apology. The masthead keeps the module's own index and name — an
   * empty module is still that module, holding its place in the ritual — and the note states what
   * the slot is for and when it fills.
   */
  it("keeps the module's place in the ritual and states what the slot is for", () => {
    render(
      <EmptyModule
        index={2}
        title="Daily brief"
        note="The evening briefing lands after the close."
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("02 — Daily brief");
    expect(screen.getByText("The evening briefing lands after the close.")).toBeInTheDocument();
  });

  /**
   * THE TIMESTAMP IS AN HONESTY RULE, AND IT CUTS BOTH WAYS.
   *
   * When a run HAS happened and this module simply found nothing, the absence is a finding as of
   * that run — so it carries the run's stamp, exactly as the filled state would. When nothing has
   * ever run, there is no as-of in existence, and the band must NOT invent one. The Desk depends on
   * this: on an empty database every module renders its band unstamped rather than borrowing the
   * wall clock.
   *
   * A fabricated timestamp is worse than no timestamp, because a reader believes it.
   */
  it("stamps the run that found nothing, and stamps nothing when no run exists", () => {
    const asOf = new Date("2026-07-10T22:41:00Z");

    const stamped = render(
      <EmptyModule index={6} title="Setup cards" note="No setups fired tonight." asOf={asOf} />,
    );
    expect(stamped.container.querySelector("time")).not.toBeNull();
    stamped.unmount();

    const unstamped = render(
      <EmptyModule index={6} title="Setup cards" note="Setup cards arrive with the nightly base rates." />,
    );
    expect(
      unstamped.container.querySelector("time"),
      "an empty module with no run behind it must not invent a timestamp",
    ).toBeNull();
  });
});
