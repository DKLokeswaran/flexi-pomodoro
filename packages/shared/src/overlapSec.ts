/**
 * Overlap of `[startMs, endMs]` with `[windowStartMs, windowEndMs)` in whole
 * seconds.
 */
export function overlapSec(
  startMs: number,
  endMs: number,
  windowStartMs: number,
  windowEndMs: number,
): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const overlapStart = Math.max(startMs, windowStartMs);
  const overlapEnd = Math.min(endMs, windowEndMs);
  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
}

/**
 * Overlap of ISO `[startedAt, endedAt]` with `[windowStartMs, windowEndMs)` in
 * whole seconds.
 */
export function overlapSecFromIso(
  startedAt: string,
  endedAt: string,
  windowStartMs: number,
  windowEndMs: number,
): number {
  return overlapSec(
    Date.parse(startedAt),
    Date.parse(endedAt),
    windowStartMs,
    windowEndMs,
  );
}
