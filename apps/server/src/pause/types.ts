import type {
  PlannedWorkPhase,
  WorkPauseStrategy as WorkPauseStrategyId,
} from "@flexi-pomodoro/shared";

export type { WorkPauseStrategyId };

/** What the engine should do after planned work's deadline. */
export type PlannedEndAction = "rest" | "decision";

/** Pause plugin used by the session engine (FR-PAUSE-M1). */
export interface WorkPauseStrategy {
  readonly id: WorkPauseStrategyId;
  onPause(phase: PlannedWorkPhase, nowMs: number): void;
  onResume(phase: PlannedWorkPhase, nowMs: number): void;
  isCountdownFrozen(phase: PlannedWorkPhase): boolean;
  onPlannedEnd(phase: PlannedWorkPhase, plannedEndMs: number): PlannedEndAction;
}
