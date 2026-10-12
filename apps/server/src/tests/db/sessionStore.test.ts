import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { SessionStore } from "../../db/stores/sessionStore.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const START = "2026-07-12T10:00:00.000Z";
const SESSION_ID = "sess-1";

describe("SessionStore (SQLite)", () => {
  const disposers: Array<() => Promise<void>> = [];

  after(async () => {
    while (disposers.length > 0) {
      await disposers.pop()!();
    }
  });

  async function open() {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);
    return ctx;
  }

  it("insertSession, upsertRuntime, updateRuntimeStats round-trip", async () => {
    const { db, stores } = await open();
    await db.transaction(async (trx) => {
      await stores.session.insertSession(trx, {
        id: SESSION_ID,
        startedAt: START,
        completedAt: null,
        status: "active",
        pauseStrategy: "soft",
        ...SessionStore.paramsColumns({
          workDurationSec: 60,
          shortRestDurationSec: 60,
          cyclesBeforeLongRest: 2,
          longRestDurationSec: 120,
          decisionWindowSec: 15,
        }),
      });
      await stores.phases.openPlannedWork(trx, {
        id: "phase-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:01:00.000Z",
        startedAt: START,
      });
      await stores.phases.openPlannedWork(trx, {
        id: "phase-2",
        sessionId: SESSION_ID,
        cycleIndex: 2,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:02:00.000Z",
        startedAt: "2026-07-12T10:01:00.000Z",
      });
      await stores.session.upsertRuntime(trx, {
        sessionId: SESSION_ID,
        currentPhaseId: "phase-1",
        workedSec: 0,
        deliberationSec: 0,
        restSec: 0,
        pausedSec: 0,
        alertSeq: 0,
        updatedAt: START,
      });
      await stores.session.updateRuntimeStats(trx, SESSION_ID, {
        currentPhaseId: "phase-2",
        liveStats: {
          workedSec: 10,
          deliberationSec: 2,
          restSec: 0,
          pausedSec: 1,
        },
        alertSeq: 3,
        updatedAt: "2026-07-12T10:00:10.000Z",
      });
    });

    const session = await db("sessions").where({ id: SESSION_ID }).first();
    assert.equal(session.status, "active");
    assert.equal(session.workDurationSec, 60);

    const runtime = await db("session_runtime")
      .where({ sessionId: SESSION_ID })
      .first();
    assert.equal(runtime.currentPhaseId, "phase-2");
    assert.equal(runtime.workedSec, 10);
    assert.equal(runtime.deliberationSec, 2);
    assert.equal(runtime.pausedSec, 1);
    assert.equal(runtime.alertSeq, 3);
  });

  it("finalizeSession and clearRuntime", async () => {
    const { db, stores } = await open();
    await db.transaction(async (trx) => {
      await stores.session.insertSession(trx, {
        id: SESSION_ID,
        startedAt: START,
        completedAt: null,
        status: "active",
        pauseStrategy: "hard",
        workDurationSec: 60,
        shortRestDurationSec: 60,
        cyclesBeforeLongRest: 1,
        longRestDurationSec: 120,
        decisionWindowSec: 15,
      });
      await stores.phases.openPlannedWork(trx, {
        id: "phase-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 60,
        plannedEndAt: "2026-07-12T10:01:00.000Z",
        startedAt: START,
      });
      await stores.session.upsertRuntime(trx, {
        sessionId: SESSION_ID,
        currentPhaseId: "phase-1",
        workedSec: 60,
        deliberationSec: 0,
        restSec: 120,
        pausedSec: 0,
        alertSeq: 5,
        updatedAt: START,
      });
      await stores.session.finalizeSession(
        trx,
        SESSION_ID,
        "2026-07-12T10:03:00.000Z",
      );
      await stores.session.clearRuntime(trx);
    });

    const session = await db("sessions").where({ id: SESSION_ID }).first();
    assert.equal(session.status, "completed");
    assert.equal(session.completedAt, "2026-07-12T10:03:00.000Z");

    const runtimeRows = await db("session_runtime").select("*");
    assert.equal(runtimeRows.length, 0);
  });
});
