import { AppWash } from "@/components/AppWash";
import { PipelineStrip } from "@/components/desk/PipelineStrip";
import { BaseRate } from "@/components/BaseRate";
import { SectionMasthead } from "@/components/SectionMasthead";
import { KitSpecimens } from "./KitSpecimens";
import { StatFigure } from "@/components/StatFigure";
import { RangeBands } from "@/components/ticker/RangeBands";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";
import type { LadderBand } from "@/lib/range-ladder";

/**
 * /styleguide — the design system as a page you can look at.
 *
 * This route is the anti-drift instrument (§3.10, §5.8). Every token and every primitive renders
 * here, the visual-regression suite screenshots each section, and the phase-exit checklist is run
 * against it with actual eyes. If a token silently changes value or a primitive quietly grows a
 * shadow, this page is where it becomes visible.
 *
 * It lives behind the login wall with everything else and is excluded from navigation. It is a
 * development and CI surface, not a product surface.
 *
 * The one fixed timestamp below is intentional: a styleguide whose clock moves produces a new
 * screenshot every run, and a visual-regression baseline that always differs is a baseline that
 * tells you nothing.
 */

/** Frozen so the visual-regression baseline is stable. 16:05 ET on 9 July 2026. */
const FROZEN_INSTANT = new Date("2026-07-09T20:05:00Z");

export default function StyleguidePage() {
  return (
    <>
      <AppWash />
      <div className="relative z-10 min-h-dvh px-5 pb-24 text-ink desk:px-8">
        <div className="mx-auto flex max-w-[1360px] wide:max-w-[1500px] flex-col gap-12 pt-8">
          <header>
            <h1 className="font-display text-display font-bold text-ink">Morning Broadsheet</h1>
            <p className="max-w-[62ch] pt-3 font-prose text-prose text-ink-2">
              The living specification. An editorial serif over mono numerals, one lavender
              morning-light wash across the whole app, glass cards with soft depth, hairlines inside
              cards, one hero figure per view. Colour is scarce and always means something. If a
              screenshot of this app could be mistaken for a template — austere <em>or</em> glossy —
              the design is wrong.
            </p>
          </header>

          <Colours />
          <Surfaces />
          <Typography />
          <Chips />
          <Controls />
          <Figures />
          <MotionSpec />
          <CopyDeck />
          <Kit />
          <FreshnessLadder />
        </div>
      </div>
    </>
  );
}

/** A section wrapper. Each part of the spec is its own screenshot target for the VRT. */
function Section({
  id,
  index,
  title,
  intro,
  children,
}: {
  id: string;
  index: number;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-vrt-section={id} aria-label={title}>
      <SectionMasthead index={index} title={title} />
      <p className="max-w-[70ch] pt-3 font-ui text-sm text-ink-2">{intro}</p>
      <div className="pt-5">{children}</div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Every colour token, with the RULE that governs where it may be used — because the rules, not the
 * hexes, are what stop a palette from drifting. The reserved-region row is the one that matters
 * most, and it is spelled out rather than implied.
 */
function Colours() {
  const groups: Array<{
    heading: string;
    note: string;
    swatches: Array<{ name: string; className: string; note: string }>;
  }> = [
    {
      heading: "Neutrals",
      note: "The paper, the ink, and the hairlines. Whitespace is still the main material.",
      swatches: [
        { name: "paper", className: "bg-paper", note: "the page plane, under the wash" },
        { name: "ink", className: "bg-ink", note: "primary text; the hero numeral, always" },
        { name: "ink-2", className: "bg-ink-2", note: "secondary text" },
        { name: "muted", className: "bg-muted", note: "PROVENANCE — clears 4.5:1, by test" },
        { name: "faint", className: "bg-faint", note: "placeholders; never body text" },
        { name: "hairline", className: "bg-hairline", note: "borders and rules inside cards" },
        { name: "hairline-strong", className: "bg-hairline-strong", note: "the masthead rule" },
      ],
    },
    {
      heading: "Accent — interactive only",
      note: "Indigo means “you can act here”. It never appears on data and never on status. Eight indigo mastheads down the Desk would teach the reader that indigo means “chrome”, and the accent would stop meaning anything at all.",
      swatches: [
        { name: "accent", className: "bg-accent", note: "washes, icons, marks" },
        { name: "accent-deep", className: "bg-accent-deep", note: "links and interactive text" },
        { name: "accent-soft", className: "bg-accent-soft", note: "the active-pill wash" },
        { name: "accent-muted", className: "bg-accent-muted", note: "tinted panels" },
      ],
    },
    {
      heading: "Semantic pair — data only",
      note: "Blue/orange, colourblind-safe. Always redundantly encoded: a triangle, a sign, and the word. Colour is never the only channel. The plain variants are for chart strokes and ≥21px figures; the -text variants are darkened to clear AA in small type.",
      swatches: [
        { name: "up", className: "bg-up", note: "gain — strokes, candles, ≥21px" },
        { name: "up-text", className: "bg-up-text", note: "gain, in small type" },
        { name: "down", className: "bg-down", note: "loss — strokes, candles, ≥21px" },
        { name: "down-text", className: "bg-down-text", note: "loss, in small type" },
      ],
    },
    {
      heading: "Band — uncertainty, non-directional",
      note: "Deliberately greyer than the accent, so an uncertainty band never reads as clickable — and deliberately not the up/down pair, so a symmetric historical range carries no directional valence.",
      swatches: [
        { name: "band", className: "bg-band", note: "range-band fills, and nothing else" },
        { name: "band-inner", className: "bg-band-inner", note: "the 50% range" },
        { name: "band-outer", className: "bg-band-outer", note: "the 80% range" },
      ],
    },
    {
      heading: "RESERVED — the amber–orange region",
      note: "The REGION is reserved, not merely the hex. Its only occupants are losses and amber's three consumers: the verification-gate flag, the fired-signal marker, and (added in N2) the pipeline strip when a session's edition never landed. No chip, tier, grade, or module hue may sit anywhere in this band — a Desk full of amber-ish “moderate” chips would drown the gate flag even with no hex collision. A unit test measures the hues; a grep counts the consumers.",
      swatches: [
        { name: "alert", className: "bg-alert", note: "gate flag · fired signal · stale pipeline" },
        { name: "alert-wash", className: "bg-alert-wash", note: "the wash behind them" },
        { name: "down", className: "bg-down", note: "a loss — the region's other rightful tenant" },
      ],
    },
    {
      heading: "DANGER — one consumer, and only one, ever",
      note: "Amber says “something degraded”. Red says something else entirely: “do not trust the numbers on this page.” Exactly one surface may make that claim — the pipeline strip's DEAD state — because the moment a second one can, the reader has to work out which red is which, and a colour that needs interpreting is not an alarm. It borrows the hue the palette already owns (the folklore grade's red, hue 0°, outside the reserved amber band) so no new hue enters the app; what it does not borrow is the meaning. Drift rule 19 fails the build for a second consumer.",
      swatches: [
        { name: "danger", className: "bg-danger", note: "the dead pipeline. Nothing else, ever." },
        { name: "danger-wash", className: "bg-danger-wash", note: "the banner's fill" },
      ],
    },
    {
      heading: "Tiers and grades",
      note: "Moderate and mixed are TEAL, not amber — pushed out of the reserved region above. Green → teal → grey is an ordinal ramp, which is what an evidence scale wants anyway.",
      swatches: [
        { name: "tier-strong", className: "bg-tier-strong", note: "strong" },
        { name: "tier-moderate", className: "bg-tier-moderate", note: "moderate — teal" },
        { name: "tier-weak", className: "bg-tier-weak", note: "weak" },
        { name: "grade-supported", className: "bg-grade-supported", note: "supported" },
        { name: "grade-mixed", className: "bg-grade-mixed", note: "mixed — teal" },
        { name: "grade-weak", className: "bg-grade-weak", note: "weak — rust" },
        { name: "grade-folklore", className: "bg-grade-folklore", note: "folklore — red" },
      ],
    },
  ];

  return (
    <Section
      id="tokens"
      index={1}
      title="Colour"
      intro="Every colour in the product, and the rule that governs it. Both rooms and both themes read this one sheet; there is no room palette and no second column."
    >
      <div className="flex flex-col gap-7">
        {groups.map((group) => (
          <div key={group.heading}>
            <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
              {group.heading}
            </h3>
            <p className="max-w-[70ch] pt-1 font-ui text-2xs text-muted">{group.note}</p>
            <ul className="flex flex-wrap gap-4 pt-3">
              {group.swatches.map((s) => (
                <li key={`${group.heading}-${s.name}`} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 size-5 shrink-0 rounded-chip border border-hairline ${s.className}`}
                  />
                  <span className="flex flex-col">
                    <span className="font-mono text-2xs text-ink">{s.name}</span>
                    <span className="font-ui text-2xs text-muted">{s.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** The surface levels, rendered as themselves. */
function Surfaces() {
  return (
    <Section
      id="surfaces"
      index={2}
      title="Surfaces and elevation"
      intro="Depth is atmospheric, never skeuomorphic. Cards NEVER blur — stacked backdrop-filters are a GPU tax that shows up as scroll jank on a mid-range phone, and over a static wash, translucency alone looks near-identical. Blur is spent only on the sticky bars and the overlays."
    >
      <div className="grid gap-4 md:grid-cols-2 desk:grid-cols-4">
        <Surface level="card" as="div" className="p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">L1 · card</p>
          <p className="pt-2 font-ui text-sm text-ink-2">
            Translucent glass, hairline border, 16px radius. Every Desk module.
          </p>
        </Surface>
        <Surface level="raised" as="div" className="p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">L2 · raised</p>
          <p className="pt-2 font-ui text-sm text-ink-2">
            More opaque, soft shadow. Stat cards, and cards the layout wants to lift.
          </p>
        </Surface>
        <Surface level="tinted" as="div" className="p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">tinted</p>
          <p className="pt-2 font-ui text-sm text-ink-2">
            An accent-washed nested panel. Base-rate panels, the cost mirror, helper boxes.
          </p>
        </Surface>
        <Surface level="solid" as="div" className="p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">solid</p>
          <p className="pt-2 font-ui text-sm text-ink-2">
            Opaque paper, no glass. The Academy&rsquo;s material — and every decision moment, where
            the surface stops being atmospheric and becomes a page.
          </p>
        </Surface>
      </div>
    </Section>
  );
}

/** The four families, and the serif floor that explains why there are two serifs. */
function Typography() {
  return (
    <Section
      id="type"
      index={3}
      title="Typography"
      intro="Four families. Playfair Display sets titles and never a number. Inter is every label and control. JetBrains Mono is every numeral in the product, without exception. Newsreader is prose — and the small editorial italics Playfair is too fragile to set."
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            display · Playfair Display
          </p>
          <p className="font-display text-display font-bold text-ink">Friday, July 11, 2026</p>
          <p className="font-display text-title font-bold text-ink">
            A card title at the serif floor — 19px
          </p>
        </div>

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            the serif floor — why two serifs exist
          </p>
          <p className="max-w-[62ch] pt-1 font-ui text-2xs text-muted">
            Playfair renders at 19px and above, and never in italic below the display sizes. A
            display serif&rsquo;s hairlines collapse at text sizes. Editorial italics at card sizes
            are Newsreader:
          </p>
          <p className="pt-2 font-prose text-base italic text-ink">
            Golden cross — a text serif holds its hairlines at 15px, where a display serif would not.
          </p>
        </div>

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">ui · Inter</p>
          <p className="font-ui text-base text-ink">
            Every label, control, table cell, and nav item. Never a number.
          </p>
        </div>

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            mono · JetBrains Mono
          </p>
          <p className="font-mono text-num-lg text-ink">6,812.34</p>
          <p className="font-mono text-sm text-ink-2">
            61 of 108 — 56.5% (47–65% CI) · tabular by construction
          </p>
        </div>

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            prose · Newsreader
          </p>
          <p className="max-w-[65ch] font-prose text-prose text-ink">
            The Academy is a reading room, not a tinted dashboard. It shares this palette and this
            theme; what changes is the furniture — solid paper cards, serif kickers, a longer line,
            and more air.
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Chips: colour allowed, the word mandatory. */
function Chips() {
  return (
    <Section
      id="chips"
      index={4}
      title="Chips and tags"
      intro="Colour is allowed on a chip. The WORD inside it is not optional. A coloured dot is not a claim — the word beside it is — so colour is always the redundant channel, and a colourblind reader loses nothing."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-28 font-mono text-2xs uppercase tracking-[0.06em] text-muted">tier</span>
          <Tag variant="tier" tier="strong">
            worth a closer look
          </Tag>
          <Tag variant="tier" tier="moderate">
            note it; check the weakeners
          </Tag>
          <Tag variant="tier" tier="weak">
            watch only
          </Tag>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-28 font-mono text-2xs uppercase tracking-[0.06em] text-muted">grade</span>
          <Tag variant="grade" grade="supported">
            supported
          </Tag>
          <Tag variant="grade" grade="mixed">
            mixed
          </Tag>
          <Tag variant="grade" grade="weak">
            weak
          </Tag>
          <Tag variant="folklore" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-28 font-mono text-2xs uppercase tracking-[0.06em] text-muted">
            catalyst
          </span>
          <Tag variant="catalyst">CPI</Tag>
          <Tag variant="catalyst">FOMC</Tag>
          <Tag variant="catalyst">EARNINGS</Tag>
          <Tag variant="catalyst">ETF proxy</Tag>
        </div>
      </div>
    </Section>
  );
}

/** Buttons and inputs — recipes, not a component library. */
function Controls() {
  return (
    <Section
      id="controls"
      index={5}
      title="Buttons and inputs"
      intro="Recipes rather than components, matching the current architecture. Every control is at least 44px tall on touch, and every input renders at 16px below md — iOS zooms on any focused control under 16px and never zooms back."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="min-h-11 rounded-control bg-[image:var(--gradient-brand)] px-4 py-2 font-ui text-sm font-semibold text-white transition-[filter] duration-(--duration-quick) ease-(--ease-quiet) hover:brightness-105"
          >
            Open my desk →
          </button>
          <button
            type="button"
            className="min-h-11 rounded-control border border-hairline bg-surface px-4 py-2 font-ui text-sm text-ink transition-colors duration-(--duration-quick) hover:border-hairline-strong"
          >
            Secondary
          </button>
          <button
            type="button"
            className="min-h-11 rounded-control border border-hairline px-4 py-2 font-ui text-sm text-down-text transition-colors duration-(--duration-quick) hover:border-hairline-strong"
          >
            Destructive, quietly
          </button>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-control border border-hairline bg-surface px-4 py-2 font-ui text-sm text-ink disabled:opacity-60"
          >
            Disabled
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">Symbol</span>
            <input
              defaultValue="AAPL"
              className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-mono text-input-touch uppercase text-ink md:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">Side</span>
            <select className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-ui text-input-touch text-ink md:text-sm">
              <option>long</option>
              <option>short</option>
            </select>
          </label>
        </div>

        <p className="max-w-[70ch] font-ui text-2xs text-muted">
          One exception, and it is a product rule rather than a style one: in the cooling-off
          interstitial, <em>Sit with it</em> takes the primary style and <em>Proceed</em> the
          secondary. The friction is the point.
        </p>
      </div>
    </Section>
  );
}

/** Figures — including the one hero, and the base rate that may never appear without its context. */
function Figures() {
  return (
    <Section
      id="charts"
      index={6}
      title="Figures and base rates"
      intro="The hero numeral is ink at every scale — never the up/down colour. The largest thing on a screen is never emotional colour: a 64px orange number is a mood; a 64px ink number with a small orange triangle is a fact."
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end gap-10">
          <StatFigure
            label="S&P 500"
            value="6,812.34"
            scale="hero"
            delta={{ value: "+0.34%", direction: "up" }}
          />
          <StatFigure
            label="Dow"
            value="44,210.55"
            scale="body"
            delta={{ value: "−0.25%", direction: "down" }}
          />
          <StatFigure label="VIX" value="15.84" scale="body" />
        </div>

        <div>
          <p className="pb-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            the one base-rate renderer
          </p>
          <Surface level="tinted" as="div" className="max-w-[62ch] p-5">
            <BaseRate
              data={{
                n: 108,
                wins: 61,
                winRate: 0.565,
                ciLow: 0.47,
                ciHigh: 0.65,
                baseline: 0.54,
                horizonDays: 10,
                refClass: "US large/mid",
                years: 20,
                publicationYear: 2019,
                evidenceGrade: "mixed",
              }}
            />
          </Surface>
          <p className="max-w-[70ch] pt-2 font-ui text-2xs text-muted">
            No other component may render a base rate. The N-gate, the interval, the always-up
            baseline, and the WEAK cap have to travel with the number — so the number lives where
            they live. The proportion bar and the dot array are base-rate displays too, which is
            exactly why they live INSIDE it.
          </p>
        </div>

        {/*
         * The Range Ladder — the app's visual centrepiece, and the drawing most likely to go wrong.
         * It renders here on fixture data so it can be reviewed and screenshotted without a seeded
         * database, and so the two honesty locks (no median mark, no connecting cone) can be checked
         * with actual eyes at every phase exit, not only by the tests.
         */}
        <div>
          <p className="pb-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            the range ladder — the honest fan, sliced
          </p>
          <Surface level="card" as="div" className="max-w-[68ch] p-5">
            <RangeBands bands={LADDER_SPECIMEN} />
          </Surface>
          <p className="max-w-[70ch] pt-2 font-ui text-2xs text-muted">
            A forward-widening cone is the visual grammar of a projection — the eye reads it as “the
            future goes that way”, whatever the caption says. So the same information is sliced into
            discrete horizons on a signed-return axis. Uncertainty visibly grows with time, and
            nothing points forward. There is no 50th-percentile mark of any kind, and nothing joins
            the rows.
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Fixture bands for the ladder specimen above — realistic shape, obviously synthetic numbers. */
const LADDER_SPECIMEN: LadderBand[] = [
  { horizonDays: 5, coverage: 0.8, lo: -0.043, hi: 0.048, label: "5-day", n: 495, windowDays: 500 },
  { horizonDays: 5, coverage: 0.5, lo: -0.018, hi: 0.021, label: "5-day", n: 495, windowDays: 500 },
  { horizonDays: 10, coverage: 0.8, lo: -0.062, hi: 0.071, label: "10-day", n: 490, windowDays: 500 },
  { horizonDays: 10, coverage: 0.5, lo: -0.027, hi: 0.031, label: "10-day", n: 490, windowDays: 500 },
  { horizonDays: 20, coverage: 0.8, lo: -0.089, hi: 0.104, label: "20-day", n: 480, windowDays: 500 },
  { horizonDays: 20, coverage: 0.5, lo: -0.038, hi: 0.045, label: "20-day", n: 480, windowDays: 500 },
];

/** The motion spec, including the list of things that must never move. */
function MotionSpec() {
  const still = [
    "BaseRate — the sentence, the interval, the baseline",
    "Dot arrays — every dot is one case; misses are hollow",
    "CalibrationScatter",
    "RangeBands — the range ladder",
    "QuantileDotplot",
    "Proportion and breadth bars",
    "Brier figures",
    "StatFigure deltas — money",
  ];

  return (
    <Section
      id="motion-static"
      index={7}
      title="Motion"
      intro="General UI motion is allowed now: hover lifts, drawer slides, a 200ms route fade, the provenance reveal. One easing, no springs, no bounce. Nothing loops, nothing autoplays, and nothing moves to attract attention."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Surface level="card" as="div" className="p-5">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Allowed</h3>
          <ul className="flex flex-col gap-1 pt-3 font-ui text-sm text-ink-2">
            <li>Hover and focus colour shifts — 150ms</li>
            <li>Hover lift — only where no probability visual sits inside</li>
            <li>Route transition — 200ms, opacity only, never a translate</li>
            <li>Rail and sheet slides — 240ms</li>
            <li>Charts appear as completed wholes — a fade, never a sweep</li>
            <li>One quiet shimmer on loading placeholders</li>
            <li>The provenance reveal — the signature gesture</li>
          </ul>
        </Surface>

        <Surface level="card" as="div" className="p-5">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            Never moves — and neither may its ancestors
          </h3>
          <ul className="flex flex-col gap-1 pt-3 font-ui text-sm text-ink-2">
            {still.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="pt-3 font-ui text-2xs text-muted">
            Each of these carries <code className="font-mono">data-p2</code>, and a jsdom test walks
            up from every marked node to prove nothing above it animates or transforms. An animated
            probability implies the probability is <em>arriving</em> — that something is happening
            right now that the reader might be late for. This product exists to say the opposite.
          </p>
          <p className="pt-2 font-ui text-2xs text-muted">
            A candle chart may fade in while a range band may not even do that: a chart is a record,
            and fading in a completed record is showing a photograph. A range band is a claim about
            uncertainty, and any entrance treatment reads as “the forecast is arriving”. Records may
            appear. Claims are simply there.
          </p>
        </Surface>
      </div>
    </Section>
  );
}

/** The copy deck, rendered — because the sentences are the honesty rules in their final form. */
function CopyDeck() {
  const lines: Array<[string, string]> = [
    ["scope.line", copy.scope.line],
    ["baseRate.baseline", fill(copy.baseRate.baseline, { h: "10", pct: "54%" })],
    ["baseRate.insufficient", fill(copy.baseRate.insufficient, { n: "18" })],
    ["volband.caveat", copy.volband.caveat],
    ["mover.noNews", copy.mover.noNews],
    // The macro provenance line is deliberately NOT in this deck: it is composed at render time
    // from the rows that actually appeared (buildMacroProvenance, ruling C6). It used to be a fixed
    // string here, and that is exactly how it came to sit under four ETF prices claiming they were
    // FRED index levels. What the deck holds now are the FRAGMENTS it is assembled from.
    ["macro.indexesUnavailable", copy.macro.indexesUnavailable],
    ["macro.proxyChipDegraded", fill(copy.macro.proxyChipDegraded, { symbol: "SPY" })],
    ["calendar.empty", copy.calendar.empty],
    ["calendar.emptySub", copy.calendar.emptySub],
    ["brief.unavailable", copy.brief.unavailable],
    ["decision.disclaimer", copy.decision.disclaimer],
  ];

  return (
    <Section
      id="copy"
      index={8}
      title="Copy"
      intro="Every reader-facing sentence that carries a guardrail lives in lib/copy.ts, verbatim. Components never inline a sentence of their own — these strings ARE the honesty rules, in their final human form."
    >
      <Surface level="card" as="div" className="p-5">
        <dl className="flex flex-col gap-3">
          {lines.map(([key, text]) => (
            <div
              key={key}
              className="flex flex-col gap-0.5 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
            >
              <dt className="font-mono text-2xs text-muted">{key}</dt>
              <dd className="max-w-[70ch] font-prose text-base text-ink">{text}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      <p className="pt-4 font-mono text-2xs text-muted">
        Rendered at a frozen instant so the visual-regression baseline is stable:{" "}
        {FROZEN_INSTANT.toISOString()}
      </p>
    </Section>
  );
}

/**
 * 9 — The kit (APP-FEEL-PLAN Part 3). The primitives that turned the receipt into rooms.
 *
 * Every specimen here is deterministic, which is the point: this section is the VRT anchor for the
 * whole kit. Photographing a skeleton by racing a real page load would be a flaky test with extra
 * steps; photographing one here is a pixel lock.
 */
/**
 * 10 — The freshness ladder (NEWS-AND-CONTROL-PLAN Part 4.1).
 *
 * The three states of the pipeline strip, side by side, which is the ONLY place they can be seen
 * together — in the product they are mutually exclusive, and two of them appear only on nights
 * nobody wants. Seeing them stacked is how the escalation gets reviewed at all.
 *
 * Every specimen is driven from a fixed run and a fixed clock, so these are true pixel locks rather
 * than pictures of whatever tonight happens to be.
 */
function FreshnessLadder() {
  // Friday 2026-07-10's run is the last completed one in all three. Only the clock changes — which
  // is precisely the argument: the same data is fresh, stale, or an emergency depending on nothing
  // but how many sessions have passed without an edition.
  const friday = { runDate: "2026-07-10", finishedAt: "2026-07-10T22:41:00Z" };
  const specimens = [
    { label: "fresh — read Saturday morning", at: "2026-07-11T09:00:00-04:00", run: friday },
    { label: "aging — read Monday night, Monday's run never landed", at: "2026-07-13T22:00:00-04:00", run: friday },
    { label: "dead — read Tuesday night, two sessions gone", at: "2026-07-14T22:00:00-04:00", run: friday },
    { label: "never — an empty database is not a dead pipeline", at: "2026-07-13T22:00:00-04:00", run: null },
  ];

  return (
    <Section
      id="freshness"
      index={10}
      title="Freshness"
      intro="Module 00 spent the best card on the Desk saying 'last cloud run — Jul 11' in the same quiet voice every day, whether the pipeline was healthy or three days dead. That is not a freshness indicator; it is a decoration that mentions freshness. The rule that replaced it: freshness is prominent in proportion to how BAD the news is. A live pipeline earns one quiet line. A stale one earns amber — which is exactly what the reserved amber is reserved for. A dead one earns the loudest surface in the application, undismissable, because a silently dead pipeline serving stale data is the catastrophic failure mode: the app keeps looking authoritative and keeps being wrong. The escalation is carried three times over — by the colour, by the word, and by the ARIA role — because if it lived only in the hue, a screen-reader user would get the app's calmest voice on its worst night."
    >
      <div className="flex flex-col gap-6">
        {specimens.map((s) => (
          <Surface key={s.label} level="card" as="div" className="p-5">
            <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">{s.label}</h3>
            <PipelineStrip run={s.run} serverNow={new Date(s.at).toISOString()} />
          </Surface>
        ))}
      </div>

      <p className="max-w-[70ch] pt-4 font-ui text-2xs text-muted">
        The clock these are graded against is the READER’S, not the cache’s. The Desk is served from
        a cache, and a cached render carries the clock it was made with — so a strip graded on the
        server would have been graded on the morning the cache was filled. A pipeline that died
        overnight would still have been photographed as “fresh” on the reader’s first paint, by the
        one surface whose entire job is to catch exactly that. The last completed run is data and it
        is cached; “now” is not data, and it is supplied by the browser.
      </p>
    </Section>
  );
}

function Kit() {
  return (
    <Section
      id="kit"
      index={9}
      title="Tables & disclosure"
      intro="The six primitives the app-feel plan added, and the rulings they carry. A table states the order it is in and never calls it 'top'. A disclosure says how much it is hiding and as of when. A shelf moves only when the reader pushes it. A skeleton may stand for a container, never for a number: figure slots load as a still em-dash, and the chart reservation is still geometry — because a pulsing rectangle where a price is about to appear manufactures exactly the anticipation the stillness rule exists to forbid."
    >
      <KitSpecimens />
    </Section>
  );
}
