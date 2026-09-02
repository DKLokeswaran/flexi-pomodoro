import { useEffect, useState } from "react";
import { type Settings } from "@flexi-pomodoro/shared";
import {
  DEBUG_FEATURE_IDS,
  DEBUG_FEATURE_META,
  useDebugFlags,
} from "../browserFlags/debug";
import {
  UI_FEATURE_IDS,
  UI_FEATURE_META,
  useUiFlags,
} from "../browserFlags/ui";
import { DECISION_WINDOW_LABEL } from "../constants/labels";
import { minutesToSec, secToMinutes } from "../utils/time";
import { NumberField } from "./NumberField";
import styles from "./SettingsTab.module.css";

type SettingsDraft = {
  workMinutes: number;
  shortRestMinutes: number;
  longRestMinutes: number;
  cyclesBeforeLongRest: number;
  decisionWindowSec: number;
  enableHardPause: boolean;
};

/** Convert persisted seconds into the minutes-based settings form draft. */
function draftFromSettings(settings: Settings): SettingsDraft {
  return {
    workMinutes: secToMinutes(settings.workDurationSec),
    shortRestMinutes: secToMinutes(settings.shortRestDurationSec),
    longRestMinutes: secToMinutes(settings.longRestDurationSec),
    cyclesBeforeLongRest: settings.cyclesBeforeLongRest,
    decisionWindowSec: settings.decisionWindowSec,
    enableHardPause: settings.workPauseStrategy === "hard",
  };
}

/** Convert the minutes draft back into a Settings object for PUT. */
function settingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  return {
    ...settings,
    workDurationSec: minutesToSec(draft.workMinutes),
    shortRestDurationSec: minutesToSec(draft.shortRestMinutes),
    longRestDurationSec: minutesToSec(draft.longRestMinutes),
    cyclesBeforeLongRest: draft.cyclesBeforeLongRest,
    decisionWindowSec: draft.decisionWindowSec,
    workPauseStrategy: draft.enableHardPause ? "hard" : "soft",
  };
}

/** Persistent defaults, browser UI prefs, and browser-local debug flags. */
export function SettingsTab({
  settings,
  onSave,
  locked,
  saving,
}: {
  settings: Settings;
  onSave: (nextSettings: Settings) => void;
  locked: boolean;
  saving?: boolean;
}) {
  const { debugMode, setDebugMode, flags, setFlag } = useDebugFlags();
  const { flags: uiFlags, setFlag: setUiFlag } = useUiFlags();
  const [draft, setDraft] = useState(draftFromSettings(settings));
  /** Session-only UI gate; opens automatically when saved defaults use hard pause. */
  const [experimentalMode, setExperimentalModeState] = useState(
    () => settings.workPauseStrategy === "hard",
  );

  useEffect(() => {
    setDraft(draftFromSettings(settings));
    if (settings.workPauseStrategy === "hard") {
      setExperimentalModeState(true);
    }
  }, [settings]);

  /** Show/hide experimental options; clearing the gate clears hard pause in the draft. */
  const setExperimentalMode = (enabled: boolean) => {
    setExperimentalModeState(enabled);
    if (!enabled) {
      setDraft((current) => ({ ...current, enableHardPause: false }));
    }
  };

  /** Update one numeric draft field, rounded to a whole number. */
  const setRoundedField = (key: keyof SettingsDraft, value: number) => {
    setDraft((current) => ({ ...current, [key]: Math.round(value) }));
  };

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
          value={draft.workMinutes}
          step={1}
          onChange={(value) => setRoundedField("workMinutes", value)}
        />
        <NumberField
          label="Short rest (min)"
          value={draft.shortRestMinutes}
          step={1}
          onChange={(value) => setRoundedField("shortRestMinutes", value)}
        />
        <NumberField
          label="Cycles (N)"
          value={draft.cyclesBeforeLongRest}
          step={1}
          onChange={(value) => setRoundedField("cyclesBeforeLongRest", value)}
        />
        <NumberField
          label="Long rest (min)"
          value={draft.longRestMinutes}
          step={1}
          onChange={(value) => setRoundedField("longRestMinutes", value)}
        />
        <NumberField
          label={DECISION_WINDOW_LABEL}
          value={draft.decisionWindowSec}
          step={1}
          min={10}
          onChange={(value) => setRoundedField("decisionWindowSec", value)}
        />
      </div>

      <p className="section-title">Experimental features</p>
      <div className={styles.debugFlags}>
        <label className={styles.debugFlag}>
          <input
            type="checkbox"
            checked={experimentalMode}
            onChange={(event) => setExperimentalMode(event.target.checked)}
          />
          <span>
            Enable experimental features
            <span className={styles.debugFlagDesc}>
              Unlocks experimental options for this visit.
            </span>
          </span>
        </label>
        {experimentalMode ? (
          <label className={`${styles.debugFlag} ${styles.debugFlagNested}`}>
            <input
              type="checkbox"
              checked={draft.enableHardPause}
              disabled={locked}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  enableHardPause: event.target.checked,
                }))
              }
            />
            <span>
              Enable hard pause (experimental)
              <span className={styles.debugFlagDesc}>
                Off = soft pause (default). On = hard pause.
              </span>
            </span>
          </label>
        ) : null}
      </div>

      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || saving}
          onClick={() => onSave(settingsFromDraft(settings, draft))}
        >
          Save defaults
        </button>
      </div>

      <p className="section-title">Browser preferences</p>
      <div className={styles.debugFlags}>
        {UI_FEATURE_IDS.map((featureId) => {
          const meta = UI_FEATURE_META[featureId];
          return (
            <label key={featureId} className={styles.debugFlag}>
              <input
                type="checkbox"
                checked={Boolean(uiFlags[featureId])}
                onChange={(event) => setUiFlag(featureId, event.target.checked)}
              />
              <span>
                {meta.label}
                {meta.description ? (
                  <span className={styles.debugFlagDesc}>
                    {meta.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      <p className="section-title">Debug</p>
      <div className={styles.debugFlags}>
        <label className={styles.debugFlag}>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
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
          ? DEBUG_FEATURE_IDS.map((featureId) => {
              const meta = DEBUG_FEATURE_META[featureId];
              return (
                <label
                  key={featureId}
                  className={`${styles.debugFlag} ${styles.debugFlagNested}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(flags[featureId])}
                    onChange={(event) =>
                      setFlag(featureId, event.target.checked)
                    }
                  />
                  <span>
                    {meta.label}
                    {meta.description ? (
                      <span className={styles.debugFlagDesc}>
                        {meta.description}
                      </span>
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
