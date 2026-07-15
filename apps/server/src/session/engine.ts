import {
  type ActiveSession,
  type AlertEvent,
  type AlertId,
  type DecisionPhase,
  type ExtendedWorkPhase,
  type PlannedWorkPhase,
  type RestKind,
  type RestPhase,
  type DebugFlags,
  type SessionOverrides,
  type SessionParams,
  type SessionSnapshot,
  type Settings,
  DEFAULT_SETTINGS,
  mergeSessionParams,
  parseSettingsPatch,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";

export class SessionError extends Error {
  constructor(
    message: string,
    readonly code: string = "SESSION_ERROR",
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export function toSessionError(err: unknown): SessionError {
  if (err instanceof SessionError) return err;
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join("; ") || "Invalid input";
    return new SessionError(msg, "INVALID_SETTINGS");
  }
  throw err;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function parseIso(value: string): number {
  return Date.parse(value);
}

function startPlannedWork(
  params: SessionParams,
  cycleIndex: number,
  nowMs: number,
): PlannedWorkPhase {
  return {
    kind: "planned_work",
    cycleIndex,
    startedAt: iso(nowMs),
    plannedDurationSec: params.workDurationSec,
    plannedEndAt: iso(nowMs + params.workDurationSec * 1000),
    softPaused: false,
    softPausedSec: 0,
    softPauseStartedAt: null,
  };
}

function restKindForCycle(
  params: SessionParams,
  cycleIndex: number,
): RestKind {
  return cycleIndex >= params.cyclesBeforeLongRest ? "long_rest" : "short_rest";
}

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
    startedAt: iso(nowMs),
    plannedDurationSec,
    plannedEndAt: iso(nowMs + plannedDurationSec * 1000),
  };
}

function closeSoftPauseIfActive(phase: PlannedWorkPhase, nowMs: number): void {
  if (!phase.softPaused || !phase.softPauseStartedAt) return;
  const started = parseIso(phase.softPauseStartedAt);
  const end = Math.min(nowMs, parseIso(phase.plannedEndAt));
  phase.softPausedSec += Math.max(0, Math.floor((end - started) / 1000));
  phase.softPaused = false;
  phase.softPauseStartedAt = null;
}

export type SnapshotListener = (snapshot: SessionSnapshot) => void;

export class SessionEngine {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private session: ActiveSession | null = null;
  /** Append-only alert log; clients receive deltas only. */
  private alertLog: AlertEvent[] = [];
  private alertSeq = 0;
  private listeners = new Set<SnapshotListener>();
  /** Per-listener delivery cursor (last seq sent). */
  private listenerCursors = new WeakMap<SnapshotListener, number>();

  getSettings(): Settings {
    return { ...this.settings };
  }

  updateSettings(partial: unknown): Settings {
    try {
      this.settings = parseSettingsPatch(this.settings, partial);
    } catch (err) {
      throw toSessionError(err);
    }
    return this.getSettings();
  }

  subscribe(listener: SnapshotListener, sinceSeq = 0): () => void {
    this.listeners.add(listener);
    this.listenerCursors.set(listener, sinceSeq);
    return () => {
      this.listeners.delete(listener);
      this.listenerCursors.delete(listener);
    };
  }

  private notify(): void {
    const nowMs = Date.now();
    for (const listener of this.listeners) {
      const since = this.listenerCursors.get(listener) ?? 0;
      const snapshot = this.buildSnapshot(nowMs, since);
      const alertSeq =
        snapshot.status === "idle"
          ? snapshot.alertSeq
          : snapshot.session.alertSeq;
      this.listenerCursors.set(listener, alertSeq);
      listener(snapshot);
    }
  }

  private emitAlerts(...alerts: AlertId[]): void {
    for (const id of alerts) {
      this.alertSeq += 1;
      this.alertLog.push({ seq: this.alertSeq, id });
    }
  }

  private alertsSince(sinceSeq: number): AlertEvent[] {
    return this.alertLog.filter((a) => a.seq > sinceSeq);
  }

  getAlertSeq(): number {
    return this.alertSeq;
  }

  private buildSnapshot(nowMs: number, sinceSeq: number): SessionSnapshot {
    const pendingAlerts = this.alertsSince(sinceSeq);
    if (!this.session) {
      return {
        status: "idle",
        serverNow: iso(nowMs),
        pendingAlerts,
        alertSeq: this.alertSeq,
      };
    }
    return {
      status: "active",
      serverNow: iso(nowMs),
      session: {
        ...this.session,
        params: { ...this.session.params },
        phase: structuredClone(this.session.phase),
        pendingAlerts,
        alertSeq: this.alertSeq,
      },
    };
  }

  getSnapshot(nowMs: number = Date.now(), sinceSeq = 0): SessionSnapshot {
    this.tick(nowMs, false);
    return this.buildSnapshot(nowMs, sinceSeq);
  }

  start(
    overrides?: SessionOverrides,
    nowMs: number = Date.now(),
    opts?: { debug?: DebugFlags },
  ): SessionSnapshot {
    if (this.session) {
      throw new SessionError("A session is already active", "SESSION_ACTIVE");
    }
    const seqAtStart = this.alertSeq;
    let params: SessionParams;
    try {
      params = mergeSessionParams(this.settings, overrides, {
        debug: opts?.debug,
      });
    } catch (err) {
      throw toSessionError(err);
    }
    this.session = {
      id: randomUUID(),
      status: "active",
      startedAt: iso(nowMs),
      params,
      pauseStrategy: "soft",
      phase: startPlannedWork(params, 1, nowMs),
      pendingAlerts: [],
      alertSeq: this.alertSeq,
    };
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  softPause(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    const phase = session.phase;
    if (phase.kind !== "planned_work") {
      throw new SessionError(
        "Soft pause is only available during planned work",
        "INVALID_PHASE",
      );
    }
    if (phase.softPaused) {
      throw new SessionError("Already soft-paused", "ALREADY_PAUSED");
    }
    if (nowMs >= parseIso(phase.plannedEndAt)) {
      throw new SessionError("Planned work already ended", "INVALID_PHASE");
    }
    phase.softPaused = true;
    phase.softPauseStartedAt = iso(nowMs);
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  softResume(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    const phase = session.phase;
    if (phase.kind !== "planned_work") {
      throw new SessionError(
        "Soft resume is only available during planned work",
        "INVALID_PHASE",
      );
    }
    if (!phase.softPaused) {
      throw new SessionError("Not soft-paused", "NOT_PAUSED");
    }
    closeSoftPauseIfActive(phase, nowMs);
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  ackRest(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    if (session.phase.kind !== "decision") {
      throw new SessionError(
        "Acknowledge rest is only valid in decision",
        "INVALID_PHASE",
      );
    }
    this.enterRestFromWork(session, nowMs, ["rest_ack"]);
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  continueExtended(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    if (session.phase.kind !== "decision") {
      throw new SessionError("Continue is only valid in decision", "INVALID_PHASE");
    }
    const decision = session.phase as DecisionPhase;
    session.phase = {
      kind: "extended_work",
      cycleIndex: decision.cycleIndex,
      startedAt: iso(nowMs),
    } satisfies ExtendedWorkPhase;
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  startRest(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    if (session.phase.kind !== "extended_work") {
      throw new SessionError(
        "Start rest is only valid during extended work",
        "INVALID_PHASE",
      );
    }
    this.enterRestFromWork(session, nowMs, []);
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  endLongRest(nowMs: number = Date.now()): SessionSnapshot {
    const seqAtStart = this.alertSeq;
    const session = this.requireActive();
    this.tick(nowMs, false);
    if (session.phase.kind !== "long_rest") {
      throw new SessionError(
        "Early end is only valid during long rest",
        "INVALID_PHASE",
      );
    }
    this.completeSession();
    this.notify();
    return this.buildSnapshot(nowMs, seqAtStart);
  }

  /**
   * Advance through all wall-clock boundaries that have already passed.
   * Stops when the current phase has no due transition (or session ends).
   * A high iteration guard only protects against advanceOnce bugs.
   */
  tick(nowMs: number = Date.now(), notify = true): void {
    if (!this.session) return;

    let changed = false;
    const maxIterations = 10_000;
    for (let i = 0; i < maxIterations; i++) {
      if (!this.session) break;
      const advanced = this.advanceOnce(this.session, nowMs);
      if (!advanced) break;
      changed = true;
    }

    if (changed && notify) {
      this.notify();
    }
  }

  private enterRestFromWork(
    session: ActiveSession,
    nowMs: number,
    alerts: AlertId[],
  ): void {
    const cycleIndex = session.phase.cycleIndex;
    const rest = startRest(session.params, cycleIndex, nowMs);
    session.phase = rest;
    const restEntry: AlertId =
      rest.kind === "long_rest" ? "long_rest_start" : "short_rest_start";
    this.emitAlerts(...alerts, restEntry);
  }

  private advanceOnce(session: ActiveSession, nowMs: number): boolean {
    const phase = session.phase;

    if (phase.kind === "planned_work") {
      if (nowMs < parseIso(phase.plannedEndAt)) {
        return false;
      }
      const wasSoftPaused = phase.softPaused;
      const plannedEndMs = parseIso(phase.plannedEndAt);
      closeSoftPauseIfActive(phase, plannedEndMs);
      if (wasSoftPaused) {
        this.enterRestFromWork(session, plannedEndMs, ["work_planned_end"]);
        return true;
      }
      const decisionEndsAt =
        plannedEndMs + session.params.decisionWindowSec * 1000;
      session.phase = {
        kind: "decision",
        cycleIndex: phase.cycleIndex,
        startedAt: phase.plannedEndAt,
        decisionEndsAt: iso(decisionEndsAt),
        decisionWindowSec: session.params.decisionWindowSec,
      };
      this.emitAlerts("work_planned_end");
      return true;
    }

    if (phase.kind === "decision") {
      if (nowMs < parseIso(phase.decisionEndsAt)) {
        return false;
      }
      session.phase = {
        kind: "extended_work",
        cycleIndex: phase.cycleIndex,
        startedAt: phase.decisionEndsAt,
      };
      this.emitAlerts("extended_work_auto_start");
      return true;
    }

    if (phase.kind === "extended_work") {
      return false;
    }

    if (phase.kind === "short_rest" || phase.kind === "long_rest") {
      if (nowMs < parseIso(phase.plannedEndAt)) {
        return false;
      }
      const endAt = parseIso(phase.plannedEndAt);
      if (phase.kind === "short_rest") {
        this.emitAlerts("short_rest_end");
        session.phase = startPlannedWork(
          session.params,
          phase.cycleIndex + 1,
          endAt,
        );
        return true;
      }
      this.emitAlerts("long_rest_end");
      this.completeSession();
      return true;
    }

    return false;
  }

  private completeSession(): void {
    this.session = null;
  }

  private requireActive(): ActiveSession {
    if (!this.session) {
      throw new SessionError("No active session", "NO_SESSION");
    }
    return this.session;
  }
}
