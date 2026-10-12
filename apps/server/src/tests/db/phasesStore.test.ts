import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const START = "2026-07-12T10:00:00.000Z";
const SESSION_ID = "sess-1";

describe("PhasesStore (SQLite)", () => {
  const disposers: Array<() => Promise<void>> = [];

  after(async () => {
    while (disposers.length > 0) {
      await disposers.pop()!();
    }
  });

  async function withSession() {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);
    await ctx.db("sessions").insert({
      id: SESSION_ID,
      startedAt: START,
      completedAt: null,
      status: "active",
      pauseStrategy: "soft",
      workDurationSec: 60,
      shortRestDurationSec: 60,
      cyclesBeforeLongRest: 2,
      longRestDurationSec: 120,
      decisionWindowSec: 15,
    });
    return ctx;
  }

  it("deleteDecisionPhase removes decision and phases rows (FR-FLOW-11 timeout)", async () => {
    const { db, stores } = await withSession();
    await db.transaction(async (trx) => {
      await stores.phases.openDecision(trx, {
        id: "dec-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
        decisionEndsAt: "2026-07-12T10:00:15.000Z",
        decisionWindowSec: 15,
      });
      await stores.phases.deleteDecisionPhase(trx, "dec-1");
      await stores.phases.openExtendedWork(trx, {
        id: "ext-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
      });
    });

    assert.equal((await stores.phases.listDecisionRows(SESSION_ID)).length, 0);
    assert.equal(await stores.phases.getPhaseKind("dec-1"), undefined);
    const extended = (await stores.phases.listExtendedWork(SESSION_ID)) as Array<{
      startedAt: string;
      endedAt: string | null;
    }>;
    assert.equal(extended.length, 1);
    assert.equal(extended[0]!.startedAt, START);
    assert.equal(extended[0]!.endedAt, null);
  });

  it("completeDecision ack_rest then opens rest", async () => {
    const { db, stores } = await withSession();
    await db.transaction(async (trx) => {
      await stores.phases.openDecision(trx, {
        id: "dec-ack",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
        decisionEndsAt: "2026-07-12T10:00:15.000Z",
        decisionWindowSec: 15,
      });
      await stores.phases.completeDecision(trx, "dec-ack", {
        endedAt: "2026-07-12T10:00:05.000Z",
        durationSec: 5,
        outcome: "ack_rest",
      });
      await stores.phases.openRest(trx, {
        id: "rest-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:01:05.000Z",
        startedAt: "2026-07-12T10:00:05.000Z",
        kind: "short_rest",
      });
    });

    const decisions = (await stores.phases.listDecisionRows(SESSION_ID)) as Array<{
      outcome: string;
      durationSec: number;
      endedAt: string | null;
    }>;
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.outcome, "ack_rest");
    assert.equal(decisions[0]!.durationSec, 5);
    assert.ok(decisions[0]!.endedAt);
    const rests = (await stores.phases.listRest(SESSION_ID)) as Array<{
      endedAt: string | null;
    }>;
    assert.equal(rests.length, 1);
    assert.equal(rests[0]!.endedAt, null);
  });

  it("completeDecision continue then opens extended at click time", async () => {
    const { db, stores } = await withSession();
    const clickAt = "2026-07-12T10:00:05.000Z";
    await db.transaction(async (trx) => {
      await stores.phases.openDecision(trx, {
        id: "dec-cont",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
        decisionEndsAt: "2026-07-12T10:00:15.000Z",
        decisionWindowSec: 15,
      });
      await stores.phases.completeDecision(trx, "dec-cont", {
        endedAt: clickAt,
        durationSec: 5,
        outcome: "continue",
      });
      await stores.phases.openExtendedWork(trx, {
        id: "ext-click",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: clickAt,
      });
    });

    const decisions = (await stores.phases.listDecisionRows(SESSION_ID)) as Array<{
      outcome: string;
    }>;
    assert.equal(decisions[0]!.outcome, "continue");
    const extended = (await stores.phases.listExtendedWork(SESSION_ID)) as Array<{
      startedAt: string;
    }>;
    assert.equal(extended[0]!.startedAt, clickAt);
  });

  it("completePlannedWork soft_paused_auto_rest and closePauseSlice", async () => {
    const { db, stores } = await withSession();
    const workId = "pw-1";
    const sliceId = "slice-1";
    await db.transaction(async (trx) => {
      await stores.phases.openPlannedWork(trx, {
        id: workId,
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:01:00.000Z",
        startedAt: START,
      });
      await stores.phases.openPauseSlice(trx, {
        id: sliceId,
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedWorkPhaseId: workId,
        strategy: "soft",
        startedAt: "2026-07-12T10:00:40.000Z",
      });
      await stores.phases.updatePlannedWorkPause(trx, workId, {
        paused: true,
        pausedSec: 0,
        pauseStartedAt: "2026-07-12T10:00:40.000Z",
        timerFrozenAt: null,
        plannedEndAt: "2026-07-12T10:01:00.000Z",
      });
      await stores.phases.closePauseSlice(trx, sliceId, {
        endedAt: "2026-07-12T10:01:00.000Z",
        durationSec: 20,
      });
      await stores.phases.completePlannedWork(trx, workId, {
        endedAt: "2026-07-12T10:01:00.000Z",
        endedReason: "soft_paused_auto_rest",
        pausedSec: 20,
        pauseStartedAt: null,
        timerFrozenAt: null,
        paused: false,
        plannedEndAt: "2026-07-12T10:01:00.000Z",
      });
    });

    const planned = (await stores.phases.listPlannedWork(SESSION_ID)) as Array<{
      endedReason: string;
      endedAt: string | null;
    }>;
    assert.equal(planned.length, 1);
    assert.equal(planned[0]!.endedReason, "soft_paused_auto_rest");
    assert.ok(planned[0]!.endedAt);
    const slices = (await stores.phases.listPauseSlices(SESSION_ID)) as Array<{
      endedAt: string | null;
      durationSec: number | null;
    }>;
    assert.equal(slices.length, 1);
    assert.ok(slices[0]!.endedAt);
    assert.equal(slices[0]!.durationSec, 20);
  });

  it("completeShortRestAck records acknowledged vs timeout_paused", async () => {
    const ackCtx = await withSession();
    await ackCtx.db.transaction(async (trx) => {
      await ackCtx.stores.phases.openShortRestAck(trx, {
        id: "ack-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
        decisionEndsAt: "2026-07-12T10:00:15.000Z",
        decisionWindowSec: 15,
      });
      await ackCtx.stores.phases.completeShortRestAck(trx, "ack-1", {
        endedAt: "2026-07-12T10:00:03.000Z",
        durationSec: 3,
        outcome: "acknowledged",
      });
    });
    const ack = (await ackCtx.stores.phases.listShortRestAck(
      SESSION_ID,
    )) as Array<{ outcome: string }>;
    assert.equal(ack[0]!.outcome, "acknowledged");

    const timeoutCtx = await withSession();
    await timeoutCtx.db.transaction(async (trx) => {
      await timeoutCtx.stores.phases.openShortRestAck(trx, {
        id: "ack-2",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: START,
        decisionEndsAt: "2026-07-12T10:00:15.000Z",
        decisionWindowSec: 15,
      });
      await timeoutCtx.stores.phases.completeShortRestAck(trx, "ack-2", {
        endedAt: "2026-07-12T10:00:15.000Z",
        durationSec: 15,
        outcome: "timeout_paused",
      });
      await timeoutCtx.stores.phases.openPlannedWork(trx, {
        id: "pw-paused",
        sessionId: SESSION_ID,
        cycleIndex: 2,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:01:15.000Z",
        startedAt: "2026-07-12T10:00:15.000Z",
        paused: true,
        pauseStartedAt: "2026-07-12T10:00:15.000Z",
      });
      await timeoutCtx.stores.phases.openPauseSlice(trx, {
        id: "slice-timeout",
        sessionId: SESSION_ID,
        cycleIndex: 2,
        plannedWorkPhaseId: "pw-paused",
        strategy: "soft",
        startedAt: "2026-07-12T10:00:15.000Z",
      });
    });
    const timeout = (await timeoutCtx.stores.phases.listShortRestAck(
      SESSION_ID,
    )) as Array<{ outcome: string }>;
    assert.equal(timeout[0]!.outcome, "timeout_paused");
    assert.equal(
      (await timeoutCtx.stores.phases.listPauseSlices(SESSION_ID)).length,
      1,
    );
  });

  it("completeRest records completed vs long_rest_skipped_early", async () => {
    const doneCtx = await withSession();
    await doneCtx.db.transaction(async (trx) => {
      await doneCtx.stores.phases.openRest(trx, {
        id: "rest-done",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 120,
        plannedEndAt: "2026-07-12T10:02:00.000Z",
        startedAt: START,
        kind: "long_rest",
      });
      await doneCtx.stores.phases.completeRest(trx, "rest-done", {
        endedAt: "2026-07-12T10:02:00.000Z",
        actualDurationSec: 120,
        endedReason: "completed",
      });
    });
    const done = (await doneCtx.stores.phases.listRest(SESSION_ID)) as Array<{
      endedReason: string;
    }>;
    assert.equal(done[0]!.endedReason, "completed");

    const skipCtx = await withSession();
    await skipCtx.db.transaction(async (trx) => {
      await skipCtx.stores.phases.openRest(trx, {
        id: "rest-skip",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 120,
        plannedEndAt: "2026-07-12T10:02:00.000Z",
        startedAt: START,
        kind: "long_rest",
      });
      await skipCtx.stores.phases.completeRest(trx, "rest-skip", {
        endedAt: "2026-07-12T10:00:30.000Z",
        actualDurationSec: 30,
        endedReason: "long_rest_skipped_early",
      });
    });
    const skipped = (await skipCtx.stores.phases.listRest(SESSION_ID)) as Array<{
      endedReason: string;
      actualDurationSec: number;
    }>;
    assert.equal(skipped[0]!.endedReason, "long_rest_skipped_early");
    assert.equal(skipped[0]!.actualDurationSec, 30);
  });
});
