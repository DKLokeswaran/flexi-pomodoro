import type { AlertEvent, AlertId, SessionSnapshot } from "@flexi-pomodoro/shared";
import { alertSeqStore } from "./alertSeqStore";

const ALERT_FILES: Record<AlertId, string> = {
  work_planned_end: "/alerts/placeholder-work_planned_end.wav",
  rest_ack: "/alerts/placeholder-rest_ack.wav",
  short_rest_start: "/alerts/placeholder-short_rest_start.wav",
  long_rest_start: "/alerts/placeholder-long_rest_start.wav",
  short_rest_end: "/alerts/placeholder-short_rest_end.wav",
  long_rest_end: "/alerts/placeholder-long_rest_end.wav",
  extended_work_auto_start: "/alerts/placeholder-extended_work_auto_start.wav",
};

/**
 * Play new alert deltas. Autoplay may fail without a recent user gesture;
 * failures are ignored — visual state remains correct.
 */
export function playAlerts(events: AlertEvent[]): void {
  if (events.length === 0) return;
  const last = alertSeqStore.get();
  const fresh = events.filter((e) => e.seq > last);
  if (fresh.length === 0) return;
  alertSeqStore.advance(Math.max(...fresh.map((e) => e.seq)));
  for (const event of fresh) {
    const src = ALERT_FILES[event.id];
    if (!src) continue;
    const audio = new Audio(src);
    void audio.play().catch(() => {
      // Autoplay blocked — visual state is enough.
    });
  }
}

export function alertsFromSnapshot(snapshot: SessionSnapshot): AlertEvent[] {
  if (snapshot.status === "idle") return snapshot.pendingAlerts;
  return snapshot.session.pendingAlerts;
}
