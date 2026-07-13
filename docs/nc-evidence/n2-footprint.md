# N2 — the footprint evidence

*Measured 2026-07-13. The plan's Part 4.4 gate asks for the phone Desk's height, before and after,
recorded rather than promised.*

## The phone Desk got 208px shorter, and nothing was removed

| | Desk height, phone (390×844 viewport) |
|---|---|
| `nc-1` (before N2) | **3,212px** |
| `nc-2` (after N2) | **3,004px** |
| Change | **−208px (−6.5%)** |

**How it was measured, and why you can trust the comparison.** Both numbers are
`document.documentElement.scrollHeight` on `/`, in the Pixel 7 project, after the fonts have
settled — a button or a card measured mid-font-swap is measured at the wrong width, and the height
follows the width. The `nc-1` figure was taken by checking that tag out, rebuilding, and running the
same probe against **the same database**, in the same session, minutes apart. Same page, same data,
same instrument. The only variable is the code.

**Why this is not comparable to the F5 number (5,041px → 4,319px).** Those were measured against the
*seeded* database, which publishes eight movers, a full calendar and a longer brief. These are
measured against production, which currently holds less. An absolute height is a property of the
data as much as the layout, so the two pairs may not be set beside each other — only compared within
themselves. There is no local Postgres on this machine (recorded at F0, still true), so a seeded
measurement is not available outside CI.

## Where the 208px went

| Change | Roughly |
|---|---|
| Module 00's card retired into the header strip (Part 4.1) | ~130px — a full Surface card, its masthead, its padding, and a `StatFigure`, replaced by one 44px line |
| The sources footer sheds its card on a healthy night (Part 4.2) | ~75px — card padding and border, gone; the provenance line itself stays, in full |

The two add to about 205px, which is the measured 208px inside the noise of a re-render. Nothing was
folded away, nothing was truncated, and no information left the page:

- The strip says **more** than module 00 did, not less. Module 00 printed one date. The strip prints
  the session on screen, when the pipeline wrote it, and when the next edition lands — and it is a
  doorway to the control room, which module 00 was not.
- The sources footer loses its **card**, not its content. Every provider is still named, the FRED
  attribution is still there, and on a night a source degrades it keeps the card at full strength,
  forced open. It shrinks on the boring night and does not shrink on the frightening one, which is
  the same rule the strip obeys.

## What the desktop got instead

Height was never the desktop's problem; **unspent width** was. Every room outside the Desk was one
column inside a 1360px shell, which on a 27" display is a phone layout with enormous margins.

The new `wide` band (≥1536px) buys internal density, not more columns:

| Room | ≥1536 |
|---|---|
| `/scans`, `/academy` | preset and module cards go **3-up** (2-up at `lg`) |
| Desk | rail widens to 360px; **setup cards 2-up** — they are independent cards, not prose |
| Desk | the brief and the movers stay **one-up**, at every width, forever — they are READ stations |
| `/paper` | the ticket (5/12) sits beside the cost mirror and ledger (7/12) |
| `/track-record` | the app's record (7/12) beside the reader's own forecasts (5/12) |
| `/scans/[preset]` | the recipe (7/12) beside its own match count (5/12) |
| `/settings` | the two small cards 2-up; the watchlist spans |

**There is no third column on the Desk at any width, and there never will be.** A second reading
column would split the ritual's order into two ambiguous streams — the reader would have to decide
which column comes first, and the entire argument for the ritual is that they never have to decide
anything about the order.

Every room is pixel-locked at 1536 (light) by the new `wide` VRT project, and asserted to have zero
horizontal scroll there. A breakpoint with no lock silently stops working: nothing else in the suite
renders above 1366px, so a broken wide grid would be invisible to every other test in the file.
