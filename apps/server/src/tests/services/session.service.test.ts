import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsError, SettingsService } from "../../services/settings.service.js";
import { SessionService } from "../../services/session.service.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");

function servicesWithShortTimers(n = 2): {
  settings: SettingsService;
  session: SessionService;
} {
  const settings = new SettingsService();
  settings.update({
    workDurationSec: 60,
    shortRestDurationSec: 60,
    longRestDurationSec: 120,
    cyclesBeforeLongRest: n,
    decisionWindowSec: 15,
  });
  return { settings, session: new SessionService() };
}

function startSession(
  settings: SettingsService,
  session: SessionService,
  now: number,
  overrides?: Parameters<SettingsService["resolveSessionParams"]>[0],
  debug?: Parameters<SettingsService["resolveSessionParams"]>[1],
) {
  const params = settings.resolveSessionParams(overrides, debug);
  return session.start(params, now);
}

function activePhase(session: SessionService, now: number) {
  const snap = session.getSnapshot(now, session.getAlertSeq());
  assert.equal(snap.status, "active");
  if (snap.status !== "active") throw new Error("expected active");
  return snap.session.phase;
}

function alertsSince(
  session: SessionService,
  now: number,
  sinceSeq: number,
): string[] {
  const snap = session.getSnapshot(now, sinceSeq);
  if (snap.status === "idle") {
    return snap.pendingAlerts.map((a) => a.id);
  }
  return snap.session.pendingAlerts.map((a) => a.id);
}

describe("SessionService", () => {
  it("happy path N=2: ack → short rest → auto work → long rest → idle", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, T0);

    let phase = activePhase(session, T0);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 1);

    const seqBeforeWorkEnd = session.getAlertSeq();
    const afterWork = T0 + 60_000;
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
        ack.session.pendingAlerts.some((a) => a.id === "short_rest_start"),
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
    const snap = session.getSnapshot(afterLong, seqBeforeLongEnd);
    assert.equal(snap.status, "idle");
    assert.ok(snap.pendingAlerts.some((a) => a.id === "long_rest_end"));
    assert.equal(session.getAlertSeq(), 0);
  });

  it("resets alertSeq after session end; new session alerts start at 1", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, T0);
    session.getSnapshot(T0 + 60_000, 0);
    session.ackRest(T0 + 60_500);
    session.getSnapshot(T0 + 60_500 + 120_000, 0);
    assert.equal(session.getAlertSeq(), 0);

    startSession(settings, session, T0 + 200_000);
    const seqBefore = session.getAlertSeq();
    session.getSnapshot(T0 + 200_000 + 60_000, seqBefore);
    assert.equal(session.getAlertSeq(), 1);
    const snap = session.getSnapshot(T0 + 200_000 + 60_000, seqBefore);
    assert.ok(
      (snap.status === "active"
        ? snap.session.pendingAlerts
        : snap.pendingAlerts
      ).some((a) => a.id === "work_planned_end" && a.seq === 1),
    );
  });

  it("decision timeout → extended → start rest without extended-end alert", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, T0);

    const afterWork = T0 + 60_000;
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

    const startRestSnap = session.startRest(afterDecision + 5_000);
    phase = activePhase(session, afterDecision + 5_000);
    assert.equal(phase.kind, "long_rest");
    assert.equal(startRestSnap.status, "active");
    if (startRestSnap.status !== "active") throw new Error("expected active");
    assert.ok(
      !startRestSnap.session.pendingAlerts.some(
        (a) => a.id === "extended_work_auto_start",
      ),
    );
    assert.ok(
      startRestSnap.session.pendingAlerts.some(
        (a) => a.id === "long_rest_start",
      ),
    );
  });

  it("continue from decision starts extended at click (decision time excluded)", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, T0);
    const afterWork = T0 + 60_000;
    activePhase(session, afterWork);
    const clickAt = afterWork + 5_000;
    session.continueExtended(clickAt);
    const phase = activePhase(session, clickAt);
    assert.equal(phase.kind, "extended_work");
    assert.equal(phase.startedAt, new Date(clickAt).toISOString());
  });

  it("soft pause mid-work keeps planned end unchanged", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, T0);
    const plannedEnd = (activePhase(session, T0) as { plannedEndAt: string })
      .plannedEndAt;

    session.softPause(T0 + 20_000);
    let phase = activePhase(session, T0 + 20_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.softPaused, true);
    assert.equal(phase.plannedEndAt, plannedEnd);

    session.softResume(T0 + 30_000);
    phase = activePhase(session, T0 + 30_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.softPaused, false);
    assert.equal(phase.plannedEndAt, plannedEnd);
    assert.equal(phase.softPausedSec, 10);

    phase = activePhase(session, T0 + 60_000);
    assert.equal(phase.kind, "decision");
  });

  it("soft-paused through planned end → auto rest, skip decision", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, T0);
    session.softPause(T0 + 40_000);

    const seqBefore = session.getAlertSeq();
    const atEnd = T0 + 60_000;
    const phase = activePhase(session, atEnd);
    assert.equal(phase.kind, "short_rest");
    const ids = alertsSince(session, atEnd, seqBefore);
    assert.ok(ids.includes("work_planned_end"));
    assert.ok(ids.includes("short_rest_start"));
    assert.ok(!ids.includes("extended_work_auto_start"));
  });

  it("N=1 → long rest only after first work path", () => {
    const { settings, session } = servicesWithShortTimers(1);
    startSession(settings, session, T0);

    session.getSnapshot(T0 + 60_000, session.getAlertSeq());
    session.ackRest(T0 + 60_500);
    const phase = activePhase(session, T0 + 60_500);
    assert.equal(phase.kind, "long_rest");
    assert.equal(phase.cycleIndex, 1);
  });

  it("tick catch-up walks all due boundaries until blocked", () => {
    const { settings, session } = servicesWithShortTimers(2);
    startSession(settings, session, T0);
    // Past work end and decision window → extended (two advances in one tick).
    const phase = activePhase(session, T0 + 60_000 + 15_000);
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
    const snap = session.start(params, T0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");
    assert.equal(snap.session.params.workDurationSec, 1);
    assert.equal(snap.session.params.decisionWindowSec, 1);
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
      (err: unknown) => {
        assert.ok(err instanceof SettingsError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });
});
