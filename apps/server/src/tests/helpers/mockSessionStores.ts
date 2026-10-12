import type { SessionLiveStats } from "@flexi-pomodoro/shared";
import type { Knex } from "knex";
import type {
  DecisionOpenRow,
  ExtendedWorkOpenRow,
  PauseSliceOpenRow,
  PhaseKind,
  PhasesStore,
  PlannedWorkOpenRow,
  RestOpenRow,
} from "../../db/stores/phasesStore.js";
import type {
  SessionRow,
  SessionRuntimeRow,
  SessionStore,
} from "../../db/stores/sessionStore.js";
import type { SessionServiceStores } from "../../services/session.service.js";

/** Knex trx is ignored; mocks run mutations immediately. */
type Trx = Knex.Transaction | Knex;

type PlannedWorkRow = PlannedWorkOpenRow & {
  endedAt: string | null;
  endedReason: string | null;
};

type DecisionRow = DecisionOpenRow & {
  endedAt: string | null;
  durationSec: number | null;
  outcome: string | null;
};

type ExtendedWorkRow = ExtendedWorkOpenRow & {
  endedAt: string | null;
  actualDurationSec: number | null;
  endedReason: string | null;
};

type RestRow = {
  id: string;
  sessionId: string;
  cycleIndex: number;
  plannedDurationSec: number;
  plannedEndAt: string;
  startedAt: string;
  endedAt: string | null;
  actualDurationSec: number | null;
  endedReason: string | null;
};

type PauseSliceRow = PauseSliceOpenRow & {
  endedAt: string | null;
  durationSec: number | null;
};

/** In-memory SessionStore + PhasesStore for SessionService unit tests. */
export function createMockSessionStores(): SessionServiceStores {
  const sessions: SessionRow[] = [];
  let runtime: SessionRuntimeRow | null = null;
  const phaseKinds = new Map<string, PhaseKind>();
  const plannedWork: PlannedWorkRow[] = [];
  const decisions: DecisionRow[] = [];
  const shortRestAcks: DecisionRow[] = [];
  const extendedWork: ExtendedWorkRow[] = [];
  const rests: RestRow[] = [];
  const pauseSlices: PauseSliceRow[] = [];

  const sessionStore = {
    async transaction<T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
      return fn(null as unknown as Knex.Transaction);
    },
    async insertSession(_trx: Trx, row: SessionRow): Promise<void> {
      sessions.push({ ...row });
    },
    async upsertRuntime(_trx: Trx, row: SessionRuntimeRow): Promise<void> {
      runtime = { ...row };
    },
    async updateRuntimeStats(
      _trx: Trx,
      sessionId: string,
      patch: {
        currentPhaseId: string;
        liveStats: SessionLiveStats;
        alertSeq: number;
        updatedAt: string;
      },
    ): Promise<void> {
      if (!runtime || runtime.sessionId !== sessionId) return;
      runtime = {
        ...runtime,
        currentPhaseId: patch.currentPhaseId,
        workedSec: patch.liveStats.workedSec,
        deliberationSec: patch.liveStats.deliberationSec,
        restSec: patch.liveStats.restSec,
        pausedSec: patch.liveStats.pausedSec,
        alertSeq: patch.alertSeq,
        updatedAt: patch.updatedAt,
      };
    },
    async finalizeSession(
      _trx: Trx,
      sessionId: string,
      completedAt: string,
    ): Promise<void> {
      const row = sessions.find((s) => s.id === sessionId);
      if (row) {
        row.status = "completed";
        row.completedAt = completedAt;
      }
    },
    async clearRuntime(_trx: Trx): Promise<void> {
      runtime = null;
    },
  };

  const phasesStore = {
    async openPlannedWork(_trx: Trx, row: PlannedWorkOpenRow): Promise<void> {
      phaseKinds.set(row.id, "planned_work");
      plannedWork.push({
        ...row,
        pausedSec: row.pausedSec ?? 0,
        pauseStartedAt: row.pauseStartedAt ?? null,
        timerFrozenAt: row.timerFrozenAt ?? null,
        paused: row.paused ?? false,
        endedAt: null,
        endedReason: null,
      });
    },
    async completePlannedWork(
      _trx: Trx,
      id: string,
      patch: {
        endedAt: string;
        endedReason: string;
        pausedSec: number;
        pauseStartedAt: string | null;
        timerFrozenAt: string | null;
        paused: boolean;
        plannedEndAt?: string;
      },
    ): Promise<void> {
      const row = plannedWork.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async updatePlannedWorkPause(
      _trx: Trx,
      id: string,
      patch: {
        paused: boolean;
        pausedSec: number;
        pauseStartedAt: string | null;
        timerFrozenAt: string | null;
        plannedEndAt: string;
      },
    ): Promise<void> {
      const row = plannedWork.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async openDecision(_trx: Trx, row: DecisionOpenRow): Promise<void> {
      phaseKinds.set(row.id, "decision");
      decisions.push({
        ...row,
        endedAt: null,
        durationSec: null,
        outcome: null,
      });
    },
    async completeDecision(
      _trx: Trx,
      id: string,
      patch: {
        endedAt: string;
        durationSec: number;
        outcome: string;
      },
    ): Promise<void> {
      const row = decisions.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async deleteDecisionPhase(_trx: Trx, id: string): Promise<void> {
      const di = decisions.findIndex((r) => r.id === id);
      if (di >= 0) decisions.splice(di, 1);
      phaseKinds.delete(id);
    },
    async openShortRestAck(_trx: Trx, row: DecisionOpenRow): Promise<void> {
      phaseKinds.set(row.id, "short_rest_ack");
      shortRestAcks.push({
        ...row,
        endedAt: null,
        durationSec: null,
        outcome: null,
      });
    },
    async completeShortRestAck(
      _trx: Trx,
      id: string,
      patch: {
        endedAt: string;
        durationSec: number;
        outcome: string;
      },
    ): Promise<void> {
      const row = shortRestAcks.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async openExtendedWork(_trx: Trx, row: ExtendedWorkOpenRow): Promise<void> {
      phaseKinds.set(row.id, "extended_work");
      extendedWork.push({
        ...row,
        endedAt: null,
        actualDurationSec: null,
        endedReason: null,
      });
    },
    async completeExtendedWork(
      _trx: Trx,
      id: string,
      patch: {
        endedAt: string;
        actualDurationSec: number;
        endedReason: string;
      },
    ): Promise<void> {
      const row = extendedWork.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async openRest(_trx: Trx, row: RestOpenRow): Promise<void> {
      phaseKinds.set(row.id, row.kind);
      rests.push({
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
    },
    async completeRest(
      _trx: Trx,
      id: string,
      patch: {
        endedAt: string;
        actualDurationSec: number;
        endedReason: string;
      },
    ): Promise<void> {
      const row = rests.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async openPauseSlice(_trx: Trx, row: PauseSliceOpenRow): Promise<void> {
      pauseSlices.push({ ...row, endedAt: null, durationSec: null });
    },
    async closePauseSlice(
      _trx: Trx,
      id: string,
      patch: { endedAt: string; durationSec: number },
    ): Promise<void> {
      const row = pauseSlices.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
    },
    async getPhaseKind(id: string): Promise<PhaseKind | undefined> {
      return phaseKinds.get(id);
    },
    async listDecisionRows(sessionId: string): Promise<unknown[]> {
      return decisions.filter((r) => r.sessionId === sessionId);
    },
    async listPlannedWork(sessionId: string): Promise<unknown[]> {
      return plannedWork.filter((r) => r.sessionId === sessionId);
    },
    async listExtendedWork(sessionId: string): Promise<unknown[]> {
      return extendedWork.filter((r) => r.sessionId === sessionId);
    },
    async listShortRestAck(sessionId: string): Promise<unknown[]> {
      return shortRestAcks.filter((r) => r.sessionId === sessionId);
    },
    async listRest(sessionId: string): Promise<unknown[]> {
      return rests.filter((r) => r.sessionId === sessionId);
    },
    async listPauseSlices(sessionId: string): Promise<unknown[]> {
      return pauseSlices.filter((r) => r.sessionId === sessionId);
    },
  };

  return {
    session: sessionStore as unknown as SessionStore,
    phases: phasesStore as unknown as PhasesStore,
  };
}
