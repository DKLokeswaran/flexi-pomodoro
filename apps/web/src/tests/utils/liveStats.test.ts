import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActiveSnapshot, Phase } from "@flexi-pomodoro/shared";
import { buildActiveSnapshot, iso } from "../helpers/activeSnapshot";
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

describe("liveStatsAt ticks locally between server snapshots", () => {
  /** Snapshot whose liveStats already include progress up to serverNow. */
  function snapshotOf(
    phase: Phase,
    serverNowMs: number,
    liveStats: Partial<ActiveSnapshot["session"]["liveStats"]>,
  ): ActiveSnapshot {
    return buildActiveSnapshot({
      phase,
      params: PARAMS,
      serverNowMs,
      liveStats,
    });
  }

  it("running planned work: worked grows, paused stays", () => {
    const snapshot = snapshotOf(
      {
        kind: "planned_work",
        cycleIndex: 1,
        startedAt: iso(START_MS),
        plannedDurationSec: 60,
        plannedEndAt: iso(START_MS + 60_000),
        paused: false,
        pausedSec: 5,
        pauseStartedAt: null,
        timerFrozenAt: null,
      },
      START_MS + 20_000,
      { workedSec: 15, pausedSec: 5 },
    );
    assert.deepEqual(liveStatsAt(snapshot, START_MS + 45_000), {
      workedSec: 40,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 5,
    });
  });

  for (const kind of ["decision", "short_rest_ack"] as const) {
    it(`${kind}: deliberation grows on top of earlier totals`, () => {
      const windowStart = START_MS + 60_000;
      const snapshot = snapshotOf(
        {
          kind,
          cycleIndex: 1,
          startedAt: iso(windowStart),
          decisionEndsAt: iso(windowStart + 15_000),
          decisionWindowSec: 15,
        },
        windowStart + 3_000,
        { workedSec: 60, deliberationSec: 7 },
      );
      const later = liveStatsAt(snapshot, windowStart + 10_000);
      assert.equal(later.deliberationSec, 14);
      assert.equal(later.workedSec, 60);
    });
  }

  it("extended work: worked grows with overtime", () => {
    const extendedStart = START_MS + 60_000;
    const snapshot = snapshotOf(
      { kind: "extended_work", cycleIndex: 1, startedAt: iso(extendedStart) },
      extendedStart + 20_000,
      { workedSec: 80 },
    );
    assert.equal(
      liveStatsAt(snapshot, extendedStart + 50_000).workedSec,
      110,
    );
  });

  for (const kind of ["short_rest", "long_rest"] as const) {
    it(`${kind}: rest grows and stops at the planned end`, () => {
      const restStart = START_MS + 60_000;
      const snapshot = snapshotOf(
        {
          kind,
          cycleIndex: 1,
          startedAt: iso(restStart),
          plannedDurationSec: 60,
          plannedEndAt: iso(restStart + 60_000),
        },
        restStart + 10_000,
        { workedSec: 60, restSec: 10 },
      );
      assert.equal(liveStatsAt(snapshot, restStart + 40_000).restSec, 40);
      assert.equal(liveStatsAt(snapshot, restStart + 90_000).restSec, 60);
    });
  }
});
