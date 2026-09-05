import { z } from "zod";
import {
  type DebugFlags,
  type SessionOverrides,
  type SessionParams,
  type Settings,
  SettingsSchema,
  getSettingsBounds,
  parseDebugFlags,
  sessionParamsSchemaForBounds,
} from "@flexi-pomodoro/shared";

/** Partial settings body for PUT /api/settings. */
export const SettingsPatchSchema = SettingsSchema.partial();

/** Overlay start-session overrides on persisted defaults, then validate bounds. */
export function mergeSessionParams(
  settings: Settings,
  overrides?: SessionOverrides,
  options?: { debug?: DebugFlags },
): SessionParams {
  const schema = sessionParamsSchemaForBounds(
    getSettingsBounds(options?.debug),
  );
  return schema.parse({
    workDurationSec: overrides?.workDurationSec ?? settings.workDurationSec,
    shortRestDurationSec:
      overrides?.shortRestDurationSec ?? settings.shortRestDurationSec,
    cyclesBeforeLongRest:
      overrides?.cyclesBeforeLongRest ?? settings.cyclesBeforeLongRest,
    longRestDurationSec:
      overrides?.longRestDurationSec ?? settings.longRestDurationSec,
    decisionWindowSec:
      overrides?.decisionWindowSec ?? settings.decisionWindowSec,
  });
}

/**
 * Parse start-session body: extract `debug` (strict), then validate overrides
 * against bounds from enabled debug flags.
 */
export function parseStartSessionBody(body: unknown): {
  debug: DebugFlags | undefined;
  overrides: SessionOverrides;
} {
  const rawBody = z
    .object({})
    .passthrough()
    .parse(body ?? {}) as Record<string, unknown>;
  const { debug: debugRaw, ...overrideRaw } = rawBody;
  const debug = debugRaw === undefined ? undefined : parseDebugFlags(debugRaw);
  const overrides = sessionParamsSchemaForBounds(getSettingsBounds(debug))
    .partial()
    .parse(overrideRaw);
  return { debug, overrides };
}

/** Merge a settings patch onto current settings and re-validate the result. */
export function parseSettingsPatch(
  current: Settings,
  patch: unknown,
): Settings {
  const partial = SettingsPatchSchema.parse(patch ?? {});
  return SettingsSchema.parse({ ...current, ...partial });
}
