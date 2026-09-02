import type {
  ActiveSnapshot,
  Phase,
  PhaseKind,
  SessionLiveStats,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { useUiFlags } from "../../browserFlags/ui";
import {
  elapsedFromIso,
  formatMmSs,
  remainingSecFromIso,
} from "../../utils/time";
import { liveStatsAt } from "../../utils/liveStats";
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
    case "short_rest_ack":
      return "Start work?";
    case "long_rest":
      return "Long rest";
  }
}

/** Primary countdown (or planned + overtime) based on phase wall-clock anchors. */
function displayClock(snapshot: ActiveSnapshot, nowMs: number): string {
  const { phase, params } = snapshot.session;
  if (phase.kind === "extended_work") {
    const planned = formatMmSs(params.workDurationSec);
    const extended = formatMmSs(elapsedFromIso(phase.startedAt, nowMs));
    return `${planned} + ${extended}`;
  }
  if (phase.kind === "decision" || phase.kind === "short_rest_ack") {
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
  snapshot: ActiveSnapshot,
  hideContinueButton: boolean,
): PhaseAction[] {
  const { phase, pauseStrategy } = snapshot.session;
  if (phase.kind === "planned_work") {
    return phase.paused
      ? [{ label: "Resume", path: SESSION_API.resume, primary: true }]
      : [{ label: pauseButtonLabel(pauseStrategy), path: SESSION_API.pause }];
  }
  if (phase.kind === "decision") {
    const actions: PhaseAction[] = [
      { label: "Acknowledge rest", path: SESSION_API.ackRest },
    ];
    if (!hideContinueButton) {
      actions.unshift({
        label: "Continue working",
        path: SESSION_API.continue,
        primary: true,
      });
    } else {
      actions[0].primary = true;
    }
    return actions;
  }
  if (phase.kind === "short_rest_ack") {
    return [
      {
        label: "Acknowledge",
        path: SESSION_API.ackWork,
        primary: true,
      },
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

/** Contextual hint under the clock for decision, ack, and overtime. */
function phaseHint(phase: Phase, nowMs: number): string | null {
  if (phase.kind === "decision") {
    const remaining = formatMmSs(
      remainingSecFromIso(phase.decisionEndsAt, nowMs),
    );
    return `Keep working — or rest in ${remaining}`;
  }
  if (phase.kind === "short_rest_ack") {
    return "Acknowledge to start work — or work starts paused";
  }
  if (phase.kind === "extended_work") {
    return "Overtime — start rest when ready";
  }
  return null;
}

/** Live session counters below the phase actions. */
function LiveStatsRow({ liveStats }: { liveStats: SessionLiveStats }) {
  return (
    <p className={displayStyles.liveStats}>
      <span>
        Worked <strong>{formatMmSs(liveStats.workedSec)}</strong>
      </span>
      <span>
        Deliberation <strong>{formatMmSs(liveStats.deliberationSec)}</strong>
      </span>
      <span>
        Rest <strong>{formatMmSs(liveStats.restSec)}</strong>
      </span>
    </p>
  );
}

/** Running-session display: phase, clock, cycle, stats, hints, and phase actions. */
export function ActiveTimer({
  snapshot,
  now,
  onAction,
}: {
  snapshot: ActiveSnapshot;
  now: number;
  onAction: (path: string) => void;
}) {
  const { phase, params, pauseStrategy } = snapshot.session;
  const { isEnabled } = useUiFlags();
  const liveStats = liveStatsAt(snapshot, now);
  const actions = actionsForPhase(snapshot, isEnabled("hideContinueButton"));
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
        {displayClock(snapshot, now)}
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
      <LiveStatsRow liveStats={liveStats} />
    </>
  );
}
