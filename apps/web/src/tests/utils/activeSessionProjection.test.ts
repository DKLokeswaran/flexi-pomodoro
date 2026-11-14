import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActiveSnapshot } from "@flexi-pomodoro/shared";
import {
  activeEstimatedSessionEndMs,
  remainingActiveSessionSec,
} from "../../utils/activeSessionProjection";
import { estimatedSessionEndMs } from "../../utils/sessionProjection";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");
const SERVER_NOW_MS = START_MS + 30_000;

const PARAMS = {
  workDurationSec: 60,
  shortRestDurationSec: 60,
  longRestDurationSec: 120,
  cyclesBeforeLongRest: 2,
  decisionWindowSec: 15,
};

function activeSnapshot(
  phase: ActiveSnapshot["session"]["phase"],
  liveStats = { workedSec: 0, deliberationSec: 0, restSec: 0, pausedSec: 0 },
  pauseStrategy: ActiveSnapshot["session"]["pauseStrategy"] = "soft",
): ActiveSnapshot {
  return {
    status: "active",
    serverNow: new Date(SERVER_NOW_MS).toISOString(),
    session: {
      id: "test",
      status: "active",
      startedAt: new Date(START_MS).toISOString(),
      params: PARAMS,
      pauseStrategy,
      phase,
      liveStats,
      pendingAlerts: [],
      alertSeq: 0,
    },
  };
}

describe("activeSessionProjection", () => {
  it("matches nominal end during planned work on the happy path", () => {
    const snapshot = activeSnapshot({
      kind: "planned_work",
      cycleIndex: 1,
      startedAt: new Date(START_MS).toISOString(),
      plannedDurationSec: 60,
      plannedEndAt: new Date(START_MS + 60_000).toISOString(),
      paused: false,
      pausedSec: 0,
      pauseStartedAt: null,
      timerFrozenAt: null,
    });
    const nowMs = START_MS + 30_000;
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, nowMs),
      estimatedSessionEndMs(PARAMS, START_MS),
    );
  });

  it("adds deliberation elapsed during decision", () => {
    const decisionStartMs = START_MS + 60_000;
    const nowMs = decisionStartMs + 12_000;
    const snapshot = activeSnapshot({
      kind: "decision",
      cycleIndex: 1,
      startedAt: new Date(decisionStartMs).toISOString(),
      decisionEndsAt: new Date(decisionStartMs + 15_000).toISOString(),
      decisionWindowSec: 15,
    });
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, nowMs),
      estimatedSessionEndMs(PARAMS, START_MS) + 12_000,
    );
  });

  it("adds extended work elapsed while overtime", () => {
    const extendedStartMs = START_MS + 75_000;
    const nowMs = extendedStartMs + 20_000;
    const snapshot = activeSnapshot(
      {
        kind: "extended_work",
        cycleIndex: 1,
        startedAt: new Date(extendedStartMs).toISOString(),
      },
      { workedSec: 60, deliberationSec: 0, restSec: 0, pausedSec: 0 },
    );
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, nowMs),
      estimatedSessionEndMs(PARAMS, START_MS) + 35_000,
    );
  });

  it("keeps extended-work slip after starting rest", () => {
    const extendedStartMs = START_MS + 75_000;
    const restStartMs = extendedStartMs + 20_000;
    const nowMs = restStartMs + 10_000;
    const snapshot = activeSnapshot(
      {
        kind: "short_rest",
        cycleIndex: 1,
        startedAt: new Date(restStartMs).toISOString(),
        plannedDurationSec: 60,
        plannedEndAt: new Date(restStartMs + 60_000).toISOString(),
      },
      { workedSec: 80, deliberationSec: 15, restSec: 0, pausedSec: 0 },
    );
    const duringExtended = activeEstimatedSessionEndMs(
      activeSnapshot(
        {
          kind: "extended_work",
          cycleIndex: 1,
          startedAt: new Date(extendedStartMs).toISOString(),
        },
        { workedSec: 60, deliberationSec: 15, restSec: 0, pausedSec: 0 },
      ),
      restStartMs,
    );
    assert.equal(activeEstimatedSessionEndMs(snapshot, nowMs), duringExtended);
  });

  it("adds open hard-pause time while countdown is frozen", () => {
    const pauseStartMs = START_MS + 20_000;
    const nowMs = pauseStartMs + 8_000;
    const snapshot = activeSnapshot(
      {
        kind: "planned_work",
        cycleIndex: 1,
        startedAt: new Date(START_MS).toISOString(),
        plannedDurationSec: 60,
        plannedEndAt: new Date(START_MS + 60_000).toISOString(),
        paused: true,
        pausedSec: 0,
        pauseStartedAt: new Date(pauseStartMs).toISOString(),
        timerFrozenAt: new Date(pauseStartMs).toISOString(),
      },
      undefined,
      "hard",
    );
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, nowMs),
      estimatedSessionEndMs(PARAMS, START_MS) + 8_000,
    );
  });

  it("keeps hard-pause slip after resume via shifted plannedEndAt", () => {
    const pauseStartMs = START_MS + 20_000;
    const resumeMs = pauseStartMs + 8_000;
    const shiftedEndMs = START_MS + 68_000;
    const duringPause = activeEstimatedSessionEndMs(
      activeSnapshot(
        {
          kind: "planned_work",
          cycleIndex: 1,
          startedAt: new Date(START_MS).toISOString(),
          plannedDurationSec: 60,
          plannedEndAt: new Date(START_MS + 60_000).toISOString(),
          paused: true,
          pausedSec: 0,
          pauseStartedAt: new Date(pauseStartMs).toISOString(),
          timerFrozenAt: new Date(pauseStartMs).toISOString(),
        },
        undefined,
        "hard",
      ),
      resumeMs,
    );
    const afterResume = activeEstimatedSessionEndMs(
      activeSnapshot(
        {
          kind: "planned_work",
          cycleIndex: 1,
          startedAt: new Date(START_MS).toISOString(),
          plannedDurationSec: 60,
          plannedEndAt: new Date(shiftedEndMs).toISOString(),
          paused: false,
          pausedSec: 8,
          pauseStartedAt: null,
          timerFrozenAt: null,
        },
        undefined,
        "hard",
      ),
      resumeMs,
    );
    assert.equal(afterResume, duringPause);
  });

  it("reflects deliberation slip in shifted rest anchors", () => {
    const restStartMs = START_MS + 61_000;
    const snapshot = activeSnapshot(
      {
        kind: "short_rest",
        cycleIndex: 1,
        startedAt: new Date(restStartMs).toISOString(),
        plannedDurationSec: 60,
        plannedEndAt: new Date(restStartMs + 60_000).toISOString(),
      },
      { workedSec: 60, deliberationSec: 1, restSec: 0, pausedSec: 0 },
    );
    const nowMs = restStartMs + 30_000;
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, nowMs),
      estimatedSessionEndMs(PARAMS, START_MS) + 1_000,
    );
  });
});

describe("activeSessionProjection across cycles and rests", () => {
  const FOUR_CYCLES = { ...PARAMS, cyclesBeforeLongRest: 4 };

  function fourCycleSnapshot(
    phase: ActiveSnapshot["session"]["phase"],
  ): ActiveSnapshot {
    const snapshot = activeSnapshot(phase);
    snapshot.session.params = FOUR_CYCLES;
    return snapshot;
  }

  it("includes every remaining short rest in a 4-cycle session", () => {
    const snapshot = fourCycleSnapshot({
      kind: "planned_work",
      cycleIndex: 1,
      startedAt: new Date(START_MS).toISOString(),
      plannedDurationSec: 60,
      plannedEndAt: new Date(START_MS + 60_000).toISOString(),
      paused: false,
      pausedSec: 0,
      pauseStartedAt: null,
      timerFrozenAt: null,
    });
    // 4 work + 3 short rests + long rest = 240 + 180 + 120.
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, START_MS + 30_000),
      START_MS + 540_000,
    );
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, START_MS + 30_000),
      estimatedSessionEndMs(FOUR_CYCLES, START_MS),
    );
  });

  it("short rest in cycle 2 of 4 still counts the later short rest", () => {
    const restStartMs = START_MS + 180_000;
    const snapshot = fourCycleSnapshot({
      kind: "short_rest",
      cycleIndex: 2,
      startedAt: new Date(restStartMs).toISOString(),
      plannedDurationSec: 60,
      plannedEndAt: new Date(restStartMs + 60_000).toISOString(),
    });
    // 40s rest left + work 3 + short rest + work 4 + long rest.
    assert.equal(
      remainingActiveSessionSec(snapshot, restStartMs + 20_000),
      40 + 60 + 60 + 60 + 120,
    );
  });

  it("long rest: projected end is the long rest's planned end", () => {
    const restStartMs = START_MS + 200_000;
    const plannedEndMs = restStartMs + 120_000;
    const snapshot = activeSnapshot({
      kind: "long_rest",
      cycleIndex: 2,
      startedAt: new Date(restStartMs).toISOString(),
      plannedDurationSec: 120,
      plannedEndAt: new Date(plannedEndMs).toISOString(),
    });
    assert.equal(
      remainingActiveSessionSec(snapshot, restStartMs + 30_000),
      90,
    );
    assert.equal(
      activeEstimatedSessionEndMs(snapshot, restStartMs + 30_000),
      plannedEndMs,
    );
  });

  it("short-rest acknowledgement window: remaining is the next cycles plus long rest", () => {
    const ackStartMs = START_MS + 121_000;
    const snapshot = activeSnapshot({
      kind: "short_rest_ack",
      cycleIndex: 1,
      startedAt: new Date(ackStartMs).toISOString(),
      decisionEndsAt: new Date(ackStartMs + 15_000).toISOString(),
      decisionWindowSec: 15,
    });
    // Cycle 2 work + long rest, measured from now.
    assert.equal(
      remainingActiveSessionSec(snapshot, ackStartMs + 4_000),
      60 + 120,
    );
  });
});
