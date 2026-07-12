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
    <div className="max-w-[62ch]">
      <p className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
        {index + 1} of {cards.length}
      </p>

      <div className="mt-3 rounded-card border border-hairline p-5">
        <h2 className="font-prose text-xl text-ink">{card.term}</h2>

        {revealed ? (
          <>
            <p className="max-w-[52ch] pt-3 font-prose text-base text-ink-2">{card.definition}</p>
            {card.lesson ? (
              <Link
                href={`/academy/${card.lesson}`}
                className="mt-2 inline-block font-ui text-2xs uppercase tracking-[0.06em] text-accent hover:underline"
              >
                Full lesson →
              </Link>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(true)}
                className="rounded-control border border-hairline px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-ink hover:border-accent disabled:opacity-50"
              >
                I knew this
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(false)}
                className="rounded-control border border-hairline px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-ink hover:border-accent disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={advance}
                className="px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-muted hover:text-ink disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pt-3 font-prose text-base text-muted">
              Do you remember what this means? Try to recall it, then reveal the definition.
            </p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-4 rounded-control border border-hairline px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em] text-ink hover:border-accent"
            >
              Reveal
            </button>
          </>
        )}
      </div>
    </div>
  );
}
