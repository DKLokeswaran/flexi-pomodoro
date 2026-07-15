import type { SettingsBounds } from "../bounds.js";

export type DebugFeatureMeta = {
  label: string;
  description?: string;
};

export type DebugFeatureDef<Id extends string = string> = {
  id: Id;
  meta: DebugFeatureMeta;
  /** Optional: tighten/replace bound mins when this feature is enabled. */
  applyBounds?: (bounds: SettingsBounds) => SettingsBounds;
};
