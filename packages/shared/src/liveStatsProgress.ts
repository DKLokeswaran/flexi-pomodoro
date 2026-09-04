/** Planned-work fields needed for live worked/paused progress. */
export type PlannedWorkProgressPhase = {
  startedAt: string;
  paused: boolean;
  pausedSec: number;
  pauseStartedAt: string | null;
  timerFrozenAt: string | null;
};

/** Whole seconds elapsed from an ISO start to nowMs, floored at zero. */
function elapsedSecFromIso(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000));
}

/** Closed + open pause seconds in planned work up to endMs. */
export function pausedSecAt(
  phase: PlannedWorkProgressPhase,
  endMs: number,
): number {
  let pauseSec = phase.pausedSec;
  if (phase.paused && phase.pauseStartedAt) {
    pauseSec += elapsedSecFromIso(phase.pauseStartedAt, endMs);
  }
  return pauseSec;
}

/**
 * Focus seconds in planned work up to endMs.
 * Wall elapsed minus total paused time — same for soft and hard.
 */
export function plannedWorkSecAt(
  phase: PlannedWorkProgressPhase,
  endMs: number,
): number {
  return elapsedSecFromIso(phase.startedAt, endMs) - pausedSecAt(phase, endMs);
}
