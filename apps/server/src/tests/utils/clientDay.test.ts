import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overlapSecFromIso } from "@flexi-pomodoro/shared";
import {
  addClientDays,
  clientDateAt,
  dayBoundsIso,
} from "../../utils/clientDay.js";

describe("clientDay", () => {
  it("formats Asia/Kolkata dates around IST midnight", () => {
    assert.equal(
      clientDateAt(Date.parse("2026-11-08T18:29:59.000Z"), "Asia/Kolkata"),
      "2026-11-08",
    );
    assert.equal(
      clientDateAt(Date.parse("2026-11-08T18:30:00.000Z"), "Asia/Kolkata"),
      "2026-11-09",
    );
  });

  it("dayBoundsIso for Asia/Kolkata is half-open at IST midnight", () => {
    const bounds = dayBoundsIso("2026-11-09", "Asia/Kolkata");
    assert.equal(bounds.dayStart, "2026-11-08T18:30:00.000Z");
    assert.equal(bounds.dayEnd, "2026-11-09T18:30:00.000Z");
  });

  it("addClientDays rolls calendar months", () => {
    assert.equal(addClientDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addClientDays("2026-11-09", -1), "2026-11-08");
  });

  it("overlapSecFromIso clips to the window", () => {
    const dayStart = Date.parse("2026-11-08T18:30:00.000Z");
    const dayEnd = Date.parse("2026-11-09T18:30:00.000Z");
    assert.equal(
      overlapSecFromIso(
        "2026-11-08T18:00:00.000Z",
        "2026-11-08T19:00:00.000Z",
        dayStart,
        dayEnd,
      ),
      30 * 60,
    );
    assert.equal(
      overlapSecFromIso(
        "2026-11-09T10:00:00.000Z",
        "2026-11-09T10:00:10.000Z",
        dayStart,
        dayEnd,
      ),
      10,
    );
    assert.equal(
      overlapSecFromIso(
        "2026-11-07T00:00:00.000Z",
        "2026-11-08T00:00:00.000Z",
        dayStart,
        dayEnd,
      ),
      0,
    );
  });

  it("dayBoundsIso spans 23 hours when clocks go forward (America/New_York)", () => {
    const bounds = dayBoundsIso("2026-03-08", "America/New_York");
    assert.equal(bounds.dayStart, "2026-03-08T05:00:00.000Z");
    assert.equal(bounds.dayEnd, "2026-03-09T04:00:00.000Z");
    assert.equal(bounds.dayEndMs - bounds.dayStartMs, 23 * 3600_000);
  });

  it("dayBoundsIso spans 25 hours when clocks go back (America/New_York)", () => {
    const bounds = dayBoundsIso("2026-11-01", "America/New_York");
    assert.equal(bounds.dayStart, "2026-11-01T04:00:00.000Z");
    assert.equal(bounds.dayEnd, "2026-11-02T05:00:00.000Z");
    assert.equal(bounds.dayEndMs - bounds.dayStartMs, 25 * 3600_000);
  });

  it("clock-change days meet their neighbours with no gap or overlap", () => {
    const zone = "America/New_York";
    for (const clientDate of ["2026-03-08", "2026-11-01"]) {
      const day = dayBoundsIso(clientDate, zone);
      const next = dayBoundsIso(addClientDays(clientDate, 1), zone);
      assert.equal(day.dayEnd, next.dayStart);
      assert.equal(clientDateAt(day.dayEndMs - 1, zone), clientDate);
      assert.equal(
        clientDateAt(day.dayEndMs, zone),
        addClientDays(clientDate, 1),
      );
    }
  });
});
