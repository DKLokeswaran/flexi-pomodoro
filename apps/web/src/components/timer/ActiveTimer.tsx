import type {
  Phase,
  PhaseKind,
  SessionParams,
  SessionSnapshot,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import {
  elapsedFromIso,
  formatMmSs,
  remainingSecFromIso,
} from "../../utils/time";
import displayStyles from "./timerDisplay.module.css";

/** Short UI title for the current phase kind. */
function phaseTitle(kind: PhaseKind): string {
  switch (kind) {
    case "planned_work":
      return "Work";
    case "decision":
      return "Decision";
    case "extended_work":
      return "Extended work";
    case "short_rest":
      return "Short rest";
    case "long_rest":
      return "Long rest";
  }
}

/** Primary countdown (or planned + overtime) based on phase wall-clock anchors. */
function displayClock(
  snapshot: SessionSnapshot,
  params: SessionParams,
  nowMs: number,
): string {
  if (snapshot.status !== "active") return "00:00";
  const { phase } = snapshot.session;
  if (phase.kind === "extended_work") {
    const planned = formatMmSs(params.workDurationSec);
    const extended = formatMmSs(elapsedFromIso(phase.startedAt, nowMs));
    return `${planned} + ${extended}`;
  }
  if (phase.kind === "decision") {
    return formatMmSs(remainingSecFromIso(phase.decisionEndsAt, nowMs));
  }
  if (phase.kind === "planned_work") {
    const clockMs = phase.timerFrozenAt
      ? Date.parse(phase.timerFrozenAt)
      : nowMs;
    return formatMmSs(remainingSecFromIso(phase.plannedEndAt, clockMs));
  }
  if (phase.kind === "short_rest" || phase.kind === "long_rest") {
    return formatMmSs(remainingSecFromIso(phase.plannedEndAt, nowMs));
  }
  return "00:00";
}

type PhaseAction = {
  label: string;
  path: string;
  primary?: boolean;
};

/** Pause button label for the locked session strategy. */
function pauseButtonLabel(pauseStrategy: WorkPauseStrategy): string {
  return pauseStrategy === "hard" ? "Hard pause (experimental)" : "Soft pause";
}

/** Phase suffix while planned work is paused. */
function pausedPhaseLabel(pauseStrategy: WorkPauseStrategy): string {
  return pauseStrategy === "hard"
    ? " · hard-paused (experimental)"
    : " · soft-paused";
}

/** Buttons allowed for the current phase (empty for short rest). */
function actionsForPhase(
  phase: Phase,
  pauseStrategy: WorkPauseStrategy,
): PhaseAction[] {
  if (phase.kind === "planned_work") {
    return phase.paused
      ? [{ label: "Resume", path: SESSION_API.resume, primary: true }]
      : [{ label: pauseButtonLabel(pauseStrategy), path: SESSION_API.pause }];
  }
  if (phase.kind === "decision") {
    return [
      {
        label: "Continue working",
        path: SESSION_API.continue,
        primary: true,
      },
      { label: "Acknowledge rest", path: SESSION_API.ackRest },
    ];
  }
  if (phase.kind === "extended_work") {
    return [
      { label: "Start rest", path: SESSION_API.startRest, primary: true },
    ];
  }
  if (phase.kind === "long_rest") {
    return [{ label: "End long rest early", path: SESSION_API.endLongRest }];
  }
  return [];
}

/** Contextual hint under the clock for decision and overtime. */
function phaseHint(phase: Phase, nowMs: number): string | null {
  if (phase.kind === "decision") {
    const remaining = formatMmSs(
      remainingSecFromIso(phase.decisionEndsAt, nowMs),
    );
    return `Keep working — or rest in ${remaining}`;
  }
  if (phase.kind === "extended_work") {
    return "Overtime — start rest when ready";
  }
  return null;
}

/** Running-session display: phase, clock, cycle, hints, and phase actions. */
export function ActiveTimer({
  snapshot,
  phase,
  params,
  now,
  onAction,
}: {
  snapshot: SessionSnapshot;
  phase: Phase;
  params: SessionParams;
  now: number;
  onAction: (path: string) => void;
}) {
  const pauseStrategy =
    snapshot.status === "active" ? snapshot.session.pauseStrategy : "soft";
  const actions = actionsForPhase(phase, pauseStrategy);
  const hint = phaseHint(phase, now);
  const pausedLabel =
    phase.kind === "planned_work" && phase.paused
      ? pausedPhaseLabel(pauseStrategy)
      : "";

  return (
    <>
      <p className={displayStyles.phaseLabel} data-phase={phase.kind}>
        {phaseTitle(phase.kind)}
        {pausedLabel}
      </p>
      <div className={displayStyles.clock}>
        {displayClock(snapshot, params, now)}
      </div>
      <p className={displayStyles.cycle}>
        Cycle {phase.cycleIndex} / {params.cyclesBeforeLongRest}
      </p>
      {hint ? <p className={displayStyles.decisionHint}>{hint}</p> : null}
      <div className="actions">
        {actions.map((action) => (
          <button
            key={action.path}
            type="button"
            className={action.primary ? "btn btn-primary" : "btn"}
            onClick={() => onAction(action.path)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
