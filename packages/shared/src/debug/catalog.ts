import { z } from "zod";
import { shortDurationsFeature } from "./features/shortDurations/index.js";
import type { DebugFeatureDef, DebugFeatureMeta } from "./types.js";

/** Register features here; catalog + schema are derived from this list. */
export const DEBUG_FEATURES = [shortDurationsFeature] as const;

export type DebugFeatureId = (typeof DEBUG_FEATURES)[number]["id"];

export const DEBUG_FEATURE_IDS: readonly DebugFeatureId[] = DEBUG_FEATURES.map(
  (f) => f.id,
);

export type DebugFlags = {
  [K in DebugFeatureId]?: boolean;
};

/** Strict — unknown keys fail validation. */
export const DebugFlagsSchema: z.ZodType<DebugFlags> = z
  .object(
    Object.fromEntries(
      DEBUG_FEATURE_IDS.map((id) => [id, z.boolean().optional()]),
    ) as {
      [K in DebugFeatureId]: z.ZodOptional<z.ZodBoolean>;
    },
  )
  .strict();

export function isDebugFeatureEnabled(
  flags: DebugFlags | undefined,
  id: DebugFeatureId,
): boolean {
  return Boolean(flags?.[id]);
}

export const DEBUG_FEATURE_META: Record<DebugFeatureId, DebugFeatureMeta> =
  Object.fromEntries(DEBUG_FEATURES.map((f) => [f.id, f.meta])) as Record<
    DebugFeatureId,
    DebugFeatureMeta
  >;

export function getDebugFeature(id: DebugFeatureId): DebugFeatureDef {
  const feature = DEBUG_FEATURES.find((f) => f.id === id);
  if (!feature) {
    throw new Error(`Unknown debug feature: ${id}`);
  }
  return feature;
}

export type { DebugFeatureDef, DebugFeatureMeta } from "./types.js";
