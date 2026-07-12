import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Combobox } from "./Combobox";
import { SegmentedControl } from "./SegmentedControl";
import { Stepper } from "./Stepper";

/**
 * The form kit's contract.
 *
 * The load-bearing test in this file is the first one: **the side control has no default.** That is
 * ruling M9, and it is the one place in the app where a helpful-looking default would be a nudge.
 * Everything else here is ergonomics — mostly iOS ergonomics, which is to say bugs that would
 * otherwise only be found by a reader holding a phone.
 */

describe("SegmentedControl", () => {
  it("presses NOTHING when no default is given (M9 — side is the decision, not a parameter)", () => {
    render(
      <SegmentedControl
        name="side"
        legend="Side"
        options={[
          { value: "buy", label: "Buy" },
          { value: "sell", label: "Sell (short)" },
        ]}
        required
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("keeps a default where the field is a parameter rather than a decision", () => {
    render(
      <SegmentedControl
        name="bucket"
        legend="Bucket"
        defaultValue="large-mid"
        options={[
          { value: "large-mid", label: "Large / mid", detail: "20bp" },
          { value: "small", label: "Small", detail: "60bp" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: /Large \/ mid/ })).toBeChecked();
  });

  it("selects on click, and posts a real radio value (the ticket is a plain form)", async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl
        name="side"
        legend="Side"
        options={[
          { value: "buy", label: "Buy" },
          { value: "sell", label: "Sell (short)" },
        ]}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "Buy" }));
    expect(screen.getByRole("radio", { name: "Buy" })).toBeChecked();
  });
});

describe("Stepper", () => {
  it("steps up and down, and typing wins", async () => {
    const user = userEvent.setup();
    render(<Stepper name="quantity" label="Quantity" defaultValue={10} min={1} />);
    const input = screen.getByLabelText("Quantity");

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(input).toHaveValue(11);

    await user.clear(input);
    await user.type(input, "42");
    expect(input).toHaveValue(42);
  });

  it("genuinely disables − at the minimum, rather than silently doing nothing", async () => {
    // On a touch screen there is no hover state to explain an inert button. A − that quietly refuses
    // to work reads as a broken control, not as a boundary.
    render(<Stepper name="quantity" label="Quantity" defaultValue={1} min={1} />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });

  it("preset chips SET the value and never submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Stepper name="quantity" label="Quantity" defaultValue={10} presets={[10, 25, 50, 100]} />
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "50" }));
    expect(screen.getByLabelText("Quantity")).toHaveValue(50);
    // A chip that submitted would be the fastest path to an unintended order, on the one surface
    // whose whole design exists to slow orders down.
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Combobox", () => {
  const hits = [
    { symbol: "SMCI", name: "Super Micro Computer, Inc." },
    { symbol: "SMTC", name: "Semtech Corporation" },
  ];
  const search = () => Promise.resolve(hits);

  it("suggests on typing and fills the field with the SYMBOL when one is chosen", async () => {
    const user = userEvent.setup();
    render(<Combobox name="symbol" label="Symbol" search={search} />);

    await user.type(screen.getByLabelText("Symbol"), "sm");
    expect(await screen.findByRole("option", { name: /SMCI/ })).toBeVisible();

    await user.click(screen.getByRole("option", { name: /SMCI/ }));
    expect(screen.getByLabelText("Symbol")).toHaveValue("SMCI");
  });

  it("walks the list with the keyboard: down, down, enter picks the second", async () => {
    const user = userEvent.setup();
    render(<Combobox name="symbol" label="Symbol" search={search} />);
    const input = screen.getByLabelText("Symbol");

    await user.type(input, "sm");
    await screen.findByRole("option", { name: /SMCI/ });

    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("SMTC");
  });

  it("tracks the active option with aria-activedescendant, so a screen reader follows along", async () => {
    const user = userEvent.setup();
    render(<Combobox name="symbol" label="Symbol" search={search} />);
    const input = screen.getByLabelText("Symbol");

    await user.type(input, "sm");
    await screen.findByRole("option", { name: /SMCI/ });
    expect(input).toHaveAttribute("aria-activedescendant");
  });

  it("closes on Escape without clearing what was typed", async () => {
    const user = userEvent.setup();
    render(<Combobox name="symbol" label="Symbol" search={search} />);
    const input = screen.getByLabelText("Symbol");

    await user.type(input, "sm");
    await screen.findByRole("option", { name: /SMCI/ });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(input).toHaveValue("sm"); // free typing is preserved verbatim — the uppercase is CSS, and
    // the action's zod boundary normalizes the symbol. Escape closes the list; it never edits the field.
  });

  it("refuses iOS's help: no autocorrect, no spellcheck, and a capitalising keyboard", () => {
    // Left alone, iOS rewrites SMCI into a word mid-typing. This lives in the component, not at the
    // call sites, so no consumer can forget it.
    render(<Combobox name="symbol" label="Symbol" search={search} />);
    const input = screen.getByLabelText("Symbol");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocapitalize", "characters");
  });
});
