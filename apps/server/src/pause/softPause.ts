import type { PlannedWorkPhase } from "@flexi-pomodoro/shared";
import { msToIso, parseIso } from "../utils/iso.js";
import type { PlannedEndAction, WorkPauseStrategy } from "./types.js";

/** If a pause is open, add its elapsed seconds and clear pause flags. */
function closePauseIfActive(phase: PlannedWorkPhase, nowMs: number): void {
  if (!phase.paused || !phase.pauseStartedAt) return;
  const pauseStartedMs = parseIso(phase.pauseStartedAt);
  phase.pausedSec += Math.floor((nowMs - pauseStartedMs) / 1000);
  phase.paused = false;
  phase.pauseStartedAt = null;
  phase.timerFrozenAt = null;
}

/** Set paused flags; leave plannedEndAt and timerFrozenAt unchanged. */
function onPause(phase: PlannedWorkPhase, nowMs: number): void {
  phase.paused = true;
  phase.pauseStartedAt = msToIso(nowMs);
}

/** Close the pause slice into pausedSec; plannedEndAt stays put. */
function onResume(phase: PlannedWorkPhase, nowMs: number): void {
  closePauseIfActive(phase, nowMs);
}

/** Soft pause never freezes the countdown (FR-PAUSE-S2). */
function isCountdownFrozen(_phase: PlannedWorkPhase): boolean {
  return false;
}

/**
 * Soft pause at planned end (FR-PAUSE-S7): close the slice through planned
 * end; auto-rest if still paused, otherwise decision.
 */
function onPlannedEnd(
  phase: PlannedWorkPhase,
  plannedEndMs: number,
): PlannedEndAction {
  const wasPaused = phase.paused;
  closePauseIfActive(phase, plannedEndMs);
  return wasPaused ? "rest" : "decision";
}

/** Default work-pause strategy: countdown keeps running; planned end is fixed. */
export const softPauseStrategy: WorkPauseStrategy = {
  id: "soft",
  onPause,
  onResume,
  isCountdownFrozen,
  onPlannedEnd,
};
