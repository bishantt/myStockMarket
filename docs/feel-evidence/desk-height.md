# The phone Desk, measured (F5, 2026-07-12)

The plan claimed the chunked Desk would go "from ~8–10 screens to ~5 screens" — roughly half. It
also said the F5 gate would record the number "so the claim is a measurement, not an adjective."

Here is the measurement, taken from the seeded VRT baseline (Pixel 7, 412px wide, full page):

| | Phone Desk height |
|---|---|
| Before F5 | **5,041 px** |
| After F5 | **4,319 px** |
| Change | **−722 px, or 14% shorter** |

**14%, not 50%.** The plan's estimate was too optimistic, and it is worth saying exactly why rather
than quietly restating the target.

What F5 folded away is real: five mover rows, two watchlist rows, the journal textarea, and the
per-provider source list. What it could NOT fold is what actually makes the page tall:

- **The daily brief is untouched, on purpose.** It is the longest module on the Desk by a wide
  margin, and the plan is explicit that it never truncates and never collapses: "a briefing behind a
  'read more' is a briefing unread." It is the product's evening heart. Folding it would have hit the
  height target and defeated the point.
- **The setup cards were already modular** — they have been `<details>` since P4. There was nothing
  left to win there; they are the pattern the rest of the Desk was catching up to.
- **The calendar did not fold at all on the seeded morning.** The cut allows three opening rows plus
  six routine ones, and the seed has exactly six routine rows. Nothing was over the line.
- **The source list is FORCED OPEN**, because the seeded run has a degraded provider. That is ruling
  M2 working exactly as intended — a degradation may not be folded away — and it costs height on
  precisely the nights when it should.

So the honest summary: **the Desk is 14% shorter, and everything that was demoted is one labelled tap
away.** The remaining height is the brief, which is the thing the reader came for.

On a night with no degraded source and a busier calendar, the saving is larger. On a night with a
short brief, larger still. This is the floor, not the ceiling — and it is a floor set by the module
the plan refused to compromise.
