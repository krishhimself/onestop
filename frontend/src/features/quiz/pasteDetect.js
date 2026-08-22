// Heuristic for "these characters were not typed here".
//
// React fires one change event per input, so ordinary typing arrives as a stream of
// +1 deltas. A single event that adds a whole paragraph did not come from a keyboard.
// The gap check is the guard against IME composition and autocomplete, which can also
// commit several characters at once but arrive after a normal human pause.
export const PASTE_MIN_DELTA = 40;
export const PASTE_MAX_GAP_MS = 100;

export function createInputTracker() {
  let lastAt = null;
  let flagged = false;
  let maxDelta = 0;

  return {
    /** Feed one change event. Returns the observed delta/gap, for tests. */
    record(prevText, nextText, now) {
      const delta = (nextText?.length ?? 0) - (prevText?.length ?? 0);
      // No prior event means nothing was typed before this. A paragraph appearing in
      // the first input event cannot be typing, so it is treated as instantaneous
      // rather than being excused for having no predecessor to compare against.
      const gap = lastAt === null ? 0 : now - lastAt;
      lastAt = now;

      if (delta > PASTE_MIN_DELTA && gap < PASTE_MAX_GAP_MS) {
        flagged = true;
        if (delta > maxDelta) maxDelta = delta;
      }
      return { delta, gap, flagged };
    },

    snapshot() {
      return { flagged_paste: flagged, paste_delta: maxDelta };
    },
  };
}
