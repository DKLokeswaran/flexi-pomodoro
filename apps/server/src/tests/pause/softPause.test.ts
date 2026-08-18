import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlannedWorkPhase } from "@flexi-pomodoro/shared";
import { softPauseStrategy } from "../../pause/softPause.js";
import { msToIso, parseIso } from "../../utils/iso.js";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");

/** Fresh planned-work phase starting at START_MS for 60s. */
function plannedWork(): PlannedWorkPhase {
  return {
    kind: "planned_work",
    cycleIndex: 1,
    startedAt: msToIso(START_MS),
    plannedDurationSec: 60,
    plannedEndAt: msToIso(START_MS + 60_000),
    paused: false,
    pausedSec: 0,
    pauseStartedAt: null,
    timerFrozenAt: null,
  };
}

describe("softPauseStrategy", () => {
  it("onPause sets flags without freezing or moving planned end", () => {
    const phase = plannedWork();
    const plannedEndAt = phase.plannedEndAt;
    softPauseStrategy.onPause(phase, START_MS + 20_000);
    assert.equal(phase.paused, true);
    assert.equal(phase.pauseStartedAt, msToIso(START_MS + 20_000));
    assert.equal(phase.timerFrozenAt, null);
    assert.equal(phase.plannedEndAt, plannedEndAt);
    assert.equal(softPauseStrategy.isCountdownFrozen(phase), false);
  });

  it("onResume accumulates pausedSec; planned end unchanged", () => {
    const phase = plannedWork();
    const plannedEndAt = phase.plannedEndAt;
    softPauseStrategy.onPause(phase, START_MS + 20_000);
    softPauseStrategy.onResume(phase, START_MS + 30_000);
    assert.equal(phase.paused, false);
    assert.equal(phase.pauseStartedAt, null);
    assert.equal(phase.pausedSec, 10);
    assert.equal(phase.plannedEndAt, plannedEndAt);
  });

  it("onPlannedEnd while paused → rest and close slice through planned end", () => {
    const phase = plannedWork();
    softPauseStrategy.onPause(phase, START_MS + 40_000);
    const plannedEndMs = parseIso(phase.plannedEndAt);
    assert.equal(softPauseStrategy.onPlannedEnd(phase, plannedEndMs), "rest");
    assert.equal(phase.paused, false);
    assert.equal(phase.pausedSec, 20);
  });

  it("onPlannedEnd while running → decision", () => {
    const phase = plannedWork();
    const plannedEndMs = parseIso(phase.plannedEndAt);
    assert.equal(
      softPauseStrategy.onPlannedEnd(phase, plannedEndMs),
      "decision",
    );
    assert.equal(phase.paused, false);
    assert.equal(phase.pausedSec, 0);
  });
});
