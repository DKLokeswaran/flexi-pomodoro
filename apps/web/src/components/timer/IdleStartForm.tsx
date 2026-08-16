import { useEffect, useState } from "react";
import type { StartSessionBody } from "@flexi-pomodoro/shared";
import { useDebugFlags } from "../../providers/DebugFlagsProvider";
import { DECISION_WINDOW_LABEL } from "../../constants/labels";
import { minutesToSec, secToMinutes } from "../../utils/time";
import { NumberField } from "../NumberField";
import displayStyles from "./timerDisplay.module.css";

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

/** Build POST /start body from the draft, attaching debug flags when needed. */
function toStartBody(
  draft: OverrideDraft,
  useSeconds: boolean,
): StartSessionBody {
  const overrides: StartSessionBody = {
    workDurationSec: durationForApi(draft.workDuration, useSeconds),
    shortRestDurationSec: durationForApi(draft.shortRestDuration, useSeconds),
    longRestDurationSec: durationForApi(draft.longRestDuration, useSeconds),
    cyclesBeforeLongRest: Math.round(draft.cyclesBeforeLongRest),
    decisionWindowSec: Math.round(draft.decisionWindowSec),
  };
  if (useSeconds) {
    overrides.debug = { shortDurations: true };
  }
  return overrides;
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
  const shortDurations = isEnabled("shortDurations");
  const [overrides, setOverrides] = useState(() =>
    draftFromDefaults(defaults, shortDurations),
  );

  useEffect(() => {
    setOverrides(draftFromDefaults(defaults, shortDurations));
  }, [defaults, shortDurations]);

  const durationUnit = shortDurations ? "sec" : "min";
  const fields: { key: keyof OverrideDraft; label: string }[] = [
    { key: "workDuration", label: `Work (${durationUnit})` },
    { key: "shortRestDuration", label: `Short rest (${durationUnit})` },
    { key: "cyclesBeforeLongRest", label: "Cycles (N)" },
    { key: "longRestDuration", label: `Long rest (${durationUnit})` },
    { key: "decisionWindowSec", label: DECISION_WINDOW_LABEL },
  ];

  return (
    <>
      <p className={displayStyles.phaseLabel}>Ready</p>
      <div className={displayStyles.clock}>00:00</div>
      <p className={displayStyles.cycle}>Start a committed session</p>
      <div className="panel" style={{ width: "100%" }}>
        <p className="section-title">This session</p>
        <div className="form-grid">
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
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onStart(toStartBody(overrides, shortDurations))}
        >
          Start session
        </button>
      </div>
    </>
  );
}
