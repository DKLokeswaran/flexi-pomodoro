import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SettingsError,
  SettingsService,
} from "../../services/settings.service.js";
import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import {
  SessionError,
  SessionService,
} from "../../services/session.service.js";
import { createMockSessionStores } from "../helpers/mockSessionStores.js";
import { createMockSettingsStore } from "../helpers/mockSettingsStore.js";

const SESSION_START_MS = Date.parse("2026-07-12T10:00:00.000Z");

/** Settings + session with mocked stores (no SQLite). */
async function openMockSessionServices(): Promise<{
  settings: SettingsService;
  session: SessionService;
}> {
  const settings = new SettingsService(createMockSettingsStore());
  await settings.hydrate();
  const session = new SessionService(createMockSessionStores());
  return { settings, session };
}

/** Settings + session with short timers so tests can advance by seconds, not minutes. */
async function servicesWithShortTimers(cyclesBeforeLongRest = 2): Promise<{
  settings: SettingsService;
  session: SessionService;
}> {
  const ctx = await openMockSessionServices();
  await ctx.settings.update({
    workDurationSec: 60,
    shortRestDurationSec: 60,
    longRestDurationSec: 120,
    cyclesBeforeLongRest,
    decisionWindowSec: 15,
  });
  return { settings: ctx.settings, session: ctx.session };
}

/** Resolve params from settings and start a session at the given clock. */
async function startSession(
  settings: SettingsService,
  session: SessionService,
  nowMs: number,
  overrides?: Parameters<SettingsService["resolveSessionParams"]>[0],
  debug?: Parameters<SettingsService["resolveSessionParams"]>[1],
) {
  const params = settings.resolveSessionParams(overrides, debug);
  return session.start(params, nowMs, settings.get().workPauseStrategy);
}

/**
 * Advance wall-clock with tickIfIdle, then read a pure snapshot.
 * Engine tests that advance time must catch up before getSnapshot.
 */
async function activePhase(session: SessionService, nowMs: number) {
  assert.equal(await session.tickIfIdle(nowMs, false), true);
  const snapshot = session.getSnapshot(nowMs, session.getAlertSeq());
  assert.equal(snapshot.status, "active");
  if (snapshot.status !== "active") throw new Error("expected active");
  return snapshot.session.phase;
}

/** Alert ids emitted after sinceSeq at the given clock (catch-up then snapshot). */
async function alertsSince(
  session: SessionService,
  nowMs: number,
  sinceSeq: number,
): string[] {
  assert.equal(await session.tickIfIdle(nowMs, false), true);
  const snapshot = session.getSnapshot(nowMs, sinceSeq);
  if (snapshot.status === "idle") {
    return snapshot.pendingAlerts.map((alertEvent) => alertEvent.id);
  }
  return snapshot.session.pendingAlerts.map((alertEvent) => alertEvent.id);
}

/**
 * Drive cycle-1 work → decision → short rest → short_rest_ack.
 * Returns the short-rest end clock (ack window start).
 */
async function reachShortRestAck(
  settings: SettingsService,
  session: SessionService,
  startMs: number,
): Promise<number> {
  await startSession(settings, session, startMs);
  const afterWork = startMs + 60_000;
  await activePhase(session, afterWork);
  const restStart = afterWork + 1_000;
  await session.ackRest(restStart);
  const afterShort = restStart + 60_000;
  const phase = await activePhase(session, afterShort);
  assert.equal(phase.kind, "short_rest_ack");
  return afterShort;
}

/** Active-session liveStats at nowMs (catch-up then full overlay). */
async function liveStatsAt(session: SessionService, nowMs: number) {
  assert.equal(await session.tickIfIdle(nowMs, false), true);
  const snapshot = session.getSnapshot(nowMs, 0);
  assert.equal(snapshot.status, "active");
  if (snapshot.status !== "active") throw new Error("expected active");
  return snapshot.session.liveStats;
}

/** Catch-up then read snapshot (for idle/active assertions). */
async function snapshotAt(
  session: SessionService,
  nowMs: number,
  sinceSeq = 0,
) {
  assert.equal(await session.tickIfIdle(nowMs, false), true);
  return session.getSnapshot(nowMs, sinceSeq);
}

describe("SessionService", () => {
  it("happy path N=2: ack → short rest → ack work → long rest → idle", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);

    let phase = await activePhase(session, SESSION_START_MS);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 1);

    const seqBeforeWorkEnd = session.getAlertSeq();
    const afterWork = SESSION_START_MS + 60_000;
    phase = await activePhase(session, afterWork);
    assert.equal(phase.kind, "decision");
    assert.ok(
      (await alertsSince(session, afterWork, seqBeforeWorkEnd)).includes(
        "work_planned_end",
      ),
    );

    const ack = await session.ackRest(afterWork + 1_000);
    phase = await activePhase(session, afterWork + 1_000);
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
    phase = await activePhase(session, afterShort);
    assert.equal(phase.kind, "short_rest_ack");
    assert.equal(phase.cycleIndex, 1);
    assert.ok(
      (await alertsSince(session, afterShort, seqBeforeShortEnd)).includes(
        "short_rest_end",
      ),
    );

    await session.ackWork(afterShort + 1_000);
    phase = await activePhase(session, afterShort + 1_000);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    if (phase.kind === "planned_work") {
      assert.equal(phase.paused, false);
    }

    const afterWork2 = afterShort + 1_000 + 60_000;
    phase = await activePhase(session, afterWork2);
    assert.equal(phase.kind, "decision");
    await session.ackRest(afterWork2 + 500);
    phase = await activePhase(session, afterWork2 + 500);
    assert.equal(phase.kind, "long_rest");

    const seqBeforeLongEnd = session.getAlertSeq();
    const afterLong = afterWork2 + 500 + 120_000;
    const snapshot = await snapshotAt(session, afterLong, seqBeforeLongEnd);
    assert.equal(snapshot.status, "idle");
    assert.ok(
      snapshot.pendingAlerts.some(
        (alertEvent) => alertEvent.id === "long_rest_end",
      ),
    );
    assert.equal(session.getAlertSeq(), 0);
  });

  it("resets alertSeq after session end; new session alerts start at 1", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);
    await snapshotAt(session, SESSION_START_MS + 60_000, 0);
    await session.ackRest(SESSION_START_MS + 60_500);
    await snapshotAt(session, SESSION_START_MS + 60_500 + 120_000, 0);
    assert.equal(session.getAlertSeq(), 0);

    await startSession(settings, session, SESSION_START_MS + 200_000);
    const seqBefore = session.getAlertSeq();
    await snapshotAt(session, SESSION_START_MS + 200_000 + 60_000, seqBefore);
    assert.equal(session.getAlertSeq(), 1);
    const snapshot = await snapshotAt(
      session,
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

  it("decision timeout → extended → start rest without extended-end alert", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);

    const afterWork = SESSION_START_MS + 60_000;
    let phase = await activePhase(session, afterWork);
    assert.equal(phase.kind, "decision");

    const seqBeforeDecisionEnd = session.getAlertSeq();
    const afterDecision = afterWork + 15_000;
    phase = await activePhase(session, afterDecision);
    assert.equal(phase.kind, "extended_work");
    // Timeout: decision window is part of extended (startedAt = decision start).
    assert.equal(phase.startedAt, new Date(afterWork).toISOString());
    assert.ok(
      (
        await alertsSince(session, afterDecision, seqBeforeDecisionEnd)
      ).includes("extended_work_auto_start"),
    );

    const startRestSnapshot = await session.startRest(afterDecision + 5_000);
    phase = await activePhase(session, afterDecision + 5_000);
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

  it("decision timeout folds window into worked once (no double-count)", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);

    const afterWork = SESSION_START_MS + 60_000;
    const afterDecision = afterWork + 15_000;
    const atTimeout = await snapshotAt(session, afterDecision, 0);
    assert.equal(atTimeout.status, "active");
    if (atTimeout.status !== "active") throw new Error("expected active");
    assert.equal(atTimeout.session.phase.kind, "extended_work");
    // 60s planned + 15s folded window — not 90 (window committed and overlaid).
    assert.deepEqual(atTimeout.session.liveStats, {
      workedSec: 75,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 0,
    });

    const afterExtended = await snapshotAt(session, afterDecision + 5_000, 0);
    assert.equal(afterExtended.status, "active");
    if (afterExtended.status !== "active") throw new Error("expected active");
    assert.deepEqual(afterExtended.session.liveStats, {
      workedSec: 80,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 0,
    });

    const restSnapshot = await session.startRest(afterDecision + 5_000);
    assert.equal(restSnapshot.status, "active");
    if (restSnapshot.status !== "active") throw new Error("expected active");
    assert.deepEqual(restSnapshot.session.liveStats, {
      workedSec: 80,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 0,
    });
  });

  it("continue from decision starts extended at click (decision time excluded)", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    const clickAt = afterWork + 5_000;
    await session.continueExtended(clickAt);
    const phase = await activePhase(session, clickAt);
    assert.equal(phase.kind, "extended_work");
    assert.equal(phase.startedAt, new Date(clickAt).toISOString());
  });

  it("soft pause mid-work keeps planned end unchanged", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const plannedEnd = (
      (await activePhase(session, SESSION_START_MS)) as { plannedEndAt: string }
    ).plannedEndAt;

    await session.pause(SESSION_START_MS + 20_000);
    let phase = await activePhase(session, SESSION_START_MS + 20_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.timerFrozenAt, null);
    assert.equal(phase.plannedEndAt, plannedEnd);

    await session.resume(SESSION_START_MS + 30_000);
    phase = await activePhase(session, SESSION_START_MS + 30_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, false);
    assert.equal(phase.plannedEndAt, plannedEnd);
    assert.equal(phase.pausedSec, 10);

    phase = await activePhase(session, SESSION_START_MS + 60_000);
    assert.equal(phase.kind, "decision");
  });

  it("soft-paused through planned end → auto rest, skip decision", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    await session.pause(SESSION_START_MS + 40_000);

    const seqBefore = session.getAlertSeq();
    const atEnd = SESSION_START_MS + 60_000;
    const phase = await activePhase(session, atEnd);
    assert.equal(phase.kind, "short_rest");
    const ids = await alertsSince(session, atEnd, seqBefore);
    assert.ok(ids.includes("work_planned_end"));
    assert.ok(ids.includes("short_rest_start"));
    assert.ok(!ids.includes("extended_work_auto_start"));
  });

  it("N=1 → long rest only after first work path", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);

    await snapshotAt(session, SESSION_START_MS + 60_000, session.getAlertSeq());
    await session.ackRest(SESSION_START_MS + 60_500);
    const phase = await activePhase(session, SESSION_START_MS + 60_500);
    assert.equal(phase.kind, "long_rest");
    assert.equal(phase.cycleIndex, 1);
  });

  it("tick catch-up walks all due boundaries until blocked", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    // Past work end and decision window → extended (two advances in one tick).
    const phase = await activePhase(
      session,
      SESSION_START_MS + 60_000 + 15_000,
    );
    assert.equal(phase.kind, "extended_work");
  });

  it("starts with 1s durations when debug.shortDurations is enabled", async () => {
    const { settings, session } = await openMockSessionServices();
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
    const snapshot = await session.start(params, SESSION_START_MS);
    assert.equal(snapshot.status, "active");
    if (snapshot.status !== "active") throw new Error("expected active");
    assert.equal(snapshot.session.params.workDurationSec, 1);
    assert.equal(snapshot.session.params.decisionWindowSec, 1);
  });

  it("hard pause 3s with 10s left keeps remaining time and shifts planned end", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await settings.update({ workPauseStrategy: "hard" });
    await startSession(settings, session, SESSION_START_MS);
    const originalEnd = (
      (await activePhase(session, SESSION_START_MS)) as { plannedEndAt: string }
    ).plannedEndAt;

    const pauseAt = SESSION_START_MS + 50_000;
    await session.pause(pauseAt);
    let phase = await activePhase(session, pauseAt);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.timerFrozenAt, new Date(pauseAt).toISOString());

    const resumeAt = pauseAt + 3_000;
    await session.resume(resumeAt);
    phase = await activePhase(session, resumeAt);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, false);
    assert.equal(phase.pausedSec, 3);
    assert.equal(
      phase.plannedEndAt,
      new Date(Date.parse(originalEnd) + 3_000).toISOString(),
    );
    const remainingSec = Math.floor(
      (Date.parse(phase.plannedEndAt) - resumeAt) / 1000,
    );
    assert.equal(remainingSec, 10);
  });

  it("hard-paused past original planned end stays in planned work", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await settings.update({ workPauseStrategy: "hard" });
    await startSession(settings, session, SESSION_START_MS);
    const originalEnd = (
      (await activePhase(session, SESSION_START_MS)) as { plannedEndAt: string }
    ).plannedEndAt;
    await session.pause(SESSION_START_MS + 50_000);
    const phase = await activePhase(session, SESSION_START_MS + 61_000);
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.plannedEndAt, originalEnd);
  });

  it("soft pause liveStats pausedSec grows during pause and commits after resume", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);

    const pauseAt = SESSION_START_MS + 20_000;
    await session.pause(pauseAt);

    const duringPause = session.getSnapshot(pauseAt + 7_000, 0);
    assert.equal(duringPause.status, "active");
    if (duringPause.status !== "active") throw new Error("expected active");
    assert.equal(duringPause.session.liveStats.pausedSec, 7);
    assert.equal(duringPause.session.liveStats.workedSec, 20);

    const laterPause = session.getSnapshot(pauseAt + 12_000, 0);
    assert.equal(laterPause.status, "active");
    if (laterPause.status !== "active") throw new Error("expected active");
    assert.equal(laterPause.session.liveStats.pausedSec, 12);
    assert.equal(laterPause.session.liveStats.workedSec, 20);

    await session.resume(pauseAt + 12_000);
    const afterResume = session.getSnapshot(pauseAt + 12_000, 0);
    assert.equal(afterResume.status, "active");
    if (afterResume.status !== "active") throw new Error("expected active");
    assert.equal(afterResume.session.liveStats.pausedSec, 12);
    assert.equal(afterResume.session.liveStats.workedSec, 20);

    const afterWork = await snapshotAt(session, SESSION_START_MS + 60_000, 0);
    assert.equal(afterWork.status, "active");
    if (afterWork.status !== "active") throw new Error("expected active");
    assert.equal(afterWork.session.phase.kind, "decision");
    // 60s wall − 12s pause = 48 worked; pause committed across transition.
    assert.deepEqual(afterWork.session.liveStats, {
      workedSec: 48,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 12,
    });
  });

  it("hard pause liveStats pausedSec grows while frozen and commits after resume", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await settings.update({ workPauseStrategy: "hard" });
    await startSession(settings, session, SESSION_START_MS);

    const pauseAt = SESSION_START_MS + 50_000;
    await session.pause(pauseAt);

    const duringPause = session.getSnapshot(pauseAt + 3_000, 0);
    assert.equal(duringPause.status, "active");
    if (duringPause.status !== "active") throw new Error("expected active");
    assert.equal(duringPause.session.liveStats.pausedSec, 3);
    assert.equal(duringPause.session.liveStats.workedSec, 50);

    const laterPause = session.getSnapshot(pauseAt + 8_000, 0);
    assert.equal(laterPause.status, "active");
    if (laterPause.status !== "active") throw new Error("expected active");
    assert.equal(laterPause.session.liveStats.pausedSec, 8);
    assert.equal(laterPause.session.liveStats.workedSec, 50);

    await session.resume(pauseAt + 8_000);
    const afterResume = session.getSnapshot(pauseAt + 8_000, 0);
    assert.equal(afterResume.status, "active");
    if (afterResume.status !== "active") throw new Error("expected active");
    assert.equal(afterResume.session.liveStats.pausedSec, 8);
    assert.equal(afterResume.session.liveStats.workedSec, 50);

    const afterWork = await snapshotAt(session, pauseAt + 8_000 + 10_000, 0);
    assert.equal(afterWork.status, "active");
    if (afterWork.status !== "active") throw new Error("expected active");
    assert.equal(afterWork.session.phase.kind, "decision");
    // 50s focus before pause + 10s after resume; 8s pause committed.
    assert.deepEqual(afterWork.session.liveStats, {
      workedSec: 60,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 8,
    });
  });

  it("pause and resume rejected outside planned work (FR-PAUSE-S6)", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);

    const assertInvalidPhase = async (run: () => Promise<unknown>) => {
      await assert.rejects(run, (error: unknown) => {
        assert.ok(error instanceof SessionError);
        assert.equal(error.code, "INVALID_PHASE");
        return true;
      });
    };

    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    await assertInvalidPhase(() => session.pause(afterWork));
    await assertInvalidPhase(() => session.resume(afterWork));

    await session.continueExtended(afterWork + 1_000);
    await assertInvalidPhase(() => session.pause(afterWork + 1_000));
    await assertInvalidPhase(() => session.resume(afterWork + 1_000));

    await session.startRest(afterWork + 2_000);
    await assertInvalidPhase(() => session.pause(afterWork + 2_000));
    await assertInvalidPhase(() => session.resume(afterWork + 2_000));

    const { settings: longSettings, session: longSession } =
      await servicesWithShortTimers(1);
    await startSession(longSettings, longSession, SESSION_START_MS);
    await snapshotAt(longSession, afterWork, longSession.getAlertSeq());
    await longSession.ackRest(afterWork + 500);
    assert.equal(
      (await activePhase(longSession, afterWork + 500)).kind,
      "long_rest",
    );
    await assertInvalidPhase(() => longSession.pause(afterWork + 500));
    await assertInvalidPhase(() => longSession.resume(afterWork + 500));
  });

  it("rejects 1s durations without shortDurations flag", async () => {
    const settings = new SettingsService(createMockSettingsStore());
    await settings.hydrate();
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

  it("explicit ackWork (soft) → cycle-2 planned_work running", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const ackAt = afterShort + 3_000;
    await session.ackWork(ackAt);
    const phase = await activePhase(session, ackAt);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, false);
    assert.equal(phase.timerFrozenAt, null);
  });

  it("explicit ackWork (hard) → cycle-2 planned_work running, no freeze", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await settings.update({ workPauseStrategy: "hard" });
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const ackAt = afterShort + 3_000;
    await session.ackWork(ackAt);
    const phase = await activePhase(session, ackAt);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, false);
    assert.equal(phase.timerFrozenAt, null);
  });

  it("ack timeout (soft) → cycle-2 paused work; short_rest_ack_expired fires", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const seqBefore = session.getAlertSeq();
    const timeoutAt = afterShort + 15_000;
    const phase = await activePhase(session, timeoutAt);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.timerFrozenAt, null);
    assert.ok(
      (await alertsSince(session, timeoutAt, seqBefore)).includes(
        "short_rest_ack_expired",
      ),
    );
  });

  it("ack timeout (hard) → cycle-2 paused work with timerFrozenAt", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await settings.update({ workPauseStrategy: "hard" });
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const seqBefore = session.getAlertSeq();
    const timeoutAt = afterShort + 15_000;
    const phase = await activePhase(session, timeoutAt);
    assert.equal(phase.kind, "planned_work");
    assert.equal(phase.cycleIndex, 2);
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.paused, true);
    assert.equal(phase.timerFrozenAt, new Date(timeoutAt).toISOString());
    assert.ok(
      (await alertsSince(session, timeoutAt, seqBefore)).includes(
        "short_rest_ack_expired",
      ),
    );
  });

  it("long rest end → idle without short_rest_ack", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    await session.ackRest(afterWork + 500);
    const longRest = await activePhase(session, afterWork + 500);
    assert.equal(longRest.kind, "long_rest");

    const afterLong = afterWork + 500 + 120_000;
    const snapshot = await snapshotAt(session, afterLong, 0);
    assert.equal(snapshot.status, "idle");
  });

  it("pause and resume rejected during short_rest_ack", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    await assert.rejects(
      () => session.pause(afterShort + 1_000),
      (error: unknown) => {
        assert.ok(error instanceof SessionError);
        assert.equal(error.code, "INVALID_PHASE");
        return true;
      },
    );
    await assert.rejects(
      () => session.resume(afterShort + 1_000),
      (error: unknown) => {
        assert.ok(error instanceof SessionError);
        assert.equal(error.code, "INVALID_PHASE");
        return true;
      },
    );
  });

  it("work-decision explicit act attributes elapsed to deliberationSec", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    const clickAt = afterWork + 5_000;
    await session.ackRest(clickAt);
    const stats = await liveStatsAt(session, clickAt);
    assert.equal(stats.deliberationSec, 5);
    assert.equal(stats.workedSec, 60);
  });

  it("ackWork explicit act attributes elapsed to deliberationSec", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const ackAt = afterShort + 4_000;
    await session.ackWork(ackAt);
    const stats = await liveStatsAt(session, ackAt);
    // 1s deliberation at work-decision ackRest + 4s at short-rest ack.
    assert.equal(stats.deliberationSec, 5);
  });

  it("ack timeout attributes full window to deliberationSec", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const afterShort = await reachShortRestAck(
      settings,
      session,
      SESSION_START_MS,
    );
    const timeoutAt = afterShort + 15_000;
    const stats = await liveStatsAt(session, timeoutAt);
    // 1s at work-decision ackRest + full 15s ack window.
    assert.equal(stats.deliberationSec, 16);
    assert.equal((await activePhase(session, timeoutAt)).kind, "planned_work");
  });

  it("live stats full cycle: work, deliberation, rest; soft pause excluded from worked", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);

    // Soft-pause 10s mid work (20s–30s).
    await session.pause(SESSION_START_MS + 20_000);
    await session.resume(SESSION_START_MS + 30_000);

    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    // Soft pause keeps planned end; 60s wall − 10s pause = 50 worked.
    assert.equal((await liveStatsAt(session, afterWork)).workedSec, 50);
    assert.equal((await liveStatsAt(session, afterWork)).pausedSec, 10);

    const restStart = afterWork + 2_000;
    await session.ackRest(restStart);
    assert.equal((await liveStatsAt(session, restStart)).deliberationSec, 2);

    const afterShort = restStart + 60_000;
    await activePhase(session, afterShort);
    assert.equal((await liveStatsAt(session, afterShort)).restSec, 60);

    const ackAt = afterShort + 3_000;
    await session.ackWork(ackAt);
    const stats = await liveStatsAt(session, ackAt);
    assert.equal(stats.workedSec, 50);
    assert.equal(stats.deliberationSec, 5); // 2s decision + 3s ack
    assert.equal(stats.restSec, 60);
    assert.equal(stats.pausedSec, 10);
  });

  it("getSnapshot does not advance phases (pure read)", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const overdue = SESSION_START_MS + 60_000;
    const beforeTick = session.getSnapshot(overdue, 0);
    assert.equal(beforeTick.status, "active");
    if (beforeTick.status !== "active") throw new Error("expected active");
    assert.equal(beforeTick.session.phase.kind, "planned_work");

    assert.equal(await session.tickIfIdle(overdue, false), true);
    const afterTick = session.getSnapshot(overdue, 0);
    assert.equal(afterTick.status, "active");
    if (afterTick.status !== "active") throw new Error("expected active");
    assert.equal(afterTick.session.phase.kind, "decision");
  });

  it("tickIfIdle skips while another exclusive tick holds the mutex", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);

    let skipped = false;
    const ops: Promise<unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      ops.push(
        session.tickIfIdle(SESSION_START_MS + 1_000 + i, false).then((ran) => {
          if (!ran) skipped = true;
        }),
      );
    }
    await Promise.all(ops);
    assert.equal(skipped, true);
  });
});

/** Assert a command rejects with the given SessionError code. */
async function assertSessionError(
  run: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof SessionError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("SessionService rest lengths and rest_ack alert", () => {
  it("long rest runs for the long rest duration, not the short one", async () => {
    const { settings, session } = await servicesWithShortTimers(1);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    await session.ackRest(afterWork);

    // Short rest would end at +60s; long rest must still be running then.
    const phase = await activePhase(session, afterWork + 60_000);
    assert.equal(phase.kind, "long_rest");
    if (phase.kind !== "long_rest") throw new Error("expected long_rest");
    assert.equal(phase.plannedDurationSec, 120);
    assert.equal(
      phase.plannedEndAt,
      new Date(afterWork + 120_000).toISOString(),
    );
  });

  it("ackRest emits rest_ack before the rest-start alert", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);

    const ack = await session.ackRest(afterWork + 1_000);
    assert.equal(ack.status, "active");
    if (ack.status !== "active") throw new Error("expected active");
    assert.deepEqual(
      ack.session.pendingAlerts.map((alertEvent) => alertEvent.id),
      ["rest_ack", "short_rest_start"],
    );
  });
});

describe("SessionService command rejections", () => {
  it("pause when already paused → ALREADY_PAUSED and the open pause is kept", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const pauseAt = SESSION_START_MS + 20_000;
    await session.pause(pauseAt);

    await assertSessionError(
      () => session.pause(pauseAt + 5_000),
      "ALREADY_PAUSED",
    );
    const phase = await activePhase(session, pauseAt + 5_000);
    if (phase.kind !== "planned_work") throw new Error("expected planned_work");
    assert.equal(phase.pauseStartedAt, new Date(pauseAt).toISOString());
  });

  it("resume when not paused → NOT_PAUSED", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    await assertSessionError(
      () => session.resume(SESSION_START_MS + 5_000),
      "NOT_PAUSED",
    );
  });

  it("start while a session is running → SESSION_ACTIVE and the session is kept", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const first = await startSession(settings, session, SESSION_START_MS);
    assert.equal(first.status, "active");
    if (first.status !== "active") throw new Error("expected active");

    await assertSessionError(
      () => startSession(settings, session, SESSION_START_MS + 5_000),
      "SESSION_ACTIVE",
    );
    const snapshot = session.getSnapshot(SESSION_START_MS + 5_000);
    assert.equal(snapshot.status, "active");
    if (snapshot.status !== "active") throw new Error("expected active");
    assert.equal(snapshot.session.id, first.session.id);
    assert.equal(snapshot.session.startedAt, first.session.startedAt);
  });

  it("every action with no session → NO_SESSION", async () => {
    const { session } = await servicesWithShortTimers(2);
    const actions: Array<() => Promise<unknown>> = [
      () => session.pause(SESSION_START_MS),
      () => session.resume(SESSION_START_MS),
      () => session.ackRest(SESSION_START_MS),
      () => session.ackWork(SESSION_START_MS),
      () => session.continueExtended(SESSION_START_MS),
      () => session.startRest(SESSION_START_MS),
      () => session.endLongRest(SESSION_START_MS),
    ];
    for (const action of actions) {
      await assertSessionError(action, "NO_SESSION");
    }
  });
});

describe("SessionService subscriber updates", () => {
  /** Subscribe and collect every pushed snapshot. */
  function collectSnapshots(session: SessionService): SessionSnapshot[] {
    const received: SessionSnapshot[] = [];
    session.subscribe((snapshot) => received.push(snapshot));
    return received;
  }

  /** Phase kind of the last pushed snapshot ("idle" when no session). */
  function lastPhaseKind(received: SessionSnapshot[]): string {
    const last = received.at(-1);
    assert.ok(last, "expected at least one pushed snapshot");
    return last.status === "active" ? last.session.phase.kind : "idle";
  }

  it("pushes a snapshot to subscribers after every command", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const received = collectSnapshots(session);

    await startSession(settings, session, SESSION_START_MS);
    assert.equal(received.length, 1);
    assert.equal(lastPhaseKind(received), "planned_work");

    await session.pause(SESSION_START_MS + 10_000);
    assert.equal(received.length, 2);
    const paused = received[1];
    assert.ok(paused.status === "active");
    assert.ok(
      paused.session.phase.kind === "planned_work" &&
        paused.session.phase.paused,
    );

    await session.resume(SESSION_START_MS + 20_000);
    assert.equal(received.length, 3);

    const afterWork = SESSION_START_MS + 60_000;
    assert.equal(await session.tickIfIdle(afterWork, false), true);
    await session.continueExtended(afterWork + 1_000);
    assert.equal(received.length, 4);
    assert.equal(lastPhaseKind(received), "extended_work");

    await session.startRest(afterWork + 2_000);
    assert.equal(received.length, 5);
    assert.equal(lastPhaseKind(received), "short_rest");

    const afterShort = afterWork + 2_000 + 60_000;
    assert.equal(await session.tickIfIdle(afterShort, false), true);
    await session.ackWork(afterShort + 1_000);
    assert.equal(received.length, 6);
    assert.equal(lastPhaseKind(received), "planned_work");

    const afterWork2 = afterShort + 1_000 + 60_000;
    assert.equal(await session.tickIfIdle(afterWork2, false), true);
    await session.ackRest(afterWork2 + 1_000);
    assert.equal(received.length, 7);
    assert.equal(lastPhaseKind(received), "long_rest");

    await session.endLongRest(afterWork2 + 2_000);
    assert.equal(received.length, 8);
    assert.equal(lastPhaseKind(received), "idle");
  });

  it("pushes a snapshot with the new alerts when a scheduler tick changes phase", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const received = collectSnapshots(session);

    // Nothing due yet: no push.
    assert.equal(await session.tickIfIdle(SESSION_START_MS + 30_000), true);
    assert.equal(received.length, 0);

    assert.equal(await session.tickIfIdle(SESSION_START_MS + 60_000), true);
    assert.equal(received.length, 1);
    const pushed = received[0];
    assert.ok(pushed.status === "active");
    assert.equal(pushed.session.phase.kind, "decision");
    assert.deepEqual(
      pushed.session.pendingAlerts.map((alertEvent) => alertEvent.id),
      ["work_planned_end"],
    );
  });

  it("stops pushing after unsubscribe", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    const received: SessionSnapshot[] = [];
    const unsubscribe = session.subscribe((snapshot) =>
      received.push(snapshot),
    );
    await startSession(settings, session, SESSION_START_MS);
    unsubscribe();
    await session.pause(SESSION_START_MS + 10_000);
    assert.equal(received.length, 1);
  });
});

describe("SessionService snapshot totals inside the open phase", () => {
  it("deliberation grows during the decision and short-rest ack windows", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    assert.equal(
      (await liveStatsAt(session, afterWork + 7_000)).deliberationSec,
      7,
    );

    await session.ackRest(afterWork + 10_000);
    const afterShort = afterWork + 10_000 + 60_000;
    // 10s committed at the decision + 4s open in the ack window.
    assert.equal(
      (await liveStatsAt(session, afterShort + 4_000)).deliberationSec,
      14,
    );
  });

  it("rest grows during an open rest and stops at its planned end", async () => {
    const { settings, session } = await servicesWithShortTimers(2);
    await startSession(settings, session, SESSION_START_MS);
    const afterWork = SESSION_START_MS + 60_000;
    await activePhase(session, afterWork);
    await session.ackRest(afterWork);

    assert.equal((await liveStatsAt(session, afterWork + 25_000)).restSec, 25);

    // Pure read past the planned end, before any tick closes the rest.
    const overdue = session.getSnapshot(afterWork + 90_000, 0);
    assert.equal(overdue.status, "active");
    if (overdue.status !== "active") throw new Error("expected active");
    assert.equal(overdue.session.phase.kind, "short_rest");
    assert.equal(overdue.session.liveStats.restSec, 60);
  });
});
