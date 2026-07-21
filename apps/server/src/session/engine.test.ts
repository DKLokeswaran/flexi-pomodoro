import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SessionEngine, SessionError } from "./engine.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");

function engineWithShortTimers(n = 2): SessionEngine {
  const engine = new SessionEngine();
  engine.updateSettings({
    workDurationSec: 60,
    shortRestDurationSec: 60,
    longRestDurationSec: 120,
    cyclesBeforeLongRest: n,
    decisionWindowSec: 15,
  });
  return engine;
}

function activePhase(engine: SessionEngine, now: number) {
  const snap = engine.getSnapshot(now, engine.getAlertSeq());
  assert.equal(snap.status, "active");
  if (snap.status !== "active") throw new Error("expected active");
  return snap.session.phase;
}

function alertsSince(
  engine: SessionEngine,
  now: number,
  sinceSeq: number,
): string[] {
  const snap = engine.getSnapshot(now, sinceSeq);
  if (snap.status === "idle") {
    return snap.pendingAlerts.map((a) => a.id);
  }
  return snap.session.pendingAlerts.map((a) => a.id);
}

describe("SessionEngine", () => {
  it("happy path N=2: ack → short rest → auto work → long rest → idle", () => {
    const engine = engineWithShortTimers(2);
    engine.start(undefined, T0);

    let phase = activePhase(engine, T0);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 1);

    const seqBeforeWorkEnd = engine.getAlertSeq();
    const afterWork = T0 + 60_000;
    phase = activePhase(engine, afterWork);
    assert.equal(phase.kind, "decision");
    assert.ok(
      alertsSince(engine, afterWork, seqBeforeWorkEnd).includes(
        "work_planned_end",
      ),
    );

    const ack = engine.ackRest(afterWork + 1_000);
    phase = activePhase(engine, afterWork + 1_000);
    assert.equal(phase.kind, "short_rest");
    assert.equal(phase.cycleIndex, 1);
    assert.ok(ack.status === "active");
    if (ack.status === "active") {
      assert.ok(
        ack.session.pendingAlerts.some((a) => a.id === "short_rest_start"),
      );
    }

    const seqBeforeShortEnd = engine.getAlertSeq();
    const afterShort = afterWork + 1_000 + 60_000;
    phase = activePhase(engine, afterShort);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    assert.ok(
      alertsSince(engine, afterShort, seqBeforeShortEnd).includes(
        "short_rest_end",
      ),
    );

    const afterWork2 = afterShort + 60_000;
    phase = activePhase(engine, afterWork2);
    assert.equal(phase.kind, "decision");
    engine.ackRest(afterWork2 + 500);
    phase = activePhase(engine, afterWork2 + 500);
    assert.equal(phase.kind, "long_rest");

    const seqBeforeLongEnd = engine.getAlertSeq();
    const afterLong = afterWork2 + 500 + 120_000;
    const snap = engine.getSnapshot(afterLong, seqBeforeLongEnd);
    assert.equal(snap.status, "idle");
    assert.ok(snap.pendingAlerts.some((a) => a.id === "long_rest_end"));
    assert.equal(engine.getAlertSeq(), 0);
  });

  it("resets alertSeq after session end; new session alerts start at 1", () => {
    const engine = engineWithShortTimers(1);
    engine.start(undefined, T0);
    engine.getSnapshot(T0 + 60_000, 0);
    engine.ackRest(T0 + 60_500);
    engine.getSnapshot(T0 + 60_500 + 120_000, 0);
    assert.equal(engine.getAlertSeq(), 0);

    engine.start(undefined, T0 + 200_000);
    const seqBefore = engine.getAlertSeq();
    engine.getSnapshot(T0 + 200_000 + 60_000, seqBefore);
    assert.equal(engine.getAlertSeq(), 1);
    const snap = engine.getSnapshot(T0 + 200_000 + 60_000, seqBefore);
    assert.ok(
      (snap.status === "active"
        ? snap.session.pendingAlerts
        : snap.pendingAlerts
      ).some((a) => a.id === "work_planned_end" && a.seq === 1),
    );
  });

  it("decision timeout → extended → start rest without extended-end alert", () => {
    const engine = engineWithShortTimers(1);
    engine.start(undefined, T0);

    const afterWork = T0 + 60_000;
    let phase = activePhase(engine, afterWork);
    assert.equal(phase.kind, "decision");

    const seqBeforeDecisionEnd = engine.getAlertSeq();
    const afterDecision = afterWork + 15_000;
    phase = activePhase(engine, afterDecision);
    assert.equal(phase.kind, "extended_work");
    assert.ok(
      alertsSince(engine, afterDecision, seqBeforeDecisionEnd).includes(
        "extended_work_auto_start",
      ),
    );

    const startRestSnap = engine.startRest(afterDecision + 5_000);
    phase = activePhase(engine, afterDecision + 5_000);
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

  it("soft pause mid-work keeps planned end unchanged", () => {
    const engine = engineWithShortTimers(2);
    engine.start(undefined, T0);
    const plannedEnd = (activePhase(engine, T0) as { plannedEndAt: string })
      .plannedEndAt;

    engine.softPause(T0 + 20_000);
    let phase = activePhase(engine, T0 + 20_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.softPaused, true);
    assert.equal(phase.plannedEndAt, plannedEnd);

    engine.softResume(T0 + 30_000);
    phase = activePhase(engine, T0 + 30_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.softPaused, false);
    assert.equal(phase.plannedEndAt, plannedEnd);
    assert.equal(phase.softPausedSec, 10);

    phase = activePhase(engine, T0 + 60_000);
    assert.equal(phase.kind, "decision");
  });

  it("soft-paused through planned end → auto rest, skip decision", () => {
    const engine = engineWithShortTimers(2);
    engine.start(undefined, T0);
    engine.softPause(T0 + 40_000);

    const seqBefore = engine.getAlertSeq();
    const atEnd = T0 + 60_000;
    const phase = activePhase(engine, atEnd);
    assert.equal(phase.kind, "short_rest");
    const ids = alertsSince(engine, atEnd, seqBefore);
    assert.ok(ids.includes("work_planned_end"));
    assert.ok(ids.includes("short_rest_start"));
    assert.ok(!ids.includes("extended_work_auto_start"));
  });

  it("rejects hard pause strategy and invalid settings", () => {
    const engine = engineWithShortTimers(2);
    assert.throws(
      () => engine.updateSettings({ workPauseStrategy: "hard" as "soft" }),
      (err: unknown) => {
        assert.ok(err instanceof SessionError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
    assert.throws(
      () => engine.updateSettings({ cyclesBeforeLongRest: 3.5 }),
      (err: unknown) => {
        assert.ok(err instanceof SessionError);
        return true;
      },
    );
  });

  it("N=1 → long rest only after first work path", () => {
    const engine = engineWithShortTimers(1);
    engine.start(undefined, T0);

    engine.getSnapshot(T0 + 60_000, engine.getAlertSeq());
    engine.ackRest(T0 + 60_500);
    const phase = activePhase(engine, T0 + 60_500);
    assert.equal(phase.kind, "long_rest");
    assert.equal(phase.cycleIndex, 1);
  });

  it("tick catch-up walks all due boundaries until blocked", () => {
    const engine = engineWithShortTimers(2);
    engine.start(undefined, T0);
    // Past work end and decision window → extended (two advances in one tick).
    const phase = activePhase(engine, T0 + 60_000 + 15_000);
    assert.equal(phase.kind, "extended_work");
  });

  it("starts with 1s durations when debug.shortDurations is enabled", () => {
    const engine = new SessionEngine();
    const snap = engine.start(
      {
        workDurationSec: 1,
        shortRestDurationSec: 1,
        longRestDurationSec: 1,
        decisionWindowSec: 1,
        cyclesBeforeLongRest: 1,
      },
      T0,
      { debug: { shortDurations: true } },
    );
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");
    assert.equal(snap.session.params.workDurationSec, 1);
    assert.equal(snap.session.params.decisionWindowSec, 1);
  });

  it("rejects 1s durations without shortDurations flag", () => {
    const engine = new SessionEngine();
    assert.throws(
      () =>
        engine.start(
          {
            workDurationSec: 1,
            shortRestDurationSec: 1,
            longRestDurationSec: 1,
            decisionWindowSec: 1,
          },
          T0,
        ),
      (err: unknown) => {
        assert.ok(err instanceof SessionError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });

  it("rejects sub-minute work in settings even when short timers are desired", () => {
    const engine = new SessionEngine();
    assert.throws(
      () => engine.updateSettings({ workDurationSec: 1 }),
      (err: unknown) => {
        assert.ok(err instanceof SessionError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });
});
