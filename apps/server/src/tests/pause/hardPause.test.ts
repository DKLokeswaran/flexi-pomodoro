import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlannedWorkPhase } from "@flexi-pomodoro/shared";
import { hardPauseStrategy } from "../../pause/hardPause.js";
import { msToIso, parseIso } from "../../utils/iso.js";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");

/** Fresh planned-work phase starting at START_MS for 25s. */
function plannedWork(): PlannedWorkPhase {
  return {
    kind: "planned_work",
    cycleIndex: 1,
    startedAt: msToIso(START_MS),
    plannedDurationSec: 25,
    plannedEndAt: msToIso(START_MS + 25_000),
    paused: false,
    pausedSec: 0,
    pauseStartedAt: null,
    timerFrozenAt: null,
  };
}

/** Whole seconds left until plannedEndAt at nowMs. */
function remainingSec(phase: PlannedWorkPhase, nowMs: number): number {
  return Math.max(0, Math.floor((parseIso(phase.plannedEndAt) - nowMs) / 1000));
}

describe("hardPauseStrategy", () => {
  it("onPause freezes the countdown at pause start", () => {
    const phase = plannedWork();
    hardPauseStrategy.onPause(phase, START_MS + 15_000);
    assert.equal(phase.paused, true);
    assert.equal(phase.pauseStartedAt, msToIso(START_MS + 15_000));
    assert.equal(phase.timerFrozenAt, msToIso(START_MS + 15_000));
    assert.equal(hardPauseStrategy.isCountdownFrozen(phase), true);
  });

  it("onResume keeps remaining time and shifts plannedEndAt by paused duration", () => {
    const phase = plannedWork();
    const pauseAt = START_MS + 15_000;
    const resumeAt = pauseAt + 3_000;
    assert.equal(remainingSec(phase, pauseAt), 10);
    hardPauseStrategy.onPause(phase, pauseAt);
    hardPauseStrategy.onResume(phase, resumeAt);
    assert.equal(phase.paused, false);
    assert.equal(phase.timerFrozenAt, null);
    assert.equal(phase.pausedSec, 3);
    assert.equal(phase.plannedEndAt, msToIso(START_MS + 28_000));
    assert.equal(remainingSec(phase, resumeAt), 10);
    assert.equal(hardPauseStrategy.isCountdownFrozen(phase), false);
  });

  it("onPlannedEnd when unfrozen → decision", () => {
    const phase = plannedWork();
    const plannedEndMs = parseIso(phase.plannedEndAt);
    assert.equal(
      hardPauseStrategy.onPlannedEnd(phase, plannedEndMs),
      "decision",
    );
  });
});
