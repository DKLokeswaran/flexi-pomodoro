import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActiveSnapshot } from "@flexi-pomodoro/shared";
import { liveStatsAt } from "../../utils/liveStats";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");

const PARAMS = {
  workDurationSec: 60,
  shortRestDurationSec: 60,
  longRestDurationSec: 120,
  cyclesBeforeLongRest: 2,
  decisionWindowSec: 15,
};

function pausedWorkSnapshot(
  pauseStrategy: "soft" | "hard",
  pauseStartMs: number,
  serverNowMs: number,
  liveStats: ActiveSnapshot["session"]["liveStats"],
  phasePausedSec = 0,
): ActiveSnapshot {
  return {
    status: "active",
    serverNow: new Date(serverNowMs).toISOString(),
    session: {
      id: "test",
      status: "active",
      startedAt: new Date(START_MS).toISOString(),
      params: PARAMS,
      pauseStrategy,
      phase: {
        kind: "planned_work",
        cycleIndex: 1,
        startedAt: new Date(START_MS).toISOString(),
        plannedDurationSec: 60,
        plannedEndAt: new Date(START_MS + 60_000).toISOString(),
        paused: true,
        pausedSec: phasePausedSec,
        pauseStartedAt: new Date(pauseStartMs).toISOString(),
        timerFrozenAt:
          pauseStrategy === "hard"
            ? new Date(pauseStartMs).toISOString()
            : null,
      },
      liveStats,
      pendingAlerts: [],
      alertSeq: 0,
    },
  };
}

describe("liveStatsAt paused totals", () => {
  it("soft pause: paused grows with wall clock; worked holds at pause start", () => {
    const pauseAt = START_MS + 20_000;
    const serverNow = pauseAt + 2_000;
    const snapshot = pausedWorkSnapshot("soft", pauseAt, serverNow, {
      workedSec: 20,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 2,
    });

    const atServer = liveStatsAt(snapshot, serverNow);
    assert.equal(atServer.workedSec, 20);
    assert.equal(atServer.pausedSec, 2);

    const later = liveStatsAt(snapshot, pauseAt + 10_000);
    assert.equal(later.workedSec, 20);
    assert.equal(later.pausedSec, 10);
  });

  it("hard pause: paused grows while countdown frozen; worked holds", () => {
    const pauseAt = START_MS + 50_000;
    const serverNow = pauseAt + 1_000;
    const snapshot = pausedWorkSnapshot("hard", pauseAt, serverNow, {
      workedSec: 50,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 1,
    });

    assert.equal(liveStatsAt(snapshot, serverNow).pausedSec, 1);
    assert.equal(liveStatsAt(snapshot, serverNow).workedSec, 50);

    const later = liveStatsAt(snapshot, pauseAt + 9_000);
    assert.equal(later.pausedSec, 9);
    assert.equal(later.workedSec, 50);
  });
});
