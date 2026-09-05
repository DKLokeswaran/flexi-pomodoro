import { z } from "zod";
import { SETTINGS_BOUNDS, type SettingsBounds } from "./bounds.js";
import type { DebugFlags } from "./debug/catalog.js";

export { SETTINGS_BOUNDS, type SettingsBounds } from "./bounds.js";
export {
  DEBUG_FEATURE_IDS,
  parseDebugFlags,
  type DebugFeatureId,
  type DebugFlags,
  type ServerFeatureDef,
} from "./debug/catalog.js";
export { getSettingsBounds } from "./debug/getSettingsBounds.js";
export {
  SHORT_DURATIONS_MIN_OVERLAY,
  shortDurationsServerFeature,
} from "./debug/features/shortDurations.js";
export {
  pausedSecAt,
  plannedWorkSecAt,
  type PlannedWorkProgressPhase,
} from "./liveStatsProgress.js";

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
export function sessionParamsSchemaForBounds(bounds: SettingsBounds) {
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

export type SettingsPatch = Partial<Settings>;

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
  /** Soft/hard pause interruption time (closed slices + open pause elapsed). */
  pausedSec: number;
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
