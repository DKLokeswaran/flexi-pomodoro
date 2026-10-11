import type { Knex } from "knex";
import type {
  SessionLiveStats,
  SessionParams,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";

export type SessionStatusRow = "active" | "completed" | "interrupted";

export type SessionRow = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: SessionStatusRow;
  pauseStrategy: WorkPauseStrategy;
  workDurationSec: number;
  shortRestDurationSec: number;
  cyclesBeforeLongRest: number;
  longRestDurationSec: number;
  decisionWindowSec: number;
};

export type SessionRuntimeRow = {
  sessionId: string;
  currentPhaseId: string;
  workedSec: number;
  deliberationSec: number;
  restSec: number;
  pausedSec: number;
  alertSeq: number;
  updatedAt: string;
};

/** Session + runtime persistence (write-through). */
export class SessionStore {
  constructor(private readonly db: Knex) {}

  /** Run multi-row phase/session updates in one SQLite transaction. */
  async transaction<T>(
    fn: (trx: Knex.Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(fn);
  }

  async insertSession(
    trx: Knex.Transaction | Knex,
    row: SessionRow,
  ): Promise<void> {
    await trx("sessions").insert(row);
  }

  async upsertRuntime(
    trx: Knex.Transaction | Knex,
    row: SessionRuntimeRow,
  ): Promise<void> {
    const existing = await trx("session_runtime")
      .where({ sessionId: row.sessionId })
      .first();
    if (existing) {
      await trx("session_runtime")
        .where({ sessionId: row.sessionId })
        .update(row);
      return;
    }
    await trx("session_runtime").insert(row);
  }

  async updateRuntimeStats(
    trx: Knex.Transaction | Knex,
    sessionId: string,
    patch: {
      currentPhaseId: string;
      liveStats: SessionLiveStats;
      alertSeq: number;
      updatedAt: string;
    },
  ): Promise<void> {
    await trx("session_runtime").where({ sessionId }).update({
      currentPhaseId: patch.currentPhaseId,
      workedSec: patch.liveStats.workedSec,
      deliberationSec: patch.liveStats.deliberationSec,
      restSec: patch.liveStats.restSec,
      pausedSec: patch.liveStats.pausedSec,
      alertSeq: patch.alertSeq,
      updatedAt: patch.updatedAt,
    });
  }

  async finalizeSession(
    trx: Knex.Transaction | Knex,
    sessionId: string,
    completedAt: string,
  ): Promise<void> {
    await trx("sessions").where({ id: sessionId }).update({
      status: "completed",
      completedAt,
    });
  }

  async clearRuntime(trx: Knex.Transaction | Knex): Promise<void> {
    await trx("session_runtime").del();
  }

  /** Locked params columns from in-memory SessionParams. */
  static paramsColumns(params: SessionParams): Pick<
    SessionRow,
    | "workDurationSec"
    | "shortRestDurationSec"
    | "cyclesBeforeLongRest"
    | "longRestDurationSec"
    | "decisionWindowSec"
  > {
    return {
      workDurationSec: params.workDurationSec,
      shortRestDurationSec: params.shortRestDurationSec,
      cyclesBeforeLongRest: params.cyclesBeforeLongRest,
      longRestDurationSec: params.longRestDurationSec,
      decisionWindowSec: params.decisionWindowSec,
    };
  }
}
