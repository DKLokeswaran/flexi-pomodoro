import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Phase } from "@flexi-pomodoro/shared";
import { cycleDotStates, dialProgress } from "../../utils/dialProgress";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");

const PARAMS = {
  workDurationSec: 100,
  shortRestDurationSec: 60,
  longRestDurationSec: 120,
  cyclesBeforeLongRest: 4,
  decisionWindowSec: 10,
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function plannedWork(timerFrozenAt: string | null = null): Phase {
  return {
    kind: "planned_work",
    cycleIndex: 1,
    startedAt: iso(START_MS),
    plannedDurationSec: 100,
    plannedEndAt: iso(START_MS + 100_000),
    paused: timerFrozenAt !== null,
    pausedSec: 0,
    pauseStartedAt: timerFrozenAt,
    timerFrozenAt,
  };
}

describe("dialProgress", () => {
  it("planned work: arc shrinks with the remaining planned time", () => {
    const progress = dialProgress(plannedWork(), PARAMS, START_MS + 25_000);
    assert.equal(progress.remaining, 0.75);
    assert.equal(progress.overtimeLaps, null);
  });

  it("hard pause: arc holds at the frozen clock", () => {
    const phase = plannedWork(iso(START_MS + 40_000));
    const progress = dialProgress(phase, PARAMS, START_MS + 90_000);
    assert.equal(progress.remaining, 0.6);
  });

  it("decision window: arc tracks the window, clamped at zero", () => {
    const phase: Phase = {
      kind: "decision",
      cycleIndex: 1,
      startedAt: iso(START_MS),
      decisionEndsAt: iso(START_MS + 10_000),
      decisionWindowSec: 10,
    };
    assert.equal(dialProgress(phase, PARAMS, START_MS + 5_000).remaining, 0.5);
    assert.equal(dialProgress(phase, PARAMS, START_MS + 60_000).remaining, 0);
  });

  it("rest: arc tracks the rest duration", () => {
    const phase: Phase = {
      kind: "short_rest",
      cycleIndex: 1,
      startedAt: iso(START_MS),
      plannedDurationSec: 60,
      plannedEndAt: iso(START_MS + 60_000),
    };
    assert.equal(
      dialProgress(phase, PARAMS, START_MS + 45_000).remaining,
      0.25,
    );
  });

  it("overtime: main arc stays full while overtime laps keep counting up", () => {
    const phase: Phase = {
      kind: "extended_work",
      cycleIndex: 1,
      startedAt: iso(START_MS),
    };
    const early = dialProgress(phase, PARAMS, START_MS + 30_000);
    assert.equal(early.remaining, 1);
    assert.equal(early.overtimeLaps, 0.3);
    assert.equal(
      dialProgress(phase, PARAMS, START_MS + 130_000).overtimeLaps,
      1.3,
    );
  });
});

describe("cycleDotStates", () => {
  it("marks earlier cycles done, the current one live, later ones pending", () => {
    assert.deepEqual(cycleDotStates(2, 4), [
      "done",
      "current",
      "pending",
      "pending",
    ]);
  });
});
