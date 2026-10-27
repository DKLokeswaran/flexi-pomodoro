import type { Phase, SessionParams } from "@flexi-pomodoro/shared";
import { phaseClockMs, phaseDurationSec, phaseEndAt } from "./phaseClock";

/** Arc state for the timer dial. */
export type DialProgress = {
  /** Share of the current phase still remaining (main gold arc), 0 to 1. */
  remaining: number;
  /** Overtime laps so far (one planned work block per lap), never wrapping; null outside overtime. */
  overtimeLaps: number | null;
};

export type CycleDotState = "done" | "current" | "pending";

/** Main-arc fraction and overtime laps for the current phase. */
export function dialProgress(
  phase: Phase,
  params: SessionParams,
  nowMs: number,
): DialProgress {
  // Overtime: full arc, laps counted in planned work lengths
  if (phase.kind === "extended_work") {
    const overtimeMs = Math.max(0, nowMs - Date.parse(phase.startedAt));
    return {
      remaining: 1,
      overtimeLaps: overtimeMs / (params.workDurationSec * 1000),
    };
  }

  // Countdown: share of the phase left, floored at 0 until the server moves on
  const leftMs = Date.parse(phaseEndAt(phase)) - phaseClockMs(phase, nowMs);
  return {
    remaining: Math.max(0, leftMs / (phaseDurationSec(phase) * 1000)),
    overtimeLaps: null,
  };
}

/** Dot state per cycle: earlier cycles done, the current one live, later ones pending. */
export function cycleDotStates(
  currentCycle: number,
  totalCycles: number,
): CycleDotState[] {
  return Array.from({ length: totalCycles }, (_, index) => {
    const cycle = index + 1;
    if (cycle < currentCycle) return "done";
    if (cycle === currentCycle) return "current";
    return "pending";
  });
}
