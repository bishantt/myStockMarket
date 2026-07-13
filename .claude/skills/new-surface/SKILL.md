# new-surface

**Status:** minted 2026-07-12 during the UI redesign (R1–R5), after building the same card
eleven times.

**When to use:** any time you add a card, panel, module, or overlay to the app — a new Desk
module, a new Academy section, a new drill panel, a new page.

The point of this skill is that "Morning Broadsheet" is not a set of colours. It is a set of
DECISIONS about what a surface may claim. Get the class strings right and the honesty rules
wrong, and you have shipped something that looks like the product and lies like a dashboard.

---

## 1. Pick the level, and know what it means

| Level | Class | What it says |
|---|---|---|
| `card` | `.surface` | The Desk's default. Translucent glass, hairline, 16px radius. |
| `raised` | `.surface-raised` | Slightly lifted. Stat cards. Use sparingly — if everything is raised, nothing is. |
| `tinted` | `.surface-tinted` | A nested accent panel. Base rates, cost mirrors, helper boxes. |
| `solid` | `.surface-solid` | Opaque paper. The Academy's material, and every DECISION moment. |

Use the `Surface` component, not the raw class:

```tsx
<Surface level="card" className="p-5 desk:p-6">…</Surface>
```

**Cards never blur.** Blur is spent on five components only (top bar, tab bar, RailDialog,
CommandPalette, GlossaryPopover), and the grep enforces it. Stacked `backdrop-filter` is a GPU
tax that shows up as scroll jank on a mid-range phone, and over the static wash, translucency
alone looks near-identical.

**The Academy is solid, always.** It is the only thing left distinguishing the two rooms now
that they share a palette (D1/D4). If you put glass in the Academy, you have deleted the room.

---

## 2. Open with a masthead, and give it its provenance

```tsx
<SectionMasthead
  index={4}
  title="Movers"
  asOf={asOf}
  provenance="Finnhub · Marketaux · fetched 8:41 PM ET"
/>
```

- The masthead is **muted mono**, never accent. Eight indigo mastheads down the Desk would
  teach the reader that indigo means "chrome", and the accent would stop meaning "you can act
  here" — which is the only thing it is for.
- **Every module carries an as-of stamp.** This is what makes stale data self-identifying, and
  it is why offline mode can be an honest state instead of an apology.
- The `provenance` prop powers the app's signature gesture: hover or tap the stamp and the full
  chain fades in. If your surface shows numbers that came from somewhere, say where.

The Academy does not use mastheads. It uses **serif kickers** — a Newsreader italic heading over
a hairline. A reading room does not number its furniture.

---

## 3. The honesty checklist, before you write the markup

Ask these in order. Any "yes" changes what you are allowed to build.

**Does it show a base rate, a win rate, or an "X of N"?**
→ It renders through `components/BaseRate`, and through nothing else. The N-gate, the interval,
the always-up baseline and the WEAK cap must travel with the number. There is no such thing as
"just the percentage, the context is one click away". Grep #10 enforces this.

**Does it show a probability, a range, a delta, or money?**
→ The root gets `data-p2`. It renders complete on first paint. Nothing inside it animates — and
**no ancestor may animate or transform it either**, which means no hover-lift on the card that
contains it. Background and border hover feedback only. A jsdom test walks up from every
`[data-p2]` node and will catch you.

**Does it show an outcome, a direction, or a state?**
→ The word goes in the chip. Colour is the redundant channel, never the primary one. A hit and
a miss render at the same size and the same weight; only the hue differs.

**Is it empty?**
→ An empty state is information, not an apology. "No moves cleared the catalyst-or-noise bar
today" is the product working. Write the sentence into `copy.ts` and render it like it means
something.

**Does it LIST rows, and hide some of them?**
→ The collapsed summary states the COUNT and the as-of context ("+ 12 more · through Jul 26"). Use
`components/Disclosure`, whose `count` prop is required by type — an uncounted disclosure does not
compile. And a caveat may collapse only WITH the claim it qualifies: a degraded source, a miss, a
gate flag, a high-importance calendar row may never be folded under a summary that reads as
complete. (Ruling M2.)

**Is it a TABLE?**
→ `components/DataTable`, and nothing else. There is one table in this app and drift rule 16 keeps
it that way. Its default order is the pipeline's own and the header SAYS so, in words — "scan
order", never "top", "best" or "hottest". A sortable table of market data is one small step from a
leaderboard, and the step gets taken by accident. (Ruling M1.)

**Does it LOAD?**
→ Figure slots render a still em-dash, never a shimmering bar. A pulsing rectangle exactly where a
price is about to appear reads as "a number is coming, look here" — which is the anticipation the
stillness rule exists to kill. Container bones may shimmer; chart reservations are still geometry.
(Ruling M4, `components/Skeleton`.)

**Does it SCROLL sideways?**
→ The reader pushes it; it never pushes itself. No autoplay, no auto-advance, no `scrollTo`, no
`scroll-behavior: smooth`, no `snap-mandatory` (drift rule 15). And it states what is off the edge:
`Shelf`'s `countLine` is required by type. (Ruling M3.)

**Is the text `faint`?**
→ Only if it is a placeholder or a disabled state. `faint` is 2.23:1 against paper — it fails WCAG
AA, and the token sheet has always said "never body text". Information is `muted`. Drift rule 18
enforces it.

**Are you reaching for amber?**
→ Don't. Amber has exactly two consumers in this app (the verification-gate flag and the
fired-signal marker), and the reservation is of the whole amber–orange REGION, not one hex. A
grep counts the consumers; a unit test measures the hues.

---

## 4. The mechanical rules

- Tokens only. No hex, no `rounded-[14px]`, no `shadow-[...]`. If the value is not in
  `globals.css`, it does not belong in the product.
- **Never** the slash-opacity modifier on a token colour (`bg-surface/50`). It silently no-ops in
  Tailwind v4 against `rgb(r g b / a)` tokens. Mint a token instead.
- Every control is ≥44px tall on touch, and every input renders at ≥16px below `md` — iOS zooms
  in on a smaller focused field and does **not** zoom back out.
- Numbers are mono. Titles are Playfair, at 19px and up (below that, Newsreader italic — a
  display serif's hairlines collapse at text sizes).

Run `npm run check:drift` before you commit. Eleven rules, and three of them are honesty rules
wearing a style rule's clothes.
