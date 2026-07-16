import { describe, expect, it } from "vitest";

import { describeCadence, describeNextRun, nextRun, parseCron } from "@/lib/cron";

/**
 * cron.test.ts — the DST-honest cadence and next-run computation (CC7, plan 4.6).
 *
 * The three real crons this table renders, verbatim from the workflow files:
 *   · nightly-a full  `37 22 * * 1-5`  = 6:37 PM EDT / 5:37 PM EST, ET Mon–Fri
 *   · nightly-a dawn  `30 10 * * 1-5`  = 6:30 AM EDT / 5:30 AM EST, ET Mon–Fri (CC8; was Tue–Sat)
 *   · nightly-b       `25 0 * * 2-6`   = 8:25 PM EDT / 7:25 PM EST, ET Mon–Fri (UTC 00:25 rolls back a day)
 *
 * The whole point is that a UTC-fixed cron reads differently on the reader's ET wall clock in the two
 * DST regimes, and nightly-b's midnight-UTC slot ALSO shifts its weekday back a day in ET. A "subtract
 * five hours" shortcut gets both wrong; only a real timezone conversion is honest.
 */

const FULL = "37 22 * * 1-5";
const DAWN = "30 10 * * 1-5";
const BRIEFING = "25 0 * * 2-6";

describe("parseCron", () => {
  it("parses minute, hour and a UTC weekday range", () => {
    expect(parseCron(FULL)).toEqual({ minute: 37, hour: 22, dows: [1, 2, 3, 4, 5] });
  });

  it("parses the dawn refresh's weekday range (Mon–Fri, CC8)", () => {
    expect(parseCron(DAWN)).toEqual({ minute: 30, hour: 10, dows: [1, 2, 3, 4, 5] });
  });

  it("parses a weekday range that includes Saturday", () => {
    expect(parseCron("0 10 * * 2-6")).toEqual({ minute: 0, hour: 10, dows: [2, 3, 4, 5, 6] });
  });

  it("parses a comma list of weekdays", () => {
    expect(parseCron("30 12 * * 1,3,5")).toEqual({ minute: 30, hour: 12, dows: [1, 3, 5] });
  });

  it("rejects a cron that constrains the day-of-month (we only model weekday schedules)", () => {
    expect(() => parseCron("0 10 15 * *")).toThrow();
  });

  it("rejects a malformed line", () => {
    expect(() => parseCron("nonsense")).toThrow();
  });
});

describe("describeCadence — DST-honest, both seasonal renderings when they differ", () => {
  it("renders the full nightly: ET Mon–Fri, 6:37 PM EDT / 5:37 PM EST", () => {
    expect(describeCadence(parseCron(FULL))).toBe("Mon–Fri · ~6:37 PM EDT / 5:37 PM EST");
  });

  it("renders the dawn refresh: ET Mon–Fri, 6:30 AM EDT / 5:30 AM EST (CC8; no weekday shift)", () => {
    expect(describeCadence(parseCron(DAWN))).toBe("Mon–Fri · ~6:30 AM EDT / 5:30 AM EST");
  });

  it("renders the evening briefing: UTC 00:25 rolls back a day, so ET Mon–Fri, 8:25 PM / 7:25 PM", () => {
    expect(describeCadence(parseCron(BRIEFING))).toBe("Mon–Fri · ~8:25 PM EDT / 7:25 PM EST");
  });

  it("lists non-contiguous weekdays with commas", () => {
    expect(describeCadence(parseCron("30 12 * * 1,3,5"))).toMatch(/^Mon, Wed, Fri · /);
  });
});

describe("describeNextRun — the next fire, in ET", () => {
  it("today, when the fire time is still ahead on a session day", () => {
    // Wednesday 2026-07-15, 15:00 UTC (11:00 AM EDT) — tonight's 22:37 UTC full run is still ahead.
    const now = new Date("2026-07-15T15:00:00Z");
    expect(describeNextRun(parseCron(FULL), now)).toBe("Wed · ~6:37 PM ET");
  });

  it("rolls to the next session day once today's slot has passed", () => {
    // Wednesday 2026-07-15, 23:00 UTC — past tonight's 22:37 slot, so the next full run is Thursday.
    const now = new Date("2026-07-15T23:00:00Z");
    expect(describeNextRun(parseCron(FULL), now)).toBe("Thu · ~6:37 PM ET");
  });

  it("skips the weekend: after Friday's run the next full run is Monday", () => {
    // Friday 2026-07-17, 23:00 UTC — past Friday's slot. Sat/Sun are not in dows → Monday.
    const now = new Date("2026-07-17T23:00:00Z");
    expect(describeNextRun(parseCron(FULL), now)).toBe("Mon · ~6:37 PM ET");
  });

  it("the evening briefing's next fire reads in ET as the same evening", () => {
    // Wednesday 2026-07-15, 15:00 UTC. The briefing cron is 00:25 UTC Thu (= 8:25 PM ET Wed).
    const now = new Date("2026-07-15T15:00:00Z");
    expect(describeNextRun(parseCron(BRIEFING), now)).toBe("Wed · ~8:25 PM ET");
  });
});

describe("nextRun — the raw UTC instant", () => {
  it("returns the exact UTC instant of the next fire", () => {
    const now = new Date("2026-07-15T15:00:00Z");
    expect(nextRun(parseCron(FULL), now).toISOString()).toBe("2026-07-15T22:37:00.000Z");
  });

  it("returns now itself when now is exactly on the fire instant", () => {
    const now = new Date("2026-07-15T22:37:00Z");
    expect(nextRun(parseCron(FULL), now).getTime()).toBe(now.getTime());
  });
});
