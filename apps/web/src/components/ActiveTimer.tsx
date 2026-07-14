import type { Phase, SessionParams, SessionSnapshot } from "@flexi-pomodoro/shared";
import {
  elapsedFromIso,
  formatMmSs,
  secFromIso,
} from "../time";

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

function displayClock(snapshot: SessionSnapshot, nowMs: number): string {
  if (snapshot.status !== "active") return "00:00";
  const { phase } = snapshot.session;
  if (phase.kind === "extended_work") {
    return formatMmSs(elapsedFromIso(phase.startedAt, nowMs));
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
      ? [{ label: "Resume", path: "/api/session/soft-resume", primary: true }]
      : [{ label: "Soft pause", path: "/api/session/soft-pause" }];
  }
  if (phase.kind === "decision") {
    return [
      {
        label: "Acknowledge rest",
        path: "/api/session/ack-rest",
        primary: true,
      },
      { label: "Continue", path: "/api/session/continue" },
    ];
  }
  if (phase.kind === "extended_work") {
    return [
      { label: "Start rest", path: "/api/session/start-rest", primary: true },
    ];
  }
  if (phase.kind === "long_rest") {
    return [{ label: "End long rest early", path: "/api/session/end-long-rest" }];
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
      <div className="clock">{displayClock(snapshot, now)}</div>
      <p className="cycle">
        Cycle {phase.cycleIndex} / {params.cyclesBeforeLongRest}
      </p>
      {phase.kind === "decision" ? (
        <p className="decision-hint">
          Rest in{" "}
          {formatMmSs(Math.max(0, secFromIso(phase.decisionEndsAt, now)))} — or
          keep working
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
