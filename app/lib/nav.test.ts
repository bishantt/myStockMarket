import { describe, expect, it } from "vitest";

import { activeRoomHref } from "./nav";

/** lib/nav.test.ts — the active-room logic that keeps the nav selection in sync with the route. */
describe("activeRoomHref", () => {
  it("lights the Desk on the root and on a ticker drill", () => {
    expect(activeRoomHref("/")).toBe("/");
    expect(activeRoomHref("/ticker/AAPL")).toBe("/");
  });

  it("lights each room on its own route", () => {
    expect(activeRoomHref("/scans")).toBe("/scans");
    expect(activeRoomHref("/paper")).toBe("/paper");
    expect(activeRoomHref("/track-record")).toBe("/track-record");
    expect(activeRoomHref("/settings")).toBe("/settings");
  });

  it("lights the Academy on the map and on any lesson or sub-page", () => {
    expect(activeRoomHref("/academy")).toBe("/academy");
    expect(activeRoomHref("/academy/reading-a-base-rate-sentence")).toBe("/academy");
    expect(activeRoomHref("/academy/glossary")).toBe("/academy");
  });

  it("does not let the Desk greedily claim a named room's route", () => {
    // /track-record must not resolve to the Desk just because the Desk is the fallback.
    expect(activeRoomHref("/track-record")).not.toBe("/");
  });

  it("falls back to the Desk for an unknown path", () => {
    expect(activeRoomHref("/nope")).toBe("/");
  });
});
