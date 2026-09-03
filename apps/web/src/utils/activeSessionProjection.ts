import type {
  ActiveSnapshot,
  PlannedWorkPhase,
  SessionParams,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";
import { elapsedFromIso, remainingSecFromIso } from "./time";

/** Nominal wall time from the start of cycle c through session end (instant acks). */
function futureFromWorkCycleStart(
  cycleIndex: number,
  params: SessionParams,
): number {
  const cycles = params.cyclesBeforeLongRest;
  let sec = 0;
  for (let cycle = cycleIndex; cycle <= cycles; cycle++) {
    sec += params.workDurationSec;
    if (cycle < cycles) sec += params.shortRestDurationSec;
  }
  sec += params.longRestDurationSec;
  return sec;
}

/** After planned work for cycleIndex completes with an instant ack. */
function futureAfterWorkCycle(
  cycleIndex: number,
  params: SessionParams,
): number {
  const cycles = params.cyclesBeforeLongRest;
  if (cycleIndex >= cycles) return params.longRestDurationSec;
  return (
    params.shortRestDurationSec +
    futureFromWorkCycleStart(cycleIndex + 1, params)
  );
}

/** Open hard-pause slice not yet baked into plannedEndAt. */
function openHardPauseSec(
  pauseStrategy: WorkPauseStrategy,
  phase: PlannedWorkPhase,
  nowMs: number,
): number {
  if (pauseStrategy !== "hard" || !phase.paused || !phase.pauseStartedAt) {
    return 0;
  }
  return elapsedFromIso(phase.pauseStartedAt, nowMs);
}

/**
 * Remaining wall-clock seconds until session end if the user acks immediately
 * from the current phase. Phase anchors carry completed slip (deliberation,
 * extended work, resumed hard pauses); in-progress phases add time via now.
 */
export function remainingActiveSessionSec(
  snapshot: ActiveSnapshot,
  nowMs: number,
): number {
  const { phase, params, pauseStrategy } = snapshot.session;

  switch (phase.kind) {
    case "planned_work": {
      const openPauseSec = openHardPauseSec(pauseStrategy, phase, nowMs);
      const effectiveEndMs =
        Date.parse(phase.plannedEndAt) + openPauseSec * 1000;
      const workRemaining = Math.floor((effectiveEndMs - nowMs) / 1000);
      return workRemaining + futureAfterWorkCycle(phase.cycleIndex, params);
    }
    case "decision":
    case "extended_work":
      return futureAfterWorkCycle(phase.cycleIndex, params);
    case "short_rest_ack":
      return futureFromWorkCycleStart(phase.cycleIndex + 1, params);
    case "short_rest":
      return (
        remainingSecFromIso(phase.plannedEndAt, nowMs) +
        futureFromWorkCycleStart(phase.cycleIndex + 1, params)
      );
    case "long_rest":
      return remainingSecFromIso(phase.plannedEndAt, nowMs);
  }
}

/** Projected session end: now plus happy-path remainder from current phase. */
export function activeEstimatedSessionEndMs(
  snapshot: ActiveSnapshot,
  nowMs: number,
): number {
  return nowMs + remainingActiveSessionSec(snapshot, nowMs) * 1000;
}
