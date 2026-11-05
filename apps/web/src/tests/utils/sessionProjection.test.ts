import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nominalSessionDurationSec } from "../../utils/sessionProjection";

describe("sessionProjection", () => {
  it("nominalSessionDurationSec sums work, short rests, and long rest", () => {
    assert.equal(
      nominalSessionDurationSec({
        workDurationSec: 60,
        shortRestDurationSec: 60,
        longRestDurationSec: 120,
        cyclesBeforeLongRest: 2,
      }),
      60 * 2 + 60 * 1 + 120,
    );
  });

  it("nominalSessionDurationSec for a single cycle skips short rest", () => {
    assert.equal(
      nominalSessionDurationSec({
        workDurationSec: 60,
        shortRestDurationSec: 60,
        longRestDurationSec: 120,
        cyclesBeforeLongRest: 1,
      }),
      60 + 120,
    );
  });
});
