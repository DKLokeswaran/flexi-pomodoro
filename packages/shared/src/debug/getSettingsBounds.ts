import { SETTINGS_BOUNDS, type SettingsBounds } from "../bounds.js";
import {
  DEBUG_FEATURES,
  isDebugFeatureEnabled,
  type DebugFlags,
} from "./catalog.js";

/** Effective session-param bounds for the given debug flags (settings always use production). */
export function getSettingsBounds(flags?: DebugFlags): SettingsBounds {
  let bounds: SettingsBounds = SETTINGS_BOUNDS;
  for (const feature of DEBUG_FEATURES) {
    if (!isDebugFeatureEnabled(flags, feature.id)) continue;
    if (feature.applyBounds) {
      bounds = feature.applyBounds(bounds);
    }
  }
  return bounds;
}
