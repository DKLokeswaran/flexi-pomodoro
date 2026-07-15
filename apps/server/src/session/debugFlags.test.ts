import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseStartSessionBody,
  parseSettingsPatch,
  DEFAULT_SETTINGS,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";

describe("parseStartSessionBody", () => {
  it("accepts 1s overrides when shortDurations is set", () => {
    const { debug, overrides } = parseStartSessionBody({
      debug: { shortDurations: true },
      workDurationSec: 1,
      shortRestDurationSec: 1,
      longRestDurationSec: 1,
      decisionWindowSec: 1,
    });
    assert.deepEqual(debug, { shortDurations: true });
    assert.equal(overrides.workDurationSec, 1);
    assert.equal(overrides.decisionWindowSec, 1);
  });

  it("rejects 1s overrides without the flag", () => {
    assert.throws(
      () =>
        parseStartSessionBody({
          workDurationSec: 1,
        }),
      ZodError,
    );
  });

  it("rejects unknown debug keys", () => {
    assert.throws(
      () =>
        parseStartSessionBody({
          debug: { shortDurations: true, timeTravel: true },
        }),
      ZodError,
    );
  });
});

describe("parseSettingsPatch", () => {
  it("rejects sub-minute work duration", () => {
    assert.throws(
      () => parseSettingsPatch(DEFAULT_SETTINGS, { workDurationSec: 1 }),
      ZodError,
    );
  });
});
