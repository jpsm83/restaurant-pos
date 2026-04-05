import { useEffect, useRef } from "react";

export type LeadingDebounceScheduleOptions = {
  /** Wait this long after `deps` change once the first timer has fired this mount. */
  debounceMs: number;
  /** Delay used until the first timer actually runs (default `0`). Survives Strict Mode. */
  leadingDelayMs?: number;
  /**
   * When `false`, no debounced work is scheduled; `onInactive` runs on a macrotask (same pattern as
   * `setTimeout(0)`), after cleanup cancels any pending timer from a previous `active` stretch.
   */
  active?: boolean;
};

/**
 * Schedules the latest `run` when `deps` change. The first time a timer **fires** for this mount,
 * the delay is `leadingDelayMs` (default `0`); every later scheduling uses `debounceMs`. This
 * matches “load / navigate = immediate, user edits = debounce” without losing the leading run when
 * React Strict Mode cancels the first effect’s timer before it fires.
 *
 * `run` and `onInactive` are read from refs so callers can pass inline functions without adding
 * them to `deps` (which would reschedule every render).
 *
 * `pastFirstFireRef` is not state: nothing in the tree needs to re-render when it flips; a ref avoids
 * an extra render on the first fire. It is not a dependency of the effect (same rationale as if it
 * were state and omitted).
 */
export function useDebounce(
  deps: readonly unknown[],
  run: (ctx: { cancelled: boolean }) => void,
  options: LeadingDebounceScheduleOptions & {
    onInactive?: () => void;
  },
): void {
  const {
    debounceMs,
    leadingDelayMs = 0,
    active = true,
    onInactive,
  } = options;

  const pastFirstFireRef = useRef(false);
  const runRef = useRef(run);
  const onInactiveRef = useRef(onInactive);
  runRef.current = run;
  onInactiveRef.current = onInactive;

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      const clearId = window.setTimeout(() => {
        if (cancelled) return;
        onInactiveRef.current?.();
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(clearId);
      };
    }

    const delay = pastFirstFireRef.current ? debounceMs : leadingDelayMs;
    const workId = window.setTimeout(() => {
      if (cancelled) return;
      pastFirstFireRef.current = true;
      runRef.current({ cancelled });
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(workId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedule only when `deps` / scheduling inputs change
  }, [...deps, active, debounceMs, leadingDelayMs]);
}
