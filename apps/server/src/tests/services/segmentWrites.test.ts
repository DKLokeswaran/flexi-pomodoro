import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { openTempSessionServices } from "../helpers/tempSession.js";

const START = Date.parse("2026-07-12T10:00:00.000Z");

const disposers: Array<() => Promise<void>> = [];

after(async () => {
  while (disposers.length > 0) {
    await disposers.pop()!();
  }
});

async function engine(cyclesBeforeLongRest = 2) {
  const ctx = await openTempSessionServices();
  disposers.push(ctx.dispose);
  await ctx.settings.update({
    workDurationSec: 60,
    shortRestDurationSec: 60,
    longRestDurationSec: 120,
    cyclesBeforeLongRest,
    decisionWindowSec: 15,
  });
  const params = ctx.settings.resolveSessionParams();
  await ctx.session.start(params, START, ctx.settings.get().workPauseStrategy);
  return ctx;
}

async function catchUp(session: { tickIfIdle: Function }, nowMs: number) {
  assert.equal(await session.tickIfIdle(nowMs, false), true);
}

describe("segment write-through (FR-FLOW-11 / FR-ACK-6)", () => {
  it("decision timeout deletes decision row and opens extended from decision start", async () => {
    const { session, stores } = await engine(1);
    const afterWork = START + 60_000;
    await catchUp(session, afterWork);
    const afterDecision = afterWork + 15_000;
    await catchUp(session, afterDecision);

    const snap = session.getSnapshot(afterDecision, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");
    assert.equal(snap.session.phase.kind, "extended_work");
    assert.equal(snap.session.phase.startedAt, new Date(afterWork).toISOString());

    const decisions = await stores.phases.listDecisionRows(snap.session.id);
    assert.equal(decisions.length, 0);

    const extended = (await stores.phases.listExtendedWork(
      snap.session.id,
    )) as Array<{ startedAt: string; endedAt: string | null }>;
    assert.equal(extended.length, 1);
    assert.equal(extended[0]!.endedAt, null);
    assert.equal(extended[0]!.startedAt, new Date(afterWork).toISOString());
  });

  it("ack_rest closes decision with outcome and opens rest", async () => {
    const { session, stores } = await engine(2);
    const afterWork = START + 60_000;
    await catchUp(session, afterWork);
    const click = afterWork + 5_000;
    await session.ackRest(click);
    const snap = session.getSnapshot(click, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");

    const decisions = (await stores.phases.listDecisionRows(
      snap.session.id,
    )) as Array<{ outcome: string; endedAt: string | null; durationSec: number }>;
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.outcome, "ack_rest");
    assert.ok(decisions[0]!.endedAt);
    assert.equal(decisions[0]!.durationSec, 5);

    const rests = (await stores.phases.listRest(snap.session.id)) as Array<{
      endedAt: string | null;
    }>;
    assert.equal(rests.length, 1);
    assert.equal(rests[0]!.endedAt, null);
  });

  it("continue closes decision and opens extended at click", async () => {
    const { session, stores } = await engine(1);
    const afterWork = START + 60_000;
    await catchUp(session, afterWork);
    const click = afterWork + 5_000;
    await session.continueExtended(click);
    const snap = session.getSnapshot(click, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");

    const decisions = (await stores.phases.listDecisionRows(
      snap.session.id,
    )) as Array<{ outcome: string }>;
    assert.equal(decisions[0]!.outcome, "continue");

    const extended = (await stores.phases.listExtendedWork(
      snap.session.id,
    )) as Array<{ startedAt: string }>;
    assert.equal(extended[0]!.startedAt, new Date(click).toISOString());
  });

  it("soft-paused auto-rest skips decision and closes planned work as soft_paused_auto_rest", async () => {
    const { session, stores } = await engine(2);
    await session.pause(START + 40_000);
    const atEnd = START + 60_000;
    await catchUp(session, atEnd);
    const snap = session.getSnapshot(atEnd, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");
    assert.equal(snap.session.phase.kind, "short_rest");

    assert.equal((await stores.phases.listDecisionRows(snap.session.id)).length, 0);
    const planned = (await stores.phases.listPlannedWork(
      snap.session.id,
    )) as Array<{ endedReason: string; endedAt: string | null }>;
    assert.equal(planned.length, 1);
    assert.equal(planned[0]!.endedReason, "soft_paused_auto_rest");
    assert.ok(planned[0]!.endedAt);

    const slices = (await stores.phases.listPauseSlices(
      snap.session.id,
    )) as Array<{ endedAt: string | null }>;
    assert.equal(slices.length, 1);
    assert.ok(slices[0]!.endedAt);
  });

  it("short_rest_ack acknowledged vs timeout_paused outcomes", async () => {
    const ackCtx = await engine(2);
    const afterWork = START + 60_000;
    await catchUp(ackCtx.session, afterWork);
    await ackCtx.session.ackRest(afterWork + 1_000);
    const afterShort = afterWork + 1_000 + 60_000;
    await catchUp(ackCtx.session, afterShort);
    await ackCtx.session.ackWork(afterShort + 3_000);
    const ackRows = (await ackCtx.stores.phases.listShortRestAck(
      (ackCtx.session.getSnapshot(afterShort + 3_000, 0) as { session: { id: string } })
        .session.id,
    )) as Array<{ outcome: string }>;
    assert.equal(ackRows[0]!.outcome, "acknowledged");

    const timeoutCtx = await engine(2);
    await catchUp(timeoutCtx.session, afterWork);
    await timeoutCtx.session.ackRest(afterWork + 1_000);
    await catchUp(timeoutCtx.session, afterShort);
    const timeoutAt = afterShort + 15_000;
    await catchUp(timeoutCtx.session, timeoutAt);
    const snap = timeoutCtx.session.getSnapshot(timeoutAt, 0);
    assert.equal(snap.status, "active");
    if (snap.status !== "active") throw new Error("expected active");
    const timeoutRows = (await timeoutCtx.stores.phases.listShortRestAck(
      snap.session.id,
    )) as Array<{ outcome: string }>;
    assert.equal(timeoutRows[0]!.outcome, "timeout_paused");
    assert.equal(snap.session.phase.kind, "planned_work");
    if (snap.session.phase.kind === "planned_work") {
      assert.equal(snap.session.phase.paused, true);
    }
    const slices = await timeoutCtx.stores.phases.listPauseSlices(snap.session.id);
    assert.equal(slices.length, 1);
  });

  it("long rest completed vs long_rest_skipped_early", async () => {
    const completed = await engine(1);
    const afterWork = START + 60_000;
    await catchUp(completed.session, afterWork);
    await completed.session.ackRest(afterWork + 500);
    const afterLong = afterWork + 500 + 120_000;
    await catchUp(completed.session, afterLong);
    const idle = completed.session.getSnapshot(afterLong, 0);
    assert.equal(idle.status, "idle");
    // Session id is gone from runtime; read rests via sessions table join — list by scanning
    const restsCompleted = (await completed.db("rest").select("*")) as Array<{
      endedReason: string;
    }>;
    assert.ok(
      restsCompleted.some((row) => row.endedReason === "completed"),
    );

    const early = await engine(1);
    await catchUp(early.session, afterWork);
    await early.session.ackRest(afterWork + 500);
    const earlyAt = afterWork + 500 + 30_000;
    await early.session.endLongRest(earlyAt);
    const restsEarly = (await early.db("rest").select("*")) as Array<{
      endedReason: string;
      actualDurationSec: number;
    }>;
    const skipped = restsEarly.find(
      (row) => row.endedReason === "long_rest_skipped_early",
    );
    assert.ok(skipped);
    assert.equal(skipped!.actualDurationSec, 30);
  });
});
