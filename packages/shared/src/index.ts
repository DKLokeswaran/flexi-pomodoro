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
  "short_rest_ack_expired",
]);
export type AlertId = z.infer<typeof AlertIdSchema>;

/** Shared session HTTP paths (server routes + client callers). */
export const SESSION_API = {
  health: "/api/health",
  settings: "/api/settings",
  session: "/api/session",
  alertSeq: "/api/session/alert-seq",
  events: "/api/session/events",
  start: "/api/session/start",
  ackRest: "/api/session/ack-rest",
  ackWork: "/api/session/ack-work",
  continue: "/api/session/continue",
  startRest: "/api/session/start-rest",
  pause: "/api/session/pause",
  resume: "/api/session/resume",
  endLongRest: "/api/session/end-long-rest",
} as const;

export const WorkPauseStrategySchema = z.enum(["soft", "hard"]);
export type WorkPauseStrategy = z.infer<typeof WorkPauseStrategySchema>;

/** Integer field constrained to a named min/max range. */
function boundedInt(fieldName: string, bounds: { min: number; max: number }) {
  return z
    .number({ error: `${fieldName} must be a number` })
    .int({ error: `${fieldName} must be an integer` })
    .min(bounds.min, { error: `${fieldName} must be >= ${bounds.min}` })
    .max(bounds.max, { error: `${fieldName} must be <= ${bounds.max}` });
}

/** Session-timing object schema using the given min/max bounds. */
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
export const SessionParamsSchema =
  sessionParamsSchemaForBounds(SETTINGS_BOUNDS);
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
  const debug =
    debugRaw === undefined ? undefined : DebugFlagsSchema.parse(debugRaw);
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

export type PhaseKind =
  | "planned_work"
  | "decision"
  | "short_rest_ack"
  | "extended_work"
  | "short_rest"
  | "long_rest";

export interface PlannedWorkPhase {
  kind: "planned_work";
  cycleIndex: number;
  startedAt: string;
  plannedDurationSec: number;
  plannedEndAt: string;
  paused: boolean;
  pausedSec: number;
  pauseStartedAt: string | null;
  /** Hard: freeze clock at pause start; soft: always null. */
  timerFrozenAt: string | null;
}

export interface DecisionPhase {
  kind: "decision" | "short_rest_ack";
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
  PlannedWorkPhase | DecisionPhase | ExtendedWorkPhase | RestPhase;

export type SessionStatus = "idle" | "active" | "completed";

export interface SessionLiveStats {
  /** Planned focus + extended work time; soft-paused time excluded. */
  workedSec: number;
  /** Work-decision elapsed (explicit act only) + ack elapsed (always). */
  deliberationSec: number;
  /** Short rest + long rest time. */
  restSec: number;
}

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
  liveStats: SessionLiveStats;
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
