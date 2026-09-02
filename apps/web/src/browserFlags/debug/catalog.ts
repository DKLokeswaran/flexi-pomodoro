import type { DebugFeatureId, DebugFlags } from "@flexi-pomodoro/shared";
import { createFlagCatalog } from "../createFlagCatalog";
import { shortDurationsFeature } from "./features/shortDurations";

/** Register browser debug features here; ids must match shared debug flag ids. */
export const DEBUG_FEATURES = [shortDurationsFeature] as const;

const catalog = createFlagCatalog(DEBUG_FEATURES);

export type { DebugFeatureId, DebugFlags };
export const DEBUG_FEATURE_IDS = catalog.ids;
export const DEBUG_FEATURE_META = catalog.meta;
