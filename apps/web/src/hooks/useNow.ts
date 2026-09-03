import { useEffect, useState } from "react";

/** Countdown and live-stats refresh cadence while a session is active. */
export const ACTIVE_UI_TICK_MS = 250;

/** Estimated end-time refresh on the idle start screen (hour/minute display). */
export const IDLE_ESTIMATE_TICK_MS = 60_000;

/**
 * Local wall-clock ms for UI extrapolation.
 * Pass null to freeze at mount; otherwise re-render at intervalMs.
 */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(intervalId);
  }, [intervalMs]);
  return now;
}
