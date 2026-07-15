/**
 * overlay-dismiss — the pure decision behind the detail sheet's overscroll-past-top dismissal (PD9).
 *
 * The sheet may not TRANSFORM while it is dragged: it wraps probability and money figures, and E7
 * forbids a translate on an ancestor of a `[data-p2]` node — moving the container moves the price.
 * So the pull gives no "sheet follows the finger" feedback; the rubber band is the scroll
 * container's OWN native overscroll (`overscroll-behavior-y: contain`, so it never leaks to the room
 * behind). This module answers only the yes/no: given whether the scroll sat at the very top when
 * the drag began and how far the finger has since travelled DOWN, has the reader pulled far enough
 * to mean "close"?
 *
 * It is a pure function so the threshold is unit-tested directly. The touch physics that feed it are
 * iOS-specific and manual-verified on the real device at PD10 — but the DECISION they drive is not
 * left to a browser to get right.
 */

/** How far down, in CSS px, a from-the-top pull must travel before it means "dismiss". */
export const PULL_TO_DISMISS_THRESHOLD_PX = 90;

/**
 * Does this pull dismiss the sheet?
 *
 * @param startedAtTop     true only if the scroll container was at scrollTop ≤ 0 when the drag began
 * @param downwardTravelPx the furthest the finger moved DOWN during the drag (0 if it only went up)
 * @param threshold        the distance that counts as intent; defaults to PULL_TO_DISMISS_THRESHOLD_PX
 */
export function pullDismisses(
  startedAtTop: boolean,
  downwardTravelPx: number,
  threshold: number = PULL_TO_DISMISS_THRESHOLD_PX,
): boolean {
  return startedAtTop && downwardTravelPx >= threshold;
}
