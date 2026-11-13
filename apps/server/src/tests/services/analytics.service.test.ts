import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { AnalyticsService } from "../../services/analytics.service.js";
import { SettingsService } from "../../services/settings.service.js";
import {
  addClientDays,
  clientDateAt,
  dayBoundsIso,
} from "../../utils/clientDay.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

const SESSION_ID = "sess-analytics-svc";
const TZ = "Asia/Kolkata";

describe("AnalyticsService", () => {
  const disposers: Array<() => Promise<void>> = [];

  after(async () => {
    while (disposers.length > 0) {
      await disposers.pop()!();
    }
  });

  async function setup() {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);
    const settings = new SettingsService(ctx.stores.settings);
    await settings.hydrate();
    await settings.update({ timezone: TZ });
    const analytics = new AnalyticsService(ctx.stores.analytics, settings);
    await ctx.db("sessions").insert({
      id: SESSION_ID,
      startedAt: "2026-11-07T10:00:00.000Z",
      completedAt: null,
      status: "active",
      pauseStrategy: "soft",
      workDurationSec: 1500,
      shortRestDurationSec: 300,
      cyclesBeforeLongRest: 4,
      longRestDurationSec: 900,
      decisionWindowSec: 15,
    });
    return { ...ctx, settings, analytics };
  }

  it("dayStats attributes full buckets for a phase fully inside the day", async () => {
    const { db, stores, analytics } = await setup();

    await db.transaction(async (trx) => {
      await stores.phases.openPlannedWork(trx, {
        id: "pw-full",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 600,
        plannedEndAt: "2026-11-09T10:10:00.000Z",
        startedAt: "2026-11-09T10:00:00.000Z",
      });
      await stores.phases.completePlannedWork(trx, "pw-full", {
        endedAt: "2026-11-09T10:10:00.000Z",
        endedReason: "planned_complete",
        pausedSec: 0,
        pauseStartedAt: null,
        timerFrozenAt: null,
        paused: false,
      });
      await stores.phases.openDecision(trx, {
        id: "dec-full",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        decisionWindowSec: 15,
        decisionEndsAt: "2026-11-09T10:10:15.000Z",
        startedAt: "2026-11-09T10:10:00.000Z",
      });
      await stores.phases.completeDecision(trx, "dec-full", {
        endedAt: "2026-11-09T10:10:15.000Z",
        durationSec: 15,
        outcome: "ack_rest",
      });
      await stores.phases.openRest(trx, {
        id: "rest-full",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        kind: "short_rest",
        plannedDurationSec: 300,
        plannedEndAt: "2026-11-09T10:15:15.000Z",
        startedAt: "2026-11-09T10:10:15.000Z",
      });
      await stores.phases.completeRest(trx, "rest-full", {
        endedAt: "2026-11-09T10:15:15.000Z",
        actualDurationSec: 300,
        endedReason: "completed",
      });
    });

    const day = await analytics.dayStats("2026-11-09");
    assert.equal(day.workedSec, 600);
    assert.equal(day.deliberationSec, 15);
    assert.equal(day.restSec, 300);
    assert.equal(day.pausedSec, 0);
  });

  it("dayStats splits a midnight-spanning phase across adjacent client days", async () => {
    const { db, stores, analytics } = await setup();
    // IST midnight 2026-11-09 = 2026-11-08T18:30:00.000Z
    await db.transaction(async (trx) => {
      await stores.phases.openExtendedWork(trx, {
        id: "ext-span",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: "2026-11-08T18:20:00.000Z",
      });
      await stores.phases.completeExtendedWork(trx, "ext-span", {
        endedAt: "2026-11-08T18:40:00.000Z",
        actualDurationSec: 1200,
        endedReason: "user_start_rest",
      });
    });

    const before = await analytics.dayStats("2026-11-08");
    const after = await analytics.dayStats("2026-11-09");
    assert.equal(before.workedSec, 10 * 60);
    assert.equal(after.workedSec, 10 * 60);
  });

  it("dayStats clips planned work spanning client midnight and subtracts clipped pauses", async () => {
    const { db, stores, analytics } = await setup();
    await db.transaction(async (trx) => {
      await stores.phases.openPlannedWork(trx, {
        id: "pw-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedDurationSec: 3600,
        plannedEndAt: "2026-11-08T19:00:00.000Z",
        startedAt: "2026-11-08T18:00:00.000Z",
      });
      await stores.phases.openPauseSlice(trx, {
        id: "ps-1",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        plannedWorkPhaseId: "pw-1",
        strategy: "soft",
        startedAt: "2026-11-08T18:40:00.000Z",
      });
      await stores.phases.closePauseSlice(trx, "ps-1", {
        endedAt: "2026-11-08T18:50:00.000Z",
        durationSec: 600,
      });
      await stores.phases.completePlannedWork(trx, "pw-1", {
        endedAt: "2026-11-08T19:00:00.000Z",
        endedReason: "planned_complete",
        pausedSec: 600,
        pauseStartedAt: null,
        timerFrozenAt: null,
        paused: false,
      });
    });

    const day = await analytics.dayStats("2026-11-09");
    assert.equal(day.workedSec, 20 * 60);
    assert.equal(day.pausedSec, 10 * 60);
  });

  it("todayStats matches dayStats for the current client date", async () => {
    const { analytics } = await setup();
    const todayClient = clientDateAt(Date.now(), TZ);
    const fromToday = await analytics.todayStats();
    const fromDay = await analytics.dayStats(todayClient);
    assert.deepEqual(fromToday, fromDay);
  });

  it("finalizeDueDays backfills missing days through yesterday", async () => {
    const { db, stores, analytics } = await setup();
    const todayClient = clientDateAt(Date.now(), TZ);
    const yesterdayClient = addClientDays(todayClient, -1);
    const twoDaysAgo = addClientDays(todayClient, -2);
    const bounds = dayBoundsIso(twoDaysAgo, TZ);
    const phaseStart = new Date(bounds.dayStartMs + 60 * 60 * 1000).toISOString();
    const phaseEnd = new Date(bounds.dayStartMs + 60 * 60 * 1000 + 600 * 1000).toISOString();

    await db.transaction(async (trx) => {
      await stores.phases.openExtendedWork(trx, {
        id: "ext-old",
        sessionId: SESSION_ID,
        cycleIndex: 1,
        startedAt: phaseStart,
      });
      await stores.phases.completeExtendedWork(trx, "ext-old", {
        endedAt: phaseEnd,
        actualDurationSec: 600,
        endedReason: "user_start_rest",
      });
    });

    await analytics.finalizeDueDays();

    assert.equal(
      await stores.analytics.getLatestFinalizedClientDate(),
      yesterdayClient,
    );
    const older = await stores.analytics.getDailyStats(twoDaysAgo);
    assert.equal(older?.workedSec, 600);
    const yesterday = await stores.analytics.getDailyStats(yesterdayClient);
    assert.deepEqual(
      {
        workedSec: yesterday?.workedSec,
        deliberationSec: yesterday?.deliberationSec,
        restSec: yesterday?.restSec,
        pausedSec: yesterday?.pausedSec,
      },
      {
        workedSec: 0,
        deliberationSec: 0,
        restSec: 0,
        pausedSec: 0,
      },
    );
    assert.equal(await stores.analytics.getDailyStats(todayClient), null);

    await analytics.finalizeDueDays();
    assert.equal(
      await stores.analytics.getLatestFinalizedClientDate(),
      yesterdayClient,
    );
  });
});
