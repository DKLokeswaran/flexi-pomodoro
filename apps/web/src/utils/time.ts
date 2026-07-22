export function formatMmSs(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const sec = Math.abs(Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function secFromIso(iso: string, nowMs: number): number {
  return Math.floor((Date.parse(iso) - nowMs) / 1000);
}

export function elapsedFromIso(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
}

export function minutesToSec(minutes: number): number {
  return Math.round(minutes * 60);
}

export function secToMinutes(sec: number): number {
  return Math.round(sec / 60);
}
