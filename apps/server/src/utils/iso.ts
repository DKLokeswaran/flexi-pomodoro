/** Convert a millisecond timestamp to an ISO-8601 string. */
export function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Parse an ISO-8601 timestamp to milliseconds since epoch. */
export function parseIso(value: string): number {
  return Date.parse(value);
}
