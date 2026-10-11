import type { Knex } from "knex";
import type { WorkPauseStrategy } from "@flexi-pomodoro/shared";

export type PhaseKind =
  | "planned_work"
  | "decision"
  | "short_rest_ack"
  | "extended_work"
  | "short_rest"
  | "long_rest";

export type PlannedWorkEndedReason =
  | "planned_complete"
  | "soft_paused_auto_rest"
  | "recovery";

export type DecisionOutcome = "ack_rest" | "continue";

export type ShortRestAckOutcome = "acknowledged" | "timeout_paused";

export type ExtendedWorkEndedReason = "user_start_rest" | "recovery";

export type RestEndedReason =
  | "completed"
  | "long_rest_skipped_early"
  | "recovery";

export type PlannedWorkOpenRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  plannedDurationSec: number;
  plannedEndAt: string;
  startedAt: string;
  pausedSec?: number;
  pauseStartedAt?: string | null;
  timerFrozenAt?: string | null;
  paused?: boolean;
};

export type DecisionOpenRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  startedAt: string;
  decisionEndsAt: string;
  decisionWindowSec: number;
};

export type ExtendedWorkOpenRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  startedAt: string;
};

export type RestOpenRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  plannedDurationSec: number;
  plannedEndAt: string;
  startedAt: string;
  kind: "short_rest" | "long_rest";
};

export type PauseSliceOpenRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  plannedWorkPhaseId: string;
  strategy: WorkPauseStrategy;
  startedAt: string;
};

/** Phase / segment persistence (write-through). */
export class PhasesStore {
  constructor(private readonly db: Knex) {}

  private async insertPhase(
    trx: Knex.Transaction | Knex,
    id: string,
    kind: PhaseKind,
  ): Promise<void> {
    await trx("phases").insert({ id, kind });
  }

  async openPlannedWork(
    trx: Knex.Transaction | Knex,
    row: PlannedWorkOpenRow,
  ): Promise<void> {
    await this.insertPhase(trx, row.id, "planned_work");
    await trx("planned_work").insert({
      id: row.id,
      sessionId: row.sessionId,
      cycleIndex: row.cycleIndex,
      plannedDurationSec: row.plannedDurationSec,
      plannedEndAt: row.plannedEndAt,
      startedAt: row.startedAt,
      endedAt: null,
      pausedSec: row.pausedSec ?? 0,
      pauseStartedAt: row.pauseStartedAt ?? null,
      timerFrozenAt: row.timerFrozenAt ?? null,
      paused: row.paused ?? false,
      endedReason: null,
    });
  }

  async completePlannedWork(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      endedAt: string;
      endedReason: PlannedWorkEndedReason;
      pausedSec: number;
      pauseStartedAt: string | null;
      timerFrozenAt: string | null;
      paused: boolean;
      plannedEndAt?: string;
    },
  ): Promise<void> {
    await trx("planned_work")
      .where({ id })
      .update({
        endedAt: patch.endedAt,
        endedReason: patch.endedReason,
        pausedSec: patch.pausedSec,
        pauseStartedAt: patch.pauseStartedAt,
        timerFrozenAt: patch.timerFrozenAt,
        paused: patch.paused,
        ...(patch.plannedEndAt !== undefined
          ? { plannedEndAt: patch.plannedEndAt }
          : {}),
      });
  }

  async updatePlannedWorkPause(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      paused: boolean;
      pausedSec: number;
      pauseStartedAt: string | null;
      timerFrozenAt: string | null;
      plannedEndAt: string;
    },
  ): Promise<void> {
    await trx("planned_work").where({ id }).update(patch);
  }

  async openDecision(
    trx: Knex.Transaction | Knex,
    row: DecisionOpenRow,
  ): Promise<void> {
    await this.insertPhase(trx, row.id, "decision");
    await trx("decision").insert({
      ...row,
      endedAt: null,
      durationSec: null,
      outcome: null,
    });
  }

  async completeDecision(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      endedAt: string;
      durationSec: number;
      outcome: DecisionOutcome;
    },
  ): Promise<void> {
    await trx("decision").where({ id }).update(patch);
  }

  /**
   * FR-FLOW-11: decision timeout folds into extended — delete decision history.
   */
  async deleteDecisionPhase(
    trx: Knex.Transaction | Knex,
    id: string,
  ): Promise<void> {
    await trx("decision").where({ id }).del();
    await trx("phases").where({ id }).del();
  }

  async openShortRestAck(
    trx: Knex.Transaction | Knex,
    row: DecisionOpenRow,
  ): Promise<void> {
    await this.insertPhase(trx, row.id, "short_rest_ack");
    await trx("short_rest_ack").insert({
      ...row,
      endedAt: null,
      durationSec: null,
      outcome: null,
    });
  }

  async completeShortRestAck(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      endedAt: string;
      durationSec: number;
      outcome: ShortRestAckOutcome;
    },
  ): Promise<void> {
    await trx("short_rest_ack").where({ id }).update(patch);
  }

  async openExtendedWork(
    trx: Knex.Transaction | Knex,
    row: ExtendedWorkOpenRow,
  ): Promise<void> {
    await this.insertPhase(trx, row.id, "extended_work");
    await trx("extended_work").insert({
      ...row,
      endedAt: null,
      actualDurationSec: null,
      endedReason: null,
    });
  }

  async completeExtendedWork(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      endedAt: string;
      actualDurationSec: number;
      endedReason: ExtendedWorkEndedReason;
    },
  ): Promise<void> {
    await trx("extended_work").where({ id }).update(patch);
  }

  async openRest(
    trx: Knex.Transaction | Knex,
    row: RestOpenRow,
  ): Promise<void> {
    await this.insertPhase(trx, row.id, row.kind);
    await trx("rest").insert({
      id: row.id,
      sessionId: row.sessionId,
      cycleIndex: row.cycleIndex,
      plannedDurationSec: row.plannedDurationSec,
      plannedEndAt: row.plannedEndAt,
      startedAt: row.startedAt,
      endedAt: null,
      actualDurationSec: null,
      endedReason: null,
    });
  }

  async completeRest(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: {
      endedAt: string;
      actualDurationSec: number;
      endedReason: RestEndedReason;
    },
  ): Promise<void> {
    await trx("rest").where({ id }).update(patch);
  }

  async openPauseSlice(
    trx: Knex.Transaction | Knex,
    row: PauseSliceOpenRow,
  ): Promise<void> {
    await trx("pause_slices").insert({
      ...row,
      endedAt: null,
      durationSec: null,
    });
  }

  async closePauseSlice(
    trx: Knex.Transaction | Knex,
    id: string,
    patch: { endedAt: string; durationSec: number },
  ): Promise<void> {
    await trx("pause_slices").where({ id }).update(patch);
  }

  /** Read helpers used by attribution tests. */
  async getPhaseKind(id: string): Promise<PhaseKind | undefined> {
    const row = await this.db("phases").where({ id }).first();
    return row?.kind as PhaseKind | undefined;
  }

  async listDecisionRows(sessionId: string): Promise<unknown[]> {
    return this.db("decision").where({ sessionId });
  }

  async listPlannedWork(sessionId: string): Promise<unknown[]> {
    return this.db("planned_work").where({ sessionId });
  }

  async listExtendedWork(sessionId: string): Promise<unknown[]> {
    return this.db("extended_work").where({ sessionId });
  }

  async listShortRestAck(sessionId: string): Promise<unknown[]> {
    return this.db("short_rest_ack").where({ sessionId });
  }

  async listRest(sessionId: string): Promise<unknown[]> {
    return this.db("rest").where({ sessionId });
  }

  async listPauseSlices(sessionId: string): Promise<unknown[]> {
    return this.db("pause_slices").where({ sessionId });
  }
}
