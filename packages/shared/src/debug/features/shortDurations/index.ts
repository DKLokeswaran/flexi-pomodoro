import type { SettingsBounds } from "../../../bounds.js";
import type { DebugFeatureDef } from "../../types.js";

export const SHORT_DURATIONS_MIN_OVERLAY = {
  workDurationSec: 1,
  shortRestDurationSec: 1,
  longRestDurationSec: 1,
  decisionWindowSec: 1,
} as const;

function applyShortDurationsBounds(bounds: SettingsBounds): SettingsBounds {
  return {
    workDurationSec: {
      min: SHORT_DURATIONS_MIN_OVERLAY.workDurationSec,
      max: bounds.workDurationSec.max,
    },
    shortRestDurationSec: {
      min: SHORT_DURATIONS_MIN_OVERLAY.shortRestDurationSec,
      max: bounds.shortRestDurationSec.max,
    },
    cyclesBeforeLongRest: bounds.cyclesBeforeLongRest,
    longRestDurationSec: {
      min: SHORT_DURATIONS_MIN_OVERLAY.longRestDurationSec,
      max: bounds.longRestDurationSec.max,
    },
    decisionWindowSec: {
      min: SHORT_DURATIONS_MIN_OVERLAY.decisionWindowSec,
      max: bounds.decisionWindowSec.max,
    },
  };
}

export const shortDurationsFeature = {
  id: "shortDurations",
  meta: {
    label: "Short durations",
    description: "Allow work/rest/decision lengths of 1 second or more",
  },
  applyBounds: applyShortDurationsBounds,
} as const satisfies DebugFeatureDef<"shortDurations">;
