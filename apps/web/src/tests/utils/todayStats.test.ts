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
  it("clips open planned work that started before the client day", () => {
    const startedAt = "2026-11-08T18:20:00.000Z"; // 10m before IST midnight
    const nowMs = Date.parse("2026-11-08T18:40:00.000Z"); // 10m after
    const stats = openPhaseProgressClippedToDay(
      plannedWork({ startedAt }),
      DAY_START,
      DAY_END,
      nowMs,
      0,
    );
    assert.equal(stats.workedSec, 10 * 60);
    assert.equal(stats.pausedSec, 0);
  });

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
      0,
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
      0,
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
      0,
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
      0,
    );
    assert.equal(restStats.restSec, 5 * 60);
  });
});

describe("openPhaseProgressClippedToDay closed pauses across midnight", () => {
  const startedAt = "2026-11-08T18:20:00.000Z"; // 10m before IST midnight

  it("subtracts server-today closed pauses after resume past midnight", () => {
    // Paused 18:35–18:38 (after midnight), resumed; now 18:40.
    const nowMs = Date.parse("2026-11-08T18:40:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({ startedAt, pausedSec: 3 * 60 }),
      DAY_START,
      DAY_END,
      nowMs,
      3 * 60,
    );
    assert.equal(stats.workedSec, 10 * 60 - 3 * 60);
    assert.equal(stats.pausedSec, 0);
  });

  it("subtracts only the in-day part of a pause spanning midnight", () => {
    // Paused 18:25–18:35 (5m each side of midnight), resumed; now 18:40.
    const nowMs = Date.parse("2026-11-08T18:40:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({ startedAt, pausedSec: 10 * 60 }),
      DAY_START,
      DAY_END,
      nowMs,
      5 * 60,
    );
    assert.equal(stats.workedSec, 10 * 60 - 5 * 60);
  });

  it("keeps worked frozen while paused again after an in-day resume", () => {
    // Paused 18:32–18:34, resumed; hard-paused again at 18:37; now 18:40.
    const pauseAt = "2026-11-08T18:37:00.000Z";
    const nowMs = Date.parse("2026-11-08T18:40:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({
        startedAt,
        paused: true,
        pausedSec: 2 * 60,
        pauseStartedAt: pauseAt,
        timerFrozenAt: pauseAt,
      }),
      DAY_START,
      DAY_END,
      nowMs,
      2 * 60,
    );
    assert.equal(stats.workedSec, 7 * 60 - 2 * 60);
    assert.equal(stats.pausedSec, 3 * 60);
  });

  it("uses the phase total when the phase started inside the day", () => {
    // Server today also holds 20m of pauses from an earlier closed cycle.
    const inDayStart = "2026-11-09T10:00:00.000Z";
    const nowMs = Date.parse("2026-11-09T10:10:00.000Z");
    const stats = openPhaseProgressClippedToDay(
      plannedWork({ startedAt: inDayStart, pausedSec: 60 }),
      DAY_START,
      DAY_END,
      nowMs,
      20 * 60 + 60,
    );
    assert.equal(stats.workedSec, 10 * 60 - 60);
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

describe("openPhaseProgressClippedToDay open-phase cases", () => {
  it("counts open extended work, clipped to the day start", () => {
    const extended: Phase = {
      kind: "extended_work",
      cycleIndex: 1,
      startedAt: "2026-11-08T18:25:00.000Z",
    };
    const stats = openPhaseProgressClippedToDay(
      extended,
      DAY_START,
      DAY_END,
      Date.parse("2026-11-08T18:42:00.000Z"),
      0,
    );
    assert.equal(stats.workedSec, 12 * 60);
  });

  it("stops counting an open rest at its planned end", () => {
    const rest: Phase = {
      kind: "long_rest",
      cycleIndex: 1,
      startedAt: "2026-11-09T10:00:00.000Z",
      plannedDurationSec: 600,
      plannedEndAt: "2026-11-09T10:10:00.000Z",
    };
    const stats = openPhaseProgressClippedToDay(
      rest,
      DAY_START,
      DAY_END,
      Date.parse("2026-11-09T10:25:00.000Z"),
      0,
    );
    assert.equal(stats.restSec, 600);
  });

  it("counts the open short-rest acknowledgement window as deliberation", () => {
    const ack: Phase = {
      kind: "short_rest_ack",
      cycleIndex: 1,
      startedAt: "2026-11-09T10:00:00.000Z",
      decisionEndsAt: "2026-11-09T10:00:15.000Z",
      decisionWindowSec: 15,
    };
    const stats = openPhaseProgressClippedToDay(
      ack,
      DAY_START,
      DAY_END,
      Date.parse("2026-11-09T10:00:09.000Z"),
      0,
    );
    assert.equal(stats.deliberationSec, 9);
  });

  it("does not subtract a pre-midnight pause from today's worked time", () => {
    // Work started 10m before the day; its 2m closed pause is not today's.
    const stats = openPhaseProgressClippedToDay(
      plannedWork({ startedAt: "2026-11-08T18:20:00.000Z", pausedSec: 120 }),
      DAY_START,
      DAY_END,
      Date.parse("2026-11-08T18:40:00.000Z"),
      0,
    );
    assert.equal(stats.workedSec, 10 * 60);
  });
});
