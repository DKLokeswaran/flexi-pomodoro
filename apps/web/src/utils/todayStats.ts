import {
  overlapSec,
  plannedWorkProgressClockMs,
  type Phase,
  type SessionLiveStats,
  type TodayStats,
} from "@flexi-pomodoro/shared";

export const EMPTY_TODAY_STATS: SessionLiveStats = {
  workedSec: 0,
  deliberationSec: 0,
  restSec: 0,
  pausedSec: 0,
};

/**
 * Open-phase contribution clipped to `[dayStart, dayEnd)`.
 * Closed pause slices for the open phase are already in server today — only the
 * open pause window is added to `pausedSec`. Closed `pausedSec` still reduces
 * worked when the phase started inside the day (no client slice list).
 */
export function openPhaseProgressClippedToDay(
  phase: Phase,
  dayStartIso: string,
  dayEndIso: string,
  nowMs: number,
): SessionLiveStats {
  const dayStartMs = Date.parse(dayStartIso);
  const dayEndMs = Date.parse(dayEndIso);
  const stats = { ...EMPTY_TODAY_STATS };

  switch (phase.kind) {
    case "planned_work": {
      const workClockMs = plannedWorkProgressClockMs(phase, nowMs);
      const wall = overlapSec(
        Date.parse(phase.startedAt),
        workClockMs,
        dayStartMs,
        dayEndMs,
      );
      const closedPaused =
        Date.parse(phase.startedAt) >= dayStartMs ? phase.pausedSec : 0;
      stats.workedSec = Math.max(0, wall - closedPaused);
      if (phase.paused && phase.pauseStartedAt) {
        stats.pausedSec = overlapSec(
          Date.parse(phase.pauseStartedAt),
          nowMs,
          dayStartMs,
          dayEndMs,
        );
      }
      break;
    }
    case "decision":
    case "short_rest_ack": {
      stats.deliberationSec = overlapSec(
        Date.parse(phase.startedAt),
        nowMs,
        dayStartMs,
        dayEndMs,
      );
      break;
    }
    case "extended_work": {
      stats.workedSec = overlapSec(
        Date.parse(phase.startedAt),
        nowMs,
        dayStartMs,
        dayEndMs,
      );
      break;
    }
    case "short_rest":
    case "long_rest": {
      const endMs = Math.min(nowMs, Date.parse(phase.plannedEndAt));
      stats.restSec = overlapSec(
        Date.parse(phase.startedAt),
        endMs,
        dayStartMs,
        dayEndMs,
      );
      break;
    }
  }

  return stats;
}

/** Closed server today + open-phase day clip (do not add full live session stats). */
export function todayDisplayStats(
  serverToday: TodayStats,
  openPhaseClipped: SessionLiveStats,
): SessionLiveStats {
  return {
    workedSec: serverToday.workedSec + openPhaseClipped.workedSec,
    deliberationSec:
      serverToday.deliberationSec + openPhaseClipped.deliberationSec,
    restSec: serverToday.restSec + openPhaseClipped.restSec,
    pausedSec: serverToday.pausedSec + openPhaseClipped.pausedSec,
  };
}
