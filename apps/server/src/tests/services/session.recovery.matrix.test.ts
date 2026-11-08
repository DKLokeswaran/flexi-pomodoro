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
});
