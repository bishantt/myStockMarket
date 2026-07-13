# The accessibility sweep (F7, 2026-07-12; contrast closed out the same day)

`e2e/a11y.spec.ts` runs axe over every room, in **both themes**, at WCAG 2.0/2.1 A and AA, and gates
on **serious and critical** violations. **Nothing is excluded.** 42 checks, all green.

(Minor and moderate are not gated. They are full of arguable advisories — a landmark preference here,
a heading-order opinion there — and a gate that fires on those trains its reader to skim past it.
This codebase has learned that lesson three separate times already.)

## The measurement mistake that came first, because it is the most useful thing here

The first run reported **58 failing contrast nodes**, in every colour the app owns: muted, ink,
the accent, the up and down chips. I wrote that down as "the palette fails on glass", excluded the
rule, and logged a [NEED] asking the user to decide.

**That was wrong, and the number was an artifact.** Every page in this app fades in — `.route-fade`,
opacity 0 → 1 — and axe composites a foreground colour through any ancestor's opacity. It was
measuring the page *while it was still arriving*, and faithfully reporting the colours of a
half-transparent page. `text-muted` at 55% opacity really is 2.23:1. It is also not a colour any
reader has ever read.

Wait for the fade to land, and 58 failures collapse to **one**.

> **The lesson, and it generalises past colour:** never measure a colour, a size, or a position while
> the page is still animating — you will measure the animation. Any test that reads a computed style
> must first wait for the thing to have finished arriving. The gate now has a `settle()` helper that
> does exactly this, and a comment saying why.

## The one real finding: a token verified against a background it is never shown on

`--color-muted` was chosen as **4.83:1 against `--color-paper`** (#f9f8ff), which clears AA's 4.5:1.

But muted text does not sit on the paper. It sits on a `Surface` — and a Surface is white at 72%
over the lavender wash, which composites to **#f0effe**. Against the thing a reader is actually
looking at:

| | Old `#6e6c80` | New `#676577` | AA needs |
|---|---|---|---|
| On the composited glass `#f0effe` | **4.48:1** ✗ | **4.99:1** ✓ | 4.5:1 |
| On the paper `#f9f8ff` | 4.83:1 ✓ | 5.37:1 ✓ | 4.5:1 |
| On a solid card `#ffffff` | 5.10:1 ✓ | 5.67:1 ✓ | 4.5:1 |

It missed the floor by two hundredths, on the only background that counts. **Fixed** — `muted` is
`#676577`, approved by the user as a readability floor rather than a palette preference (2026-07-12).
`--color-tier-weak` was the same hex on purpose (weak tier *is* the provenance grey) and moved with
it, so the two do not silently drift into being two different greys.

### Midnight, and a second measuring mistake

I first wrote here that **Midnight was already fine** — its `muted` (#918ea6) measures 5.00:1 on its
composited card, and my survey found zero contrast failures in dark. Both of those statements are
true and the conclusion drawn from them was wrong.

CI failed on the phone Desk in dark. `#918ea6` measures **4.44:1** on a **raised** card (#2c293d),
not the standard one — and the phone Desk's shelf cards are raised. My survey missed it because I had
run it on the **desktop project only**, and the shelf is phone-only. I measured half the app and
called all of it clean.

| Midnight `muted` | on a raised card `#2c293d` | on a standard card `#231f38` |
|---|---|---|
| Old `#918ea6` | **4.44:1** ✗ | 5.00:1 ✓ |
| New `#9c99b1` | **5.10:1** ✓ | 5.74:1 ✓ |

**Fixed.** Both themes now clear the floor against the *lightest card the grey ever sits on*, which is
the only version of the question worth asking. The gate runs on both projects and both themes, so the
next person cannot make this mistake quietly.

## The other three, from the same sweep

**1. A link nested inside a button.** The Desk's mover rows wrapped the ENTIRE row in the rail
trigger — including the catalyst's source link. A link inside a button is invalid markup, ambiguous
to a screen reader, and unreachable by keyboard: you could not tab to the source of the news story
because the button swallowed it. The catalyst zone is a sibling of the trigger now. **Fixed.**

**2. A scroll region with no keyboard access.** The macro shelf could be pushed by a thumb or a mouse
and by nothing else, so a keyboard reader could not reach the figures past the edge of the screen.
The shelf is the one place in this app where content lives off-screen BY DESIGN, which makes it the
one place where "you can scroll to it" has to be true for everybody. It is focusable now. **Fixed.**

**3. The chart's attribution link, sealed inside a picture.** Lightweight Charts' `attributionLogo`
option injects its TradingView link *inside* the chart container — and that container is `role="img"`,
which tells a screen reader the whole box is a single picture. The licence's link was in the DOM,
painted on screen, and reachable by nobody. The logo is off; the attribution is a real link in the
chart's caption, which is what the licence asked for anyway ("a link on the page of your website").
**Fixed.**

## `text-faint` carrying information — fixed, and it was real

Separately from the fade artifact, `faint` was genuinely being used for information: a disclosure's
count, the em-dash standing in for an unknown value, a column label. At full opacity `#a9a7b8`
measures **2.08:1** on the glass. The token sheet had already forbidden this in writing since R1 —
`/* placeholders/disabled; never body text */` — and the app had simply ignored its own rule.

Every information-bearing `text-faint` is `text-muted` now, and **drift rule 18** fails the build if
one comes back. `disabled:text-faint` survives: WCAG explicitly exempts disabled controls, and a
disabled control that looked enabled would be the worse lie.

## Still open — and it is the user's to close, not mine

**The iOS device pass.** There is no iPhone in this build environment. Everything a machine can check
is checked on every push (44px targets, 16px inputs, no sideways scroll, no manufactured motion, and
now the full axe sweep in both themes). What remains is the ten minutes of hand-checking that only a
real device can do — VoiceOver, the notch, the home indicator, Safari's URL bar, real thumbs. The
checklist is in QUESTIONS-FOR-BISHANT.md. **Pending the user's own verification.**
