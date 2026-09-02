import type {
  ActiveSnapshot,
  Phase,
  PlannedWorkPhase,
  RestPhase,
  SessionLiveStats,
} from "@flexi-pomodoro/shared";
import { elapsedFromIso } from "./time";

function plannedWorkSecAt(phase: PlannedWorkPhase, endMs: number): number {
  let pauseSec = phase.pausedSec;
  if (phase.paused && phase.pauseStartedAt) {
    pauseSec += elapsedFromIso(phase.pauseStartedAt, endMs);
  }
  return elapsedFromIso(phase.startedAt, endMs) - pauseSec;
}

function restSecAt(phase: RestPhase, endMs: number): number {
  const clockMs = Math.min(endMs, Date.parse(phase.plannedEndAt));
  return elapsedFromIso(phase.startedAt, clockMs);
}

/** Add or subtract in-phase progress (sign = 1 add, −1 subtract). */
function applyPhaseProgress(
  stats: SessionLiveStats,
  phase: Phase,
  nowMs: number,
  sign: 1 | -1,
): void {
  switch (phase.kind) {
    case "planned_work":
      stats.workedSec += sign * plannedWorkSecAt(phase, nowMs);
      break;
    case "decision":
    case "short_rest_ack":
      stats.deliberationSec += sign * elapsedFromIso(phase.startedAt, nowMs);
      break;
    case "extended_work":
      stats.workedSec += sign * elapsedFromIso(phase.startedAt, nowMs);
      break;
    case "short_rest":
    case "long_rest":
      stats.restSec += sign * restSecAt(phase, nowMs);
      break;
  }
}

/** Committed stats only — strips in-phase progress baked into the snapshot. */
function committedLiveStats(snapshot: ActiveSnapshot): SessionLiveStats {
  const stats = { ...snapshot.session.liveStats };
  applyPhaseProgress(
    stats,
    snapshot.session.phase,
    Date.parse(snapshot.serverNow),
    -1,
  );
  return stats;
}

/** Live stats at nowMs; ticks locally like the phase countdown clock. */
export function liveStatsAt(
  snapshot: ActiveSnapshot,
  nowMs: number,
): SessionLiveStats {
  const stats = committedLiveStats(snapshot);
  applyPhaseProgress(stats, snapshot.session.phase, nowMs, 1);
  return stats;
}
