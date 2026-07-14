import { z } from "zod";

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

export const SETTINGS_BOUNDS = {
  workDurationSec: { min: 60, max: 180 * 60 },
  shortRestDurationSec: { min: 60, max: 60 * 60 },
  cyclesBeforeLongRest: { min: 1, max: 12 },
  longRestDurationSec: { min: 60, max: 120 * 60 },
  decisionWindowSec: { min: 10, max: 20 },
} as const;

function boundedInt(name: string, bounds: { min: number; max: number }) {
  return z
    .number({ error: `${name} must be a number` })
    .int({ error: `${name} must be an integer` })
    .min(bounds.min, { error: `${name} must be >= ${bounds.min}` })
    .max(bounds.max, { error: `${name} must be <= ${bounds.max}` });
}

function boundedNumber(name: string, bounds: { min: number; max: number }) {
  return z
    .number({ error: `${name} must be a number` })
    .finite({ error: `${name} must be finite` })
    .min(bounds.min, { error: `${name} must be >= ${bounds.min}` })
    .max(bounds.max, { error: `${name} must be <= ${bounds.max}` });
}

export const SessionParamsSchema = z.object({
  workDurationSec: boundedNumber("workDurationSec", SETTINGS_BOUNDS.workDurationSec),
  shortRestDurationSec: boundedNumber(
    "shortRestDurationSec",
    SETTINGS_BOUNDS.shortRestDurationSec,
  ),
  cyclesBeforeLongRest: boundedInt(
    "cyclesBeforeLongRest",
    SETTINGS_BOUNDS.cyclesBeforeLongRest,
  ),
  longRestDurationSec: boundedNumber(
    "longRestDurationSec",
    SETTINGS_BOUNDS.longRestDurationSec,
  ),
  decisionWindowSec: boundedInt(
    "decisionWindowSec",
    SETTINGS_BOUNDS.decisionWindowSec,
  ),
});
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
): SessionParams {
  return SessionParamsSchema.parse({
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
