import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import {
  SettingsError,
  SettingsService,
} from "../../services/settings.service.js";
import {
  parseSettingsPatch,
  parseStartSessionBody,
} from "../../utils/settingsValidation.js";
import { createMockSettingsStore } from "../helpers/mockSettingsStore.js";

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
  it("accepts hard pause strategy", async () => {
    const store = createMockSettingsStore();
    const settings = new SettingsService(store);
    await settings.hydrate();
    const next = await settings.update({ workPauseStrategy: "hard" });
    assert.equal(next.workPauseStrategy, "hard");
    assert.equal(store.saved.at(-1)?.workPauseStrategy, "hard");
  });

  it("rejects invalid settings without calling save", async () => {
    const store = createMockSettingsStore();
    const settings = new SettingsService(store);
    await settings.hydrate();
    const savesBefore = store.saved.length;
    await assert.rejects(
      () => settings.update({ cyclesBeforeLongRest: 3.5 }),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        return true;
      },
    );
    assert.equal(store.saved.length, savesBefore);
  });

  it("rejects sub-minute work in settings even when short timers are desired", async () => {
    const store = createMockSettingsStore();
    const settings = new SettingsService(store);
    await settings.hydrate();
    await assert.rejects(
      () => settings.update({ workDurationSec: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        assert.equal(error.code, "INVALID_SETTINGS");
        return true;
      },
    );
  });

  it("hydrate loads seeded defaults from the store", async () => {
    const store = createMockSettingsStore(null);
    const settings = new SettingsService(store);
    await settings.hydrate();
    assert.equal(store.ensureSeededCalls, 1);
    assert.deepEqual(settings.get(), DEFAULT_SETTINGS);
  });

  it("hydrate restores previously saved settings from the store", async () => {
    const store = createMockSettingsStore({
      ...DEFAULT_SETTINGS,
      workDurationSec: 30 * 60,
      workPauseStrategy: "hard",
      alertsMuted: true,
      cyclesBeforeLongRest: 2,
    });
    const settings = new SettingsService(store);
    await settings.hydrate();
    assert.equal(settings.get().workDurationSec, 30 * 60);
    assert.equal(settings.get().workPauseStrategy, "hard");
    assert.equal(settings.get().alertsMuted, true);
    assert.equal(settings.get().cyclesBeforeLongRest, 2);
  });

  it("update persists the merged settings through the store", async () => {
    const store = createMockSettingsStore(null);
    const settings = new SettingsService(store);
    await settings.hydrate();
    await settings.update({
      workDurationSec: 30 * 60,
      workPauseStrategy: "hard",
      alertsMuted: true,
      cyclesBeforeLongRest: 2,
    });
    assert.equal(store.saved.length, 2); // seed + update
    assert.deepEqual(store.saved.at(-1), {
      ...DEFAULT_SETTINGS,
      workDurationSec: 30 * 60,
      workPauseStrategy: "hard",
      alertsMuted: true,
      cyclesBeforeLongRest: 2,
    });
  });
});
