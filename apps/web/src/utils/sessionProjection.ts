/** Timing fields that determine nominal session length (excludes decision windows). */
export type SessionDurationParams = {
  workDurationSec: number;
  shortRestDurationSec: number;
  longRestDurationSec: number;
  cyclesBeforeLongRest: number;
};

/**
 * Planned session length assuming immediate acks, no pauses, and no extended work.
 * Matches wall-clock duration when the happy path runs without user delay.
 */
export function nominalSessionDurationSec(
  params: SessionDurationParams,
): number {
  const cycles = params.cyclesBeforeLongRest;
  return (
    cycles * params.workDurationSec +
    (cycles - 1) * params.shortRestDurationSec +
    params.longRestDurationSec
  );
}

/** Wall-clock ms when a session started at startMs would end on the nominal path. */
export function estimatedSessionEndMs(
  params: SessionDurationParams,
  startMs: number,
): number {
  return startMs + nominalSessionDurationSec(params) * 1000;
}
