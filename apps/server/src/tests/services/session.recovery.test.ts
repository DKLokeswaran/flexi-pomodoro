import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  SessionError,
  SessionService,
} from "../../services/session.service.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");

const SHORT_PARAMS = {
  workDurationSec: 60,
  shortRestDurationSec: 60,
  cyclesBeforeLongRest: 2,
  longRestDurationSec: 120,
  decisionWindowSec: 15,
} as const;

describe("SessionService boot hydrate + recovery", () => {
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

  it("hydrate restores alertSeq from session_runtime", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    // Advance to decision so alerts were emitted and persisted.
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    const seqBefore = session.getAlertSeq();
    assert.ok(seqBefore > 0);

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    assert.equal(mid.getAlertSeq(), seqBefore);
    const snap = mid.getSnapshot(T0 + 60_000, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.alertSeq, seqBefore);
  });

  it("recovery tick past planned end closes work with endedReason recovery", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    // Still inside decision window after work end (T0+60s + 5s).
    await mid.runRecoveryTick(T0 + 65_000);

    const snap = mid.getSnapshot(T0 + 65_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "decision");

    const planned = await db("planned_work").select("*");
    assert.equal(planned.length, 1);
    assert.equal(planned[0].endedReason, "recovery");
    assert.ok(planned[0].endedAt);
  });

  it("recoveryTick flag resets so later closes use live endedReason", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(
      { ...SHORT_PARAMS, cyclesBeforeLongRest: 1 },
      T0,
      "soft",
    );

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    await mid.runRecoveryTick(T0 + 80_000); // → extended_work
    let snap = mid.getSnapshot(T0 + 80_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "extended_work");

    const restAt = T0 + 90_000;
    await mid.startRest(restAt);
    snap = mid.getSnapshot(restAt);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "long_rest");

    // Normal scheduler-style tick after boot recovery must not use "recovery".
    assert.equal(await mid.tickIfIdle(restAt + 120_000, false), true);
    snap = mid.getSnapshot(restAt + 120_000);
    assert.equal(snap.status, "idle");

    const rest = await db("rest").first();
    assert.ok(rest);
    assert.equal(rest.endedReason, "completed");
  });

  it("recovery that completes the session clears session_runtime", async () => {
    const { session, stores } = await openEngine();
    await session.start(
      { ...SHORT_PARAMS, cyclesBeforeLongRest: 1 },
      T0,
      "soft",
    );
    await session.pause(T0 + 20_000);

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    // Soft-paused through planned end → auto long rest → past rest end → idle.
    await mid.runRecoveryTick(T0 + 60_000 + 120_000);

    const snap = mid.getSnapshot(T0 + 180_000);
    assert.equal(snap.status, "idle");
    assert.equal(await stores.session.getRuntime(), null);
  });

  it("hydrate restores soft-paused planned work and open pause slice", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    await session.pause(T0 + 20_000);

    const openBefore = await db("pause_slices")
      .whereNull("endedAt")
      .first();
    assert.ok(openBefore);

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    const snap = mid.getSnapshot(T0 + 25_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, true);
    assert.ok(snap.session.phase.pauseStartedAt);

    const openAfterHydrate = await db("pause_slices")
      .whereNull("endedAt")
      .first();
    assert.ok(openAfterHydrate);
    assert.equal(openAfterHydrate.id, openBefore.id);

    // Prove openPauseSliceId was restored: resume must close that same slice.
    await mid.resume(T0 + 30_000);
    const stillOpen = await db("pause_slices").whereNull("endedAt").first();
    assert.equal(stillOpen, undefined);
    const closed = await db("pause_slices").where({ id: openBefore.id }).first();
    assert.ok(closed.endedAt);
  });

  it("recovery does not advance hard-paused work past original planned end", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "hard");
    const before = session.getSnapshot(T0 + 20_000);
    assert.equal(before.status, "active");
    if (before.status !== "active") return;
    assert.equal(before.session.phase.kind, "planned_work");
    if (before.session.phase.kind !== "planned_work") return;
    const originalEnd = before.session.phase.plannedEndAt;

    await session.pause(T0 + 20_000);

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    await mid.runRecoveryTick(T0 + 90_000);

    const snap = mid.getSnapshot(T0 + 90_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, true);
    assert.ok(snap.session.phase.timerFrozenAt);
    assert.equal(snap.session.phase.plannedEndAt, originalEnd);
  });

  it("hard ack timeout catch-up past next plannedEnd stays frozen planned_work", async () => {
    const { session, stores } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "hard");

    const afterWork = T0 + 60_000;
    assert.equal(await session.tickIfIdle(afterWork, false), true);
    await session.ackRest(afterWork + 1_000);
    const afterShort = afterWork + 1_000 + 60_000;
    assert.equal(await session.tickIfIdle(afterShort, false), true);
    let snap = session.getSnapshot(afterShort);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest_ack");

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    assert.equal(await mid.hydrateFromStore(), true);
    // Ack window 15s + full 60s work + 30s past that planned end.
    const recoveryAt = afterShort + 15_000 + 60_000 + 30_000;
    await mid.runRecoveryTick(recoveryAt);

    snap = mid.getSnapshot(recoveryAt);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    assert.equal(snap.session.phase.cycleIndex, 2);
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, true);
    assert.ok(snap.session.phase.timerFrozenAt);
    assert.ok(Date.parse(snap.session.phase.plannedEndAt) < recoveryAt);
  });

  it("CORRUPT_RUNTIME abandon clears runtime and surfaces idle notice", async () => {
    const { session, stores, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    const runtime = await stores.session.getRuntime();
    assert.ok(runtime);

    // Runtime still points at a session that is no longer active.
    await db("sessions")
      .where({ id: runtime.sessionId })
      .update({ status: "completed", completedAt: new Date(T0).toISOString() });

    const mid = new SessionService({
      session: stores.session,
      phases: stores.phases,
    });
    await assert.rejects(
      () => mid.hydrateFromStore(),
      (error: unknown) =>
        error instanceof SessionError && error.code === "CORRUPT_RUNTIME",
    );

    await mid.abandonCorruptRuntime(T0 + 1_000);
    assert.equal(await stores.session.getRuntime(), null);
    const row = await stores.session.getSession(runtime.sessionId);
    assert.equal(row?.status, "interrupted");

    const snap = mid.getSnapshot(T0 + 1_000);
    assert.equal(snap.status, "idle");
    if (snap.status !== "idle") return;
    assert.match(
      snap.recoveryAbandonedMessage ?? "",
      /could not be recovered/i,
    );
  });
});
