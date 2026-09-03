/** Format a duration as signed mm:ss (e.g. 75 → 01:15, −5 → -00:05). */
export function formatMmSs(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(Math.floor(totalSec));
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = absoluteSeconds % 60;
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Whole seconds from now until an ISO timestamp (negative if already past). */
export function secFromIso(iso: string, nowMs: number): number {
  return Math.floor((Date.parse(iso) - nowMs) / 1000);
}

/** Whole seconds elapsed since an ISO timestamp, floored at zero. */
export function elapsedFromIso(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
}

/** Whole minutes → seconds for API payloads. */
export function minutesToSec(minutes: number): number {
  return Math.round(minutes * 60);
}

/** Seconds → nearest whole minutes for minute-based form fields. */
export function secToMinutes(sec: number): number {
  return Math.round(sec / 60);
}

/** Remaining seconds until an ISO deadline, never negative. */
export function remainingSecFromIso(iso: string, nowMs: number): number {
  return Math.max(0, secFromIso(iso, nowMs));
}

/** Local wall-clock time label (e.g. 3:45 PM) for a Unix timestamp. */
export function formatLocalTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Human-readable approximate duration (e.g. 8100 → ~2h 15m). */
export function formatApproxDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0 && minutes > 0) return `~${hours}h ${minutes}m`;
  if (hours > 0) return `~${hours}h`;
  if (minutes > 0) return `~${minutes}m`;
  return `~${totalSec}s`;
}
