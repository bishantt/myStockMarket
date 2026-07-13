import { Disclosure } from "@/components/Disclosure";
import { copy } from "@/lib/copy";
import type { MoodComponent } from "@/lib/macro-board";

/**
 * MoodGauge — this app's own fear/greed reading, and the only number on the Desk that has to justify
 * its existence every single time it renders (NEWS-AND-CONTROL-PLAN Part 6.5, ruling C8).
 *
 * WHY THIS COMPONENT IS SHAPED THE WAY IT IS
 *
 * There is no legitimate external fear-and-greed index to license. CNN publishes no API (the
 * endpoint everyone scrapes is an internal, bot-blocked chart feed), and alternative.me's is
 * crypto-only. So this number is ours — and a home-built sentiment number that a reader cannot take
 * apart is a rumour with a decimal point.
 *
 * Hence the contract, which is enforced in the TYPE and not by anyone's good intentions:
 *
 *   **`components` is a required, NON-EMPTY tuple.** A gauge without its breakdown does not compile.
 *   That is the same enforcement shape BaseRate uses, and it exists because "remember to pass the
 *   components" is exactly the kind of rule that survives right up until the evening someone is in a
 *   hurry.
 *
 * The ownership line and the not-a-signal line are ALWAYS on screen — never folded away. Only the
 * per-component detail sits behind a disclosure on the phone, and its summary states how many inputs
 * it is hiding (M2). A reader who never opens it has still been told, in plain words, that this
 * number is ours and that no evidence attaches to it.
 *
 * P13: IT IS A POSITION, NOT A DIAL. No needle, no angle, no arc. A dial has a red zone, and a red
 * zone is an instruction. This renders as a labelled 0–100 strip with a mark on it — the reader can
 * see where the number sits and nothing about the picture urges them anywhere.
 */

type MoodGaugeProps = {
  score: number;
  /** The band word: "leaning fearful". Flat by design — there is no "extreme" band. */
  band: string;
  /**
   * THE C8 GUARANTEE, IN THE TYPE SIGNATURE.
   *
   * A non-empty tuple: at least one component, always. The score cannot be rendered without the
   * evidence that produced it, because a call that tried would not type-check.
   */
  components: [MoodComponent, ...MoodComponent[]];
};

export function MoodGauge({ score, band, components }: MoodGaugeProps) {
  // The type already forbids this. The throw is for the boundary the type cannot see — a row
  // arriving from the database at runtime, an `any` from a JSON parse, a future caller in JavaScript.
  // C8 is a promise to the reader, not to the compiler, so it is kept in both places.
  if (components.length === 0) {
    throw new Error(
      "MoodGauge: the score may never render without its component breakdown (ruling C8). " +
        "A sentiment number a reader cannot take apart is a number they are being asked to trust.",
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
          {copy.macroBoard.moodLabel}
        </span>
        {/* The word, beside the number. The band never rides on colour — it is spelled out. */}
        <span className="font-ui text-2xs text-ink-2">{band}</span>
      </div>

      {/*
       * The figure and its position strip.
       *
       * `data-p2` recruits the app's stillness guard: the jsdom ancestor walk in p2-motion.test.tsx
       * will now fail the build if anything above this subtree animates, transitions or transforms
       * it. A sentiment reading that eased into place would be a sentiment reading that *arrives* —
       * implying something is happening right now that the reader might be late for. That is the
       * precise feeling this entire product is built to not create.
       */}
      <div data-p2 className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl text-ink">{score}</span>
          <span className="font-mono text-2xs text-muted">/ 100</span>
        </div>

        {/* The strip. A position on a line — no needle, no arc, no red zone. */}
        <div
          role="img"
          aria-label={`${score} out of 100 — ${band}`}
          className="relative h-1.5 w-full rounded-full bg-hairline"
        >
          <span
            className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-ink"
            style={{ left: `${clamp(score)}%` }}
          />
        </div>

        {/* The ends of the scale, so the mark above means something without a legend. */}
        <div className="flex justify-between font-ui text-2xs text-muted">
          <span>{copy.moodBands.f0}</span>
          <span>{copy.moodBands.g76}</span>
        </div>
      </div>

      {/*
       * THE TWO LINES THAT ARE NEVER FOLDED AWAY.
       *
       * The first says the number is ours and not CNN's. The second says no evidence attaches to it.
       * A reader who never opens the breakdown below has still read both — which is the difference
       * between a disclosure and a disclaimer nobody meets.
       */}
      <p className="font-ui text-2xs text-ink-2">{copy.macroBoard.moodOwnership}</p>
      <p className="font-ui text-2xs text-muted">{copy.macroBoard.moodContext}</p>

      <Disclosure label="How this is computed" count={components.length} defaultOpen={false}>
        <MoodComponents components={components} />
      </Disclosure>
    </div>
  );
}

/**
 * The breakdown: what each input measured, over what window, where that sits in its own history, and
 * which way it is pulling the score.
 *
 * The arrow is not decoration and it is not stored — it is derived from the percentile upstream, so
 * it cannot contradict the number printed next to it.
 */
function MoodComponents({ components }: { components: MoodComponent[] }) {
  return (
    <ul className="flex flex-col gap-2 pt-2">
      {components.map((component) => (
        <li key={component.key} className="flex flex-col gap-0.5 border-t border-hairline pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-ui text-2xs text-ink-2">{component.label}</span>
            <span className="font-mono text-2xs text-ink">
              {component.value}
              {/* The percentile, and the word for which way it pulls. Never the colour alone. */}
              <span className="pl-2 text-muted">
                {component.percentile} · {component.contributes}
              </span>
            </span>
          </div>
          {/* A percentile with no idea what it is a percentile OF is a decimal, not evidence. */}
          <span className="font-ui text-2xs text-muted">{component.window}</span>
        </li>
      ))}
    </ul>
  );
}

/** Keep the mark on the strip even if a score ever arrives outside its own scale. */
function clamp(score: number): number {
  return Math.min(100, Math.max(0, score));
}
