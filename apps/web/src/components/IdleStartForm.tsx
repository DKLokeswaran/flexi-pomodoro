import { useEffect, useState } from "react";
import type { SessionOverrides } from "@flexi-pomodoro/shared";
import { minutesToSec, secToMinutes } from "../time";
import { NumberField } from "./NumberField";

export type SessionTimingDefaults = {
  workDurationSec: number;
  shortRestDurationSec: number;
  longRestDurationSec: number;
  cyclesBeforeLongRest: number;
};

type OverrideDraft = {
  workMin: number;
  shortRestMin: number;
  longRestMin: number;
  cycles: number;
};

const OVERRIDE_FIELDS: {
  key: keyof OverrideDraft;
  label: string;
  step?: number;
}[] = [
  { key: "workMin", label: "Work (min)" },
  { key: "shortRestMin", label: "Short rest (min)" },
  { key: "cycles", label: "Cycles (N)", step: 1 },
  { key: "longRestMin", label: "Long rest (min)" },
];

function draftFromDefaults(defaults: SessionTimingDefaults): OverrideDraft {
  return {
    workMin: secToMinutes(defaults.workDurationSec),
    shortRestMin: secToMinutes(defaults.shortRestDurationSec),
    longRestMin: secToMinutes(defaults.longRestDurationSec),
    cycles: defaults.cyclesBeforeLongRest,
  };
}

export function IdleStartForm({
  defaults,
  onStart,
}: {
  defaults: SessionTimingDefaults;
  onStart: (body: SessionOverrides) => void;
}) {
  const [overrides, setOverrides] = useState(() => draftFromDefaults(defaults));

  useEffect(() => {
    setOverrides(draftFromDefaults(defaults));
  }, [defaults]);

  return (
    <>
      <p className="phase-label">Ready</p>
      <div className="clock">00:00</div>
      <p className="cycle">Start a committed session</p>
      <div className="panel" style={{ width: "100%" }}>
        <p className="section-title">This session</p>
        <div className="form-grid">
          {OVERRIDE_FIELDS.map(({ key, label, step }) => (
            <NumberField
              key={key}
              label={label}
              value={overrides[key]}
              step={step}
              onChange={(v) =>
                setOverrides((o) => ({
                  ...o,
                  [key]: step === 1 ? Math.round(v) : v,
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
          onClick={() =>
            onStart({
              workDurationSec: minutesToSec(overrides.workMin),
              shortRestDurationSec: minutesToSec(overrides.shortRestMin),
              longRestDurationSec: minutesToSec(overrides.longRestMin),
              cyclesBeforeLongRest: overrides.cycles,
            })
          }
        >
          Start session
        </button>
      </div>
    </>
  );
}
