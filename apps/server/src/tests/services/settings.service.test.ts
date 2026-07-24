import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseStartSessionBody,
  parseSettingsPatch,
  DEFAULT_SETTINGS,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import { SettingsError, SettingsService } from "../../services/settings.service.js";

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
  it("rejects hard pause strategy and invalid settings", () => {
    const settings = new SettingsService();
    assert.throws(
      () => settings.update({ workPauseStrategy: "hard" as "soft" }),
      (err: unknown) => {
        assert.ok(err instanceof SettingsError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
    assert.throws(
      () => settings.update({ cyclesBeforeLongRest: 3.5 }),
      (err: unknown) => {
        assert.ok(err instanceof SettingsError);
        return true;
      },
    );
  });

  it("rejects sub-minute work in settings even when short timers are desired", () => {
    const settings = new SettingsService();
    assert.throws(
      () => settings.update({ workDurationSec: 1 }),
      (err: unknown) => {
        assert.ok(err instanceof SettingsError);
        assert.equal(err.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });
});
