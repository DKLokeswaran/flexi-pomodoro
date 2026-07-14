import { useEffect, useState } from "react";
import type { Settings } from "@flexi-pomodoro/shared";
import { minutesToSec, secToMinutes } from "../time";
import { NumberField } from "./NumberField";

export function DefaultsPanel({
  settings,
  onSave,
  locked,
  saving,
  error,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  locked: boolean;
  saving?: boolean;
  error?: string | null;
}) {
  const [draft, setDraft] = useState({
    workMin: secToMinutes(settings.workDurationSec),
    shortRestMin: secToMinutes(settings.shortRestDurationSec),
    longRestMin: secToMinutes(settings.longRestDurationSec),
    cycles: settings.cyclesBeforeLongRest,
    decisionSec: settings.decisionWindowSec,
  });

  useEffect(() => {
    setDraft({
      workMin: secToMinutes(settings.workDurationSec),
      shortRestMin: secToMinutes(settings.shortRestDurationSec),
      longRestMin: secToMinutes(settings.longRestDurationSec),
      cycles: settings.cyclesBeforeLongRest,
      decisionSec: settings.decisionWindowSec,
    });
  }, [settings]);

  return (
    <section className="panel">
      <h2>Defaults</h2>
      <p className="lead">
        Persistent settings used when starting without overrides. Edits apply to
        future sessions only.
      </p>
      {locked ? (
        <p className="stub">
          A session is active — defaults stay locked until idle.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="form-grid">
        <NumberField
          label="Work (min)"
          value={draft.workMin}
          onChange={(v) => setDraft((d) => ({ ...d, workMin: v }))}
        />
        <NumberField
          label="Short rest (min)"
          value={draft.shortRestMin}
          onChange={(v) => setDraft((d) => ({ ...d, shortRestMin: v }))}
        />
        <NumberField
          label="Cycles (N)"
          value={draft.cycles}
          step={1}
          onChange={(v) => setDraft((d) => ({ ...d, cycles: Math.round(v) }))}
        />
        <NumberField
          label="Long rest (min)"
          value={draft.longRestMin}
          onChange={(v) => setDraft((d) => ({ ...d, longRestMin: v }))}
        />
        <NumberField
          label="Decision window (sec)"
          value={draft.decisionSec}
          step={1}
          onChange={(v) =>
            setDraft((d) => ({ ...d, decisionSec: Math.round(v) }))
          }
        />
      </div>
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || saving}
          onClick={() =>
            onSave({
              ...settings,
              workDurationSec: minutesToSec(draft.workMin),
              shortRestDurationSec: minutesToSec(draft.shortRestMin),
              longRestDurationSec: minutesToSec(draft.longRestMin),
              cyclesBeforeLongRest: draft.cycles,
              decisionWindowSec: draft.decisionSec,
            })
          }
        >
          Save defaults
        </button>
      </div>
    </section>
  );
}
