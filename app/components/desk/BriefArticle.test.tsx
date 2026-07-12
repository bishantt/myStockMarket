import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BriefArticle } from "./BriefArticle";
import { copy } from "@/lib/copy";
import type { BriefView } from "@/lib/briefing";

/**
 * BriefArticle tests (plan §6.2 — the "briefing-unavailable render test", plus the published path).
 *
 * A held briefing must render the neutral "briefing unavailable" line and NONE of the article — the
 * honesty rule in its final rendered form. A published briefing shows the Today's-focus headline,
 * the labeled slots, and a source superscript that links to the article behind the claim.
 */

const ASOF = new Date("2026-07-09T20:05:00Z");

const PUBLISHED: BriefView = {
  status: "published",
  todayFocus: { headline: "AI-server demand carried the tape", body: "Breadth was positive.", citationNumbers: [1] },
  items: [
    {
      whatHappened: "Super Micro beat estimates.",
      whyItMatters: "An early read on datacentre spend.",
      byTheNumbers: "Shares rose 18.40%.",
      yesBut: "One quarter is not a trend.",
      citationNumbers: [1],
    },
  ],
  calendarNotes: ["CPI is due 2026-07-12."],
  learnSlug: null,
  footnotes: [{ n: 1, url: "https://reuters.com/smci", source: "reuters.com" }],
};

describe("BriefArticle", () => {
  it("renders the unavailable line and NO prose when held — but keeps the slot skeleton", () => {
    // A held briefing means the verification gate refused to print a number it could not check.
    // None of the LLM's prose may survive that — but the STRUCTURE does, deliberately (§5.1). The
    // shape of a market note (what happened / why it matters / by the numbers / yes, but) is part
    // of what this module teaches, and a reader on a held night still learns the shape and still
    // sees exactly what is missing. An empty paragraph teaches nothing.
    const held: BriefView = { ...PUBLISHED, status: "held" };
    render(<BriefArticle asOf={ASOF} brief={held} />);

    expect(screen.getByText(copy.brief.unavailable)).toBeInTheDocument();

    // Not one word of the withheld briefing appears.
    expect(screen.queryByText("AI-server demand carried the tape")).not.toBeInTheDocument();

    // But the slot skeleton does — as labels over empty rules, never as content.
    expect(screen.getByText("What happened")).toBeInTheDocument();
    expect(screen.getByText("Yes, but")).toBeInTheDocument();
  });

  it("renders the headline, the labeled slots, and a source superscript link when published", () => {
    render(<BriefArticle asOf={ASOF} brief={PUBLISHED} />);
    const region = screen.getByRole("region", { name: "Daily brief" });
    expect(region).toHaveTextContent("AI-server demand carried the tape");
    expect(screen.getByText("What happened")).toBeInTheDocument();
    expect(screen.getByText(/Shares rose 18\.40%/)).toBeInTheDocument();
    // The source footnote resolves to a real outbound link.
    expect(screen.getByRole("link", { name: "reuters.com" })).toHaveAttribute("href", "https://reuters.com/smci");
    // No Learn doorway when the slug is unknown to the manifest.
    expect(screen.queryByRole("link", { name: /Learn:/ })).not.toBeInTheDocument();
  });
});
