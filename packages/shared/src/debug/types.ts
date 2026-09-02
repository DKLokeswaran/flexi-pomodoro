import type { SettingsBounds } from "../bounds.js";

/** Server-side debug feature: id + optional bounds overlay (no UI meta). */
export type ServerFeatureDef<Id extends string = string> = {
  id: Id;
  applyBounds?: (bounds: SettingsBounds) => SettingsBounds;
};
