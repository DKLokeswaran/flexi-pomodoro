import { z } from "zod";
import { SETTINGS_BOUNDS, type SettingsBounds } from "./bounds.js";
import { DebugFlagsSchema, type DebugFlags } from "./debug/catalog.js";
import { getSettingsBounds } from "./debug/getSettingsBounds.js";

export { SETTINGS_BOUNDS, type SettingsBounds } from "./bounds.js";
export {
  DEBUG_FEATURES,
  DEBUG_FEATURE_IDS,
  DEBUG_FEATURE_META,
  DebugFlagsSchema,
  getDebugFeature,
  isDebugFeatureEnabled,
  type DebugFeatureDef,
  type DebugFeatureId,
  type DebugFeatureMeta,
  type DebugFlags,
} from "./debug/catalog.js";
export { getSettingsBounds } from "./debug/getSettingsBounds.js";
export { SHORT_DURATIONS_MIN_OVERLAY } from "./debug/features/shortDurations/index.js";

export const AlertIdSchema = z.enum([
  "work_planned_end",
  "rest_ack",
  "short_rest_start",
  "long_rest_start",
  "short_rest_end",
  "long_rest_end",
  "extended_work_auto_start",
]);
export type AlertId = z.infer<typeof AlertIdSchema>;

/** M1: only soft is accepted. Hard arrives in M2. */
export const WorkPauseStrategySchema = z.literal("soft");
export type WorkPauseStrategy = z.infer<typeof WorkPauseStrategySchema>;

function boundedInt(name: string, bounds: { min: number; max: number }) {
  return z
    .number({ error: `${name} must be a number` })
    .int({ error: `${name} must be an integer` })
    .min(bounds.min, { error: `${name} must be >= ${bounds.min}` })
    .max(bounds.max, { error: `${name} must be <= ${bounds.max}` });
}

function sessionParamsSchemaForBounds(bounds: SettingsBounds) {
  return z.object({
    workDurationSec: boundedInt("workDurationSec", bounds.workDurationSec),
    shortRestDurationSec: boundedInt(
      "shortRestDurationSec",
      bounds.shortRestDurationSec,
    ),
    cyclesBeforeLongRest: boundedInt(
      "cyclesBeforeLongRest",
      bounds.cyclesBeforeLongRest,
    ),
    longRestDurationSec: boundedInt(
      "longRestDurationSec",
      bounds.longRestDurationSec,
    ),
    decisionWindowSec: boundedInt(
      "decisionWindowSec",
      bounds.decisionWindowSec,
    ),
  });
}

/** Production session params (settings + default start validation). */
export const SessionParamsSchema = sessionParamsSchemaForBounds(SETTINGS_BOUNDS);
export type SessionParams = z.infer<typeof SessionParamsSchema>;

export const SessionOverridesSchema = SessionParamsSchema.partial();
export type SessionOverrides = z.infer<typeof SessionOverridesSchema>;

export const SettingsSchema = SessionParamsSchema.extend({
  alertsMuted: z.boolean(),
  workPauseStrategy: WorkPauseStrategySchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchSchema = SettingsSchema.partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

/** Body for POST /api/session/start — overrides plus optional per-feature debug flags. */
export type StartSessionBody = SessionOverrides & { debug?: DebugFlags };

export const DEFAULT_SETTINGS: Settings = {
  workDurationSec: 25 * 60,
  shortRestDurationSec: 5 * 60,
  cyclesBeforeLongRest: 4,
  longRestDurationSec: 15 * 60,
  decisionWindowSec: 15,
  alertsMuted: false,
  workPauseStrategy: "soft",
};

export function mergeSessionParams(
  settings: Settings,
  overrides?: SessionOverrides,
  opts?: { debug?: DebugFlags },
): SessionParams {
  const schema = sessionParamsSchemaForBounds(getSettingsBounds(opts?.debug));
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
  const raw = z.object({}).passthrough().parse(body ?? {}) as Record<
    string,
    unknown
  >;
  const { debug: debugRaw, ...overrideRaw } = raw;
  const debug =
    debugRaw === undefined ? undefined : DebugFlagsSchema.parse(debugRaw);
  const overrides = sessionParamsSchemaForBounds(getSettingsBounds(debug))
    .partial()
    .parse(overrideRaw);
  return { debug, overrides };
}

export function parseSettingsPatch(
  current: Settings,
  patch: unknown,
): Settings {
  const partial = SettingsPatchSchema.parse(patch ?? {});
  return SettingsSchema.parse({ ...current, ...partial });
}

export type PhaseKind =
  | "planned_work"
  | "decision"
  | "extended_work"
  | "short_rest"
  | "long_rest";

export interface PlannedWorkPhase {
  kind: "planned_work";
  cycleIndex: number;
  startedAt: string;
  plannedDurationSec: number;
  plannedEndAt: string;
  softPaused: boolean;
  softPausedSec: number;
  softPauseStartedAt: string | null;
}

export interface DecisionPhase {
  kind: "decision";
  cycleIndex: number;
  startedAt: string;
  decisionEndsAt: string;
  decisionWindowSec: number;
}

export interface ExtendedWorkPhase {
  kind: "extended_work";
  cycleIndex: number;
  startedAt: string;
}

export interface RestPhase {
  kind: "short_rest" | "long_rest";
  cycleIndex: number;
  startedAt: string;
  plannedDurationSec: number;
  plannedEndAt: string;
}

export type RestKind = RestPhase["kind"];

export type Phase =
  | PlannedWorkPhase
  | DecisionPhase
  | ExtendedWorkPhase
  | RestPhase;

export type SessionStatus = "idle" | "active" | "completed";

export interface AlertEvent {
  seq: number;
  id: AlertId;
}

export interface ActiveSession {
  id: string;
  status: "active";
  startedAt: string;
  params: SessionParams;
  pauseStrategy: WorkPauseStrategy;
  phase: Phase;
  /** New alerts since the client's watermark (delta only). */
  pendingAlerts: AlertEvent[];
  alertSeq: number;
}

export interface IdleSnapshot {
  status: "idle";
  serverNow: string;
  pendingAlerts: AlertEvent[];
  alertSeq: number;
}

export interface ActiveSnapshot {
  status: "active";
  serverNow: string;
  session: ActiveSession;
}

export type SessionSnapshot = IdleSnapshot | ActiveSnapshot;
