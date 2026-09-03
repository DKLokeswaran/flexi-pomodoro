import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import {
  estimatedSessionEndMs,
  nominalSessionDurationSec,
} from "../../../../web/src/utils/sessionProjection.js";
import { SessionService } from "../../services/session.service.js";
import { SettingsService } from "../../services/settings.service.js";

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

  it("estimatedSessionEndMs matches happy-path session end without ack delays", () => {
    const startMs = 1_700_000_000_000;
    const params = {
      workDurationSec: 60,
      shortRestDurationSec: 60,
      longRestDurationSec: 120,
      cyclesBeforeLongRest: 2,
    };
    const projectedEndMs = estimatedSessionEndMs(params, startMs);
    assert.equal(
      projectedEndMs,
      startMs + nominalSessionDurationSec(params) * 1000,
    );
  });

  it("reflects DEFAULT_SETTINGS cycle count", () => {
    const n = DEFAULT_SETTINGS.cyclesBeforeLongRest;
    const expected =
      n * DEFAULT_SETTINGS.workDurationSec +
      (n - 1) * DEFAULT_SETTINGS.shortRestDurationSec +
      DEFAULT_SETTINGS.longRestDurationSec;
    assert.equal(
      nominalSessionDurationSec({
        workDurationSec: DEFAULT_SETTINGS.workDurationSec,
        shortRestDurationSec: DEFAULT_SETTINGS.shortRestDurationSec,
        longRestDurationSec: DEFAULT_SETTINGS.longRestDurationSec,
        cyclesBeforeLongRest: DEFAULT_SETTINGS.cyclesBeforeLongRest,
      }),
      expected,
    );
  });

  it("matches SessionService end when transitions are acknowledged immediately", () => {
    const settings = new SettingsService();
    settings.update({
      workDurationSec: 60,
      shortRestDurationSec: 60,
      longRestDurationSec: 120,
      cyclesBeforeLongRest: 2,
      decisionWindowSec: 15,
    });
    const session = new SessionService();
    const startMs = Date.parse("2026-07-12T10:00:00.000Z");
    const params = settings.resolveSessionParams();
    const projectedEndMs = estimatedSessionEndMs(params, startMs);

    session.start(params, startMs, settings.get().workPauseStrategy);

    const afterWork1 = startMs + 60_000;
    session.ackRest(afterWork1);
    const afterShort = afterWork1 + 60_000;
    session.ackWork(afterShort);
    const afterWork2 = afterShort + 60_000;
    session.ackRest(afterWork2);

    const snapshot = session.getSnapshot(projectedEndMs, 0);
    assert.equal(snapshot.status, "idle");
  });
});
