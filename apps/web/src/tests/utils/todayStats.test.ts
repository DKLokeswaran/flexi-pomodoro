import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Phase } from "@flexi-pomodoro/shared";
import {
  openPhaseProgressClippedToDay,
  todayDisplayStats,
} from "../../utils/todayStats";

/** Asia/Kolkata client day 2026-11-09. */
const DAY_START = "2026-11-08T18:30:00.000Z";
const DAY_END = "2026-11-09T18:30:00.000Z";

function plannedWork(partial: {
  startedAt: string;
  paused?: boolean;
  pausedSec?: number;
  pauseStartedAt?: string | null;
  timerFrozenAt?: string | null;
}): Phase {
  const startedMs = Date.parse(partial.startedAt);
  return {
    kind: "planned_work",
    cycleIndex: 1,
    startedAt: partial.startedAt,
    plannedDurationSec: 1500,
    plannedEndAt: new Date(startedMs + 1500_000).toISOString(),
    paused: partial.paused ?? false,
    pausedSec: partial.pausedSec ?? 0,
    pauseStartedAt: partial.pauseStartedAt ?? null,
    timerFrozenAt: partial.timerFrozenAt ?? null,
  };
}

describe("openPhaseProgressClippedToDay", () => {
  it("adds only the open pause to pausedSec and freezes worked", () => {
    const startedAt = "2026-11-09T10:00:00.000Z";
    const pauseAt = "2026-11-09T10:02:00.000Z";
    const nowMs = Date.parse("2026-11-09T10:05:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({
        startedAt,
        paused: true,
        pausedSec: 30,
        pauseStartedAt: pauseAt,
        timerFrozenAt: null,
      }),
      DAY_START,
      DAY_END,
      nowMs,
    );
    assert.equal(stats.workedSec, 90); // wall to pause start minus closed 30
    assert.equal(stats.pausedSec, 180); // open pause only
  });

  it("clips open pause that began before the client day", () => {
    const startedAt = "2026-11-08T18:00:00.000Z";
    const pauseAt = "2026-11-08T18:20:00.000Z";
    const nowMs = Date.parse("2026-11-08T18:40:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({
        startedAt,
        paused: true,
        pausedSec: 0,
        pauseStartedAt: pauseAt,
        timerFrozenAt: pauseAt,
      }),
      DAY_START,
      DAY_END,
      nowMs,
    );
    // Worked frozen at pause start (before day) → 0 in today; open pause ∩ day = 10m
    assert.equal(stats.workedSec, 0);
    assert.equal(stats.pausedSec, 10 * 60);
  });

  it("clips deliberation and rest to the day window", () => {
    const decision: Phase = {
      kind: "decision",
      cycleIndex: 1,
      startedAt: "2026-11-08T18:25:00.000Z",
      decisionEndsAt: "2026-11-08T18:35:00.000Z",
      decisionWindowSec: 600,
    };
    const nowMs = Date.parse("2026-11-08T18:35:00.000Z");
    const deliberation = openPhaseProgressClippedToDay(
      decision,
      DAY_START,
      DAY_END,
      nowMs,
    );
    assert.equal(deliberation.deliberationSec, 5 * 60);

    const rest: Phase = {
      kind: "short_rest",
      cycleIndex: 1,
      startedAt: "2026-11-08T18:25:00.000Z",
      plannedDurationSec: 600,
      plannedEndAt: "2026-11-08T18:35:00.000Z",
    };
    const restStats = openPhaseProgressClippedToDay(
      rest,
      DAY_START,
      DAY_END,
      nowMs,
    );
    assert.equal(restStats.restSec, 5 * 60);
  });
});

describe("todayDisplayStats", () => {
  it("adds open-phase clip onto closed server today without replacing it", () => {
    const display = todayDisplayStats(
      {
        workedSec: 100,
        deliberationSec: 10,
        restSec: 20,
        pausedSec: 5,
      },
      {
        workedSec: 3,
        deliberationSec: 1,
        restSec: 2,
        pausedSec: 4,
      },
    );
    assert.deepEqual(display, {
      workedSec: 103,
      deliberationSec: 11,
      restSec: 22,
      pausedSec: 9,
    });
  });
});
