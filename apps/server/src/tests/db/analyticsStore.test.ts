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
