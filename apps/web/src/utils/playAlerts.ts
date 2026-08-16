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
  const lastPlayedSeq = alertSeqStore.get();
  const unplayedEvents = events.filter(
    (alertEvent) => alertEvent.seq > lastPlayedSeq,
  );
  if (unplayedEvents.length === 0) return;
  alertSeqStore.advance(Math.max(...unplayedEvents.map((alertEvent) => alertEvent.seq)));
  for (const alertEvent of unplayedEvents) {
    const src = ALERT_FILES[alertEvent.id];
    if (!src) continue;
    const audio = new Audio(src);
    void audio.play().catch(() => {
      // Autoplay blocked — visual state is enough.
    });
  }
}

/** Pending alerts live on the snapshot when idle, else on the nested session. */
export function alertsFromSnapshot(snapshot: SessionSnapshot): AlertEvent[] {
  if (snapshot.status === "idle") return snapshot.pendingAlerts;
  return snapshot.session.pendingAlerts;
}
