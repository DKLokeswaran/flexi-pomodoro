import type { Knex } from "knex";

export type DailyStatsRow = {
  clientDate: string;
  dayStart: string;
  dayEnd: string;
  workedSec: number;
  deliberationSec: number;
  restSec: number;
  pausedSec: number;
  finalizedAt: string;
};

export type TimedClosedRow = {
  startedAt: string;
  endedAt: string;
};

export type PlannedWorkClosedRow = TimedClosedRow & { id: string };

export type PauseSliceClosedRow = TimedClosedRow & {
  plannedWorkPhaseId: string;
};

/** DB access for analytics phase rows and `daily_stats`. */
export class AnalyticsStore {
  constructor(private readonly db: Knex) {}

  listClosedPlannedWorkOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<PlannedWorkClosedRow[]> {
    return this.listClosedOverlapping("planned_work", dayStart, dayEnd, [
      "id",
      "startedAt",
      "endedAt",
    ]);
  }

  listClosedPauseSlicesOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<PauseSliceClosedRow[]> {
    return this.listClosedOverlapping("pause_slices", dayStart, dayEnd, [
      "plannedWorkPhaseId",
      "startedAt",
      "endedAt",
    ]);
  }

  listClosedExtendedWorkOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<TimedClosedRow[]> {
    return this.listClosedOverlapping("extended_work", dayStart, dayEnd, [
      "startedAt",
      "endedAt",
    ]);
  }

  listClosedDecisionsOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<TimedClosedRow[]> {
    return this.listClosedOverlapping("decision", dayStart, dayEnd, [
      "startedAt",
      "endedAt",
    ]);
  }

  listClosedShortRestAcksOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<TimedClosedRow[]> {
    return this.listClosedOverlapping("short_rest_ack", dayStart, dayEnd, [
      "startedAt",
      "endedAt",
    ]);
  }

  listClosedRestsOverlapping(
    dayStart: string,
    dayEnd: string,
  ): Promise<TimedClosedRow[]> {
    return this.listClosedOverlapping("rest", dayStart, dayEnd, [
      "startedAt",
      "endedAt",
    ]);
  }

  /** Insert or replace a finalized client-timezone day row (idempotent). */
  async upsertDailyStats(row: DailyStatsRow): Promise<void> {
    const existing = await this.db("daily_stats")
      .where({ clientDate: row.clientDate })
      .first();
    if (existing) {
      await this.db("daily_stats").where({ clientDate: row.clientDate }).update({
        dayStart: row.dayStart,
        dayEnd: row.dayEnd,
        workedSec: row.workedSec,
        deliberationSec: row.deliberationSec,
        restSec: row.restSec,
        pausedSec: row.pausedSec,
        finalizedAt: row.finalizedAt,
      });
      return;
    }
    await this.db("daily_stats").insert(row);
  }

  /** Latest `clientDate` already written to `daily_stats`, or null. */
  async getLatestFinalizedClientDate(): Promise<string | null> {
    const row = await this.db("daily_stats")
      .max<{ max: string | null }>("clientDate as max")
      .first();
    return row?.max ?? null;
  }

  /** Load one materialized day, or null. */
  async getDailyStats(clientDate: string): Promise<DailyStatsRow | null> {
    const row = await this.db<DailyStatsRow>("daily_stats")
      .where({ clientDate })
      .first();
    return row ?? null;
  }

  /** Earliest `startedAt` among closed phase/slice rows (finalize backfill). */
  async getEarliestClosedPhaseStartedAt(): Promise<string | null> {
    const tables = [
      "planned_work",
      "extended_work",
      "decision",
      "short_rest_ack",
      "rest",
      "pause_slices",
    ] as const;
    let earliest: string | null = null;
    for (const table of tables) {
      const row = await this.db(table)
        .whereNotNull("endedAt")
        .min<{ min: string | null }>("startedAt as min")
        .first();
      const value = row?.min ?? null;
      if (value && (earliest === null || value < earliest)) {
        earliest = value;
      }
    }
    return earliest;
  }

  private listClosedOverlapping<T extends TimedClosedRow>(
    table: string,
    dayStart: string,
    dayEnd: string,
    columns: string[],
  ): Promise<T[]> {
    return this.db(table)
      .select(columns)
      .whereNotNull("endedAt")
      .andWhere("startedAt", "<", dayEnd)
      .andWhere("endedAt", ">", dayStart) as Promise<T[]>;
  }
}
