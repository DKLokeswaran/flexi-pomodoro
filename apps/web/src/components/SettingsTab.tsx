import { useEffect, useState } from "react";
import {
  DEBUG_FEATURE_IDS,
  DEBUG_FEATURE_META,
  type Settings,
} from "@flexi-pomodoro/shared";
import { useDebugFlags } from "../providers/DebugFlagsProvider";
import { DECISION_WINDOW_LABEL } from "../constants/labels";
import { minutesToSec, secToMinutes } from "../utils/time";
import { NumberField } from "./NumberField";
import styles from "./SettingsTab.module.css";

export function SettingsTab({
  settings,
  onSave,
  locked,
  saving,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  locked: boolean;
  saving?: boolean;
}) {
  const { debugMode, setDebugMode, flags, setFlag } = useDebugFlags();
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
      <h2>Settings</h2>
      <p className="lead">
        Persistent defaults used when starting without overrides. Edits apply to
        future sessions only.
      </p>
      {locked ? (
        <p className="stub">
          A session is active — defaults stay locked until idle.
        </p>
      ) : null}
      <div className="form-grid">
        <NumberField
          label="Work (min)"
          value={draft.workMin}
          step={1}
          onChange={(v) =>
            setDraft((d) => ({ ...d, workMin: Math.round(v) }))
          }
        />
        <NumberField
          label="Short rest (min)"
          value={draft.shortRestMin}
          step={1}
          onChange={(v) =>
            setDraft((d) => ({ ...d, shortRestMin: Math.round(v) }))
          }
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
          step={1}
          onChange={(v) =>
            setDraft((d) => ({ ...d, longRestMin: Math.round(v) }))
          }
        />
        <NumberField
          label={DECISION_WINDOW_LABEL}
          value={draft.decisionSec}
          step={1}
          min={10}
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

      <p className="section-title">Debug</p>
      <div className={styles.debugFlags}>
        <label className={styles.debugFlag}>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
          />
          <span>
            Enable debug mode
            <span className={styles.debugFlagDesc}>
              Unlocks per-feature debug options for this browser session. Not
              saved with defaults.
            </span>
          </span>
        </label>
        {debugMode
          ? DEBUG_FEATURE_IDS.map((id) => {
              const meta = DEBUG_FEATURE_META[id];
              return (
                <label key={id} className={`${styles.debugFlag} ${styles.debugFlagNested}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(flags[id])}
                    onChange={(e) => setFlag(id, e.target.checked)}
                  />
                  <span>
                    {meta.label}
                    {meta.description ? (
                      <span className={styles.debugFlagDesc}>{meta.description}</span>
                    ) : null}
                  </span>
                </label>
              );
            })
          : null}
      </div>
    </section>
  );
}
