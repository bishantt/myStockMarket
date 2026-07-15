/**
 * The @modal slot's fallback (PD9, plan 11.1).
 *
 * A named parallel-route slot must define `default.tsx`, or this Next version errors rather than
 * quietly rendering nothing. Returning null is the whole point: on every hard load, every refresh,
 * and every room where the reader has not opened a detail, the slot contributes nothing and the room
 * renders alone. The sheet appears ONLY when an in-app tap activates an intercepting route, which
 * takes over this slot for the life of that navigation.
 */
export default function Default() {
  return null;
}
