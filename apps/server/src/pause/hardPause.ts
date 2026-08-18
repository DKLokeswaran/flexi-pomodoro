import type { PlannedWorkPhase } from "@flexi-pomodoro/shared";
import { msToIso, parseIso } from "../utils/iso.js";
import type { PlannedEndAction, WorkPauseStrategy } from "./types.js";

/** Set paused flags and freeze the countdown at pause start. */
function onPause(phase: PlannedWorkPhase, nowMs: number): void {
  phase.paused = true;
  phase.pauseStartedAt = msToIso(nowMs);
  phase.timerFrozenAt = msToIso(nowMs);
}

/**
 * Close the pause slice at `now` (not capped at the original deadline) and
 * shift plannedEndAt by the paused duration (FR-PAUSE-H2).
 */
function onResume(phase: PlannedWorkPhase, nowMs: number): void {
  if (!phase.paused || !phase.pauseStartedAt) return;
  const pauseStartedMs = parseIso(phase.pauseStartedAt);
  const pausedMs = Math.max(0, nowMs - pauseStartedMs);
  phase.pausedSec += Math.floor(pausedMs / 1000);
  phase.plannedEndAt = msToIso(parseIso(phase.plannedEndAt) + pausedMs);
  phase.paused = false;
  phase.pauseStartedAt = null;
  phase.timerFrozenAt = null;
}

/** Hard pause freezes the countdown while paused. */
function isCountdownFrozen(phase: PlannedWorkPhase): boolean {
  return phase.paused;
}

/** Frozen ticks never reach here; unpaused planned end → decision. */
function onPlannedEnd(
  _phase: PlannedWorkPhase,
  _plannedEndMs: number,
): PlannedEndAction {
  return "decision";
}

/** Experimental work-pause strategy: freeze remaining time; shift the deadline. */
export const hardPauseStrategy: WorkPauseStrategy = {
  id: "hard",
  onPause,
  onResume,
  isCountdownFrozen,
  onPlannedEnd,
};
