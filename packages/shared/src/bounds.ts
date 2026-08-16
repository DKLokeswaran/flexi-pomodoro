/** Production min/max for session timing fields (seconds, except cycle count). */
export const SETTINGS_BOUNDS = {
  workDurationSec: { min: 60, max: 180 * 60 },
  shortRestDurationSec: { min: 60, max: 60 * 60 },
  cyclesBeforeLongRest: { min: 1, max: 12 },
  longRestDurationSec: { min: 60, max: 120 * 60 },
  decisionWindowSec: { min: 10, max: 20 },
} as const;

export type SettingsBounds = {
  [K in keyof typeof SETTINGS_BOUNDS]: {
    min: number;
    max: number;
  };
};
