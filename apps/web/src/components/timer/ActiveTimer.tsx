import type {
  ActiveSnapshot,
  Phase,
  SessionLiveStats,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { useUiFlags } from "../../browserFlags/ui";
import { ACTIVE_UI_TICK_MS, useNow } from "../../hooks/useNow";
import {
  elapsedFromIso,
  formatLocalTime,
  formatHhMmSs,
  formatMmSs,
  remainingSecFromIso,
} from "../../utils/time";
import { activeEstimatedSessionEndMs } from "../../utils/activeSessionProjection";
import { cycleDotStates, dialProgress } from "../../utils/dialProgress";
import { liveStatsAt } from "../../utils/liveStats";
import { phaseClockMs, phaseEndAt } from "../../utils/phaseClock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TimerDial } from "./TimerDial";
import { timerDisplay } from "./timerDisplay";

/** Short UI title for the current phase kind. */
function phaseTitle(kind: Phase["kind"]): string {
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

/** Phase label color: gold for work and decisions, soft for rest. */
const PHASE_LABEL_CLASS: Record<Phase["kind"], string> = {
  planned_work: "text-primary",
  extended_work: "text-primary",
  decision: "text-primary",
  short_rest_ack: "text-primary",
  short_rest: "text-fg-soft",
  long_rest: "text-fg-soft",
};

type ClockParts = {
  /** Countdown, or the planned work length once in overtime. */
  main: string;
  /** Overtime elapsed so far; null outside extended work. */
  overtime: string | null;
};

/** Countdown (or planned + overtime) based on phase wall-clock anchors. */
function clockParts(snapshot: ActiveSnapshot, nowMs: number): ClockParts {
  const { phase, params } = snapshot.session;
  if (phase.kind === "extended_work") {
    return {
      main: formatMmSs(params.workDurationSec),
      overtime: formatMmSs(elapsedFromIso(phase.startedAt, nowMs)),
    };
  }
  const remainingSec = remainingSecFromIso(
    phaseEndAt(phase),
    phaseClockMs(phase, nowMs),
  );
  return { main: formatMmSs(remainingSec), overtime: null };
}

/** Single-line clock for the classic layout (e.g. "25:00 + 03:12"). */
function displayClock(parts: ClockParts): string {
  return parts.overtime ? `${parts.main} + ${parts.overtime}` : parts.main;
}

/** Local time the current phase ends, "Paused" while paused, "Open" in overtime. */
function phaseEndLabel(phase: Phase): string {
  if (phase.kind === "extended_work") return "Open";
  if (phase.kind === "planned_work" && phase.paused) return "Paused";
  return formatLocalTime(Date.parse(phaseEndAt(phase)));
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

/** Clock text with colons that blink while the timer is running. */
function ClockText({ text, live }: { text: string; live: boolean }) {
  return text.split(/(:)/).map((part, index) =>
    part === ":" ? (
      <span key={index} className={cn(live && "animate-colon")}>
        :
      </span>
    ) : (
      part
    ),
  );
}

/** Mono phase label with a live dot that rests while paused. */
function PhaseLabel({
  phase,
  isPaused,
  pausedLabel,
  className,
}: {
  phase: Phase;
  isPaused: boolean;
  pausedLabel: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        timerDisplay.phaseLabel,
        PHASE_LABEL_CLASS[phase.kind],
        className,
      )}
      data-phase={phase.kind}
    >
      <span
        aria-hidden
        className={cn(
          "size-[5px] shrink-0 rounded-full bg-current",
          !isPaused && "animate-breathe",
        )}
      />
      {phaseTitle(phase.kind)}
      {pausedLabel}
    </p>
  );
}

/** Live session counters below the phase actions. */
function LiveStatsRow({ liveStats }: { liveStats: SessionLiveStats }) {
  return (
    <p className={timerDisplay.liveStats}>
      <span>
        Worked <strong>{formatHhMmSs(liveStats.workedSec)}</strong>
      </span>
      <span>
        Deliberation <strong>{formatHhMmSs(liveStats.deliberationSec)}</strong>
      </span>
      <span>
        Rest <strong>{formatHhMmSs(liveStats.restSec)}</strong>
      </span>
      <span>
        Paused <strong>{formatHhMmSs(liveStats.pausedSec)}</strong>
      </span>
    </p>
  );
}

/** Running-session display: phase, clock, cycle, stats, hints, and phase actions. */
export function ActiveTimer({
  snapshot,
  onAction,
}: {
  snapshot: ActiveSnapshot;
  onAction: (path: string) => void;
}) {
  const now = useNow(ACTIVE_UI_TICK_MS);
  const { phase, params, pauseStrategy } = snapshot.session;
  const { isEnabled } = useUiFlags();
  const liveStats = liveStatsAt(snapshot, now);
  const actions = actionsForPhase(snapshot, isEnabled("hideContinueButton"));
  const hint = phaseHint(phase, now);
  const estimatedEnd = formatLocalTime(
    activeEstimatedSessionEndMs(snapshot, now),
  );
  const isPaused = phase.kind === "planned_work" && phase.paused;
  const pausedLabel = isPaused ? pausedPhaseLabel(pauseStrategy) : "";
  const clock = clockParts(snapshot, now);
  const showDial = !isEnabled("classicTimer");
  const phaseLabel = (
    <PhaseLabel
      phase={phase}
      isPaused={isPaused}
      pausedLabel={pausedLabel}
      className={cn(showDial && "max-w-[64cqw] justify-center text-center")}
    />
  );

  return (
    <>
      {showDial ? (
        <TimerDial
          progress={dialProgress(phase, params, now)}
          eyebrow={phaseLabel}
          clock={<ClockText text={clock.main} live={!isPaused} />}
          clockSuffix={clock.overtime ? `+ ${clock.overtime}` : null}
          cycleDots={cycleDotStates(
            phase.cycleIndex,
            params.cyclesBeforeLongRest,
          )}
          readouts={[
            {
              label: "Cycle",
              value: `${phase.cycleIndex} / ${params.cyclesBeforeLongRest}`,
            },
            { label: "Phase ends", value: phaseEndLabel(phase) },
            { label: "Estimated end", value: estimatedEnd },
          ]}
        />
      ) : (
        <>
          {phaseLabel}
          <div className={timerDisplay.clock}>
            <ClockText text={displayClock(clock)} live={!isPaused} />
          </div>
          <p className={timerDisplay.cycle}>
            Cycle {phase.cycleIndex} / {params.cyclesBeforeLongRest}
          </p>
          <div className={timerDisplay.estimatedEnd}>
            <p>
              Estimated end <strong>{estimatedEnd}</strong>
            </p>
          </div>
        </>
      )}
      {hint ? <p className={timerDisplay.decisionHint}>{hint}</p> : null}
      <div className={timerDisplay.actions}>
        {actions.map((action) => (
          <Button
            key={action.path}
            type="button"
            variant={action.primary ? "default" : "outline"}
            onClick={() => onAction(action.path)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <LiveStatsRow liveStats={liveStats} />
    </>
  );
}
