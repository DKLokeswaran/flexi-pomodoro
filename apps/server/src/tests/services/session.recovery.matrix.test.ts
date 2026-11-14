import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { SessionService } from "../../services/session.service.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");

const SHORT_PARAMS = {
  workDurationSec: 60,
  shortRestDurationSec: 60,
  cyclesBeforeLongRest: 2,
  longRestDurationSec: 120,
  decisionWindowSec: 15,
} as const;

/** Q9 Option A — strict wall-clock catch-up on boot hydrate + recovery tick. */
describe("Q9 S1–S8 recovery matrix", () => {
  const disposers: Array<() => Promise<void>> = [];

  after(async () => {
    while (disposers.length > 0) {
      await disposers.pop()!();
    }
  });

  async function openEngine() {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);
    const session = new SessionService({
      session: ctx.stores.session,
      phases: ctx.stores.phases,
    });
    return { ...ctx, session };
  }

  async function reboot(stores: {
    session: ConstructorParameters<typeof SessionService>[0]["session"];
    phases: ConstructorParameters<typeof SessionService>[0]["phases"];
  }) {
    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    return mid;
  }

  it("S3: down through short rest → short_rest_ack (still in window)", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    const mid = await reboot(stores);
    // Rest ends at T0+61+60; +5s still inside 15s ack window.
    const now = T0 + 61_000 + 60_000 + 5_000;
    await mid.runRecoveryTick(now);
    const snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest_ack");
    const rest = await db("rest").first();
    assert.equal(rest.endedReason, "recovery");
  });

  it("S5: down through long rest end → idle session complete", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(
      { ...SHORT_PARAMS, cyclesBeforeLongRest: 1 },
      T0,
      "soft",
    );
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    const mid = await reboot(stores);
    const now = T0 + 61_000 + 120_000;
    await mid.runRecoveryTick(now);
    assert.equal(mid.getSnapshot(now).status, "idle");
    const rest = await db("rest").first();
    assert.equal(rest.endedReason, "recovery");
    assert.equal(await stores.session.getRuntime(), null);
  });

  it("S6: down during extended work → still extended; overtime includes downtime", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 75_000, false), true);
    let snap = session.getSnapshot(T0 + 75_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "extended_work");
    const extendedStart = snap.session.phase.startedAt;

    const mid = await reboot(stores);
    const now = T0 + 75_000 + 120_000;
    await mid.runRecoveryTick(now);
    snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "extended_work");
    assert.equal(snap.session.phase.startedAt, extendedStart);
    // Worked includes planned 60s + extended from decision start through now.
    assert.ok(snap.session.liveStats.workedSec >= 60 + 120);
  });

  it("S7: soft-pause downtime is included in pausedSec", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    await session.pause(T0 + 20_000);
    const mid = await reboot(stores);
    const now = T0 + 40_000;
    await mid.runRecoveryTick(now);
    const snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, true);
    assert.equal(snap.session.liveStats.pausedSec, 20);
  });

  it("S8a: down during SHORT_REST_ACK inside window → restore ack", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    assert.equal(await session.tickIfIdle(T0 + 61_000 + 60_000, false), true);
    let snap = session.getSnapshot(T0 + 61_000 + 60_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest_ack");

    const mid = await reboot(stores);
    const now = T0 + 61_000 + 60_000 + 5_000;
    await mid.runRecoveryTick(now);
    snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest_ack");
  });

  it("totals for deciding, resting and paused survive a restart", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    await session.pause(T0 + 10_000);
    await session.resume(T0 + 20_000);
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 65_000);
    const afterShort = T0 + 65_000 + 60_000;
    assert.equal(await session.tickIfIdle(afterShort, false), true);
    const workStart = afterShort + 3_000;
    await session.ackWork(workStart);

    const mid = await reboot(stores);
    const now = workStart + 10_000;
    await mid.runRecoveryTick(now);
    const snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    // Worked 50 + 10 open; deliberation 5 + 3; one full short rest; 10s pause.
    assert.deepEqual(snap.session.liveStats, {
      workedSec: 60,
      deliberationSec: 8,
      restSec: 60,
      pausedSec: 10,
    });
  });

  it("session timings come back unchanged, so rests keep their own lengths", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");

    const mid = await reboot(stores);
    await mid.runRecoveryTick(T0 + 60_000);
    let snap = mid.getSnapshot(T0 + 60_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.deepEqual(snap.session.params, SHORT_PARAMS);

    await mid.ackRest(T0 + 60_000);
    snap = mid.getSnapshot(T0 + 60_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest");
    if (snap.session.phase.kind !== "short_rest") return;
    assert.equal(snap.session.phase.plannedDurationSec, 60);
  });

  /** Extended work must start at planned end, whatever the restart time. */
  async function assertExtendedFromPlannedEnd(
    mid: SessionService,
    db: Awaited<ReturnType<typeof openEngine>>["db"],
    now: number,
  ) {
    const plannedEndIso = new Date(T0 + 60_000).toISOString();
    const snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "extended_work");
    assert.equal(snap.session.phase.startedAt, plannedEndIso);
    assert.equal(
      snap.session.liveStats.workedSec,
      60 + Math.floor((now - (T0 + 60_000)) / 1000),
    );
    assert.equal(snap.session.liveStats.deliberationSec, 0);
    const extended = await db("extended_work").first();
    assert.equal(extended.startedAt, plannedEndIso);
  }

  it("down from planned work past the decision window → extended timed from planned end", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    const mid = await reboot(stores);
    const now = T0 + 60_000 + 15_000 + 30_000;
    await mid.runRecoveryTick(now);
    await assertExtendedFromPlannedEnd(mid, db, now);
  });

  it("down during the decision window past its end → extended timed from planned end", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 65_000, false), true);
    const mid = await reboot(stores);
    const now = T0 + 60_000 + 15_000 + 30_000;
    await mid.runRecoveryTick(now);
    await assertExtendedFromPlannedEnd(mid, db, now);
  });

  it("S8b: down during SHORT_REST_ACK past the window → timeout_paused, work paused from window end", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    const ackStart = T0 + 61_000 + 60_000;
    assert.equal(await session.tickIfIdle(ackStart, false), true);

    const mid = await reboot(stores);
    const windowEnd = ackStart + 15_000;
    const now = windowEnd + 20_000;
    await mid.runRecoveryTick(now);

    const snap = mid.getSnapshot(now);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    const phase = snap.session.phase;
    assert.equal(phase.kind, "planned_work");
    if (phase.kind !== "planned_work") return;
    assert.equal(phase.cycleIndex, 2);
    assert.equal(phase.paused, true);
    assert.equal(phase.startedAt, new Date(windowEnd).toISOString());
    assert.equal(phase.pauseStartedAt, new Date(windowEnd).toISOString());
    // 1s at the work decision + the full 15s ack window; paused since window end.
    assert.equal(snap.session.liveStats.deliberationSec, 16);
    assert.equal(snap.session.liveStats.pausedSec, 20);

    const acks = await db("short_rest_ack").select("*");
    assert.equal(acks.length, 1);
    assert.equal(acks[0].outcome, "timeout_paused");
    assert.equal(acks[0].durationSec, 15);
    assert.equal(acks[0].endedAt, new Date(windowEnd).toISOString());
  });
});
