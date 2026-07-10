import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";

/**
 * /styleguide — the design system as a page you can look at.
 *
 * This route is the anti-drift instrument (plan §3.10). Every token and every primitive renders
 * here, the visual-regression suite screenshots it, and the phase-exit checklist is run against
 * it with actual eyes. If a token silently changes value or a primitive quietly grows a shadow,
 * this page is where it becomes visible.
 *
 * It lives behind the login wall with everything else and is excluded from navigation. It is a
 * development and CI surface, not a product surface.
 *
 * The one fixed timestamp below is intentional: a styleguide whose clock moves produces a new
 * screenshot every run, and a visual-regression baseline that always differs is a baseline
 * that tells you nothing.
 */

/** Frozen so the visual-regression baseline is stable. 16:05 ET on 9 July 2026. */
const FROZEN_INSTANT = new Date("2026-07-09T20:05:00Z");

export default function StyleguidePage() {
  return (
    <div className="min-h-dvh bg-desk-bg px-5 pb-24 text-ink desk:px-8">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-10 pt-6">
        <header>
          <h1 className="font-ui text-2xl font-bold uppercase tracking-[0.06em] font-stretch-[120%]">
            Broadsheet Terminal
          </h1>
          <p className="pt-2 max-w-[62ch] font-prose text-prose text-ink-2">
            The living specification. Ink on bone paper, hairline rules, mono numerals, 2px
            corners. Colour is nearly absent so that the few semantic uses carry real
            information. If a screenshot of this app could be mistaken for a default admin
            template, the design is wrong.
          </p>
        </header>

        <Colours />
        <Typography />
        <Mastheads />
        <Tags />
        <Figures />
        <CopyDeck />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Every colour token, with its role. The swatches are squares with the app's 2px radius, and
 * each names the rule that governs where it may be used — because the rules, not the hexes,
 * are what stop this palette from drifting.
 */
function Colours() {
  const surfaces = [
    { name: "desk-bg", className: "bg-desk-bg", note: "Desk page plane — cool bone" },
    { name: "surface", className: "bg-surface", note: "module surfaces, cards" },
    { name: "academy-bg", className: "bg-academy-bg", note: "Academy paper — warm" },
    { name: "hairline", className: "bg-hairline", note: "1px rules — the only elevation" },
  ];
  const inks = [
    { name: "ink", className: "bg-ink", note: "primary text, 2px section rules" },
    { name: "ink-2", className: "bg-ink-2", note: "secondary text" },
    { name: "muted", className: "bg-muted", note: "provenance, ticks, placeholders" },
    { name: "accent", className: "bg-accent", note: "petrol — focus, active, link hover. Never on data." },
  ];
  const semantic = [
    { name: "up", className: "bg-up", note: "chart strokes, triangles, text ≥ 21px" },
    { name: "down", className: "bg-down", note: "same, downward" },
    { name: "up-text", className: "bg-up-text", note: "delta text ≤ 18px (AA)" },
    { name: "down-text", className: "bg-down-text", note: "same, downward" },
  ];
  const reserved = [
    { name: "alert", className: "bg-alert", note: "exactly two consumers app-wide" },
    { name: "alert-wash", className: "bg-alert-wash", note: "the wash behind them" },
  ];
  const grades = [
    { name: "grade-supported", className: "bg-grade-supported", note: "ledger: supported" },
    { name: "grade-mixed", className: "bg-grade-mixed", note: "ledger: mixed" },
    { name: "grade-weak", className: "bg-grade-weak", note: "ledger: weak" },
    { name: "grade-folklore", className: "bg-grade-folklore", note: "ledger: folklore" },
  ];

  return (
    <section>
      <SectionMasthead index={1} title="Colour" />
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 pt-5 md:grid-cols-2 desk:grid-cols-3">
        <Swatches title="Surfaces" items={surfaces} />
        <Swatches title="Ink & interaction" items={inks} />
        <Swatches title="Semantic (Wong, colourblind-safe)" items={semantic} />
        <Swatches title="Reserved attention" items={reserved} />
        <Swatches title="Evidence grades" items={grades} />
      </div>
    </section>
  );
}

function Swatches({
  title,
  items,
}: {
  title: string;
  items: ReadonlyArray<{ name: string; className: string; note: string }>;
}) {
  return (
    <div>
      <h3 className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
        {title}
      </h3>
      <ul className="flex flex-col gap-2 pt-3">
        {items.map((item) => (
          <li key={item.name} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 size-5 shrink-0 rounded-edge border border-hairline ${item.className}`}
            />
            <span className="flex flex-col">
              <code className="font-mono text-2xs text-ink">{item.name}</code>
              <span className="font-ui text-2xs text-muted">{item.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The type scale, and the one rule that governs it: every number is IBM Plex Mono, every label
 * is Archivo, every paragraph is Newsreader. A number set in Archivo is a bug.
 */
function Typography() {
  const scale = [
    { token: "text-2xs", cls: "text-2xs", use: "provenance, axis ticks, footnotes" },
    { token: "text-xs", cls: "text-xs", use: "mastheads, tags, table headers" },
    { token: "text-sm", cls: "text-sm", use: "Desk body UI, table cells" },
    { token: "text-base", cls: "text-base", use: "drawers, settings" },
    { token: "text-lg", cls: "text-lg", use: "card titles, lesson H2" },
    { token: "text-xl", cls: "text-xl", use: "page titles, brief headline" },
    { token: "text-2xl", cls: "text-2xl", use: "zone titles, lesson H1" },
  ];

  return (
    <section>
      <SectionMasthead index={2} title="Type" />

      <div className="grid grid-cols-1 gap-8 pt-5 desk:grid-cols-3">
        <div>
          <h3 className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
            Archivo — structure &amp; UI
          </h3>
          <p className="pt-2 font-ui text-base">
            Labels, table headers, buttons, nav. Never a number.
          </p>
          <p className="pt-2 font-ui text-xs font-bold uppercase tracking-[0.07em] font-stretch-[120%]">
            Expanded, uppercase, tracked — the masthead voice
          </p>
        </div>

        <div>
          <h3 className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
            IBM Plex Mono — data &amp; numerals
          </h3>
          <p className="pt-2 font-mono text-base">
            Every figure in the product, without exception.
          </p>
          <table className="pt-2 font-mono text-sm">
            <tbody>
              <tr><td className="pr-4 text-right">1,204.55</td><td className="text-muted">aligns</td></tr>
              <tr><td className="pr-4 text-right">98.10</td><td className="text-muted">by</td></tr>
              <tr><td className="pr-4 text-right">7.02</td><td className="text-muted">construction</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
            Newsreader — prose
          </h3>
          <p className="max-w-[62ch] pt-2 font-prose text-prose text-ink-2">
            Academy lesson bodies and the briefing paragraphs, set at a comfortable measure.
          </p>
          <p className="pt-2 font-prose text-xl italic">
            Today’s focus — the one literary flourish
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-3 pt-8">
        {scale.map((step) => (
          <li key={step.token} className="flex items-baseline gap-5 border-b border-hairline pb-2">
            <code className="w-28 shrink-0 font-mono text-2xs text-muted">{step.token}</code>
            <span className={`font-ui ${step.cls}`}>The quick brown fox</span>
            <span className="ml-auto font-ui text-2xs text-muted">{step.use}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

function Mastheads() {
  return (
    <section>
      <SectionMasthead index={3} title="Section masthead" asOf={FROZEN_INSTANT} />
      <p className="max-w-[62ch] pt-4 font-ui text-sm text-ink-2">
        Every Desk module opens with one. The index number names its fixed place in the daily
        ritual; the right-aligned timestamp is what lets stale data identify itself, which is
        why offline mode can be an honest state rather than an apology.
      </p>
      <div className="pt-6">
        <SectionMasthead index={4} title="Movers with reason" asOf={FROZEN_INSTANT} />
        <p className="pt-3 font-ui text-sm text-muted">—</p>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

function Tags() {
  return (
    <section>
      <SectionMasthead index={5} title="Tag" />
      <p className="max-w-[62ch] pt-4 font-ui text-sm text-ink-2">
        The only coloured chip in the app. Tiers are neutral grey by law — ten firing setup
        cards must never turn the Desk amber. An evidence-grade square never appears without
        its word beside it, because a coloured square is not a claim.
      </p>

      <div className="flex flex-col gap-5 pt-5">
        <TagRow label="Tier (neutral, always)">
          <Tag variant="tier">Strong</Tag>
          <Tag variant="tier">Moderate</Tag>
          <Tag variant="tier">Weak</Tag>
        </TagRow>

        <TagRow label="Evidence grade (Research Report Part 4 ledger)">
          <Tag variant="grade" grade="supported">Supported</Tag>
          <Tag variant="grade" grade="mixed">Mixed</Tag>
          <Tag variant="grade" grade="weak">Weak</Tag>
        </TagRow>

        <TagRow label="Folklore, labelled as folklore">
          <Tag variant="folklore" />
        </TagRow>

        <TagRow label="Catalyst type">
          <Tag variant="catalyst">Earnings</Tag>
          <Tag variant="catalyst">Analyst</Tag>
          <Tag variant="catalyst">Macro</Tag>
        </TagRow>
      </div>
    </section>
  );
}

function TagRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The hero rule, made visible: the 64px numeral is ink, and its direction lives beside it in
 * small type. Wong colour never exceeds text-num-lg. A big red number is a mood; a big ink
 * number with a small red triangle is a fact.
 */
function Figures() {
  return (
    <section>
      <SectionMasthead index={6} title="Stat figure" asOf={FROZEN_INSTANT} />

      <div className="flex flex-col gap-10 pt-6">
        <div>
          <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
            Hero — exactly one per view, and only on the Desk
          </span>
          <div className="pt-3">
            <StatFigure
              label="S&P 500"
              value="5,412.88"
              scale="hero"
              delta={{ value: "+0.42%", direction: "up" }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-12">
          <StatFigure label="Nasdaq" value="17,204.10" scale="figure" delta={{ value: "-0.31%", direction: "down" }} />
          <StatFigure label="VIX" value="13.84" scale="figure" delta={{ value: "0.00%", direction: "flat" }} />
          <StatFigure label="10-year" value="4.21%" scale="body" delta={{ value: "+2bp", direction: "up" }} />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The copy deck, rendered. These sentences are the honesty rules in their final human form,
 * and seeing them together is the fastest way to notice if one has drifted.
 */
function CopyDeck() {
  const lines: ReadonlyArray<[string, string]> = [
    [
      "baseRate.sentence",
      fill(copy.baseRate.sentence, {
        years: 5,
        n: 110,
        refClass: "US large caps",
        h: 10,
        wins: 62,
        pct: "56%",
      }),
    ],
    ["baseRate.insufficient", fill(copy.baseRate.insufficient, { n: 12 })],
    ["baseRate.baseline", fill(copy.baseRate.baseline, { h: 10, pct: "55%" })],
    ["volband.label", fill(copy.volband.label, { h: 10 })],
    ["volband.caveat", copy.volband.caveat],
    ["mover.noNews", copy.mover.noNews],
    ["calendar.noEdge", copy.calendar.noEdge],
    ["brief.unavailable", copy.brief.unavailable],
    ["offline.ribbon", fill(copy.offline.ribbon, { date: "Jul 9" })],
    ["scope.line", copy.scope.line],
    ["decision.disclaimer", copy.decision.disclaimer],
    ["brier.anchor", copy.brier.anchor],
    ["degraded.source", fill(copy.degraded.source, { source: "Marketaux" })],
    ["save.offline", copy.save.offline],
    ["update.ready", copy.update.ready],
    ["attribution.fred", copy.attribution.fred],
  ];

  return (
    <section>
      <SectionMasthead index={7} title="Copy deck" />
      <p className="max-w-[62ch] pt-4 font-ui text-sm text-ink-2">
        Mechanical third person, sentence case, no exclamation marks, no “I”. Changing any of
        these strings is a structural decision — they are the guardrails, spoken.
      </p>
      <dl className="flex flex-col gap-4 pt-5">
        {lines.map(([key, text]) => (
          <div key={key} className="flex flex-col gap-1 border-b border-hairline pb-3">
            <dt className="font-mono text-2xs text-muted">{key}</dt>
            <dd className="max-w-[68ch] font-prose text-prose text-ink">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
