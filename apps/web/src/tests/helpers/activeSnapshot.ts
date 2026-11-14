import type {
  ActiveSnapshot,
  Phase,
  SessionLiveStats,
  SessionParams,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";

export const NO_STATS: SessionLiveStats = {
  workedSec: 0,
  deliberationSec: 0,
  restSec: 0,
  pausedSec: 0,
};

/** ISO timestamp for a Unix ms value. */
export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Fabricated active snapshot around one open phase. */
export function buildActiveSnapshot(options: {
  phase: Phase;
  params: SessionParams;
  serverNowMs: number;
  liveStats?: Partial<SessionLiveStats>;
  pauseStrategy?: WorkPauseStrategy;
}): ActiveSnapshot {
  return {
    status: "active",
    serverNow: iso(options.serverNowMs),
    session: {
      id: "test",
      status: "active",
      startedAt: iso(options.serverNowMs),
      params: options.params,
      pauseStrategy: options.pauseStrategy ?? "soft",
      phase: options.phase,
      liveStats: { ...NO_STATS, ...options.liveStats },
      pendingAlerts: [],
      alertSeq: 0,
    },
  };
}
