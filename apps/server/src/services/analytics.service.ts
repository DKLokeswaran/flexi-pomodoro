import type {
  TodayStats,
  TodayStatsResponse,
} from "@flexi-pomodoro/shared";
import type { AnalyticsStore } from "../db/stores/analyticsStore.js";
import type { SettingsService } from "./settings.service.js";
import {
  addClientDays,
  clientDateAt,
  dayBoundsIso,
  overlapSec,
  type ClientDayBounds,
} from "../utils/clientDay.js";
import { msToIso } from "../utils/iso.js";

const EMPTY_STATS: TodayStats = {
  workedSec: 0,
  deliberationSec: 0,
  restSec: 0,
  pausedSec: 0,
};

/** Day-bound analytics: open-day aggregate + finalized `daily_stats` catch-up. */
export class AnalyticsService {
  constructor(
    private readonly store: AnalyticsStore,
    private readonly settings: SettingsService,
  ) {}

  /** Closed-phase totals for the current client-timezone day. */
  async todayStats(): Promise<TodayStatsResponse> {
    const timeZone = this.settings.get().timezone;
    return this.dayStats(clientDateAt(Date.now(), timeZone));
  }

  /**
   * Closed-phase totals for one client-timezone calendar date
   * (`YYYY-MM-DD` in `settings.timezone`).
   */
  async dayStats(clientDate: string): Promise<TodayStatsResponse> {
    const timeZone = this.settings.get().timezone;
    const bounds = dayBoundsIso(clientDate, timeZone);
    const totals = await this.aggregateDay(bounds);
    return {
      clientDate,
      dayStart: bounds.dayStart,
      dayEnd: bounds.dayEnd,
      ...totals,
    };
  }

  /**
   * Finalize every client-timezone date after the latest `daily_stats` row
   * through yesterday (idempotent upserts). Backfills from earliest closed
   * phase when nothing has been finalized yet.
   */
  async finalizeDueDays(): Promise<void> {
    const nowMs = Date.now();
    const timeZone = this.settings.get().timezone;
    const todayClient = clientDateAt(nowMs, timeZone);
    const yesterdayClient = addClientDays(todayClient, -1);

    let cursor = await this.nextFinalizeCursor(yesterdayClient, timeZone);
    if (cursor === null) return;

    while (cursor <= yesterdayClient) {
      const day = await this.dayStats(cursor);
      await this.store.upsertDailyStats({
        clientDate: day.clientDate,
        dayStart: day.dayStart,
        dayEnd: day.dayEnd,
        workedSec: day.workedSec,
        deliberationSec: day.deliberationSec,
        restSec: day.restSec,
        pausedSec: day.pausedSec,
        finalizedAt: msToIso(nowMs),
      });
      cursor = addClientDays(cursor, 1);
    }
  }

  /**
   * Overlap-clip closed phases into `TodayStats` for the given client-day
   * bounds (ISO strings for SQL; ms for clipping).
   */
  private async aggregateDay(bounds: ClientDayBounds): Promise<TodayStats> {
    const { dayStart, dayEnd, dayStartMs, dayEndMs } = bounds;

    const [plannedWork, pauseSlices, extendedWork, decisions, acks, rests] =
      await Promise.all([
        this.store.listClosedPlannedWorkOverlapping(dayStart, dayEnd),
        this.store.listClosedPauseSlicesOverlapping(dayStart, dayEnd),
        this.store.listClosedExtendedWorkOverlapping(dayStart, dayEnd),
        this.store.listClosedDecisionsOverlapping(dayStart, dayEnd),
        this.store.listClosedShortRestAcksOverlapping(dayStart, dayEnd),
        this.store.listClosedRestsOverlapping(dayStart, dayEnd),
      ]);

    const pauseByPlannedWork = new Map<string, number>();
    let pausedSec = 0;
    for (const slice of pauseSlices) {
      const clipped = overlapSec(
        slice.startedAt,
        slice.endedAt,
        dayStartMs,
        dayEndMs,
      );
      pausedSec += clipped;
      pauseByPlannedWork.set(
        slice.plannedWorkPhaseId,
        (pauseByPlannedWork.get(slice.plannedWorkPhaseId) ?? 0) + clipped,
      );
    }

    let workedSec = 0;
    for (const row of plannedWork) {
      const wall = overlapSec(row.startedAt, row.endedAt, dayStartMs, dayEndMs);
      const paused = pauseByPlannedWork.get(row.id) ?? 0;
      workedSec += Math.max(0, wall - paused);
    }
    for (const row of extendedWork) {
      workedSec += overlapSec(
        row.startedAt,
        row.endedAt,
        dayStartMs,
        dayEndMs,
      );
    }

    let deliberationSec = 0;
    for (const row of decisions) {
      deliberationSec += overlapSec(
        row.startedAt,
        row.endedAt,
        dayStartMs,
        dayEndMs,
      );
    }
    for (const row of acks) {
      deliberationSec += overlapSec(
        row.startedAt,
        row.endedAt,
        dayStartMs,
        dayEndMs,
      );
    }

    let restSec = 0;
    for (const row of rests) {
      restSec += overlapSec(row.startedAt, row.endedAt, dayStartMs, dayEndMs);
    }

    return { workedSec, deliberationSec, restSec, pausedSec };
  }

  /**
   * First client date that still needs finalization, or null when already
   * caught up through yesterday.
   */
  private async nextFinalizeCursor(
    yesterdayClient: string,
    timeZone: string,
  ): Promise<string | null> {
    const latest = await this.store.getLatestFinalizedClientDate();
    if (latest !== null) {
      const next = addClientDays(latest, 1);
      return next <= yesterdayClient ? next : null;
    }

    const earliestStartedAt =
      await this.store.getEarliestClosedPhaseStartedAt();
    if (earliestStartedAt) {
      const earliestClient = clientDateAt(
        Date.parse(earliestStartedAt),
        timeZone,
      );
      return earliestClient <= yesterdayClient ? earliestClient : null;
    }

    // No history: still watermark yesterday as zeros so catch-up has a floor.
    return yesterdayClient;
  }
}

export { EMPTY_STATS as EMPTY_TODAY_STATS };
