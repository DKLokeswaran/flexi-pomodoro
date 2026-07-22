import type { Phase, SessionParams, SessionSnapshot } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import {
  elapsedFromIso,
  formatMmSs,
  secFromIso,
} from "../../utils/time";

function phaseTitle(kind: string): string {
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
    default:
      return kind;
  }
}

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
    return formatMmSs(Math.max(0, secFromIso(phase.decisionEndsAt, nowMs)));
  }
  if (
    phase.kind === "planned_work" ||
    phase.kind === "short_rest" ||
    phase.kind === "long_rest"
  ) {
    return formatMmSs(Math.max(0, secFromIso(phase.plannedEndAt, nowMs)));
  }
  return "00:00";
}

type PhaseAction = {
  label: string;
  path: string;
  primary?: boolean;
};

function actionsForPhase(phase: Phase): PhaseAction[] {
  if (phase.kind === "planned_work") {
    return phase.softPaused
      ? [{ label: "Resume", path: SESSION_API.softResume, primary: true }]
      : [{ label: "Soft pause", path: SESSION_API.softPause }];
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
  const actions = actionsForPhase(phase);

  return (
    <>
      <p className="phase-label" data-phase={phase.kind}>
        {phaseTitle(phase.kind)}
        {phase.kind === "planned_work" && phase.softPaused
          ? " · soft-paused"
          : ""}
      </p>
      <div className="clock">{displayClock(snapshot, params, now)}</div>
      <p className="cycle">
        Cycle {phase.cycleIndex} / {params.cyclesBeforeLongRest}
      </p>
      {phase.kind === "decision" ? (
        <p className="decision-hint">
          Keep working — or rest in{" "}
          {formatMmSs(Math.max(0, secFromIso(phase.decisionEndsAt, now)))}
        </p>
      ) : null}
      {phase.kind === "extended_work" ? (
        <p className="decision-hint">Overtime — start rest when ready</p>
      ) : null}
      <div className="actions">
        {actions.map((a) => (
          <button
            key={a.path}
            type="button"
            className={a.primary ? "btn btn-primary" : "btn"}
            onClick={() => onAction(a.path)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
