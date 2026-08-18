import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseStartSessionBody,
  parseSettingsPatch,
  DEFAULT_SETTINGS,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import {
  SettingsError,
  SettingsService,
} from "../../services/settings.service.js";

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

describe("SettingsService", () => {
  it("accepts hard pause strategy", () => {
    const settings = new SettingsService();
    const next = settings.update({ workPauseStrategy: "hard" });
    assert.equal(next.workPauseStrategy, "hard");
  });

  it("rejects invalid settings", () => {
    const settings = new SettingsService();
    assert.throws(
      () => settings.update({ cyclesBeforeLongRest: 3.5 }),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        return true;
      },
    );
  });

  it("rejects sub-minute work in settings even when short timers are desired", () => {
    const settings = new SettingsService();
    assert.throws(
      () => settings.update({ workDurationSec: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        assert.equal(error.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });
});
