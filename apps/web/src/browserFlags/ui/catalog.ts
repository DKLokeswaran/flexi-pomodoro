import { createFlagCatalog, type FlagMap } from "../createFlagCatalog";
import { hideContinueButtonFeature } from "./features/hideContinueButton";
import { timerDialFeature } from "./features/timerDial";

/** Register browser UI features here. */
export const UI_FEATURES = [
  hideContinueButtonFeature,
  timerDialFeature,
] as const;

const catalog = createFlagCatalog(UI_FEATURES);

export type UiFeatureId = (typeof UI_FEATURES)[number]["id"];
export type UiFlags = FlagMap<UiFeatureId>;
export const UI_FEATURE_IDS = catalog.ids;
export const UI_FEATURE_META = catalog.meta;

/** Read UI flags from a plain object (localStorage); unknown keys ignored. */
export function readUiFlags(raw: Record<string, unknown>): UiFlags {
  const flags: UiFlags = {};
  for (const id of UI_FEATURE_IDS) {
    if (raw[id] === true) {
      flags[id] = true;
    }
  }
  return flags;
}
