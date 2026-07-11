import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GlossaryPopover } from "./GlossaryPopover";
import { GLOSSARY } from "@/lib/glossary";

/**
 * GlossaryPopover tests — the term shows a hover tip and opens its definition on click, with a
 * doorway to the full lesson when one exists (plan §3.5).
 */

describe("GlossaryPopover", () => {
  it("shows the term as a dotted-underline control with a hover tip, closed by default", () => {
    render(<GlossaryPopover entry={GLOSSARY.rvol}>RVOL</GlossaryPopover>);
    const trigger = screen.getByRole("button", { name: "RVOL" });
    expect(trigger).toHaveAttribute("title", GLOSSARY.rvol.short);
    expect(trigger.className).toContain("decoration-dotted");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the definition and the lesson doorway on click", () => {
    render(<GlossaryPopover entry={GLOSSARY.rvol}>RVOL</GlossaryPopover>);
    fireEvent.click(screen.getByRole("button", { name: "RVOL" }));
    const panel = screen.getByRole("dialog", { name: "RVOL" });
    expect(panel).toHaveTextContent(GLOSSARY.rvol.long);
    const lesson = screen.getByRole("link", { name: /full lesson/i });
    expect(lesson).toHaveAttribute("href", "/academy/volume-and-rvol");
  });

  it("omits the lesson doorway when the term teaches no lesson", () => {
    render(<GlossaryPopover entry={GLOSSARY["implied-move"]}>implied move</GlossaryPopover>);
    fireEvent.click(screen.getByRole("button", { name: "implied move" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /full lesson/i })).not.toBeInTheDocument();
  });

  it("closes again on a second click (toggle)", () => {
    render(<GlossaryPopover entry={GLOSSARY.gap}>gap</GlossaryPopover>);
    const trigger = screen.getByRole("button", { name: "gap" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
