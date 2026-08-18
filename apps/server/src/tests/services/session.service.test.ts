import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SettingsError,
  SettingsService,
} from "../../services/settings.service.js";
import { SessionService } from "../../services/session.service.js";

const SESSION_START_MS = Date.parse("2026-07-12T10:00:00.000Z");

/** Settings + session with short timers so tests can advance by seconds, not minutes. */
function servicesWithShortTimers(cyclesBeforeLongRest = 2): {
  settings: SettingsService;
  session: SessionService;
} {
  const settings = new SettingsService();
  settings.update({
    workDurationSec: 60,
    shortRestDurationSec: 60,
    longRestDurationSec: 120,
    cyclesBeforeLongRest,
    decisionWindowSec: 15,
  });
  return { settings, session: new SessionService() };
}

/** Resolve params from settings and start a session at the given clock. */
function startSession(
  settings: SettingsService,
  session: SessionService,
  nowMs: number,
  overrides?: Parameters<SettingsService["resolveSessionParams"]>[0],
  debug?: Parameters<SettingsService["resolveSessionParams"]>[1],
) {
  const params = settings.resolveSessionParams(overrides, debug);
  return session.start(params, nowMs, settings.get().workPauseStrategy);
}

/** Tick to nowMs and return the active phase (asserting the session is running). */
function activePhase(session: SessionService, nowMs: number) {
  const snapshot = session.getSnapshot(nowMs, session.getAlertSeq());
  assert.equal(snapshot.status, "active");
  if (snapshot.status !== "active") throw new Error("expected active");
  return snapshot.session.phase;
}

/** Alert ids emitted after sinceSeq at the given clock. */
function alertsSince(
  session: SessionService,
  nowMs: number,
  sinceSeq: number,
): string[] {
  const snapshot = session.getSnapshot(nowMs, sinceSeq);
  if (snapshot.status === "idle") {
    return snapshot.pendingAlerts.map((alertEvent) => alertEvent.id);
  }
  return snapshot.session.pendingAlerts.map((alertEvent) => alertEvent.id);
}

describe("SessionService", () => {
  it("happy path N=2: ack → short rest → auto work → long rest → idle", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, SESSION_START_MS);

    let phase = activePhase(session, SESSION_START_MS);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 1);

    const seqBeforeWorkEnd = session.getAlertSeq();
    const afterWork = SESSION_START_MS + 60_000;
    phase = activePhase(session, afterWork);
    assert.equal(phase.kind, "decision");
    assert.ok(
      alertsSince(session, afterWork, seqBeforeWorkEnd).includes(
        "work_planned_end",
      ),
    );

    const ack = session.ackRest(afterWork + 1_000);
    phase = activePhase(session, afterWork + 1_000);
    assert.equal(phase.kind, "short_rest");
    assert.equal(phase.cycleIndex, 1);
    assert.ok(ack.status === "active");
    if (ack.status === "active") {
      assert.ok(
        ack.session.pendingAlerts.some(
          (alertEvent) => alertEvent.id === "short_rest_start",
        ),
      );
    }

    const seqBeforeShortEnd = session.getAlertSeq();
    const afterShort = afterWork + 1_000 + 60_000;
    phase = activePhase(session, afterShort);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    assert.ok(
      alertsSince(session, afterShort, seqBeforeShortEnd).includes(
        "short_rest_end",
      ),
    );

    const afterWork2 = afterShort + 60_000;
    phase = activePhase(session, afterWork2);
    assert.equal(phase.kind, "decision");
    session.ackRest(afterWork2 + 500);
    phase = activePhase(session, afterWork2 + 500);
    assert.equal(phase.kind, "long_rest");

    const seqBeforeLongEnd = session.getAlertSeq();
    const afterLong = afterWork2 + 500 + 120_000;
    const snapshot = session.getSnapshot(afterLong, seqBeforeLongEnd);
    assert.equal(snapshot.status, "idle");
    assert.ok(
      snapshot.pendingAlerts.some(
        (alertEvent) => alertEvent.id === "long_rest_end",
      ),
    );
    assert.equal(session.getAlertSeq(), 0);
  });

  it("resets alertSeq after session end; new session alerts start at 1", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, SESSION_START_MS);
    session.getSnapshot(SESSION_START_MS + 60_000, 0);
    session.ackRest(SESSION_START_MS + 60_500);
    session.getSnapshot(SESSION_START_MS + 60_500 + 120_000, 0);
    assert.equal(session.getAlertSeq(), 0);

    startSession(settings, session, SESSION_START_MS + 200_000);
    const seqBefore = session.getAlertSeq();
    session.getSnapshot(SESSION_START_MS + 200_000 + 60_000, seqBefore);
    assert.equal(session.getAlertSeq(), 1);
    const snapshot = session.getSnapshot(
      SESSION_START_MS + 200_000 + 60_000,
      seqBefore,
    );
    assert.ok(
      (snapshot.status === "active"
        ? snapshot.session.pendingAlerts
        : snapshot.pendingAlerts
      ).some(
        (alertEvent) =>
          alertEvent.id === "work_planned_end" && alertEvent.seq === 1,
      ),
    );
  });

  it("decision timeout → extended → start rest without extended-end alert", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, SESSION_START_MS);

    const afterWork = SESSION_START_MS + 60_000;
    let phase = activePhase(session, afterWork);
    assert.equal(phase.kind, "decision");

    const seqBeforeDecisionEnd = session.getAlertSeq();
    const afterDecision = afterWork + 15_000;
    phase = activePhase(session, afterDecision);
    assert.equal(phase.kind, "extended_work");
    // Timeout: decision window is part of extended (startedAt = decision start).
    assert.equal(phase.startedAt, new Date(afterWork).toISOString());
    assert.ok(
      alertsSince(session, afterDecision, seqBeforeDecisionEnd).includes(
        "extended_work_auto_start",
      ),
    );

    const startRestSnapshot = session.startRest(afterDecision + 5_000);
    phase = activePhase(session, afterDecision + 5_000);
    assert.equal(phase.kind, "long_rest");
    assert.equal(startRestSnapshot.status, "active");
    if (startRestSnapshot.status !== "active")
      throw new Error("expected active");
    assert.ok(
      !startRestSnapshot.session.pendingAlerts.some(
        (alertEvent) => alertEvent.id === "extended_work_auto_start",
      ),
    );
    assert.ok(
      startRestSnapshot.session.pendingAlerts.some(
        (alertEvent) => alertEvent.id === "long_rest_start",
      ),
    );
  });

  it("continue from decision starts extended at click (decision time excluded)", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    activePhase(session, afterWork);
    const clickAt = afterWork + 5_000;
    session.continueExtended(clickAt);
    const phase = activePhase(session, clickAt);
    assert.equal(phase.kind, "extended_work");
    assert.equal(phase.startedAt, new Date(clickAt).toISOString());
  });

  it("soft pause mid-work keeps planned end unchanged", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, SESSION_START_MS);
    const plannedEnd = (
      activePhase(session, SESSION_START_MS) as { plannedEndAt: string }
    ).plannedEndAt;

    session.pause(SESSION_START_MS + 20_000);
    let phase = activePhase(session, SESSION_START_MS + 20_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.timerFrozenAt, null);
    assert.equal(phase.plannedEndAt, plannedEnd);

    session.resume(SESSION_START_MS + 30_000);
    phase = activePhase(session, SESSION_START_MS + 30_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, false);
    assert.equal(phase.plannedEndAt, plannedEnd);
    assert.equal(phase.pausedSec, 10);

    phase = activePhase(session, SESSION_START_MS + 60_000);
    assert.equal(phase.kind, "decision");
  });

  it("soft-paused through planned end → auto rest, skip decision", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, SESSION_START_MS);
    session.pause(SESSION_START_MS + 40_000);

    const seqBefore = session.getAlertSeq();
    const atEnd = SESSION_START_MS + 60_000;
    const phase = activePhase(session, atEnd);
    assert.equal(phase.kind, "short_rest");
    const ids = alertsSince(session, atEnd, seqBefore);
    assert.ok(ids.includes("work_planned_end"));
    assert.ok(ids.includes("short_rest_start"));
    assert.ok(!ids.includes("extended_work_auto_start"));
  });

  it("N=1 → long rest only after first work path", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, SESSION_START_MS);

    session.getSnapshot(SESSION_START_MS + 60_000, session.getAlertSeq());
    session.ackRest(SESSION_START_MS + 60_500);
    const phase = activePhase(session, SESSION_START_MS + 60_500);
    assert.equal(phase.kind, "long_rest");
    assert.equal(phase.cycleIndex, 1);
  });

  it("tick catch-up walks all due boundaries until blocked", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, SESSION_START_MS);
    // Past work end and decision window → extended (two advances in one tick).
    const phase = activePhase(session, SESSION_START_MS + 60_000 + 15_000);
    assert.equal(phase.kind, "extended_work");
  });

  it("starts with 1s durations when debug.shortDurations is enabled", () => {
    const settings = new SettingsService();
    const session = new SessionService();
    const params = settings.resolveSessionParams(
      {
        workDurationSec: 1,
        shortRestDurationSec: 1,
        longRestDurationSec: 1,
        decisionWindowSec: 1,
        cyclesBeforeLongRest: 1,
      },
      { shortDurations: true },
    );
    const snapshot = session.start(params, SESSION_START_MS);
    assert.equal(snapshot.status, "active");
    if (snapshot.status !== "active") throw new Error("expected active");
    assert.equal(snapshot.session.params.workDurationSec, 1);
    assert.equal(snapshot.session.params.decisionWindowSec, 1);
  });

  it("rejects 1s durations without shortDurations flag", () => {
    const settings = new SettingsService();
    assert.throws(
      () =>
        settings.resolveSessionParams({
          workDurationSec: 1,
          shortRestDurationSec: 1,
          longRestDurationSec: 1,
          decisionWindowSec: 1,
        }),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        assert.equal(error.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });
});
