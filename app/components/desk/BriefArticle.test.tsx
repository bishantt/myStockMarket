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
  it("renders the briefing-unavailable line and no article when held", () => {
    const held: BriefView = { ...PUBLISHED, status: "held" };
    render(<BriefArticle asOf={ASOF} brief={held} />);
    expect(screen.getByText(copy.brief.unavailable)).toBeInTheDocument();
    expect(screen.queryByText("AI-server demand carried the tape")).not.toBeInTheDocument();
    expect(screen.queryByText("What happened")).not.toBeInTheDocument();
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
