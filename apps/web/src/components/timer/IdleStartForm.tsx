import { useEffect, useState } from "react";
import type { StartSessionBody } from "@flexi-pomodoro/shared";
import { useDebugFlags } from "../../browserFlags/debug";
import { useUiFlags } from "../../browserFlags/ui";
import { DECISION_WINDOW_LABEL } from "../../constants/labels";
import { IDLE_ESTIMATE_TICK_MS, useNow } from "../../hooks/useNow";
import {
  estimatedSessionEndMs,
  nominalSessionDurationSec,
  type SessionDurationParams,
} from "../../utils/sessionProjection";
import {
  formatApproxDuration,
  formatLocalTime,
  minutesToSec,
  secToMinutes,
} from "../../utils/time";
import { NumberField } from "../NumberField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DialProgress } from "../../utils/dialProgress";
import { TimerDial } from "./TimerDial";
import { timerDisplay } from "./timerDisplay";

/** Idle dial: a full, still ring. */
const IDLE_DIAL_PROGRESS: DialProgress = {
  remaining: 1,
  overtimeLaps: null,
};

export type SessionTimingDefaults = {
  workDurationSec: number;
  shortRestDurationSec: number;
  longRestDurationSec: number;
  cyclesBeforeLongRest: number;
  decisionWindowSec: number;
};

type OverrideDraft = {
  workDuration: number;
  shortRestDuration: number;
  longRestDuration: number;
  cyclesBeforeLongRest: number;
  decisionWindowSec: number;
};

/** Seconds when short-durations debug is on; otherwise minutes. */
function durationForDisplay(durationSec: number, useSeconds: boolean): number {
  return useSeconds ? durationSec : secToMinutes(durationSec);
}

/** Round seconds as-is, or convert minutes to seconds for the start API. */
function durationForApi(value: number, useSeconds: boolean): number {
  return useSeconds ? Math.round(value) : minutesToSec(value);
}

/** Seed the start form from persisted defaults and the current duration unit. */
function draftFromDefaults(
  defaults: SessionTimingDefaults,
  useSeconds: boolean,
): OverrideDraft {
  return {
    workDuration: durationForDisplay(defaults.workDurationSec, useSeconds),
    shortRestDuration: durationForDisplay(
      defaults.shortRestDurationSec,
      useSeconds,
    ),
    longRestDuration: durationForDisplay(
      defaults.longRestDurationSec,
      useSeconds,
    ),
    cyclesBeforeLongRest: defaults.cyclesBeforeLongRest,
    decisionWindowSec: defaults.decisionWindowSec,
  };
}

/** Map the start-form draft to duration params for projection and the start API. */
function durationParamsFromDraft(
  draft: OverrideDraft,
  useSeconds: boolean,
): SessionDurationParams {
  return {
    workDurationSec: durationForApi(draft.workDuration, useSeconds),
    shortRestDurationSec: durationForApi(draft.shortRestDuration, useSeconds),
    longRestDurationSec: durationForApi(draft.longRestDuration, useSeconds),
    cyclesBeforeLongRest: Math.round(draft.cyclesBeforeLongRest),
  };
}

/** Build POST /start body from the draft, attaching debug flags when needed. */
function toStartBody(
  draft: OverrideDraft,
  useSeconds: boolean,
): StartSessionBody {
  const params = durationParamsFromDraft(draft, useSeconds);
  return {
    ...params,
    decisionWindowSec: Math.round(draft.decisionWindowSec),
    ...(useSeconds ? { debug: { shortDurations: true } } : {}),
  };
}

/** Idle timer: Ready clock plus per-session duration overrides and Start. */
export function IdleStartForm({
  defaults,
  onStart,
}: {
  defaults: SessionTimingDefaults;
  onStart: (body: StartSessionBody) => void;
}) {
  const { isEnabled } = useDebugFlags();
  const { isEnabled: isUiEnabled } = useUiFlags();
  const shortDurations = isEnabled("shortDurations");
  const now = useNow(IDLE_ESTIMATE_TICK_MS);
  const [overrides, setOverrides] = useState(() =>
    draftFromDefaults(defaults, shortDurations),
  );

  useEffect(() => {
    setOverrides(draftFromDefaults(defaults, shortDurations));
  }, [defaults, shortDurations]);

  const durationParams = durationParamsFromDraft(overrides, shortDurations);
  const durationUnit = shortDurations ? "sec" : "min";
  const estimatedEnd = formatLocalTime(
    estimatedSessionEndMs(durationParams, now),
  );
  const endsIn = formatApproxDuration(
    nominalSessionDurationSec(durationParams),
  );
  const fields: { key: keyof OverrideDraft; label: string }[] = [
    { key: "workDuration", label: `Work (${durationUnit})` },
    { key: "shortRestDuration", label: `Short rest (${durationUnit})` },
    { key: "cyclesBeforeLongRest", label: "Cycles (N)" },
    { key: "longRestDuration", label: `Long rest (${durationUnit})` },
    { key: "decisionWindowSec", label: DECISION_WINDOW_LABEL },
  ];

  const readyLabel = (
    <p className={cn(timerDisplay.phaseLabel, "text-muted-foreground")}>
      Ready
    </p>
  );

  return (
    <>
      {!isUiEnabled("classicTimer") ? (
        <TimerDial
          progress={IDLE_DIAL_PROGRESS}
          eyebrow={readyLabel}
          clock="00:00"
          readouts={[
            { label: "Cycles", value: String(overrides.cyclesBeforeLongRest) },
            { label: "Ends in", value: endsIn },
            { label: "Estimated end", value: estimatedEnd },
          ]}
        />
      ) : (
        <>
          {readyLabel}
          <div className={timerDisplay.clock}>00:00</div>
          <p className={timerDisplay.cycle}>Start a committed session</p>
          <div className={timerDisplay.estimatedEnd}>
            <p>
              Estimated end <strong>{estimatedEnd}</strong>
            </p>
            <p>
              Ends in <strong>{endsIn}</strong> if you start now
            </p>
          </div>
        </>
      )}
      <div className="flex w-full flex-col gap-4">
        <p className="type-label mt-2 text-left text-muted-foreground">
          This session
        </p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 min-[561px]:grid-cols-2">
          {fields.map(({ key, label }) => (
            <NumberField
              key={key}
              label={label}
              value={overrides[key]}
              step={1}
              min={key === "decisionWindowSec" && !shortDurations ? 10 : 1}
              onChange={(value) =>
                setOverrides((draft) => ({
                  ...draft,
                  [key]: Math.round(value),
                }))
              }
            />
          ))}
        </div>
      </div>
      <div className={timerDisplay.actions}>
        <Button
          type="button"
          onClick={() => onStart(toStartBody(overrides, shortDurations))}
        >
          Start session
        </Button>
      </div>
    </>
  );
}
