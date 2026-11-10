import { DateTime } from "luxon";

/**
 * Client-timezone day helpers for analytics (`settings.timezone`).
 * Day windows are half-open `[dayStart, dayEnd)` as UTC instants.
 */

/** `YYYY-MM-DD` for `ms` in the client timezone. */
export function clientDateAt(ms: number, timeZone: string): string {
  const date = DateTime.fromMillis(ms, { zone: timeZone }).toISODate();
  if (!date) {
    throw new Error(`clientDateAt: invalid instant ${ms} in zone ${timeZone}`);
  }
  return date;
}

/** Add calendar days to a `YYYY-MM-DD` client date. */
export function addClientDays(clientDate: string, deltaDays: number): string {
  const date = DateTime.fromISO(clientDate, { zone: "utc" })
    .plus({ days: deltaDays })
    .toISODate();
  if (!date) {
    throw new Error(`addClientDays: invalid client date ${clientDate}`);
  }
  return date;
}

/** Half-open UTC window for one client-timezone calendar day. */
export type ClientDayBounds = {
  dayStart: string;
  dayEnd: string;
  dayStartMs: number;
  dayEndMs: number;
};

/**
 * UTC bounds for one client-timezone calendar day:
 * `[00:00 at clientDate, 00:00 at clientDate+1)`.
 */
export function dayBoundsIso(
  clientDate: string,
  timeZone: string,
): ClientDayBounds {
  const start = DateTime.fromISO(clientDate, { zone: timeZone }).startOf("day");
  if (!start.isValid) {
    throw new Error(
      `dayBoundsIso: invalid client date ${clientDate} in zone ${timeZone}`,
    );
  }
  const end = start.plus({ days: 1 });
  const dayStart = start.toUTC().toISO();
  const dayEnd = end.toUTC().toISO();
  if (!dayStart || !dayEnd) {
    throw new Error(`dayBoundsIso: failed to convert bounds to ISO`);
  }
  return {
    dayStart,
    dayEnd,
    dayStartMs: start.toMillis(),
    dayEndMs: end.toMillis(),
  };
}
