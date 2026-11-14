import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { IntervalScheduler } from "../../scheduler.js";

describe("IntervalScheduler", () => {
  afterEach(() => {
    mock.timers.reset();
  });

  /** Scheduler on mocked timers that records the clock passed to each tick. */
  function openScheduler(intervalMs = 250) {
    mock.timers.enable({ apis: ["setInterval"] });
    const ticks: number[] = [];
    let clock = 1_000;
    const scheduler = new IntervalScheduler({
      intervalMs,
      onTick: (nowMs) => {
        ticks.push(nowMs);
      },
      now: () => clock,
    });
    return {
      scheduler,
      ticks,
      setClock: (ms: number) => {
        clock = ms;
      },
    };
  }

  it("does not tick before start", () => {
    const { ticks } = openScheduler();
    mock.timers.tick(1_000);
    assert.deepEqual(ticks, []);
  });

  it("ticks once per interval with the current clock", () => {
    const { scheduler, ticks, setClock } = openScheduler();
    scheduler.start();
    mock.timers.tick(249);
    assert.deepEqual(ticks, []);
    mock.timers.tick(1);
    assert.deepEqual(ticks, [1_000]);
    setClock(2_000);
    mock.timers.tick(250);
    assert.deepEqual(ticks, [1_000, 2_000]);
    scheduler.stop();
  });

  it("starting twice does not double the tick rate", () => {
    const { scheduler, ticks } = openScheduler();
    scheduler.start();
    scheduler.start();
    mock.timers.tick(250);
    assert.equal(ticks.length, 1);
    scheduler.stop();
  });

  it("stop ends ticking and start resumes it", () => {
    const { scheduler, ticks } = openScheduler();
    scheduler.start();
    mock.timers.tick(250);
    scheduler.stop();
    mock.timers.tick(1_000);
    assert.equal(ticks.length, 1);
    scheduler.start();
    mock.timers.tick(250);
    assert.equal(ticks.length, 2);
    scheduler.stop();
  });
});
