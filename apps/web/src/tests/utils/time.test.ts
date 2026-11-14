import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  elapsedFromIso,
  formatHhMmSs,
  formatMmSs,
  minutesToSec,
  remainingSecFromIso,
  secFromIso,
  secToMinutes,
} from "../../utils/time";

const AT = "2026-07-12T10:00:00.000Z";
const AT_MS = Date.parse(AT);

describe("time formatting", () => {
  it("formatMmSs pads and keeps minutes past one hour", () => {
    assert.equal(formatMmSs(0), "00:00");
    assert.equal(formatMmSs(75), "01:15");
    assert.equal(formatMmSs(1500), "25:00");
    assert.equal(formatMmSs(3661), "61:01");
    assert.equal(formatMmSs(59.9), "00:59");
  });

  it("formatHhMmSs switches to hh:mm:ss from one hour", () => {
    assert.equal(formatHhMmSs(75), "01:15");
    assert.equal(formatHhMmSs(3599), "59:59");
    assert.equal(formatHhMmSs(3600), "01:00:00");
    assert.equal(formatHhMmSs(3661), "01:01:01");
  });
});

describe("time arithmetic", () => {
  it("secFromIso counts whole seconds to the deadline and goes negative after it", () => {
    assert.equal(secFromIso(AT, AT_MS - 90_000), 90);
    assert.equal(secFromIso(AT, AT_MS - 1_500), 1);
    assert.equal(secFromIso(AT, AT_MS + 2_000), -2);
  });

  it("remainingSecFromIso never goes below zero", () => {
    assert.equal(remainingSecFromIso(AT, AT_MS - 90_000), 90);
    assert.equal(remainingSecFromIso(AT, AT_MS + 2_000), 0);
  });

  it("elapsedFromIso counts whole seconds since the start, floored at zero", () => {
    assert.equal(elapsedFromIso(AT, AT_MS + 12_900), 12);
    assert.equal(elapsedFromIso(AT, AT_MS - 5_000), 0);
  });

  it("converts between minutes and seconds", () => {
    assert.equal(minutesToSec(25), 1500);
    assert.equal(secToMinutes(1500), 25);
    assert.equal(secToMinutes(89), 1);
  });
});
