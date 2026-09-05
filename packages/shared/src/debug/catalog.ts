import { z } from "zod";
import { shortDurationsServerFeature } from "./features/shortDurations.js";

/** Server-visible debug features (id + bounds logic only). */
export const DEBUG_SERVER_FEATURES = [shortDurationsServerFeature] as const;

export type DebugFeatureId = (typeof DEBUG_SERVER_FEATURES)[number]["id"];

export const DEBUG_FEATURE_IDS: readonly DebugFeatureId[] =
  DEBUG_SERVER_FEATURES.map((feature) => feature.id);

const debugFlagsSchema = z
  .object(
    Object.fromEntries(
      DEBUG_FEATURE_IDS.map((id) => [id, z.boolean().optional()]),
    ) as { [K in DebugFeatureId]: z.ZodOptional<z.ZodBoolean> },
  )
  .strict();

export type DebugFlags = z.infer<typeof debugFlagsSchema>;

/** Parse `debug` from POST /start (and browser localStorage via the same contract). */
export function parseDebugFlags(raw: unknown): DebugFlags {
  return debugFlagsSchema.parse(raw);
}

export type { ServerFeatureDef } from "./types.js";
