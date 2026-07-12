"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { submitReview } from "@/app/academy/review-actions";

/**
 * ReviewSession — steps through the day's review cards (plan §7 P5 step 5).
 *
 * One card at a time: the term is shown, the reader tries to recall it, then reveals the definition
 * and reports whether they knew it. "I knew this" promotes the concept to a longer interval; "Not
 * yet" brings it back tomorrow; "Skip" moves on with no penalty and no record. Calm-tech: no timers,
 * no score, no animation — just a quiet count of how many remain.
 */

type ReviewCard = { concept: string; term: string; definition: string; lesson?: string };

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();

  const card = cards[index];
  const done = index >= cards.length;

  function advance() {
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function answer(correct: boolean) {
    startTransition(async () => {
      await submitReview(card.concept, correct);
      advance();
    });
  }

  if (done) {
    return (
      <div className="max-w-[62ch]">
        <p className="font-prose text-base text-ink">That is the queue for today.</p>
        <Link
          href="/academy"
          className="mt-4 inline-block font-ui text-xs uppercase tracking-[0.06em] text-accent hover:underline"
        >
          Back to the Academy →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[58ch] py-8">
      {/*
       * "3 of 12" is a POSITION, not a progress bar.
       *
       * A bar that fills up is a completion mechanic, and a completion mechanic turns recall into a
       * score. There are no timers here either, and no streaks, and no points (P6). The question is
       * whether you remember the word — not how fast, and not how many in a row.
       */}
      <p className="text-center font-mono text-2xs uppercase tracking-[0.08em] text-muted">
        {index + 1} of {cards.length}
      </p>

      <div className="surface-solid mt-5 p-8 desk:p-10">
        <h2 className="text-center font-prose text-lg italic text-ink">{card.term}</h2>

        {revealed ? (
          <>
            <p className="mx-auto max-w-[52ch] pt-5 font-prose text-base leading-[1.7] text-ink-2">
              {card.definition}
            </p>
            {card.lesson ? (
              <p className="pt-3 text-center">
                <Link
                  href={`/academy/${card.lesson}`}
                  className="font-ui text-sm text-accent-deep transition-colors duration-(--duration-quick) hover:underline"
                >
                  Full lesson →
                </Link>
              </p>
            ) : null}

            {/*
             * Three buttons, all SECONDARY. There is deliberately no primary among them: a primary
             * button is the interface saying "this is the answer we want", and the interface has no
             * opinion about whether you knew the word. Honest self-report only works if nothing on
             * screen is rooting for one of the answers.
             */}
            <div className="flex flex-wrap justify-center gap-2 pt-7">
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(true)}
                className="min-h-11 rounded-control border border-hairline px-4 py-2 font-ui text-sm text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:border-hairline-strong disabled:opacity-50"
              >
                I knew this
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(false)}
                className="min-h-11 rounded-control border border-hairline px-4 py-2 font-ui text-sm text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:border-hairline-strong disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={advance}
                className="min-h-11 rounded-control px-4 py-2 font-ui text-sm text-muted transition-colors duration-(--duration-quick) hover:text-ink disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mx-auto max-w-[46ch] pt-5 text-center font-prose text-base leading-[1.7] text-muted">
              Do you remember what this means? Try to recall it, then reveal the definition.
            </p>
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-11 rounded-control border border-hairline px-5 py-2 font-ui text-sm text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:border-hairline-strong"
              >
                Reveal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
