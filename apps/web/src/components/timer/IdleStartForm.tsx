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
  work: number;
  shortRest: number;
  longRest: number;
  cycles: number;
  decision: number;
};

function draftFromDefaults(
  defaults: SessionTimingDefaults,
  shortDurations: boolean,
): OverrideDraft {
  return {
    work: shortDurations
      ? defaults.workDurationSec
      : secToMinutes(defaults.workDurationSec),
    shortRest: shortDurations
      ? defaults.shortRestDurationSec
      : secToMinutes(defaults.shortRestDurationSec),
    longRest: shortDurations
      ? defaults.longRestDurationSec
      : secToMinutes(defaults.longRestDurationSec),
    cycles: defaults.cyclesBeforeLongRest,
    decision: defaults.decisionWindowSec,
  };
}

function toStartBody(
  draft: OverrideDraft,
  shortDurations: boolean,
): StartSessionBody {
  const overrides: StartSessionBody = {
    workDurationSec: shortDurations
      ? Math.round(draft.work)
      : minutesToSec(draft.work),
    shortRestDurationSec: shortDurations
      ? Math.round(draft.shortRest)
      : minutesToSec(draft.shortRest),
    longRestDurationSec: shortDurations
      ? Math.round(draft.longRest)
      : minutesToSec(draft.longRest),
    cyclesBeforeLongRest: Math.round(draft.cycles),
    decisionWindowSec: Math.round(draft.decision),
  };
  if (shortDurations) {
    overrides.debug = { shortDurations: true };
  }
  return overrides;
}

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

  const fields: {
    key: keyof OverrideDraft;
    label: string;
  }[] = [
    { key: "work", label: `Work (${durationUnit})` },
    { key: "shortRest", label: `Short rest (${durationUnit})` },
    { key: "cycles", label: "Cycles (N)" },
    { key: "longRest", label: `Long rest (${durationUnit})` },
    { key: "decision", label: DECISION_WINDOW_LABEL },
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
              min={key === "decision" && !shortDurations ? 10 : 1}
              onChange={(v) =>
                setOverrides((o) => ({
                  ...o,
                  [key]: Math.round(v),
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
