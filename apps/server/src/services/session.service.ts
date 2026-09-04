import {
  type ActiveSession,
  type AlertEvent,
  type AlertId,
  type DecisionPhase,
  type Phase,
  type PlannedWorkPhase,
  type RestKind,
  type RestPhase,
  type SessionLiveStats,
  type SessionParams,
  type SessionSnapshot,
  type WorkPauseStrategy as PauseStrategyId,
} from "@flexi-pomodoro/shared";
import { randomUUID } from "node:crypto";
import {
  defaultPauseRegistry,
  PauseStrategyRegistry,
  type WorkPauseStrategy,
} from "../pause/index.js";
import { elapsedSecFromIso, msToIso, parseIso } from "../utils/iso.js";

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
function restKindForCycle(params: SessionParams, cycleIndex: number): RestKind {
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

/**
 * Focus seconds in planned work up to endMs.
 * Wall elapsed minus total paused time (closed + open) — same for soft and hard.
 */
function plannedWorkSecAt(phase: PlannedWorkPhase, endMs: number): number {
  let pauseSec = phase.pausedSec;
  if (phase.paused && phase.pauseStartedAt) {
    pauseSec += elapsedSecFromIso(phase.pauseStartedAt, endMs);
  }
  return elapsedSecFromIso(phase.startedAt, endMs) - pauseSec;
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

/** Enter extended work; startedAtMs is click time or decision start (timeout). */
function enterExtendedWork(
  session: ActiveSession,
  cycleIndex: number,
  startedAtMs: number,
): void {
  session.phase = {
    kind: "extended_work",
    cycleIndex,
    startedAt: msToIso(startedAtMs),
  };
}

/** Called with a snapshot whenever the engine notifies subscribers. */
export type SnapshotListener = (snapshot: SessionSnapshot) => void;

/** In-memory session engine: phases, alerts, and snapshot subscribers. */
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

  constructor(
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

  /** Tick without notifying, then return the live session for a mutating command. */
  private beginActiveCommand(nowMs: number): {
    session: ActiveSession;
    seqAtStart: number;
  } {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
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

  /** Tick due transitions, then return a snapshot; reset alerts if now idle. */
  getSnapshot(nowMs: number = Date.now(), sinceSeq = 0): SessionSnapshot {
    this.tick(nowMs, false);
    const snapshot = this.buildSnapshot(nowMs, sinceSeq);
    if (!this.session) {
      this.resetAlertState();
    }
    return snapshot;
  }

  /** Start a new session in planned work; fails if one is already active. */
  start(
    params: SessionParams,
    nowMs: number = Date.now(),
    pauseStrategy: PauseStrategyId = "soft",
  ): SessionSnapshot {
    if (this.session) {
      throw new SessionError("A session is already active", "SESSION_ACTIVE");
    }
    const seqAtStart = this.alertSeq;
    this.pausePlugin = this.pauseRegistry.get(pauseStrategy)!;
    this.session = {
      id: randomUUID(),
      status: "active",
      startedAt: msToIso(nowMs),
      params,
      pauseStrategy,
      phase: startPlannedWork(params, 1, nowMs),
      liveStats: { workedSec: 0, deliberationSec: 0, restSec: 0 },
      pendingAlerts: [],
      alertSeq: this.alertSeq,
    };
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Pause planned work via the session's pause strategy. */
  pause(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
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
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** End an active pause via the session's pause strategy. */
  resume(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    const phase = this.requirePhase(
      session,
      "planned_work",
      "Resume is only available during planned work",
    );
    if (!phase.paused) {
      throw new SessionError("Not paused", "NOT_PAUSED");
    }
    this.pausePlugin!.onResume(phase, nowMs);
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Work decision: user chooses rest. */
  ackRest(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    this.requirePhase(
      session,
      "decision",
      "Acknowledge rest is only valid in decision",
    );
    addDeliberation(session, session.phase as DecisionPhase, nowMs);
    this.enterRestFromWork(session, nowMs, ["rest_ack"]);
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Short-rest ack: user acknowledges; next cycle starts running. */
  ackWork(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    this.requirePhase(
      session,
      "short_rest_ack",
      "Acknowledge work is only valid in short-rest ack",
    );
    const phase = session.phase as DecisionPhase;
    addDeliberation(session, phase, nowMs);
    session.phase = startPlannedWork(
      session.params,
      phase.cycleIndex + 1,
      nowMs,
    );
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Work decision: user continues; extended work starts at the click. */
  continueExtended(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    this.requirePhase(
      session,
      "decision",
      "Continue is only valid in decision",
    );
    const phase = session.phase as DecisionPhase;
    addDeliberation(session, phase, nowMs);
    enterExtendedWork(session, phase.cycleIndex, nowMs);
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Extended work: user starts rest (no extra end-of-extended alert). */
  startRest(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    const phase = this.requirePhase(
      session,
      "extended_work",
      "Start rest is only valid during extended work",
    );
    session.liveStats.workedSec += elapsedSecFromIso(phase.startedAt, nowMs);
    this.enterRestFromWork(session, nowMs, []);
    return this.notifyAndSnapshot(nowMs, seqAtStart);
  }

  /** Long rest: end early, complete the session, then reset alert history. */
  endLongRest(nowMs: number = Date.now()): SessionSnapshot {
    const { session, seqAtStart } = this.beginActiveCommand(nowMs);
    this.requirePhase(
      session,
      "long_rest",
      "Early end is only valid during long rest",
    );
    this.completeSession();
    const snapshot = this.buildSnapshot(nowMs, seqAtStart);
    this.notify();
    this.resetAlertState();
    return snapshot;
  }

  /**
   * Advance through every due wall-clock boundary. Iteration cap is a safety net.
   */
  tick(nowMs: number = Date.now(), notify = true): void {
    if (!this.session) return;

    let changed = false;
    const maxIterations = 10_000;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (!this.session) break;
      const advanced = this.advanceOnce(this.session, nowMs);
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

  /** Move from work into rest and emit the matching rest-start alert. */
  private enterRestFromWork(
    session: ActiveSession,
    nowMs: number,
    alerts: AlertId[],
  ): void {
    const cycleIndex = session.phase.cycleIndex;
    const rest = startRest(session.params, cycleIndex, nowMs);
    session.phase = rest;
    const restEntryAlert: AlertId =
      rest.kind === "long_rest" ? "long_rest_start" : "short_rest_start";
    this.emitAlerts(...alerts, restEntryAlert);
  }

  private commitPlannedWork(
    session: ActiveSession,
    phase: PlannedWorkPhase,
    endMs: number,
  ): void {
    session.liveStats.workedSec += plannedWorkSecAt(phase, endMs);
  }

  private commitRest(
    session: ActiveSession,
    phase: RestPhase,
    endMs: number,
  ): void {
    session.liveStats.restSec += restSecAt(phase, endMs);
  }

  /** Apply at most one due phase transition; false if nothing is due. */
  private advanceOnce(session: ActiveSession, nowMs: number): boolean {
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
  private advancePlannedWork(
    session: ActiveSession,
    phase: PlannedWorkPhase,
    nowMs: number,
  ): boolean {
    if (this.pausePlugin!.isCountdownFrozen(phase)) return false;
    if (isBeforeDeadline(phase.plannedEndAt, nowMs)) return false;
    const plannedEndMs = parseIso(phase.plannedEndAt);
    const action = this.pausePlugin!.onPlannedEnd(phase, plannedEndMs);
    this.commitPlannedWork(session, phase, plannedEndMs);
    if (action === "rest") {
      this.enterRestFromWork(session, plannedEndMs, ["work_planned_end"]);
      return true;
    }
    this.enterDecisionPhase(session, phase, plannedEndMs);
    return true;
  }

  /** Open the work-decision window starting at planned work's end. */
  private enterDecisionPhase(
    session: ActiveSession,
    plannedWork: PlannedWorkPhase,
    plannedEndMs: number,
  ): void {
    const decisionEndsAtMs =
      plannedEndMs + session.params.decisionWindowSec * 1000;
    session.phase = {
      kind: "decision",
      cycleIndex: plannedWork.cycleIndex,
      startedAt: plannedWork.plannedEndAt,
      decisionEndsAt: msToIso(decisionEndsAtMs),
      decisionWindowSec: session.params.decisionWindowSec,
    };
    this.emitAlerts("work_planned_end");
  }

  /**
   * Work-decision timeout: full window folds into extended work (FR-FLOW-11).
   * Keep startedAt at decision start; liveStats progress covers the window once.
   */
  private advanceWorkDecision(
    session: ActiveSession,
    phase: DecisionPhase,
    nowMs: number,
  ): boolean {
    if (isBeforeDeadline(phase.decisionEndsAt, nowMs)) return false;
    enterExtendedWork(session, phase.cycleIndex, parseIso(phase.startedAt));
    this.emitAlerts("extended_work_auto_start");
    return true;
  }

  /** Open short-rest ack window after short rest ends. */
  private enterShortRestAckPhase(
    session: ActiveSession,
    restPhase: RestPhase,
    restEndedAtMs: number,
  ): void {
    session.phase = {
      kind: "short_rest_ack",
      cycleIndex: restPhase.cycleIndex,
      startedAt: msToIso(restEndedAtMs),
      decisionEndsAt: msToIso(
        restEndedAtMs + session.params.decisionWindowSec * 1000,
      ),
      decisionWindowSec: session.params.decisionWindowSec,
    };
  }

  /**
   * Short-rest ack timeout: deliberation for the window, then next work paused.
   */
  private advanceShortRestAck(
    session: ActiveSession,
    phase: DecisionPhase,
    nowMs: number,
  ): boolean {
    if (isBeforeDeadline(phase.decisionEndsAt, nowMs)) return false;
    const timeoutMs = parseIso(phase.decisionEndsAt);
    session.liveStats.deliberationSec += phase.decisionWindowSec;
    this.emitAlerts("short_rest_ack_expired");
    const work = startPlannedWork(
      session.params,
      phase.cycleIndex + 1,
      timeoutMs,
    );
    session.phase = work;
    this.pausePlugin!.onPause(work, timeoutMs);
    return true;
  }

  /** Rest end → short-rest ack, or session complete after long rest. */
  private advanceRest(
    session: ActiveSession,
    phase: RestPhase,
    nowMs: number,
  ): boolean {
    if (isBeforeDeadline(phase.plannedEndAt, nowMs)) return false;
    const restEndedAtMs = parseIso(phase.plannedEndAt);
    this.commitRest(session, phase, restEndedAtMs);
    if (phase.kind === "short_rest") {
      this.emitAlerts("short_rest_end");
      this.enterShortRestAckPhase(session, phase, restEndedAtMs);
      return true;
    }
    this.emitAlerts("long_rest_end");
    this.completeSession();
    return true;
  }

  /** Drop the in-memory session (engine becomes idle). */
  private completeSession(): void {
    this.session = null;
    this.pausePlugin = null;
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
