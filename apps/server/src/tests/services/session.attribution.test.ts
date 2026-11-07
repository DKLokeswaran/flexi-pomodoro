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

describe("SessionService segment attribution (SQLite)", () => {
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

  it("decision timeout deletes decision and folds window into extended (FR-FLOW-11)", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    assert.equal(await session.tickIfIdle(T0 + 75_000, false), true);

    const snap = session.getSnapshot(T0 + 75_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "extended_work");
    assert.equal(snap.session.phase.startedAt, new Date(T0 + 60_000).toISOString());

    assert.equal((await db("decision").select("*")).length, 0);
    const planned = await db("planned_work").first();
    assert.equal(planned.endedReason, "planned_complete");
    const extended = await db("extended_work").first();
    assert.ok(extended);
    assert.equal(extended.startedAt, planned.endedAt);
    assert.equal(extended.endedAt, null);
  });

  it("continue persists closed decision and opens extended at click", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    const clickAt = T0 + 65_000;
    await session.continueExtended(clickAt);

    const decisions = await db("decision").select("*");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].outcome, "continue");
    assert.equal(decisions[0].durationSec, 5);
    assert.ok(decisions[0].endedAt);

    const extended = await db("extended_work").first();
    assert.equal(extended.startedAt, new Date(clickAt).toISOString());
    assert.equal(extended.endedAt, null);
  });

  it("ackRest persists closed decision and opens short rest", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    const ackAt = T0 + 63_000;
    await session.ackRest(ackAt);

    const decisions = await db("decision").select("*");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].outcome, "ack_rest");

    const rest = await db("rest").first();
    assert.ok(rest);
    assert.equal(rest.endedAt, null);
    const kindRow = await db("phases").where({ id: rest.id }).first();
    assert.equal(kindRow.kind, "short_rest");
  });

  it("soft-paused through planned end auto-rests with no decision row", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    await session.pause(T0 + 20_000);
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);

    const snap = session.getSnapshot(T0 + 60_000);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "short_rest");

    assert.equal((await db("decision").select("*")).length, 0);
    const planned = await db("planned_work").first();
    assert.equal(planned.endedReason, "soft_paused_auto_rest");
    const slices = await db("pause_slices").select("*");
    assert.equal(slices.length, 1);
    assert.ok(slices[0].endedAt);
  });

  it("short_rest_ack timeout persists timeout_paused and opens paused work", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    assert.equal(await session.tickIfIdle(T0 + 61_000 + 60_000, false), true);
    const timeoutAt = T0 + 61_000 + 60_000 + 15_000;
    assert.equal(await session.tickIfIdle(timeoutAt, false), true);

    const snap = session.getSnapshot(timeoutAt);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    assert.equal(snap.session.phase.cycleIndex, 2);
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, true);

    const acks = await db("short_rest_ack").select("*");
    assert.equal(acks.length, 1);
    assert.equal(acks[0].outcome, "timeout_paused");
    assert.equal(acks[0].durationSec, 15);
  });

  it("short_rest_ack ackWork persists acknowledged and opens running work", async () => {
    const { session, db } = await openEngine();
    await session.start(SHORT_PARAMS, T0, "soft");
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    assert.equal(await session.tickIfIdle(T0 + 61_000 + 60_000, false), true);
    const ackAt = T0 + 61_000 + 60_000 + 5_000;
    await session.ackWork(ackAt);

    const snap = session.getSnapshot(ackAt);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") return;
    assert.equal(snap.session.phase.kind, "planned_work");
    if (snap.session.phase.kind !== "planned_work") return;
    assert.equal(snap.session.phase.paused, false);

    const acks = await db("short_rest_ack").select("*");
    assert.equal(acks[0].outcome, "acknowledged");
  });

  it("long rest timer end closes rest completed and clears runtime", async () => {
    const { session, db } = await openEngine();
    await session.start(
      { ...SHORT_PARAMS, cyclesBeforeLongRest: 1 },
      T0,
      "soft",
    );
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    assert.equal(await session.tickIfIdle(T0 + 61_000 + 120_000, false), true);

    assert.equal(session.getSnapshot(T0 + 61_000 + 120_000).status, "idle");
    const rest = await db("rest").first();
    assert.equal(rest.endedReason, "completed");
    assert.equal(await db("session_runtime").first(), undefined);
  });

  it("early end long rest persists long_rest_skipped_early", async () => {
    const { session, db } = await openEngine();
    await session.start(
      { ...SHORT_PARAMS, cyclesBeforeLongRest: 1 },
      T0,
      "soft",
    );
    assert.equal(await session.tickIfIdle(T0 + 60_000, false), true);
    await session.ackRest(T0 + 61_000);
    const earlyAt = T0 + 61_000 + 30_000;
    await session.endLongRest(earlyAt);

    assert.equal(session.getSnapshot(earlyAt).status, "idle");
    const rest = await db("rest").first();
    assert.equal(rest.endedReason, "long_rest_skipped_early");
    assert.equal(rest.actualDurationSec, 30);
  });
});
