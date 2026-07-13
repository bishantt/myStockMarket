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

/**
 * Trade timestamps are RELATIVE to when the seed runs, and they have to be (N7, 2026-07-13).
 *
 * This fixture used to carry absolute dates — the closed trades sat on 2026-07-02, 07-06 and 07-07 —
 * and that quietly made the /paper VRT baselines a BOMB WITH A TIMER ON IT.
 *
 * The app's frequency mirror counts "round trips this week" as `closedAt >= now - 7 days` — a window
 * that rolls against the wall clock, which is the correct product behaviour. An ABSOLUTE fixture date
 * cannot stay inside a rolling window; it can only wait to fall out of it. Here is the moment it did:
 *
 *   nc-6's CI ran 2026-07-13 19:22Z → cutoff 07-06 19:22 → the 07-06T19:50 trade was IN  → count 2 ✅
 *   nc-final's   ran 2026-07-13 20:39Z → cutoff 07-06 20:39 → the same trade was OUT     → count 1 ❌
 *
 * The baseline expired at 2026-07-13T19:50Z — twenty-eight minutes after the run that last certified
 * it. The Desk photograph did not break; it EXPIRED, and it took the cost mirror with it ("-31.2%/yr"
 * became "-15.6%/yr", because half the trades had aged out of the year's projected drag). Nobody
 * touched a line of code.
 *
 * Re-shooting the baseline would have bought one day: tomorrow the 07-07 trade ages out too, the
 * count reaches 0, and the whole cost mirror reads zero. **There is no fixed date that stays "this
 * week" forever**, so a fixture that claims "two round trips this week" must SAY that relative to the
 * week — which is what these offsets do. The count is now 2 on every run, at every hour, forever.
 *
 * This is N6's rotting-baseline lesson in a new room: a picture whose subject depends on the wall
 * clock fails on a day nobody changed anything, and the failure looks exactly like a regression.
 * (Safe for the pixels: PaperLedger renders no dates at all — only symbol, side, fills and P&L — so
 * moving these timestamps changes the round-trip COUNT and nothing else on screen.)
 */
const DAY_MS = 86_400_000;
const SEED_NOW = Date.now();

/** `n` days before the seed ran. Fractional days are fine — 2.5 is "two and a half days ago". */
const DAYS_AGO = (n) => new Date(SEED_NOW - n * DAY_MS);


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
    openedAt: DAYS_AGO(7),
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
    openedAt: DAYS_AGO(6),
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
    openedAt: DAYS_AGO(5),
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
    openedAt: DAYS_AGO(19),
    status: "closed",
    exitFillPrice: 481.2,
    closedAt: DAYS_AGO(11),
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
    openedAt: DAYS_AGO(17),
    status: "closed",
    exitFillPrice: 23.1,
    closedAt: DAYS_AGO(3),
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
    openedAt: DAYS_AGO(13),
    status: "closed",
    exitFillPrice: 594.0,
    closedAt: DAYS_AGO(2),
    realizedPnl: 25.5, // (599.10 − 594.00) × 5 — a SHORT that profited: the exit is below the fill
    note: null,
  },
];
