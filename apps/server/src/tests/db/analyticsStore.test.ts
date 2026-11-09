import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { dayBoundsIso } from "../../utils/clientDay.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const SESSION_ID = "sess-analytics";
const TZ = "Asia/Kolkata";

describe("AnalyticsStore (SQLite)", () => {
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
      startedAt: "2026-11-08T10:00:00.000Z",
      completedAt: null,
      status: "active",
      pauseStrategy: "soft",
      workDurationSec: 1500,
      shortRestDurationSec: 300,
      cyclesBeforeLongRest: 4,
      longRestDurationSec: 900,
      decisionWindowSec: 15,
    });
    return ctx;
  }

  it("creates daily_stats via migration", async () => {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);
    assert.ok(ctx.stores.analytics);
    const tables = await ctx.db.raw(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const names = (tables as { name: string }[]).map((row) => row.name);
    assert.ok(names.includes("daily_stats"));
    const columns = await ctx.db("daily_stats").columnInfo();
    assert.ok("clientDate" in columns);
  });

  it("lists closed planned work overlapping a client-day window", async () => {
    const { db, stores } = await withSession();
    const bounds = dayBoundsIso("2026-11-09", TZ);
    await db.transaction(async (trx) => {
      await stores.phases.openPlannedWork(trx, {
        id: "pw-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 3600,
        plannedEndAt: "2026-11-08T19:00:00.000Z",
        startedAt: "2026-11-08T18:00:00.000Z",
      });
      await stores.phases.completePlannedWork(trx, "pw-1", {
        endedAt: "2026-11-08T19:00:00.000Z",
        endedReason: "planned_complete",
        pausedSec: 0,
        pauseStartedAt: null,
        timerFrozenAt: null,
        paused: false,
      });
    });

    const rows = await stores.analytics.listClosedPlannedWorkOverlapping(
      bounds.dayStart,
      bounds.dayEnd,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, "pw-1");
  });

  it("upsertDailyStats is idempotent and getLatestFinalizedClientDate advances", async () => {
    const { stores } = await withSession();
    const bounds = dayBoundsIso("2026-11-08", TZ);
    await stores.analytics.upsertDailyStats({
      clientDate: "2026-11-08",
      dayStart: bounds.dayStart,
      dayEnd: bounds.dayEnd,
      workedSec: 10,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 0,
      finalizedAt: "2026-11-09T00:00:00.000Z",
    });
    await stores.analytics.upsertDailyStats({
      clientDate: "2026-11-08",
      dayStart: bounds.dayStart,
      dayEnd: bounds.dayEnd,
      workedSec: 99,
      deliberationSec: 1,
      restSec: 2,
      pausedSec: 3,
      finalizedAt: "2026-11-09T01:00:00.000Z",
    });
    const row = await stores.analytics.getDailyStats("2026-11-08");
    assert.equal(row?.workedSec, 99);
    assert.equal(row?.deliberationSec, 1);
    assert.equal(
      await stores.analytics.getLatestFinalizedClientDate(),
      "2026-11-08",
    );
  });
});
