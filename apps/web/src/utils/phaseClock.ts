import type { ExtendedWorkPhase, Phase } from "@flexi-pomodoro/shared";

/** Phases that count down to a fixed end time (every phase except overtime). */
export type CountdownPhase = Exclude<Phase, ExtendedWorkPhase>;

/** Time the countdown phase ends. */
export function phaseEndAt(phase: CountdownPhase): string {
  return "decisionEndsAt" in phase ? phase.decisionEndsAt : phase.plannedEndAt;
}

/** Full length of the countdown phase, in seconds. */
export function phaseDurationSec(phase: CountdownPhase): number {
  return "decisionWindowSec" in phase
    ? phase.decisionWindowSec
    : phase.plannedDurationSec;
}

/** Moment the countdown is read at: the freeze time during a hard pause, otherwise now. */
export function phaseClockMs(phase: CountdownPhase, nowMs: number): number {
  if (phase.kind === "planned_work" && phase.timerFrozenAt) {
    return Date.parse(phase.timerFrozenAt);
  }
  return nowMs;
}
