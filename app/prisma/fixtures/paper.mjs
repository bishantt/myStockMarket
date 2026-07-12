/**
 * fixtures/paper.mjs — the seeded paper ledger.
 *
 * Six trades: three still open (one of them a short) and three closed with mixed outcomes (two
 * gains — one of them earned on the SHORT side — and one loss). That mix is not decoration. The
 * ledger tables render a realized-P&L outcome chip, and a chip that only ever renders green has
 * never been tested; a short that PROFITED is the one case where the sign convention can silently
 * invert (a short gains when the exit is BELOW the fill), so the seed insists on having one.
 *
 * Every fill here agrees with lib/paper.ts rather than being invented:
 *
 *     costBps  = spread/2 + slippage   →  large-mid: 20/2 + 5 = 15bp ·  small: 60/2 + 5 = 35bp
 *     fill     = referenceOpen × (1 ± costBps/10,000)     buying fills ABOVE, selling BELOW
 *
 * The cost always moves against the trader. That is the whole lesson of the room, and a seed whose
 * numbers quietly disagreed with the room's own arithmetic would be teaching the opposite one.
 *
 * `realizedPnl` is stored for completeness, but note the app does not trust it: lib/ledger.ts
 * recomputes P&L from the fills and the quantity every render. The values below are what that
 * function returns for these rows, so the two can never be seen to disagree.
 */

const OPENED = (iso) => new Date(iso);

export const PAPER_TRADES = [
  // ---- Open ----------------------------------------------------------------------------------
  {
    id: "seed-paper-aapl",
    symbol: "AAPL",
    side: "buy",
    bucket: "large-mid",
    quantity: 25,
    referenceOpen: 210.0,
    fillPrice: 210.315, // 210.00 × (1 + 15/10,000) — the buy fills above the open
    costBps: 15,
    signalViewedAt: null,
    openedAt: OPENED("2026-07-06T13:35:00.000Z"),
    status: "open",
    exitFillPrice: null,
    closedAt: null,
    realizedPnl: null,
    note: "Earnings run-up — sized small on purpose.",
  },
  {
    id: "seed-paper-nvda",
    symbol: "NVDA",
    side: "sell", // the short: the ledger must render the side, and the P&L must invert for it
    bucket: "large-mid",
    quantity: 15,
    referenceOpen: 165.0,
    fillPrice: 164.7525, // 165.00 × (1 − 15/10,000) — the sell fills below the open
    costBps: 15,
    signalViewedAt: null,
    openedAt: OPENED("2026-07-07T13:32:00.000Z"),
    status: "open",
    exitFillPrice: null,
    closedAt: null,
    realizedPnl: null,
    note: "Fading the run into the 50-day.",
  },
  {
    id: "seed-paper-sndl",
    symbol: "SNDL",
    side: "buy",
    bucket: "small", // the small bucket costs 35bp, not 15 — the ledger shows the difference
    quantity: 100,
    referenceOpen: 1.8,
    fillPrice: 1.8063, // 1.80 × (1 + 35/10,000)
    costBps: 35,
    signalViewedAt: null,
    openedAt: OPENED("2026-07-08T13:31:00.000Z"),
    status: "open",
    exitFillPrice: null,
    closedAt: null,
    realizedPnl: null,
    note: "Deliberately tiny — this is a lottery-risk name.",
  },

  // ---- Closed --------------------------------------------------------------------------------
  {
    id: "seed-paper-msft",
    symbol: "MSFT",
    side: "buy",
    bucket: "large-mid",
    quantity: 10,
    referenceOpen: 470.0,
    fillPrice: 470.705,
    costBps: 15,
    signalViewedAt: null,
    openedAt: OPENED("2026-06-24T13:31:00.000Z"),
    status: "closed",
    exitFillPrice: 481.2,
    closedAt: OPENED("2026-07-02T19:50:00.000Z"),
    realizedPnl: 104.95, // (481.20 − 470.705) × 10 — a gain on a long
    note: null,
  },
  {
    id: "seed-paper-gme",
    symbol: "GME",
    side: "buy",
    bucket: "large-mid",
    quantity: 40,
    referenceOpen: 25.0,
    fillPrice: 25.0375,
    costBps: 15,
    signalViewedAt: null,
    openedAt: OPENED("2026-06-26T13:31:00.000Z"),
    status: "closed",
    exitFillPrice: 23.1,
    closedAt: OPENED("2026-07-06T19:50:00.000Z"),
    realizedPnl: -77.5, // (23.10 − 25.0375) × 40 — the loss the outcome chip must say out loud
    note: null,
  },
  {
    id: "seed-paper-spy",
    symbol: "SPY",
    side: "sell",
    bucket: "large-mid",
    quantity: 5,
    referenceOpen: 600.0,
    fillPrice: 599.1,
    costBps: 15,
    signalViewedAt: null,
    openedAt: OPENED("2026-06-30T13:31:00.000Z"),
    status: "closed",
    exitFillPrice: 594.0,
    closedAt: OPENED("2026-07-07T19:50:00.000Z"),
    realizedPnl: 25.5, // (599.10 − 594.00) × 5 — a SHORT that profited: the exit is below the fill
    note: null,
  },
];
