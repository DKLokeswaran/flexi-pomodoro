import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClientDays,
  clientDateAt,
  dayBoundsIso,
  overlapSec,
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

  it("overlapSec clips to the window", () => {
    const dayStart = Date.parse("2026-11-08T18:30:00.000Z");
    const dayEnd = Date.parse("2026-11-09T18:30:00.000Z");
    assert.equal(
      overlapSec(
        "2026-11-08T18:00:00.000Z",
        "2026-11-08T19:00:00.000Z",
        dayStart,
        dayEnd,
      ),
      30 * 60,
    );
    assert.equal(
      overlapSec(
        "2026-11-09T10:00:00.000Z",
        "2026-11-09T10:00:10.000Z",
        dayStart,
        dayEnd,
      ),
      10,
    );
    assert.equal(
      overlapSec(
        "2026-11-07T00:00:00.000Z",
        "2026-11-08T00:00:00.000Z",
        dayStart,
        dayEnd,
      ),
      0,
    );
  });
});
