import {
  type ActiveSession,
  type AlertEvent,
  type AlertId,
  type DecisionPhase,
  type Phase,
  type PlannedWorkPhase,
  type RestPhase,
  type SessionLiveStats,
  type SessionParams,
  type SessionSnapshot,
  type WorkPauseStrategy as PauseStrategyId,
  pausedSecAt,
  plannedWorkSecAt,
} from "@flexi-pomodoro/shared";
import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import type { PhasesStore } from "../db/stores/phasesStore.js";
import type { SessionStore } from "../db/stores/sessionStore.js";
import { SessionStore as SessionStoreClass } from "../db/stores/sessionStore.js";
import {
  defaultPauseRegistry,
  PauseStrategyRegistry,
  type WorkPauseStrategy,
} from "../pause/index.js";
import { AsyncMutex } from "../utils/asyncMutex.js";
import { elapsedSecFromIso, msToIso, parseIso } from "../utils/iso.js";

type PausePersistContext = {
  sessionId: string;
  plannedWorkPhaseId: string;
  cycleIndex: number;
  strategy: PauseStrategyId;
};

/** Domain error from session commands (wrong phase, no session, etc.). */
export class SessionError extends Error {
  constructor(
    message: string,
    readonly code: string = "SESSION_ERROR",
  ) {
    super(message);
    this.name = "SessionError";
  }
}

/** True while wall-clock time is still before the given ISO deadline. */
function isBeforeDeadline(isoTimestamp: string, nowMs: number): boolean {
  return nowMs < parseIso(isoTimestamp);
}

/** Client watermark: idle snapshots store seq at the top level. */
function alertSeqFromSnapshot(snapshot: SessionSnapshot): number {
  return snapshot.status === "idle"
    ? snapshot.alertSeq
    : snapshot.session.alertSeq;
}

/** Open a new planned-work phase for the given cycle at nowMs. */
function startPlannedWork(
  params: SessionParams,
  cycleIndex: number,
  nowMs: number,
): PlannedWorkPhase {
  return {
    kind: "planned_work",
    cycleIndex,
    startedAt: msToIso(nowMs),
    plannedDurationSec: params.workDurationSec,
    plannedEndAt: msToIso(nowMs + params.workDurationSec * 1000),
    paused: false,
    pausedSec: 0,
    pauseStartedAt: null,
    timerFrozenAt: null,
  };
}

/** Long rest after N cycles; otherwise short rest. */
function restKindForCycle(
  params: SessionParams,
  cycleIndex: number,
): RestPhase["kind"] {
  return cycleIndex >= params.cyclesBeforeLongRest ? "long_rest" : "short_rest";
}

/** Open a rest phase whose kind and duration follow cycle index. */
function startRest(
  params: SessionParams,
  cycleIndex: number,
  nowMs: number,
): RestPhase {
  const kind = restKindForCycle(params, cycleIndex);
  const plannedDurationSec =
    kind === "long_rest"
      ? params.longRestDurationSec
      : params.shortRestDurationSec;
  return {
    kind,
    cycleIndex,
    startedAt: msToIso(nowMs),
    plannedDurationSec,
    plannedEndAt: msToIso(nowMs + plannedDurationSec * 1000),
  };
}

/** Rest seconds accumulated in a rest phase up to endMs. */
function restSecAt(phase: RestPhase, endMs: number): number {
  const clockMs = Math.min(endMs, parseIso(phase.plannedEndAt));
  return elapsedSecFromIso(phase.startedAt, clockMs);
}

/** Attribute decision/ack elapsed so far to deliberation. */
function addDeliberation(
  session: ActiveSession,
  phase: DecisionPhase,
  nowMs: number,
): void {
  session.liveStats.deliberationSec += elapsedSecFromIso(
    phase.startedAt,
    nowMs,
  );
}

/** Called with a snapshot whenever the engine notifies subscribers. */
export type SnapshotListener = (snapshot: SessionSnapshot) => void;

export type SessionServiceStores = {
  session: SessionStore;
  phases: PhasesStore;
};

/** In-memory session engine with SQLite write-through on every transition. */
export class SessionService {
  private session: ActiveSession | null = null;
  /** Pause plugin resolved at start; cleared when the session ends. */
  private pausePlugin: WorkPauseStrategy | null = null;
  /** Append-only alert log; clients receive deltas only. */
  private alertLog: AlertEvent[] = [];
  private alertSeq = 0;
  private listeners = new Set<SnapshotListener>();
  /** Per-listener delivery cursor (last seq sent). */
  private listenerCursors = new WeakMap<SnapshotListener, number>();
  /** Serializes tick and every command that ticks (commands, scheduler, boot). */
  private readonly mutex = new AsyncMutex();
  /** DB id of the open phase (`phases.id` / detail PK). */
  private currentPhaseId: string | null = null;
  /** DB id of the open pause_slices row, if any. */
  private openPauseSliceId: string | null = null;

  constructor(
    private readonly stores: SessionServiceStores,
    private readonly pauseRegistry: PauseStrategyRegistry = defaultPauseRegistry(),
  ) {}

  /** Register a snapshot listener and return an unsubscribe function. */
  subscribe(listener: SnapshotListener, sinceSeq = 0): () => void {
    this.listeners.add(listener);
    this.listenerCursors.set(listener, sinceSeq);
    return () => {
      this.listeners.delete(listener);
      this.listenerCursors.delete(listener);
    };
  }

  /** Push a fresh snapshot to every listener and advance their cursors. */
  private notify(): void {
    const nowMs = Date.now();
    for (const listener of this.listeners) {
      const sinceSeq = this.listenerCursors.get(listener) ?? 0;
      const snapshot = this.buildSnapshot(nowMs, sinceSeq);
      this.listenerCursors.set(listener, alertSeqFromSnapshot(snapshot));
      listener(snapshot);
    }
  }

  /** Notify listeners, then return the snapshot for this command's delta. */
  private notifyAndSnapshot(nowMs: number, sinceSeq: number): SessionSnapshot {
    this.notify();
    return this.buildSnapshot(nowMs, sinceSeq);
  }

  /**
   * Tick without notifying, then return the live session for a mutating command.
   * Caller must already hold the mutex.
   */
  private async beginActiveCommand(nowMs: number): Promise<{
    session: ActiveSession;
    seqAtStart: number;
  }> {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    await this.tickUnlocked(nowMs, false);
    return { session, seqAtStart };
  }

  /** Append one alert event per id, advancing the global sequence. */
  private emitAlerts(...alerts: AlertId[]): void {
    for (const alertId of alerts) {
      this.alertSeq += 1;
      this.alertLog.push({ seq: this.alertSeq, id: alertId });
    }
  }

  /** Alerts strictly newer than the client's watermark. */
  private alertsSince(sinceSeq: number): AlertEvent[] {
    return this.alertLog.filter((alertEvent) => alertEvent.seq > sinceSeq);
  }

  /** Highest alert seq emitted so far (0 after reset). */
  getAlertSeq(): number {
    return this.alertSeq;
  }

  /** Live stats including elapsed time in the current phase (for HUD). */
  private liveStatsWithProgress(
    session: ActiveSession,
    nowMs: number,
  ): SessionLiveStats {
    const stats = { ...session.liveStats };
    const phase = session.phase;
    switch (phase.kind) {
      case "planned_work":
        stats.workedSec += plannedWorkSecAt(phase, nowMs);
        stats.pausedSec += pausedSecAt(phase, nowMs);
        break;
      case "decision":
      case "short_rest_ack":
        stats.deliberationSec += elapsedSecFromIso(phase.startedAt, nowMs);
        break;
      case "extended_work":
        stats.workedSec += elapsedSecFromIso(phase.startedAt, nowMs);
        break;
      case "short_rest":
      case "long_rest":
        stats.restSec += restSecAt(phase, nowMs);
        break;
    }
    return stats;
  }

  /** Build idle or active snapshot, cloning session fields and attaching alert deltas. */
  private buildSnapshot(nowMs: number, sinceSeq: number): SessionSnapshot {
    const pendingAlerts = this.alertsSince(sinceSeq);
    if (!this.session) {
      return {
        status: "idle",
        serverNow: msToIso(nowMs),
        pendingAlerts,
        alertSeq: this.alertSeq,
      };
    }
    return {
      status: "active",
      serverNow: msToIso(nowMs),
      session: {
        ...this.session,
        params: { ...this.session.params },
        phase: structuredClone(this.session.phase),
        liveStats: this.liveStatsWithProgress(this.session, nowMs),
        pendingAlerts,
        alertSeq: this.alertSeq,
      },
    };
  }

  /**
   * Pure read of current in-memory state (no wall-clock catch-up).
   * Idle cleanup clears delivered alert history after the snapshot is built.
   */
  getSnapshot(nowMs: number = Date.now(), sinceSeq = 0): SessionSnapshot {
    const snapshot = this.buildSnapshot(nowMs, sinceSeq);
    if (!this.session) {
      this.resetAlertState();
    }
    return snapshot;
  }

  /** Persist liveStats + alertSeq + currentPhaseId on session_runtime. */
  private async syncRuntime(
    trx: Knex.Transaction | Knex,
    session: ActiveSession,
    nowMs: number,
    currentPhaseId: string = this.currentPhaseId!,
  ): Promise<void> {
    await this.stores.session.updateRuntimeStats(trx, session.id, {
      currentPhaseId,
      liveStats: session.liveStats,
      alertSeq: this.alertSeq,
      updatedAt: msToIso(nowMs),
    });
  }

  private pausePersistCtx(
    session: ActiveSession,
    plannedWorkPhaseId: string,
    cycleIndex: number,
  ): PausePersistContext {
    return {
      sessionId: session.id,
      plannedWorkPhaseId,
      cycleIndex,
      strategy: session.pauseStrategy,
    };
  }

  /** Open a pause_slices row and write planned-work pause columns. Returns slice id. */
  private async persistPauseOpen(
    trx: Knex.Transaction | Knex,
    phase: PlannedWorkPhase,
    ctx: PausePersistContext,
  ): Promise<string> {
    if (!phase.pauseStartedAt) {
      throw new Error("persistPauseOpen requires pauseStartedAt on the phase");
    }
    const sliceId = randomUUID();
    await this.stores.phases.openPauseSlice(trx, {
      id: sliceId,
      sessionId: ctx.sessionId,
      cycleIndex: ctx.cycleIndex,
      plannedWorkPhaseId: ctx.plannedWorkPhaseId,
      strategy: ctx.strategy,
      startedAt: phase.pauseStartedAt,
    });
    await this.stores.phases.updatePlannedWorkPause(trx, ctx.plannedWorkPhaseId, {
      paused: phase.paused,
      pausedSec: phase.pausedSec,
      pauseStartedAt: phase.pauseStartedAt,
      timerFrozenAt: phase.timerFrozenAt,
      plannedEndAt: phase.plannedEndAt,
    });
    return sliceId;
  }

  /** Close an open pause_slices row and write planned-work pause columns. */
  private async persistPauseClose(
    trx: Knex.Transaction | Knex,
    phase: PlannedWorkPhase,
    ctx: PausePersistContext & { openPauseSliceId: string },
    endedAtMs: number,
    pauseStartedAt: string | null,
  ): Promise<void> {
    const startedMs = pauseStartedAt ? parseIso(pauseStartedAt) : endedAtMs;
    const durationSec = Math.max(
      0,
      Math.floor((endedAtMs - startedMs) / 1000),
    );
    await this.stores.phases.closePauseSlice(trx, ctx.openPauseSliceId, {
      endedAt: msToIso(endedAtMs),
      durationSec,
    });
    await this.stores.phases.updatePlannedWorkPause(trx, ctx.plannedWorkPhaseId, {
      paused: phase.paused,
      pausedSec: phase.pausedSec,
      pauseStartedAt: phase.pauseStartedAt,
      timerFrozenAt: phase.timerFrozenAt,
      plannedEndAt: phase.plannedEndAt,
    });
  }

  /** Move from work into rest and emit the matching rest-start alert. */
  private enterRestFromWork(
    session: ActiveSession,
    nowMs: number,
    alerts: AlertId[],
  ): { rest: RestPhase; phaseId: string } {
    const cycleIndex = session.phase.cycleIndex;
    const rest = startRest(session.params, cycleIndex, nowMs);
    const phaseId = randomUUID();
    session.phase = rest;
    this.currentPhaseId = phaseId;
    const restEntryAlert: AlertId =
      rest.kind === "long_rest" ? "long_rest_start" : "short_rest_start";
    this.emitAlerts(...alerts, restEntryAlert);
    return { rest, phaseId };
  }

  /** Open the work-decision window starting at planned work's end. */
  private enterDecisionPhase(
    session: ActiveSession,
    plannedWork: PlannedWorkPhase,
    plannedEndMs: number,
  ): { phase: DecisionPhase; phaseId: string } {
    const decisionEndsAtMs =
      plannedEndMs + session.params.decisionWindowSec * 1000;
    const phaseId = randomUUID();
    const phase: DecisionPhase = {
      kind: "decision",
      cycleIndex: plannedWork.cycleIndex,
      startedAt: plannedWork.plannedEndAt,
      decisionEndsAt: msToIso(decisionEndsAtMs),
      decisionWindowSec: session.params.decisionWindowSec,
    };
    session.phase = phase;
    this.currentPhaseId = phaseId;
    this.emitAlerts("work_planned_end");
    return { phase, phaseId };
  }

  /** Enter extended work; startedAtMs is click time or decision start (timeout). */
  private enterExtendedWork(
    session: ActiveSession,
    cycleIndex: number,
    startedAtMs: number,
  ): { phaseId: string } {
    const phaseId = randomUUID();
    session.phase = {
      kind: "extended_work",
      cycleIndex,
      startedAt: msToIso(startedAtMs),
    };
    this.currentPhaseId = phaseId;
    return { phaseId };
  }

  /** Open short-rest ack window after short rest ends. */
  private enterShortRestAckPhase(
    session: ActiveSession,
    restPhase: RestPhase,
    restEndedAtMs: number,
  ): { phase: DecisionPhase; phaseId: string } {
    const phaseId = randomUUID();
    const phase: DecisionPhase = {
      kind: "short_rest_ack",
      cycleIndex: restPhase.cycleIndex,
      startedAt: msToIso(restEndedAtMs),
      decisionEndsAt: msToIso(
        restEndedAtMs + session.params.decisionWindowSec * 1000,
      ),
      decisionWindowSec: session.params.decisionWindowSec,
    };
    session.phase = phase;
    this.currentPhaseId = phaseId;
    return { phase, phaseId };
  }

  /** Start a new session in planned work; fails if one is already active. */
  async start(
    params: SessionParams,
    nowMs: number = Date.now(),
    pauseStrategy: PauseStrategyId = "soft",
  ): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      if (this.session) {
        throw new SessionError("A session is already active", "SESSION_ACTIVE");
      }
      const seqAtStart = this.alertSeq;
      this.pausePlugin = this.pauseRegistry.get(pauseStrategy)!;
      const sessionId = randomUUID();
      const phaseId = randomUUID();
      const phase = startPlannedWork(params, 1, nowMs);
      this.session = {
        id: sessionId,
        status: "active",
        startedAt: msToIso(nowMs),
        params,
        pauseStrategy,
        phase,
        liveStats: {
          workedSec: 0,
          deliberationSec: 0,
          restSec: 0,
          pausedSec: 0,
        },
        pendingAlerts: [],
        alertSeq: this.alertSeq,
      };
      this.currentPhaseId = phaseId;
      this.openPauseSliceId = null;

      await this.stores.session.transaction(async (trx) => {
        await this.stores.session.insertSession(trx, {
          id: sessionId,
          startedAt: this.session!.startedAt,
          completedAt: null,
          status: "active",
          pauseStrategy,
          ...SessionStoreClass.paramsColumns(params),
        });
        await this.stores.phases.openPlannedWork(trx, {
          id: phaseId,
          sessionId,
          cycleIndex: 1,
          plannedDurationSec: phase.plannedDurationSec,
          plannedEndAt: phase.plannedEndAt,
          startedAt: phase.startedAt,
        });
        await this.stores.session.upsertRuntime(trx, {
          sessionId,
          currentPhaseId: phaseId,
          workedSec: 0,
          deliberationSec: 0,
          restSec: 0,
          pausedSec: 0,
          alertSeq: this.alertSeq,
          updatedAt: msToIso(nowMs),
        });
      });

      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Pause planned work via the session's pause strategy. */
  async pause(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      const phase = this.requirePhase(
        session,
        "planned_work",
        "Pause is only available during planned work",
      );
      if (phase.paused) {
        throw new SessionError("Already paused", "ALREADY_PAUSED");
      }
      if (nowMs >= parseIso(phase.plannedEndAt)) {
        throw new SessionError("Planned work already ended", "INVALID_PHASE");
      }
      this.pausePlugin!.onPause(phase, nowMs);
      await this.stores.session.transaction(async (trx) => {
        this.openPauseSliceId = await this.persistPauseOpen(
          trx,
          phase,
          this.pausePersistCtx(session, this.currentPhaseId!, phase.cycleIndex),
        );
        await this.syncRuntime(trx, session, nowMs);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** End an active pause via the session's pause strategy. */
  async resume(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      const phase = this.requirePhase(
        session,
        "planned_work",
        "Resume is only available during planned work",
      );
      if (!phase.paused) {
        throw new SessionError("Not paused", "NOT_PAUSED");
      }
      const pauseStartedAt = phase.pauseStartedAt;
      const openPauseSliceId = this.openPauseSliceId!;
      this.pausePlugin!.onResume(phase, nowMs);
      await this.stores.session.transaction(async (trx) => {
        await this.persistPauseClose(
          trx,
          phase,
          {
            ...this.pausePersistCtx(
              session,
              this.currentPhaseId!,
              phase.cycleIndex,
            ),
            openPauseSliceId,
          },
          nowMs,
          pauseStartedAt,
        );
        this.openPauseSliceId = null;
        await this.syncRuntime(trx, session, nowMs);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Work decision: user chooses rest. */
  async ackRest(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      this.requirePhase(
        session,
        "decision",
        "Acknowledge rest is only valid in decision",
      );
      const decision = session.phase as DecisionPhase;
      const decisionPhaseId = this.currentPhaseId!;
      addDeliberation(session, decision, nowMs);
      const durationSec = elapsedSecFromIso(decision.startedAt, nowMs);
      const { rest, phaseId: restPhaseId } = this.enterRestFromWork(
        session,
        nowMs,
        ["rest_ack"],
      );

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeDecision(trx, decisionPhaseId, {
          endedAt: msToIso(nowMs),
          durationSec,
          outcome: "ack_rest",
        });
        await this.stores.phases.openRest(trx, {
          id: restPhaseId,
          sessionId: session.id,
          cycleIndex: rest.cycleIndex,
          plannedDurationSec: rest.plannedDurationSec,
          plannedEndAt: rest.plannedEndAt,
          startedAt: rest.startedAt,
          kind: rest.kind,
        });
        await this.syncRuntime(trx, session, nowMs, restPhaseId);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Short-rest ack: user acknowledges; next cycle starts running. */
  async ackWork(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      this.requirePhase(
        session,
        "short_rest_ack",
        "Acknowledge work is only valid in short-rest ack",
      );
      const ack = session.phase as DecisionPhase;
      const ackPhaseId = this.currentPhaseId!;
      addDeliberation(session, ack, nowMs);
      const durationSec = elapsedSecFromIso(ack.startedAt, nowMs);
      const work = startPlannedWork(
        session.params,
        ack.cycleIndex + 1,
        nowMs,
      );
      const workPhaseId = randomUUID();
      session.phase = work;
      this.currentPhaseId = workPhaseId;

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeShortRestAck(trx, ackPhaseId, {
          endedAt: msToIso(nowMs),
          durationSec,
          outcome: "acknowledged",
        });
        await this.stores.phases.openPlannedWork(trx, {
          id: workPhaseId,
          sessionId: session.id,
          cycleIndex: work.cycleIndex,
          plannedDurationSec: work.plannedDurationSec,
          plannedEndAt: work.plannedEndAt,
          startedAt: work.startedAt,
        });
        await this.syncRuntime(trx, session, nowMs, workPhaseId);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Work decision: user continues; extended work starts at the click. */
  async continueExtended(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      this.requirePhase(
        session,
        "decision",
        "Continue is only valid in decision",
      );
      const decision = session.phase as DecisionPhase;
      const decisionPhaseId = this.currentPhaseId!;
      addDeliberation(session, decision, nowMs);
      const durationSec = elapsedSecFromIso(decision.startedAt, nowMs);
      const { phaseId: extendedPhaseId } = this.enterExtendedWork(
        session,
        decision.cycleIndex,
        nowMs,
      );

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeDecision(trx, decisionPhaseId, {
          endedAt: msToIso(nowMs),
          durationSec,
          outcome: "continue",
        });
        await this.stores.phases.openExtendedWork(trx, {
          id: extendedPhaseId,
          sessionId: session.id,
          cycleIndex: decision.cycleIndex,
          startedAt: msToIso(nowMs),
        });
        await this.syncRuntime(trx, session, nowMs, extendedPhaseId);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Extended work: user starts rest (no extra end-of-extended alert). */
  async startRest(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      const phase = this.requirePhase(
        session,
        "extended_work",
        "Start rest is only valid during extended work",
      );
      const extendedPhaseId = this.currentPhaseId!;
      const actualDurationSec = elapsedSecFromIso(phase.startedAt, nowMs);
      session.liveStats.workedSec += actualDurationSec;
      const { rest, phaseId: restPhaseId } = this.enterRestFromWork(
        session,
        nowMs,
        [],
      );

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeExtendedWork(trx, extendedPhaseId, {
          endedAt: msToIso(nowMs),
          actualDurationSec,
          endedReason: "user_start_rest",
        });
        await this.stores.phases.openRest(trx, {
          id: restPhaseId,
          sessionId: session.id,
          cycleIndex: rest.cycleIndex,
          plannedDurationSec: rest.plannedDurationSec,
          plannedEndAt: rest.plannedEndAt,
          startedAt: rest.startedAt,
          kind: rest.kind,
        });
        await this.syncRuntime(trx, session, nowMs, restPhaseId);
      });
      return this.notifyAndSnapshot(nowMs, seqAtStart);
    });
  }

  /** Long rest: end early, complete the session, then reset alert history. */
  async endLongRest(nowMs: number = Date.now()): Promise<SessionSnapshot> {
    return this.mutex.runExclusive(async () => {
      const { session, seqAtStart } = await this.beginActiveCommand(nowMs);
      this.requirePhase(
        session,
        "long_rest",
        "Early end is only valid during long rest",
      );
      const phase = session.phase as RestPhase;
      const restPhaseId = this.currentPhaseId!;
      const actualDurationSec = elapsedSecFromIso(phase.startedAt, nowMs);

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeRest(trx, restPhaseId, {
          endedAt: msToIso(nowMs),
          actualDurationSec,
          endedReason: "long_rest_skipped_early",
        });
        await this.stores.session.finalizeSession(
          trx,
          session.id,
          msToIso(nowMs),
        );
        await this.stores.session.clearRuntime(trx);
      });

      this.completeSession();
      const snapshot = this.buildSnapshot(nowMs, seqAtStart);
      this.notify();
      this.resetAlertState();
      return snapshot;
    });
  }

  /**
   * Scheduler entry: run a tick only if the mutex is free (skip-if-busy).
   * Returns false when skipped so overlapping intervals do not queue up.
   */
  async tickIfIdle(nowMs: number = Date.now(), notify = true): Promise<boolean> {
    const ran = await this.mutex.tryRunExclusive(() =>
      this.tickUnlocked(nowMs, notify),
    );
    return ran !== null;
  }

  /** Tick body; caller must hold the mutex. */
  private async tickUnlocked(nowMs: number, notify: boolean): Promise<void> {
    if (!this.session) return;

    let changed = false;
    const maxIterations = 10_000;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (!this.session) break;
      const advanced = await this.advanceOnce(this.session, nowMs);
      if (!advanced) break;
      changed = true;
    }

    if (changed && notify) {
      this.notify();
      if (!this.session) {
        this.resetAlertState();
      }
    }
  }

  private commitPlannedWork(
    session: ActiveSession,
    phase: PlannedWorkPhase,
    endMs: number,
  ): void {
    session.liveStats.workedSec += plannedWorkSecAt(phase, endMs);
    session.liveStats.pausedSec += pausedSecAt(phase, endMs);
  }

  private commitRest(
    session: ActiveSession,
    phase: RestPhase,
    endMs: number,
  ): void {
    session.liveStats.restSec += restSecAt(phase, endMs);
  }

  /** Apply at most one due phase transition; false if nothing is due. */
  private async advanceOnce(
    session: ActiveSession,
    nowMs: number,
  ): Promise<boolean> {
    const phase = session.phase;
    switch (phase.kind) {
      case "planned_work":
        return this.advancePlannedWork(session, phase, nowMs);
      case "decision":
        return this.advanceWorkDecision(session, phase, nowMs);
      case "short_rest_ack":
        return this.advanceShortRestAck(session, phase, nowMs);
      case "extended_work":
        return false;
      case "short_rest":
      case "long_rest":
        return this.advanceRest(session, phase, nowMs);
    }
  }

  /** Planned end: skip ticks while frozen; otherwise apply pause-strategy policy. */
  private async advancePlannedWork(
    session: ActiveSession,
    phase: PlannedWorkPhase,
    nowMs: number,
  ): Promise<boolean> {
    if (this.pausePlugin!.isCountdownFrozen(phase)) return false;
    if (isBeforeDeadline(phase.plannedEndAt, nowMs)) return false;
    const plannedEndMs = parseIso(phase.plannedEndAt);
    const plannedWorkPhaseId = this.currentPhaseId!;
    // Soft auto-rest closes an open pause; capture before onPlannedEnd clears it.
    const pauseStartedAt = phase.pauseStartedAt;
    const openPauseSliceId = this.openPauseSliceId;
    const action = this.pausePlugin!.onPlannedEnd(phase, plannedEndMs);
    this.commitPlannedWork(session, phase, plannedEndMs);

    if (action === "rest") {
      const { rest, phaseId: restPhaseId } = this.enterRestFromWork(
        session,
        plannedEndMs,
        ["work_planned_end"],
      );

      await this.stores.session.transaction(async (trx) => {
        await this.persistPauseClose(
          trx,
          phase,
          {
            ...this.pausePersistCtx(
              session,
              plannedWorkPhaseId,
              phase.cycleIndex,
            ),
            openPauseSliceId: openPauseSliceId!,
          },
          plannedEndMs,
          pauseStartedAt,
        );
        this.openPauseSliceId = null;
        await this.stores.phases.completePlannedWork(trx, plannedWorkPhaseId, {
          endedAt: msToIso(plannedEndMs),
          endedReason: "soft_paused_auto_rest",
          pausedSec: phase.pausedSec,
          pauseStartedAt: phase.pauseStartedAt,
          timerFrozenAt: phase.timerFrozenAt,
          paused: phase.paused,
          plannedEndAt: phase.plannedEndAt,
        });
        await this.stores.phases.openRest(trx, {
          id: restPhaseId,
          sessionId: session.id,
          cycleIndex: rest.cycleIndex,
          plannedDurationSec: rest.plannedDurationSec,
          plannedEndAt: rest.plannedEndAt,
          startedAt: rest.startedAt,
          kind: rest.kind,
        });
        await this.syncRuntime(trx, session, plannedEndMs, restPhaseId);
      });
      return true;
    }

    // Focusing → decision: not paused; onPlannedEnd does not open/close a slice.
    const { phase: decision, phaseId: decisionPhaseId } =
      this.enterDecisionPhase(session, phase, plannedEndMs);

    await this.stores.session.transaction(async (trx) => {
      await this.stores.phases.completePlannedWork(trx, plannedWorkPhaseId, {
        endedAt: msToIso(plannedEndMs),
        endedReason: "planned_complete",
        pausedSec: phase.pausedSec,
        pauseStartedAt: phase.pauseStartedAt,
        timerFrozenAt: phase.timerFrozenAt,
        paused: phase.paused,
        plannedEndAt: phase.plannedEndAt,
      });
      await this.stores.phases.openDecision(trx, {
        id: decisionPhaseId,
        sessionId: session.id,
        cycleIndex: decision.cycleIndex,
        startedAt: decision.startedAt,
        decisionEndsAt: decision.decisionEndsAt,
        decisionWindowSec: decision.decisionWindowSec,
      });
      await this.syncRuntime(trx, session, plannedEndMs, decisionPhaseId);
    });
    return true;
  }

  /**
   * Work-decision timeout: full window folds into extended work (FR-FLOW-11).
   * Keep startedAt at decision start; liveStats progress covers the window once.
   */
  private async advanceWorkDecision(
    session: ActiveSession,
    phase: DecisionPhase,
    nowMs: number,
  ): Promise<boolean> {
    if (isBeforeDeadline(phase.decisionEndsAt, nowMs)) return false;
    const decisionPhaseId = this.currentPhaseId!;
    const startedAtMs = parseIso(phase.startedAt);
    const { phaseId: extendedPhaseId } = this.enterExtendedWork(
      session,
      phase.cycleIndex,
      startedAtMs,
    );
    this.emitAlerts("extended_work_auto_start");

    await this.stores.session.transaction(async (trx) => {
      await this.stores.phases.openExtendedWork(trx, {
        id: extendedPhaseId,
        sessionId: session.id,
        cycleIndex: phase.cycleIndex,
        startedAt: phase.startedAt,
      });
      await this.syncRuntime(trx, session, nowMs, extendedPhaseId);
      await this.stores.phases.deleteDecisionPhase(trx, decisionPhaseId);
    });
    return true;
  }

  /**
   * Short-rest ack timeout: deliberation for the window, then next work paused.
   */
  private async advanceShortRestAck(
    session: ActiveSession,
    phase: DecisionPhase,
    nowMs: number,
  ): Promise<boolean> {
    if (isBeforeDeadline(phase.decisionEndsAt, nowMs)) return false;
    const timeoutMs = parseIso(phase.decisionEndsAt);
    const ackPhaseId = this.currentPhaseId!;
    session.liveStats.deliberationSec += phase.decisionWindowSec;
    this.emitAlerts("short_rest_ack_expired");
    const work = startPlannedWork(
      session.params,
      phase.cycleIndex + 1,
      timeoutMs,
    );
    const workPhaseId = randomUUID();
    session.phase = work;
    this.currentPhaseId = workPhaseId;
    this.pausePlugin!.onPause(work, timeoutMs);

    await this.stores.session.transaction(async (trx) => {
      await this.stores.phases.completeShortRestAck(trx, ackPhaseId, {
        endedAt: msToIso(timeoutMs),
        durationSec: phase.decisionWindowSec,
        outcome: "timeout_paused",
      });
      await this.stores.phases.openPlannedWork(trx, {
        id: workPhaseId,
        sessionId: session.id,
        cycleIndex: work.cycleIndex,
        plannedDurationSec: work.plannedDurationSec,
        plannedEndAt: work.plannedEndAt,
        startedAt: work.startedAt,
      });
      this.openPauseSliceId = await this.persistPauseOpen(
        trx,
        work,
        this.pausePersistCtx(session, workPhaseId, work.cycleIndex),
      );
      await this.syncRuntime(trx, session, timeoutMs, workPhaseId);
    });
    return true;
  }

  /** Rest end → short-rest ack, or session complete after long rest. */
  private async advanceRest(
    session: ActiveSession,
    phase: RestPhase,
    nowMs: number,
  ): Promise<boolean> {
    if (isBeforeDeadline(phase.plannedEndAt, nowMs)) return false;
    const restEndedAtMs = parseIso(phase.plannedEndAt);
    const restPhaseId = this.currentPhaseId!;
    this.commitRest(session, phase, restEndedAtMs);

    if (phase.kind === "short_rest") {
      this.emitAlerts("short_rest_end");
      const { phase: ack, phaseId: ackPhaseId } = this.enterShortRestAckPhase(
        session,
        phase,
        restEndedAtMs,
      );

      await this.stores.session.transaction(async (trx) => {
        await this.stores.phases.completeRest(trx, restPhaseId, {
          endedAt: msToIso(restEndedAtMs),
          actualDurationSec: phase.plannedDurationSec,
          endedReason: "completed",
        });
        await this.stores.phases.openShortRestAck(trx, {
          id: ackPhaseId,
          sessionId: session.id,
          cycleIndex: ack.cycleIndex,
          startedAt: ack.startedAt,
          decisionEndsAt: ack.decisionEndsAt,
          decisionWindowSec: ack.decisionWindowSec,
        });
        await this.syncRuntime(trx, session, restEndedAtMs, ackPhaseId);
      });
      return true;
    }

    this.emitAlerts("long_rest_end");
    await this.stores.session.transaction(async (trx) => {
      await this.stores.phases.completeRest(trx, restPhaseId, {
        endedAt: msToIso(restEndedAtMs),
        actualDurationSec: phase.plannedDurationSec,
        endedReason: "completed",
      });
      await this.syncRuntime(trx, session, restEndedAtMs, restPhaseId);
      await this.stores.session.finalizeSession(
        trx,
        session.id,
        msToIso(restEndedAtMs),
      );
      await this.stores.session.clearRuntime(trx);
    });
    this.completeSession();
    return true;
  }

  /** Drop the in-memory session (engine becomes idle). */
  private completeSession(): void {
    this.session = null;
    this.pausePlugin = null;
    this.currentPhaseId = null;
    this.openPauseSliceId = null;
  }

  /** Clear alert history and seq after delivery when a session has ended. */
  private resetAlertState(): void {
    this.alertLog = [];
    this.alertSeq = 0;
    for (const listener of this.listeners) {
      this.listenerCursors.set(listener, 0);
    }
  }

  /** Throw unless a session is running. */
  private requireActive(): ActiveSession {
    if (!this.session) {
      throw new SessionError("No active session", "NO_SESSION");
    }
    return this.session;
  }

  /** Throw unless the current phase matches `kind`; returns the narrowed phase. */
  private requirePhase<K extends Phase["kind"]>(
    session: ActiveSession,
    kind: K,
    message: string,
  ): Extract<Phase, { kind: K }> {
    if (session.phase.kind !== kind) {
      throw new SessionError(message, "INVALID_PHASE");
    }
    return session.phase as Extract<Phase, { kind: K }>;
  }
}
