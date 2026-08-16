import { z } from "zod";
import { shortDurationsFeature } from "./features/shortDurations/index.js";
import type { DebugFeatureDef, DebugFeatureMeta } from "./types.js";

/** Register features here; catalog + schema are derived from this list. */
export const DEBUG_FEATURES = [shortDurationsFeature] as const;

export type DebugFeatureId = (typeof DEBUG_FEATURES)[number]["id"];

export const DEBUG_FEATURE_IDS: readonly DebugFeatureId[] = DEBUG_FEATURES.map(
  (feature) => feature.id,
);

export type DebugFlags = {
  [K in DebugFeatureId]?: boolean;
};

/** Strict — unknown keys fail validation. */
export const DebugFlagsSchema: z.ZodType<DebugFlags> = z
  .object(
    Object.fromEntries(
      DEBUG_FEATURE_IDS.map((featureId) => [featureId, z.boolean().optional()]),
    ) as {
      [K in DebugFeatureId]: z.ZodOptional<z.ZodBoolean>;
    },
  )
  .strict();

/** True when the given feature flag is present and set. */
export function isDebugFeatureEnabled(
  flags: DebugFlags | undefined,
  featureId: DebugFeatureId,
): boolean {
  return Boolean(flags?.[featureId]);
}

export const DEBUG_FEATURE_META: Record<DebugFeatureId, DebugFeatureMeta> =
  Object.fromEntries(
    DEBUG_FEATURES.map((feature) => [feature.id, feature.meta]),
  ) as Record<DebugFeatureId, DebugFeatureMeta>;

/** Look up a registered feature definition; throws if the id is unknown. */
export function getDebugFeature(featureId: DebugFeatureId): DebugFeatureDef {
  const feature = DEBUG_FEATURES.find((entry) => entry.id === featureId);
  if (!feature) {
    throw new Error(`Unknown debug feature: ${featureId}`);
  }
  return feature;
}

export type { DebugFeatureDef, DebugFeatureMeta } from "./types.js";
