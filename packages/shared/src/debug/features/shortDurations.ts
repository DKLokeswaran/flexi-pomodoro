import type { SettingsBounds } from "../../bounds.js";
import type { ServerFeatureDef } from "../types.js";

/** Overlay mins (seconds) applied when the short-durations debug feature is on. */
export const SHORT_DURATIONS_MIN_OVERLAY = {
  workDurationSec: 1,
  shortRestDurationSec: 1,
  longRestDurationSec: 1,
  decisionWindowSec: 1,
} as const;

/** Keep production maxima; lower work/rest/decision mins to 1 second. */
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

export const shortDurationsServerFeature = {
  id: "shortDurations",
  applyBounds: applyShortDurationsBounds,
} as const satisfies ServerFeatureDef<"shortDurations">;
