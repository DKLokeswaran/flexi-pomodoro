function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Whole hours, minutes-within-hour, and seconds from a non-negative duration. */
function splitSec(totalSec: number): [number, number, number] {
  const sec = Math.floor(totalSec);
  return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60];
}

/** Format a non-negative duration as mm:ss (e.g. 75 → 01:15). */
export function formatMmSs(totalSec: number): string {
  const [hours, minutes, seconds] = splitSec(totalSec);
  return `${pad2(hours * 60 + minutes)}:${pad2(seconds)}`;
}

/**
 * Format a non-negative duration as mm:ss under one hour, else hh:mm:ss
 * (e.g. 75 → 01:15, 3661 → 01:01:01).
 */
export function formatHhMmSs(totalSec: number): string {
  const [hours, minutes, seconds] = splitSec(totalSec);
  if (hours === 0) return `${pad2(minutes)}:${pad2(seconds)}`;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
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
