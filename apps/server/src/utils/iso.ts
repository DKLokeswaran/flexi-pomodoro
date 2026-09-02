/** Convert a millisecond timestamp to an ISO-8601 string. */
export function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Parse an ISO-8601 timestamp to milliseconds since epoch. */
export function parseIso(value: string): number {
  return Date.parse(value);
}

/** Whole seconds elapsed from an ISO start timestamp to nowMs. */
export function elapsedSecFromIso(startedAt: string, nowMs: number): number {
  return Math.floor((nowMs - parseIso(startedAt)) / 1000);
}
